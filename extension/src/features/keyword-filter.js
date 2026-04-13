// features/keyword-filter.js - Hide chat messages containing specified keywords
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const STORAGE_KEY = 'kees-filtered-keywords';

    let keywords = [];

    function getMessageBody(msgEl) {
        return msgEl.querySelector('.message') || msgEl.querySelector('.chat-message-content') || msgEl.querySelector('.message-body') || msgEl;
    }

    function getMessageText(msgEl) {
        const raw = msgEl.getAttribute && msgEl.getAttribute('data-raw');
        if (raw) return raw.toLowerCase();
        return (getMessageBody(msgEl).textContent || '').toLowerCase();
    }

    function matchesKeyword(text) {
        for (const kw of keywords) {
            if (text.includes(kw)) return true;
        }
        return false;
    }

    function hideIfMatched(msgEl) {
        if (!msgEl.classList || !msgEl.classList.contains('chat-message')) return;
        const text = getMessageText(msgEl);
        if (!text) return;

        if (matchesKeyword(text)) {
            msgEl.style.display = 'none';
            msgEl.dataset.keesKeywordFiltered = 'true';
        }
    }

    function rescanAll(doc) {
        const container = SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const messages = container.querySelectorAll('.chat-message');
        for (const msg of messages) {
            const text = getMessageText(msg);
            if (!text) continue;

            if (matchesKeyword(text)) {
                msg.style.display = 'none';
                msg.dataset.keesKeywordFiltered = 'true';
            } else if (msg.dataset.keesKeywordFiltered) {
                msg.style.display = '';
                delete msg.dataset.keesKeywordFiltered;
            }
        }
    }

    function start(doc) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const raw = result[STORAGE_KEY] || [];
            keywords = raw.map(k => k.toLowerCase());

            rescanAll(doc);

            SNEED.core.events.addMessageHandler(doc, (addedElements) => {
                for (const node of addedElements) {
                    hideIfMatched(node);
                }
            });
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                const raw = changes[STORAGE_KEY].newValue || [];
                keywords = raw.map(k => k.toLowerCase());
                rescanAll(doc);
            }
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.keywordFilter = { start };

})();
