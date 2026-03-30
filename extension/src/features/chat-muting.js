// features/chat-muting.js - Hide chat messages from muted users
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const STORAGE_KEY = 'sneedchat-muted-users';

    let mutedUsersLower = new Set();

    function getAuthor(msgEl) {
        const authorEl = msgEl.querySelector('.author');
        return authorEl ? authorEl.textContent.trim().toLowerCase() : null;
    }

    function hideIfMuted(msgEl) {
        if (!msgEl.classList || !msgEl.classList.contains('chat-message')) return;
        const author = getAuthor(msgEl);
        if (!author) return;

        if (mutedUsersLower.has(author)) {
            msgEl.style.display = 'none';
            msgEl.dataset.keesMuted = 'true';
        }
    }

    function rescanAll(doc) {
        const container = SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const messages = container.querySelectorAll('.chat-message');
        for (const msg of messages) {
            const author = getAuthor(msg);
            if (!author) continue;

            if (mutedUsersLower.has(author)) {
                msg.style.display = 'none';
                msg.dataset.keesMuted = 'true';
            } else if (msg.dataset.keesMuted) {
                msg.style.display = '';
                delete msg.dataset.keesMuted;
            }
        }
    }

    function start(doc) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const users = result[STORAGE_KEY] || [];
            mutedUsersLower = new Set(users.map(u => u.toLowerCase()));

            rescanAll(doc);

            SNEED.core.events.addMessageHandler(doc, (addedElements) => {
                for (const node of addedElements) {
                    hideIfMuted(node);
                }
            });
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                const users = changes[STORAGE_KEY].newValue || [];
                mutedUsersLower = new Set(users.map(u => u.toLowerCase()));
                rescanAll(doc);
            }
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.chatMuting = { start };

})();
