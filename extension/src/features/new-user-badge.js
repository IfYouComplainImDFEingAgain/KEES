// features/new-user-badge.js - Flag recently-joined accounts in chat messages
// and in the online-users column.
//
// Chat messages carry no join date, so the date is scraped once per user from
// /members/<name>.<id> (the "Joined" pair in .memberHeader-blurb) and cached in
// chrome.storage.local under kees-joined-<userId>. A join date never changes, so
// a hit is cached forever and the "is this account new?" test is re-evaluated
// against the cached date at render time — no TTL, no re-fetching.
//
// Lookups are serialised through a delayed queue: one member page at a time, so
// a busy room can't turn into a request flood. The online column adds a second
// pressure valve — a room with 300 people in it would otherwise queue 300 member
// pages the moment it loads, which is exactly the traffic shape the anti-bot gate
// watches for. So column entries only cost a lookup once they scroll into view,
// and they queue behind message lookups, which are what the user is reading.
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
        .activity > .${BADGE_CLASS} {
            margin: 0 0 0 4px;
            padding: 0 3px;
            font-size: 9px;
            line-height: 13px;
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
    // doc -> IntersectionObserver that holds unresolved online-column entries
    // until they scroll into view
    const visibility = new WeakMap();
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

        // The meta row's author span carries the poster's id directly.
        if (!userId) {
            const authorEl = msgEl.querySelector('.author[data-id]');
            const byAuthor = authorEl && authorEl.getAttribute('data-id');
            if (byAuthor && /^\d+$/.test(byAuthor)) userId = byAuthor;
        }

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

    // Online-column entries are much simpler than messages: the row id carries
    // the numeric user id (<div class="activity" id="chat-activity-162123">),
    // with the avatar filename as a fallback. The name link usually has no href,
    // so lookups fall back to /members/<id>/.
    function identifyActivity(el) {
        if (!el.querySelector) return null;

        const m = /^chat-activity-(\d+)$/.exec(el.id || '');
        let userId = m ? m[1] : null;

        if (!userId) {
            const img = el.querySelector('img[src*="/data/avatars/"]');
            const src = img && img.getAttribute('src');
            const byAvatar = src && src.match(/\/(\d+)\.[a-z]+(?:\?|$)/i);
            if (byAvatar) userId = byAvatar[1];
        }

        if (!userId || userId === '0') return null;

        const link = el.querySelector('a.user[href], a[href*="/members/"]');
        return {
            userId,
            href: link ? link.getAttribute('href') : null,
            username: (el.dataset && el.dataset.username) || ''
        };
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

    // Priority jobs stay a prefix of the queue; column jobs sit behind them.
    function insertJob(job) {
        const at = job.priority ? queue.findIndex(j => !j.priority) : -1;
        if (at === -1) queue.push(job); else queue.splice(at, 0, job);
    }

    // priority: a poster the user is reading right now. Those jump ahead of the
    // online-column backlog, which is bulk work nobody is waiting on.
    function enqueue(userId, href, username, priority) {
        if (queued.has(userId) || known.has(userId)) return;

        if (queue.length >= MAX_QUEUE) {
            // A full queue is column backlog most of the time, and that backlog
            // all sits at the tail. Rather than drop a poster the user is
            // reading, bump the last column job for them.
            const last = queue.length - 1;
            if (!priority || last < 0 || queue[last].priority) return;
            queued.delete(queue[last].userId);
            queue.pop();
        }

        queued.add(userId);
        insertJob({ userId, href, username, priority: !!priority });
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
                    insertJob(job);
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

    function paint(el, record) {
        const existing = el.querySelector('.' + BADGE_CLASS);
        if (existing) existing.remove();

        const badge = enabled ? buildBadge(el.ownerDocument, record) : null;
        if (!badge) return;

        const isActivity = el.classList.contains('activity');
        const anchor = isActivity ? el.querySelector('a.user') : el.querySelector('.author');

        if (anchor) {
            anchor.insertAdjacentElement('afterend', badge);
        } else if (isActivity) {
            el.appendChild(badge);
        } else {
            el.insertBefore(badge, el.firstChild);
        }
    }

    // Paint every message and column entry that was waiting on this user's
    // lookup. Chat documents die when the iframe reloads, so drop detached ones
    // as we go.
    function resolvePending(userId) {
        const record = known.get(userId);
        const selector = '.chat-message[' + MARK_ATTR + '="p' + userId + '"], ' +
                         '.activity[' + MARK_ATTR + '="p' + userId + '"]';

        for (const doc of docs) {
            if (!doc.defaultView) {
                docs.delete(doc);
                continue;
            }
            for (const el of doc.querySelectorAll(selector)) {
                el.setAttribute(MARK_ATTR, userId);
                paint(el, record);
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
        enqueue(who.userId, who.href, who.username, true);
    }

    // Column entries whose join date is already known are badged immediately.
    // The rest are handed to the visibility observer and only cost a member-page
    // fetch once they're actually on screen; see the note at the top of the file.
    function decorateActivity(el) {
        if (!enabled) return;
        if (!el.classList || !el.classList.contains('activity')) return;
        if (el.hasAttribute(MARK_ATTR)) return;

        const who = identifyActivity(el);
        if (!who) return;

        const record = known.get(who.userId);
        if (record) {
            el.setAttribute(MARK_ATTR, who.userId);
            paint(el, record);
            return;
        }

        const seer = seerFor(el.ownerDocument);
        if (seer) {
            seer.observe(el);
            return;
        }

        el.setAttribute(MARK_ATTR, 'p' + who.userId);
        enqueue(who.userId, who.href, who.username, false);
    }

    function activityContainer(doc) {
        return doc.getElementById('chat-activity') || doc.getElementById('chat-activity-scroller');
    }

    function rescan(doc) {
        const container = doc.getElementById('chat-messages') || SNEED.util.findMessageContainer(doc);
        if (container) {
            for (const msgEl of container.querySelectorAll('.chat-message')) decorate(msgEl);
        }
        rescanActivity(doc);
    }

    function rescanActivity(doc) {
        const container = activityContainer(doc);
        if (!container) return;
        for (const el of container.querySelectorAll('.activity')) decorateActivity(el);
    }

    // Settings changed: drop every badge and mark, then re-decorate from cache.
    function repaintAll() {
        for (const doc of docs) {
            for (const badge of doc.querySelectorAll('.' + BADGE_CLASS)) badge.remove();
            for (const el of doc.querySelectorAll('[' + MARK_ATTR + ']')) {
                if (!el.getAttribute(MARK_ATTR).startsWith('p')) el.removeAttribute(MARK_ATTR);
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

    // A column entry that scrolled into view finally earns its lookup.
    function makeVisibilityObserver(doc) {
        const view = doc.defaultView;
        if (!view || typeof view.IntersectionObserver !== 'function') return null;

        const io = new view.IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;

                const el = entry.target;
                io.unobserve(el);
                if (!el.isConnected || el.hasAttribute(MARK_ATTR)) continue;

                const who = identifyActivity(el);
                if (!who) continue;

                const record = known.get(who.userId);
                if (record) {
                    el.setAttribute(MARK_ATTR, who.userId);
                    paint(el, record);
                    continue;
                }

                el.setAttribute(MARK_ATTR, 'p' + who.userId);
                enqueue(who.userId, who.href, who.username, false);
            }
        }, { rootMargin: '64px' });

        return io;
    }

    // Cached per document, null included, so an environment without
    // IntersectionObserver isn't probed on every entry.
    function seerFor(doc) {
        if (!visibility.has(doc)) visibility.set(doc, makeVisibilityObserver(doc));
        return visibility.get(doc);
    }

    // The column can render after the message list, so keep looking for it for a
    // while. Sneedchat appends arrivals to #chat-activity and re-appends every
    // entry whenever it re-sorts the roster, so a childList watch covers both —
    // and because re-sorting moves the same nodes rather than rebuilding them,
    // badges and marks survive it.
    function watchActivity(doc, attempt) {
        const container = activityContainer(doc);
        if (!container) {
            if ((attempt || 0) < 15) setTimeout(() => watchActivity(doc, (attempt || 0) + 1), 1000);
            return;
        }
        if (container.__kees_newUserActivity) return;
        container.__kees_newUserActivity = true;

        rescanActivity(doc);

        let timer = null;
        const observer = new MutationObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                rescanActivity(doc);
            }, 200);
        });

        // childList only, and on #chat-activity itself where possible: painting a
        // badge mutates an entry's subtree, and a subtree observer would keep
        // re-arming itself off its own output.
        observer.observe(container, { childList: true, subtree: container.id !== 'chat-activity' });
        SNEED.core.events.addManagedObserver(container, observer);
    }

    async function start(doc) {
        if (doc.__kees_newUserBadge) return;
        doc.__kees_newUserBadge = true;

        docs.add(doc);
        injectStyles(doc);
        await loadSettings();
        hookStorage();

        rescan(doc);
        watchActivity(doc, 0);

        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) decorate(node);
        });

        log.info('New-user badge started (threshold ' + newDays + ' days)');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.newUserBadge = { start };

})();
