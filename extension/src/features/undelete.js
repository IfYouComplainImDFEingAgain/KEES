// features/undelete.js - Keep deleted chat messages visible, highlighted in dark red.
//
// The interception itself has to run in the page realm (see chat-messages-page.js);
// this module injects that script into the chat document, carries the on/off
// setting across to it via a documentElement attribute, and owns the styling.
//
// A message that has already been preserved is marked with data-kees-deleted, so
// turning the feature off can undo the preservation by removing those messages
// for real — removeChild is used for that, since the page's patched remove()
// would otherwise be a no-op for a message that isn't marked yet.
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;

    const ENABLED_KEY = 'kees-undelete';
    const FLAG_ATTR = 'data-kees-undelete';
    const MARK_SELECTOR = '.chat-message[data-kees-deleted]';

    const STYLES = `
        .chat-message[data-kees-deleted] {
            background: rgba(104, 12, 18, 0.55) !important;
            box-shadow: inset 3px 0 0 0 #a3202a;
        }
        .chat-message[data-kees-deleted] .meta::after {
            content: 'DELETED';
            display: inline-block;
            margin-left: 6px;
            padding: 0 4px;
            border-radius: 3px;
            background: #8b1a1a;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            line-height: 15px;
            vertical-align: middle;
            letter-spacing: 0.3px;
        }
    `;

    let enabled = true;
    const docs = new Set();

    function injectStyles(doc) {
        if (doc.getElementById('kees-undelete-styles')) return;
        const style = doc.createElement('style');
        style.id = 'kees-undelete-styles';
        style.textContent = STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    // Drop the messages that were held back while the feature was on, so turning
    // it off leaves the room looking the way the site intended.
    function purge(doc) {
        for (const msgEl of doc.querySelectorAll(MARK_SELECTOR)) {
            if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl);
        }
    }

    function applyFlag(doc) {
        doc.documentElement.setAttribute(FLAG_ATTR, enabled ? '1' : '0');
        if (!enabled) purge(doc);
    }

    function applyAll() {
        for (const doc of docs) {
            if (!doc.defaultView) {
                docs.delete(doc);
                continue;
            }
            applyFlag(doc);
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

    let storageHooked = false;

    function hookStorage() {
        if (storageHooked) return;
        storageHooked = true;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[ENABLED_KEY]) return;
            enabled = changes[ENABLED_KEY].newValue !== false;
            applyAll();
        });
    }

    async function start(doc) {
        if (doc.__kees_undelete_started) return;
        doc.__kees_undelete_started = true;

        docs.add(doc);
        injectStyles(doc);
        await loadSettings();
        hookStorage();
        applyFlag(doc);
        SNEED.core.chatPage.inject(doc);

        log.info('Message undelete started (' + (enabled ? 'on' : 'off') + ')');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.undelete = { start };

})();
