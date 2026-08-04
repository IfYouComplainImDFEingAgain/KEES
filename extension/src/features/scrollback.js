// features/scrollback.js - Keep more chat history than Sneedchat would.
//
// Sneedchat hard-caps its log at 200 messages. The cap can only be lifted from
// the page realm (src/chat-messages-page.js explains why refusing the removals
// hangs the tab); this half owns the setting and hands it over as an attribute
// on <html>, which the page script reads.
//
// The limit only ever raises the log — MIN_LIMIT is the site's own cap, so a
// stale or low stored value can never cost you history you have today.
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;

    const STORAGE_KEY = 'kees-scrollback-limit';
    const LIMIT_ATTR = 'data-kees-scrollback';

    const MIN_LIMIT = 200;     // Sneedchat's own cap
    const MAX_LIMIT = 1000;    // ~25 DOM nodes per message; past this, scrolling suffers

    let limit = MIN_LIMIT;
    const docs = new Set();

    function clampLimit(value) {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return MIN_LIMIT;
        return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, parsed));
    }

    function applyLimit(doc) {
        doc.documentElement.setAttribute(LIMIT_ATTR, String(limit));
    }

    function applyAll() {
        for (const doc of docs) {
            if (!doc.defaultView) {
                docs.delete(doc);
                continue;
            }
            applyLimit(doc);
        }
    }

    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                limit = clampLimit(result[STORAGE_KEY]);
                resolve();
            });
        });
    }

    let storageHooked = false;

    function hookStorage() {
        if (storageHooked) return;
        storageHooked = true;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
            limit = clampLimit(changes[STORAGE_KEY].newValue);
            applyAll();
        });
    }

    async function start(doc) {
        if (doc.__kees_scrollback_started) return;
        doc.__kees_scrollback_started = true;

        docs.add(doc);
        await loadSettings();
        hookStorage();
        applyLimit(doc);
        SNEED.core.chatPage.inject(doc);

        log.info('Scrollback limit set to ' + limit);
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.scrollback = { start };

})();
