// features/mention-notifications.js - Browser notifications for chat mentions
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-mention-notifications';
    const STORAGE_KEY_SHOW_BODY = 'kees-mention-show-body';
    const STORAGE_KEY_BOSSMAN_LIVE = 'kees-bossman-live-notify';
    const STORAGE_KEY_MUTED = 'sneedchat-muted-users';
    const MENTION_SELECTOR = '.chat-message--highlightYou';

    const BOSSMAN_BOT = 'kenogpt';
    const BOSSMAN_LIVE_PATTERNS = [
        { pattern: /\bLIVE\b.*on Discord/i, label: 'Bossman is LIVE on Discord!' },
        { pattern: /\bLIVE\b.*on Twitch/i, label: 'Bossman is LIVE on Twitch!' }
    ];

    const initializedDocs = new WeakSet();
    const processedMessages = new WeakSet();

    let isEnabled = false;
    let showBody = false;
    let bossmanLiveEnabled = false;
    let mutedUsersLower = new Set();

    function checkForMention(messageElement, doc) {
        if (!isEnabled) return;

        if (processedMessages.has(messageElement)) return;
        processedMessages.add(messageElement);

        if (!messageElement.classList.contains('chat-message--highlightYou')) return;

        let author = SNEED.util.getMessageAuthor(messageElement)
            || messageElement.querySelector('.chat-user-name')?.textContent?.trim()
            || messageElement.querySelector('.username')?.textContent?.trim()
            || messageElement.querySelector('[class*="user"]')?.textContent?.trim();

        // Skip notifications from muted users
        if (author && mutedUsersLower.has(author.toLowerCase())) return;

        let content = messageElement.querySelector('.chat-message-content')?.textContent?.trim()
            || messageElement.querySelector('.message-content')?.textContent?.trim()
            || messageElement.querySelector('.content')?.textContent?.trim()
            || messageElement.textContent?.trim() || '';

        sendNotification(author || 'Someone', content, doc);
    }

    function checkForBossmanLive(messageElement, doc) {
        if (!bossmanLiveEnabled) return;
        if (processedMessages.has(messageElement)) return;

        const author = messageElement.querySelector('.chat-user-name')?.textContent?.trim()
            || messageElement.querySelector('.username')?.textContent?.trim()
            || messageElement.querySelector('.author')?.textContent?.trim()
            || '';

        if (author.toLowerCase() !== BOSSMAN_BOT) return;

        const content = messageElement.textContent || '';
        for (const { pattern, label } of BOSSMAN_LIVE_PATTERNS) {
            if (pattern.test(content)) {
                sendNotification('KenoGPT', label, doc, true);
                return;
            }
        }
    }

    function sendNotification(author, content, doc, alwaysNotify) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
            Notification.requestPermission();
            return;
        }

        if (Notification.permission !== 'granted') return;

        // Don't notify if page is focused (unless alwaysNotify is set)
        if (!alwaysNotify) {
            const docHasFocus = doc.hasFocus();
            let parentHasFocus = false;
            try {
                parentHasFocus = window.parent && window.parent.document.hasFocus();
            } catch (e) {
                // Cross-origin
            }
            if (docHasFocus || parentHasFocus) return;
        }

        let body = '';
        if (showBody && content) {
            body = content.length > 150 ? content.substring(0, 150) + '...' : content;
        }

        const notification = new Notification(`${author} mentioned you in chat`, {
            body: body,
            icon: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            tag: 'kees-mention-' + Date.now(),
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            if (window.parent) window.parent.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 5000);
    }

    function setupObserver(doc) {
        const chatContainer = doc.querySelector('.chat-messages, .chat-box, #chat-messages');
        if (!chatContainer) {
            console.log('[KEES] Chat container not found for mention observer');
            return;
        }

        // Mark existing messages as processed to avoid notifying on connect/reconnect
        const existingMessages = chatContainer.querySelectorAll('.chat-message');
        existingMessages.forEach(msg => processedMessages.add(msg));
        console.log('[KEES] Marked', existingMessages.length, 'existing messages as processed');

        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) {
                if (node.matches && node.matches('.chat-message')) {
                    checkForBossmanLive(node, doc);
                    checkForMention(node, doc);
                } else if (node.querySelectorAll) {
                    const messages = node.querySelectorAll('.chat-message');
                    messages.forEach(msg => {
                        checkForBossmanLive(msg, doc);
                        checkForMention(msg, doc);
                    });
                }
            }
        });

        console.log('[KEES] Mention notification observer started');
    }

    async function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;
        initializedDocs.add(doc);

        const settings = await new Promise(resolve => {
            chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_SHOW_BODY, STORAGE_KEY_BOSSMAN_LIVE, STORAGE_KEY_MUTED], resolve);
        });

        isEnabled = settings[STORAGE_KEY_ENABLED] === true;
        showBody = settings[STORAGE_KEY_SHOW_BODY] === true;
        bossmanLiveEnabled = settings[STORAGE_KEY_BOSSMAN_LIVE] === true;
        const mutedUsers = settings[STORAGE_KEY_MUTED] || [];
        mutedUsersLower = new Set(mutedUsers.map(u => u.toLowerCase()));

        if (!isEnabled) {
            console.log('[KEES] Mention notifications disabled');
        } else {
            console.log('[KEES] Mention notifications enabled, showBody:', showBody);
        }

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Setup observer even if disabled, so it works when enabled later
        setupObserver(doc);

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local') {
                if (changes[STORAGE_KEY_ENABLED]) {
                    isEnabled = changes[STORAGE_KEY_ENABLED].newValue === true;
                    console.log('[KEES] Mention notifications', isEnabled ? 'enabled' : 'disabled');
                }
                if (changes[STORAGE_KEY_SHOW_BODY]) {
                    showBody = changes[STORAGE_KEY_SHOW_BODY].newValue === true;
                    console.log('[KEES] Show body in notifications:', showBody);
                }
                if (changes[STORAGE_KEY_BOSSMAN_LIVE]) {
                    bossmanLiveEnabled = changes[STORAGE_KEY_BOSSMAN_LIVE].newValue === true;
                    console.log('[KEES] Bossman live alerts', bossmanLiveEnabled ? 'enabled' : 'disabled');
                }
                if (changes[STORAGE_KEY_MUTED]) {
                    const users = changes[STORAGE_KEY_MUTED].newValue || [];
                    mutedUsersLower = new Set(users.map(u => u.toLowerCase()));
                }
            }
        });
    }

    function init() {
        console.log('[KEES] Mention notifications module loaded');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.mentionNotifications = {
        init,
        start
    };

    init();
})();
