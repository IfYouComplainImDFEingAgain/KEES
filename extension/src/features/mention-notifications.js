/**
 * features/mention-notifications.js - Browser notifications for chat mentions
 * Sends a notification when someone mentions your username in chat.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-mention-notifications';
    const STORAGE_KEY_SHOW_BODY = 'kees-mention-show-body';
    const MENTION_SELECTOR = '.chat-message--highlightYou';

    // Track initialized documents
    const initializedDocs = new WeakSet();
    // Track processed message elements to avoid duplicate notifications
    const processedMessages = new WeakSet();

    let isEnabled = false;
    let showBody = false;

    // ============================================
    // CHECK FOR MENTIONS
    // ============================================

    function checkForMention(messageElement, doc) {
        console.log('[KEES] Checking message for mention, enabled:', isEnabled);

        if (!isEnabled) return;

        // Skip if already processed
        if (processedMessages.has(messageElement)) {
            console.log('[KEES] Message already processed, skipping');
            return;
        }
        processedMessages.add(messageElement);

        // Check if this message mentions the user (site adds this class)
        if (!messageElement.classList.contains('chat-message--highlightYou')) {
            console.log('[KEES] Message does not have highlightYou class');
            return;
        }

        console.log('[KEES] Found mention message!');

        // Get the message author - try multiple selectors
        let author = messageElement.querySelector('.chat-user-name')?.textContent?.trim()
            || messageElement.querySelector('.username')?.textContent?.trim()
            || messageElement.querySelector('[class*="user"]')?.textContent?.trim();

        // Get message content - try multiple selectors
        let content = messageElement.querySelector('.chat-message-content')?.textContent?.trim()
            || messageElement.querySelector('.message-content')?.textContent?.trim()
            || messageElement.querySelector('.content')?.textContent?.trim()
            || messageElement.textContent?.trim() || '';

        console.log('[KEES] Mention from:', author, 'content:', content.substring(0, 50));
        console.log('[KEES] Message HTML:', messageElement.innerHTML.substring(0, 200));

        // Send notification
        sendNotification(author || 'Someone', content, doc);
    }

    // ============================================
    // SEND NOTIFICATION
    // ============================================

    function sendNotification(author, content, doc) {
        console.log('[KEES] sendNotification called, author:', author);

        // Check if notifications are supported and permitted
        if (!('Notification' in window)) {
            console.log('[KEES] Notifications not supported');
            return;
        }

        console.log('[KEES] Notification permission:', Notification.permission);

        // Request permission if needed
        if (Notification.permission === 'default') {
            console.log('[KEES] Requesting notification permission');
            Notification.requestPermission();
            return;
        }

        if (Notification.permission !== 'granted') {
            console.log('[KEES] Notification permission denied');
            return;
        }

        // Check focus state (disabled for testing - notifications will always show)
        // const docHasFocus = doc.hasFocus();
        // let parentHasFocus = false;
        // try {
        //     parentHasFocus = window.parent && window.parent.document.hasFocus();
        // } catch (e) {
        //     // Cross-origin
        // }
        // console.log('[KEES] Focus check - doc:', docHasFocus, 'parent:', parentHasFocus);
        // if (docHasFocus || parentHasFocus) {
        //     console.log('[KEES] Page is focused, skipping notification');
        //     return;
        // }
        console.log('[KEES] Creating notification (focus check disabled for testing)');

        // Build notification body
        let body = '';
        if (showBody && content) {
            body = content.length > 150 ? content.substring(0, 150) + '...' : content;
        }

        // Create notification
        const notification = new Notification(`${author} mentioned you in chat`, {
            body: body,
            icon: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            tag: 'kees-mention-' + Date.now(), // Unique tag to allow multiple notifications
            requireInteraction: false
        });

        console.log('[KEES] Notification created for mention from:', author);

        // Focus window when notification is clicked
        notification.onclick = () => {
            window.focus();
            if (window.parent) window.parent.focus();
            notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        console.log('[KEES] Mention notification sent for:', author);
    }

    // ============================================
    // MUTATION OBSERVER
    // ============================================

    function setupObserver(doc) {
        const chatContainer = doc.querySelector('.chat-messages, .chat-box, #chat-messages');
        if (!chatContainer) {
            console.log('[KEES] Chat container not found for mention observer');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // Check if it's a chat message
                    if (node.matches && node.matches('.chat-message')) {
                        console.log('[KEES] New chat message detected, classes:', node.className);
                        checkForMention(node, doc);
                    } else if (node.querySelectorAll) {
                        // Check for messages inside added node
                        const messages = node.querySelectorAll('.chat-message');
                        if (messages.length > 0) {
                            console.log('[KEES] Found', messages.length, 'messages in added node');
                            messages.forEach(msg => checkForMention(msg, doc));
                        }
                    }
                }
            }
        });

        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });

        console.log('[KEES] Mention notification observer started');
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;
        initializedDocs.add(doc);

        // Check if feature is enabled
        const settings = await new Promise(resolve => {
            chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_SHOW_BODY], resolve);
        });

        isEnabled = settings[STORAGE_KEY_ENABLED] === true;
        showBody = settings[STORAGE_KEY_SHOW_BODY] === true;

        if (!isEnabled) {
            console.log('[KEES] Mention notifications disabled');
        } else {
            console.log('[KEES] Mention notifications enabled, showBody:', showBody);
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Setup observer (even if disabled, so it works when enabled later)
        setupObserver(doc);

        // Listen for setting changes
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
            }
        });
    }

    function init() {
        console.log('[KEES] Mention notifications module loaded');
    }

    // Export
    SNEED.features = SNEED.features || {};
    SNEED.features.mentionNotifications = {
        init,
        start
    };

    init();
})();
