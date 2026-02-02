// ==UserScript==
// @name         Sneedchat Increase Scrollback
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Increases chat message history from 200 to 2000 messages
// @author
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration: Change this value to set your desired message limit
    const MESSAGE_LIMIT = 2000;

    console.log(`[Scrollback] Attempting to increase message limit to ${MESSAGE_LIMIT}`);

    // Store original remove method
    const originalRemove = Element.prototype.remove;

    // Override Element.prototype.remove to intercept message removals
    Element.prototype.remove = function() {
        // Check if this is a chat message being removed
        const messagesEl = document.getElementById('chat-messages');
        if (messagesEl && this.parentNode === messagesEl && this.classList.contains('chat-message')) {
            // This is a chat message - check if we should actually remove it
            const currentCount = messagesEl.children.length;

            if (currentCount > MESSAGE_LIMIT) {
                // We're over our custom limit, allow removal
                originalRemove.call(this);
            } else {
                // We're under our custom limit, prevent removal
                // Do nothing - the message stays
                if (currentCount === 201) {
                    console.log(`[Scrollback] Preventing message removal (current: ${currentCount}, limit: ${MESSAGE_LIMIT})`);
                }
                return;
            }
        } else {
            // Not a chat message, use original remove
            originalRemove.call(this);
        }
    };

    console.log(`[Scrollback] Successfully patched! Message limit set to ${MESSAGE_LIMIT}`);

    // Patch is applied immediately at script load
})();
