// features/chat-tag-chips.js - Show your own user tags next to names in chat.
//
// Read-only companion to the forum-side tagging feature: it renders the manual
// tags stored under kees-user-tags and never scans, crawls or writes anything.
// Only tag-store.js is injected on /chat/*, not the scanner or the crawler.
//
// Auto (forum-activity) tags are deliberately left out. They exist to summarise
// where somebody posts, which is useful beside a forum post and pure noise on
// every line of a fast-scrolling chat - and skipping them keeps this feature
// independent of the auto-tagging toggle entirely.
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;
    const tagging = SNEED.tagging;
    if (!tagging) return; // tag-store loads first; bail defensively if missing

    const ENABLED_KEY = 'kees-chat-tag-chips';
    const MARK_ATTR = 'data-kees-chattag';
    const CHIP_CLASS = 'kees-chat-tag';
    const WRAP_CLASS = 'kees-chat-tags';
    const MAX_CHIPS = 3;   // a user with a dozen tags must not eat the whole line

    const STYLES =
        '.' + WRAP_CLASS + ' { display:inline-flex; flex-wrap:wrap; gap:3px; vertical-align:middle; margin-left:4px; }' +
        '.' + CHIP_CLASS + ' { display:inline-block; font-size:10px; line-height:1.4; padding:0 5px;' +
        ' border-radius:7px; color:#fff; font-weight:600; border:1px solid rgba(255,255,255,0.25); }';

    let enabled = true;
    let tagsByUser = {};
    const docs = new Set();

    function injectStyles(doc) {
        if (doc.getElementById('kees-chat-tag-styles')) return;
        const style = doc.createElement('style');
        style.id = 'kees-chat-tag-styles';
        style.textContent = STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    // Same resolution ladder as new-user-badge.js: Sneedchat stamps the numeric
    // author id on the message, with the meta row, the member link and the
    // avatar filename as fallbacks.
    //
    // Anything inside .message is post *content* - a member link someone pasted
    // there belongs to a third party, so those nodes are never used to identify
    // the poster.
    function identify(msgEl) {
        if (!msgEl.querySelector) return null;

        const byData = msgEl.dataset && msgEl.dataset.author;
        let userId = byData && /^\d+$/.test(byData) ? byData : null;

        if (!userId) {
            const authorEl = msgEl.querySelector('.author[data-id]');
            const byAuthor = authorEl && authorEl.getAttribute('data-id');
            if (byAuthor && /^\d+$/.test(byAuthor)) userId = byAuthor;
        }

        if (!userId) {
            for (const a of msgEl.querySelectorAll('a[href*="/members/"]')) {
                if (a.closest('.message')) continue;
                userId = parseUserFromHref(a.getAttribute('href'));
                break;
            }
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
        return userId;
    }

    function manualFor(userId) {
        const entry = tagsByUser[userId];
        return (entry && entry.manual) || [];
    }

    function buildChips(doc, userId) {
        const tags = manualFor(userId);
        if (!tags.length) return null;

        const wrap = doc.createElement('span');
        wrap.className = WRAP_CLASS;

        tags.slice(0, MAX_CHIPS).forEach(t => {
            const chip = doc.createElement('span');
            chip.className = CHIP_CLASS;
            chip.textContent = t.label;
            chip.title = 'Your tag';
            chip.style.background = tagging.resolveTagColor(t.label, t.color);
            wrap.appendChild(chip);
        });

        // Anything past the cap is still reachable, just not taking up room.
        if (tags.length > MAX_CHIPS) {
            const more = doc.createElement('span');
            more.className = CHIP_CLASS;
            more.textContent = '+' + (tags.length - MAX_CHIPS);
            more.title = tags.map(t => t.label).join(', ');
            more.style.background = '#555';
            wrap.appendChild(more);
        }

        return wrap;
    }

    function paint(msgEl, userId) {
        const existing = msgEl.querySelector('.' + WRAP_CLASS);
        if (existing) existing.remove();
        if (!enabled) return;

        const chips = buildChips(msgEl.ownerDocument, userId);
        if (!chips) return;

        // new-user-badge.js also inserts after .author, and both features are
        // driven by the same message handler, so whichever painted last would
        // otherwise end up nearest the name. Always sit after the NEW badge
        // when one is present, so the order is stable either way.
        const anchor = msgEl.querySelector('.kees-new-user') || msgEl.querySelector('.author');
        if (anchor) anchor.insertAdjacentElement('afterend', chips);
        else msgEl.appendChild(chips);
    }

    function decorate(msgEl) {
        if (!msgEl || !msgEl.classList || !msgEl.classList.contains('chat-message')) return;
        let userId = msgEl.getAttribute(MARK_ATTR);
        if (!userId) {
            userId = identify(msgEl);
            if (!userId) return;
            msgEl.setAttribute(MARK_ATTR, userId);
        }
        paint(msgEl, userId);
    }

    function rescan(doc) {
        const container = doc.getElementById('chat-messages') || SNEED.util.findMessageContainer(doc);
        if (!container) return;
        for (const msgEl of container.querySelectorAll('.chat-message')) decorate(msgEl);
    }

    // Tags, colours or the toggle changed: repaint every live document. Marks
    // are kept, so this never re-runs identification.
    function repaintAll() {
        for (const doc of [...docs]) {
            if (!doc.defaultView) { docs.delete(doc); continue; }
            rescan(doc);
        }
    }

    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([ENABLED_KEY], (result) => {
                enabled = result[ENABLED_KEY] !== false;
                resolve();
            });
        });
    }

    let hooked = false;
    function hookStorage() {
        if (hooked) return;
        hooked = true;
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (area !== 'local') return;
            let dirty = false;
            if (changes[tagging.TAGS_KEY]) {
                tagsByUser = changes[tagging.TAGS_KEY].newValue || {};
                dirty = true;
            }
            // tag-store refreshes its own colour cache from this same event, and
            // it registers first because it loads first, so the cache is already
            // fresh by the time we repaint.
            if (changes[tagging.LIBRARY_KEY]) dirty = true;
            if (changes[ENABLED_KEY]) {
                enabled = changes[ENABLED_KEY].newValue !== false;
                dirty = true;
            }
            if (dirty) repaintAll();
        });
    }

    async function start(doc) {
        if (doc.__kees_chatTagChips) return;
        doc.__kees_chatTagChips = true;

        docs.add(doc);
        injectStyles(doc);

        await loadSettings();
        await tagging.loadLibraryCache();
        tagsByUser = await tagging.getAllTags();
        hookStorage();

        rescan(doc);

        // The shared message observer covers arrivals; no observer of our own,
        // since painting a chip mutates a message subtree and a subtree watcher
        // would keep re-arming off its own output.
        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) decorate(node);
        });

        log.info('Chat tag chips started');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.chatTagChips = { start };

})();
