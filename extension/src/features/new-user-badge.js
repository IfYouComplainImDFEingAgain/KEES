// features/new-user-badge.js - Flag chat messages posted by recently-joined accounts.
//
// Chat messages carry no join date, so the date is scraped once per user from
// /members/<name>.<id> (the "Joined" pair in .memberHeader-blurb) and cached in
// chrome.storage.local under kees-joined-<userId>. A join date never changes, so
// a hit is cached forever and the "is this account new?" test is re-evaluated
// against the cached date at render time — no TTL, no re-fetching.
//
// Lookups are serialised through a delayed queue: one member page at a time, so
// a busy room can't turn into a request flood.
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;

    const JOIN_PREFIX = 'kees-joined-';        // kees-joined-<userId> -> { joined, username, fetched, miss }
    const ENABLED_KEY = 'kees-new-user-badge';
    const DAYS_KEY = 'kees-new-user-days';

    const DEFAULT_DAYS = 30;
    const DAY_MS = 86400000;
    const FETCH_DELAY = 600;                   // between member-page fetches
    const BLOCKED_BACKOFF = 60000;             // pause after an anti-bot challenge
    const BLOCKED_ATTEMPTS = 3;                // retries before a challenge counts as a miss
    const MISS_RETRY_MS = 6 * 3600 * 1000;     // re-try a failed lookup after 6h
    const MAX_QUEUE = 200;                     // cap pending lookups in a busy room

    const MARK_ATTR = 'data-kees-nu';          // '<id>' once resolved, 'p<id>' while pending
    const BADGE_CLASS = 'kees-new-user';

    const STYLES = `
        .${BADGE_CLASS} {
            display: inline-block;
            margin: 0 4px;
            padding: 0 4px;
            border-radius: 3px;
            background: #c77b17;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            line-height: 15px;
            vertical-align: middle;
            letter-spacing: 0.3px;
            cursor: help;
        }
    `;

    let enabled = true;
    let newDays = DEFAULT_DAYS;

    // userId -> { joined, username, fetched, miss } | null while a lookup is running
    const known = new Map();
    // userIds waiting on a member-page fetch, plus the docs to repaint afterwards
    const queue = [];
    const queued = new Set();
    const docs = new Set();
    let draining = false;

    // ---------- storage ----------

    function joinKey(userId) {
        return JOIN_PREFIX + userId;
    }

    function readCached(userId) {
        return new Promise((resolve) => {
            chrome.storage.local.get([joinKey(userId)], (r) => resolve(r[joinKey(userId)] || null));
        });
    }

    function writeCached(userId, record) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [joinKey(userId)]: record }, () => resolve(!chrome.runtime.lastError));
        });
    }

    // A cached miss is only honoured for MISS_RETRY_MS; hits are permanent.
    function isUsable(record) {
        if (!record) return false;
        if (!record.miss) return true;
        return (Date.now() - (record.fetched || 0)) < MISS_RETRY_MS;
    }

    // ---------- identifying the poster ----------

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    // Sneedchat stamps the numeric author id on the message element; the member
    // link and the avatar filename are fallbacks in case the template changes.
    //
    // Anything inside .message is post *content* — a member link someone pasted
    // there belongs to a third party, so those nodes are never used to identify
    // the poster.
    function identify(msgEl) {
        if (!msgEl.querySelector) return null;

        const byData = msgEl.dataset && msgEl.dataset.author;
        let userId = byData && /^\d+$/.test(byData) ? byData : null;
        let href = null;

        for (const a of msgEl.querySelectorAll('a[href*="/members/"]')) {
            if (a.closest('.message')) continue;
            href = a.getAttribute('href');
            if (!userId) userId = parseUserFromHref(href);
            break;
        }

        if (!userId) {
            for (const img of msgEl.querySelectorAll('img[src*="/data/avatars/"]')) {
                if (img.closest('.message')) continue;
                const m = img.getAttribute('src').match(/\/(\d+)\.[a-z]+(?:\?|$)/i);
                if (m) userId = m[1];
                break;
            }
        }

        if (!userId || userId === '0') return null;
        return { userId, href, username: SNEED.util.getMessageAuthor(msgEl) };
    }

    // ---------- member page scraping ----------

    function isChallenge(doc) {
        const root = doc.documentElement;
        return root.hasAttribute('data-sssg-challenge') || root.hasAttribute('data-ttrs-challenge');
    }

    // Read the "Joined" pair out of a member page. Several pairs (Joined, Last
    // seen, Messages, ...) share the same markup, so match on the <dt> label
    // rather than grabbing the first <time> in the header.
    function parseJoinDate(doc) {
        const lists = doc.querySelectorAll('.memberHeader-blurb dl.pairs, dl.pairs');
        for (const dl of lists) {
            const dt = dl.querySelector('dt');
            if (!dt || !/^joined\b/i.test(dt.textContent.trim())) continue;

            const time = dl.querySelector('dd time[data-timestamp], dd time[datetime]');
            if (!time) continue;

            const secs = parseInt(time.getAttribute('data-timestamp'), 10);
            if (!isNaN(secs) && secs > 0) return secs;

            const iso = Date.parse(time.getAttribute('datetime'));
            if (!isNaN(iso)) return Math.floor(iso / 1000);
        }
        return null;
    }

    function memberUrl(userId, href) {
        if (href) return href.startsWith('http') ? href : window.location.origin + href;
        return window.location.origin + '/members/' + userId + '/';
    }

    // Returns { joined } on success, { blocked: true } if the anti-bot gate fired,
    // or null when the page had no usable join date.
    async function fetchJoinDate(userId, href) {
        try {
            const res = await fetch(memberUrl(userId, href), {
                credentials: 'same-origin',
                headers: { 'Accept': 'text/html' }
            });
            if (!res.ok) return null;

            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            if (isChallenge(doc)) return { blocked: true };

            const joined = parseJoinDate(doc);
            return joined ? { joined } : null;
        } catch (e) {
            log.warn('Join-date lookup failed for user', userId, e);
            return null;
        }
    }

    // ---------- lookup queue ----------

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function enqueue(userId, href, username) {
        if (queued.has(userId) || known.has(userId)) return;
        if (queue.length >= MAX_QUEUE) return;
        queued.add(userId);
        queue.push({ userId, href, username });
        drain();
    }

    async function drain() {
        if (draining) return;
        draining = true;

        while (queue.length) {
            const job = queue.shift();
            queued.delete(job.userId);

            const cached = await readCached(job.userId);
            if (isUsable(cached)) {
                known.set(job.userId, cached);
                resolvePending(job.userId);
                continue;
            }

            await delay(FETCH_DELAY);
            const result = await fetchJoinDate(job.userId, job.href);

            if (result && result.blocked) {
                // Put it back and wait — hammering a challenge page helps nobody.
                // After BLOCKED_ATTEMPTS tries it falls through to a normal miss,
                // so a persistent challenge can't spin this loop forever.
                job.blocked = (job.blocked || 0) + 1;
                if (job.blocked < BLOCKED_ATTEMPTS && !queued.has(job.userId) && queue.length < MAX_QUEUE) {
                    queued.add(job.userId);
                    queue.push(job);
                    await delay(BLOCKED_BACKOFF);
                    continue;
                }
                await delay(BLOCKED_BACKOFF);
            }

            // A join date is permanent; anything else (404, parse failure, an
            // exhausted challenge) is a miss and gets re-tried after MISS_RETRY_MS.
            const record = (result && result.joined)
                ? { joined: result.joined, username: job.username || '', fetched: Date.now() }
                : { miss: true, username: job.username || '', fetched: Date.now() };

            known.set(job.userId, record);
            await writeCached(job.userId, record);
            resolvePending(job.userId);
        }

        draining = false;
    }

    // ---------- rendering ----------

    function ageDays(record) {
        if (!record || record.miss || !record.joined) return null;
        return Math.floor((Date.now() - record.joined * 1000) / DAY_MS);
    }

    function injectStyles(doc) {
        if (doc.getElementById('kees-new-user-styles')) return;
        const style = doc.createElement('style');
        style.id = 'kees-new-user-styles';
        style.textContent = STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    function buildBadge(doc, record) {
        const days = ageDays(record);
        if (days === null || days >= newDays) return null;

        const badge = doc.createElement('span');
        badge.className = BADGE_CLASS;
        badge.textContent = days < 1 ? 'NEW' : 'NEW·' + days + 'd';
        badge.title = 'Joined ' + new Date(record.joined * 1000).toLocaleDateString() +
            (days < 1 ? ' (today)' : ' (' + days + ' day' + (days === 1 ? '' : 's') + ' ago)');
        return badge;
    }

    function paint(msgEl, record) {
        const existing = msgEl.querySelector('.' + BADGE_CLASS);
        if (existing) existing.remove();

        const badge = enabled ? buildBadge(msgEl.ownerDocument, record) : null;
        if (!badge) return;

        const author = msgEl.querySelector('.author');
        if (author) {
            author.insertAdjacentElement('afterend', badge);
        } else {
            msgEl.insertBefore(badge, msgEl.firstChild);
        }
    }

    // Paint every message that was waiting on this user's lookup. Chat documents
    // die when the iframe reloads, so drop detached ones as we go.
    function resolvePending(userId) {
        const record = known.get(userId);
        for (const doc of docs) {
            if (!doc.defaultView) {
                docs.delete(doc);
                continue;
            }
            const pending = doc.querySelectorAll('.chat-message[' + MARK_ATTR + '="p' + userId + '"]');
            for (const msgEl of pending) {
                msgEl.setAttribute(MARK_ATTR, userId);
                paint(msgEl, record);
            }
        }
    }

    function decorate(msgEl) {
        // While disabled, don't even identify posters — no lookups, no fetches.
        if (!enabled) return;
        if (!msgEl.classList || !msgEl.classList.contains('chat-message')) return;
        if (msgEl.hasAttribute(MARK_ATTR)) return;

        const who = identify(msgEl);
        if (!who) return;

        const record = known.get(who.userId);
        if (record) {
            msgEl.setAttribute(MARK_ATTR, who.userId);
            paint(msgEl, record);
            return;
        }

        msgEl.setAttribute(MARK_ATTR, 'p' + who.userId);
        enqueue(who.userId, who.href, who.username);
    }

    function rescan(doc) {
        const container = doc.getElementById('chat-messages') || SNEED.util.findMessageContainer(doc);
        if (!container) return;
        for (const msgEl of container.querySelectorAll('.chat-message')) {
            decorate(msgEl);
        }
    }

    // Settings changed: drop every badge and mark, then re-decorate from cache.
    function repaintAll() {
        for (const doc of docs) {
            for (const badge of doc.querySelectorAll('.' + BADGE_CLASS)) badge.remove();
            for (const msgEl of doc.querySelectorAll('.chat-message[' + MARK_ATTR + ']')) {
                if (!msgEl.getAttribute(MARK_ATTR).startsWith('p')) msgEl.removeAttribute(MARK_ATTR);
            }
            rescan(doc);
        }
    }

    // ---------- lifecycle ----------

    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([ENABLED_KEY, DAYS_KEY], (result) => {
                enabled = result[ENABLED_KEY] !== false;
                const days = parseInt(result[DAYS_KEY], 10);
                newDays = (!isNaN(days) && days > 0) ? Math.min(365, days) : DEFAULT_DAYS;
                resolve();
            });
        });
    }

    let storageHooked = false;

    function hookStorage() {
        if (storageHooked) return;
        storageHooked = true;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;

            if (changes[ENABLED_KEY] || changes[DAYS_KEY]) {
                loadSettings().then(repaintAll);
            }

            // Another tab resolved a user we're still waiting on.
            for (const key of Object.keys(changes)) {
                if (!key.startsWith(JOIN_PREFIX)) continue;
                const userId = key.slice(JOIN_PREFIX.length);
                const record = changes[key].newValue;
                if (!isUsable(record) || known.has(userId)) continue;
                known.set(userId, record);
                resolvePending(userId);
            }
        });
    }

    async function start(doc) {
        if (doc.__kees_newUserBadge) return;
        doc.__kees_newUserBadge = true;

        docs.add(doc);
        injectStyles(doc);
        await loadSettings();
        hookStorage();

        rescan(doc);

        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) decorate(node);
        });

        log.info('New-user badge started (threshold ' + newDays + ' days)');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.newUserBadge = { start };

})();
