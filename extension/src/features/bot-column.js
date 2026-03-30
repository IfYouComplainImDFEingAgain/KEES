// features/bot-column.js - Second column alongside main chat for bot messages
(function() {
    'use strict';

    const SNEED = window.SNEED;

    let botUsersLower = [];
    let enabled = false;
    let hideFromMain = false;

    const STYLES = `
        .sneed-has-bot-col {
            display: flex !important;
            flex-direction: row !important;
        }
        .sneed-has-bot-col > #chat-scroller,
        .sneed-has-bot-col > :first-child:not(.sneed-bot-col) {
            flex: 1 !important;
            min-width: 0 !important;
        }
        .sneed-bot-col {
            width: 300px;
            min-width: 200px;
            max-width: 50%;
            border-left: 1px solid #333;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            resize: horizontal;
            overflow: auto;
        }
        .sneed-bot-col-header {
            padding: 6px 10px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid #333;
            color: #999;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .sneed-bot-col-messages {
            flex: 1;
            overflow-y: auto;
            padding: 4px;
        }
        .sneed-bot-col-messages .chat-message {
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
    `;

    function isBotUser(username) {
        if (!username) return false;
        return botUsersLower.includes(username.toLowerCase());
    }

    function getMessageAuthor(msgEl) {
        const authorEl = msgEl.querySelector('.author');
        if (authorEl) return authorEl.textContent.trim();
        return null;
    }

    function injectStyles(doc) {
        if (doc.getElementById('sneed-bot-column-styles')) return;
        const style = doc.createElement('style');
        style.id = 'sneed-bot-column-styles';
        style.textContent = STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    function createColumn(doc) {
        const col = doc.createElement('div');
        col.className = 'sneed-bot-col';
        col.id = 'sneed-bot-column';

        const header = doc.createElement('div');
        header.className = 'sneed-bot-col-header';
        header.textContent = 'Bot Messages';

        const messages = doc.createElement('div');
        messages.className = 'sneed-bot-col-messages';

        col.appendChild(header);
        col.appendChild(messages);

        return col;
    }

    function start(doc) {
        const keys = [
            SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED,
            SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN,
            SNEED.state.STORAGE_KEYS.BOT_USERS
        ];

        // Use callback style — Firefox's chrome.* compat doesn't support Promise return
        chrome.storage.local.get(keys, (result) => {
            enabled = result[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED] === true;
            hideFromMain = result[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN] === true;
            const users = result[SNEED.state.STORAGE_KEYS.BOT_USERS] || [];
            botUsersLower = users.map(u => u.toLowerCase());

            if (enabled && botUsersLower.length > 0) {
                setupColumn(doc);
            }
        });

        chrome.storage.onChanged.addListener((changes) => {
            let needsRefresh = false;

            if (changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED]) {
                enabled = changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED].newValue === true;
                needsRefresh = true;
            }
            if (changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN]) {
                hideFromMain = changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN].newValue === true;
            }
            if (changes[SNEED.state.STORAGE_KEYS.BOT_USERS]) {
                const users = changes[SNEED.state.STORAGE_KEYS.BOT_USERS].newValue || [];
                botUsersLower = users.map(u => u.toLowerCase());
                needsRefresh = true;
            }

            if (needsRefresh) {
                teardownColumn(doc);
                if (enabled && botUsersLower.length > 0) {
                    setupColumn(doc);
                }
            }
        });
    }

    function setupColumn(doc) {
        const chatMessages = doc.getElementById('chat-messages');
        if (!chatMessages) return;

        const scroller = chatMessages.closest('#chat-scroller') || chatMessages.parentElement;
        if (!scroller || doc.getElementById('sneed-bot-column')) return;

        injectStyles(doc);

        const parent = scroller.parentElement;
        parent.classList.add('sneed-has-bot-col');

        const botCol = createColumn(doc);
        parent.appendChild(botCol);

        const botMessages = botCol.querySelector('.sneed-bot-col-messages');

        const existing = chatMessages.querySelectorAll('.chat-message');
        existing.forEach(msg => {
            processMessage(msg, botMessages, doc);
        });

        let scrollPending = false;

        const observer = new MutationObserver((mutations) => {
            let added = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('chat-message')) {
                        if (processMessage(node, botMessages, doc)) added = true;
                    }
                }
            }
            if (added && !scrollPending) {
                scrollPending = true;
                requestAnimationFrame(() => {
                    botMessages.scrollTop = botMessages.scrollHeight;
                    scrollPending = false;
                });
            }
        });

        observer.observe(chatMessages, { childList: true });
        SNEED.core.events.addManagedObserver(chatMessages, observer);

        doc.__sneed_botColumn = {
            cleanup: () => {
                observer.disconnect();
                teardownColumn(doc);
            }
        };
    }

    function processMessage(msgEl, botContainer, doc) {
        const author = getMessageAuthor(msgEl);
        if (!author || !isBotUser(author)) return false;

        const msgId = msgEl.id || msgEl.dataset.id;

        // Check if this message already exists in bot column (edit/replace)
        if (msgId) {
            const existing = botContainer.querySelector(`[id="${msgId}"], [data-id="${msgId}"]`);
            if (existing) {
                const clone = msgEl.cloneNode(true);
                existing.replaceWith(clone);
                if (hideFromMain) msgEl.style.display = 'none';
                return false;
            }
        }

        const clone = msgEl.cloneNode(true);
        botContainer.appendChild(clone);

        if (hideFromMain) {
            msgEl.style.display = 'none';
        }

        return true;
    }

    function teardownColumn(doc) {
        const botCol = doc.getElementById('sneed-bot-column');
        if (botCol) {
            const parent = botCol.parentElement;
            botCol.remove();
            if (parent) parent.classList.remove('sneed-has-bot-col');
        }

        // Show any hidden bot messages
        const chatMessages = doc.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.querySelectorAll('.chat-message[style*="display: none"]').forEach(msg => {
                const author = getMessageAuthor(msg);
                if (author && isBotUser(author)) {
                    msg.style.display = '';
                }
            });
        }

        if (doc.__sneed_botColumn) {
            delete doc.__sneed_botColumn;
        }
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.botColumn = { start };

})();
