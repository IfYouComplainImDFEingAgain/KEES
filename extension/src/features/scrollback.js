// features/scrollback.js - Increase chat message scrollback limit
// Overrides Element.prototype.remove to prevent chat message removal.
// Must run at document_start to intercept removals.
(function() {
    'use strict';

    const STORAGE_KEY = 'kees-scrollback-limit';
    const DEFAULT_LIMIT = 100;

    let messageLimit = DEFAULT_LIMIT;

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const stored = result[STORAGE_KEY];
            if (stored !== undefined && stored !== null) {
                messageLimit = parseInt(stored, 10) || DEFAULT_LIMIT;
            }
            console.log(`[KEES] Scrollback limit set to ${messageLimit}`);
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                messageLimit = parseInt(changes[STORAGE_KEY].newValue, 10) || DEFAULT_LIMIT;
                console.log(`[KEES] Scrollback limit updated to ${messageLimit}`);
            }
        });
    }

    const originalRemove = Element.prototype.remove;

    Element.prototype.remove = function() {
        const messagesEl = document.getElementById('chat-messages');
        if (messagesEl && this.parentNode === messagesEl && this.classList.contains('chat-message')) {
            const currentCount = messagesEl.children.length;

            if (currentCount > messageLimit) {
                originalRemove.call(this);
            }
            // Under our custom limit - prevent removal (do nothing)
            return;
        }

        originalRemove.call(this);
    };

    console.log('[KEES] Scrollback module loaded');
})();
