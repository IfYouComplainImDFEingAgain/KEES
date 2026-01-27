/**
 * features/scrollback.js - Increase chat message scrollback limit
 * Overrides Element.prototype.remove to prevent chat message removal
 * until the configured limit is exceeded.
 *
 * This script must run at document_start to intercept removals.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'kees-scrollback-limit';
    const DEFAULT_LIMIT = 100;

    // Start with default, update when storage loads
    let messageLimit = DEFAULT_LIMIT;

    // Load setting from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const stored = result[STORAGE_KEY];
            if (stored !== undefined && stored !== null) {
                messageLimit = parseInt(stored, 10) || DEFAULT_LIMIT;
            }
            console.log(`[KEES] Scrollback limit set to ${messageLimit}`);
        });

        // Listen for setting changes
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                messageLimit = parseInt(changes[STORAGE_KEY].newValue, 10) || DEFAULT_LIMIT;
                console.log(`[KEES] Scrollback limit updated to ${messageLimit}`);
            }
        });
    }

    // Store original remove method
    const originalRemove = Element.prototype.remove;

    // Override Element.prototype.remove to intercept message removals
    Element.prototype.remove = function() {
        // Check if this is a chat message being removed
        const messagesEl = document.getElementById('chat-messages');
        if (messagesEl && this.parentNode === messagesEl && this.classList.contains('chat-message')) {
            // This is a chat message - check if we should actually remove it
            const currentCount = messagesEl.children.length;

            if (currentCount > messageLimit) {
                // We're over our custom limit, allow removal
                originalRemove.call(this);
            }
            // else: We're under our custom limit, prevent removal (do nothing)
            return;
        }

        // Not a chat message, use original remove
        originalRemove.call(this);
    };

    console.log('[KEES] Scrollback module loaded');
})();
