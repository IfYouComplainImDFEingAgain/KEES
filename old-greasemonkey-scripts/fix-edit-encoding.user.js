// ==UserScript==
// @name         Fix Chat Edit HTML Entity Encoding
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Fix HTML entity encoding issue when editing chat messages
// @match        *://kiwifarms.st/chat/*
// @match        *://kiwifarms.net/chat/*
// @match        *://localhost/chat/*
// @match        *://*/test-chat*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Wait for the chat to be initialized
    const waitForChat = setInterval(() => {
        if (typeof messageEdit === 'function' && typeof messageSend === 'function') {
            clearInterval(waitForChat);
            patchMessageEdit();
        }
    }, 100);

    function patchMessageEdit() {
        // Store reference to original messageEdit function
        const originalMessageEdit = window.messageEdit;

        // Override the messageEdit function
        window.messageEdit = function(messageEl) {
            // Call original function first
            originalMessageEdit.call(this, messageEl);

            // After the original function runs, fix the input handling
            const inputEl = document.getElementById('edit-message-input');
            if (inputEl && messageEl.rawMessage) {
                // Store the raw message as a data attribute
                inputEl.dataset.rawMessage = messageEl.rawMessage;

                // Use textContent instead of innerHTML to avoid HTML entity issues
                inputEl.textContent = decodeHtmlEntities(messageEl.rawMessage);

                // Override the keydown handler to use the raw message
                const existingHandlers = inputEl.cloneNode(true);
                const newInputEl = inputEl.cloneNode(true);
                inputEl.parentNode.replaceChild(newInputEl, inputEl);

                // Re-add event listeners
                inputAddEventListeners(newInputEl);

                newInputEl.addEventListener('keydown', function(event) {
                    switch(event.key) {
                        case 'Escape':
                            event.preventDefault();
                            messageEditReverse();
                            return false;
                        case 'Enter':
                            event.preventDefault();
                            // Use the stored raw message or fallback to textContent
                            const messageContent = this.textContent || this.innerText;
                            messageSend('/edit ' + JSON.stringify({
                                id: parseInt(messageEl.dataset.id, 10),
                                message: encodeHtmlEntities(messageContent)
                            }));
                            messageEditReverse();
                            return false;
                    }
                });

                // Focus and set cursor at end
                newInputEl.focus();
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(newInputEl);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };
    }

    // Helper function to decode HTML entities
    function decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    // Helper function to encode HTML entities
    function encodeHtmlEntities(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();