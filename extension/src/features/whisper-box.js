// features/whisper-box.js - Whisper conversation manager
(function() {
    'use strict';

    const SNEED = window.SNEED;
    let maxHistoryPerPartner = 100;

    const conversations = {};
    let activePartner = null;
    let boxElement = null;
    let currentDoc = null;
    let closed = false;
    let globalEnabled = false;
    let hideMainChat = true;
    let saveDebounceTimer = null;
    let savedPosition = null;
    let savedCollapsed = false;

    async function loadPosition() {
        try {
            const pos = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_POSITION);
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                savedPosition = pos;
            }
        } catch (e) {
            // ignore
        }
    }

    function savePosition(pos) {
        savedPosition = pos;
        SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_POSITION, pos);
    }

    async function loadState() {
        try {
            const state = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_STATE);
            if (state && typeof state === 'object') {
                savedCollapsed = state.collapsed === true;
                closed = state.closed === true;
            }
        } catch (e) {
            // ignore
        }
    }

    function saveState() {
        SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_STATE, {
            collapsed: savedCollapsed,
            closed: closed
        });
    }

    async function loadRetention() {
        try {
            const val = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_RETENTION);
            if (val !== undefined && val !== null) {
                maxHistoryPerPartner = parseInt(val, 10) || 0;
            }
        } catch (e) {
            // ignore
        }
    }

    async function loadGlobalState() {
        try {
            const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL);
            globalEnabled = result === true;
        } catch (e) {
            globalEnabled = false;
        }
    }

    async function loadHideMainState() {
        try {
            const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN);
            hideMainChat = result !== false;
        } catch (e) {
            hideMainChat = true;
        }
    }

    async function loadHistory() {
        if (!globalEnabled) return;
        try {
            const history = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HISTORY);
            if (history && typeof history === 'object') {
                for (const [partner, data] of Object.entries(history)) {
                    if (!conversations[partner]) {
                        conversations[partner] = { partnerId: data.partnerId || 0, messages: [], unread: 0 };
                    }
                    conversations[partner].messages = data.messages || [];
                    conversations[partner].partnerId = data.partnerId || conversations[partner].partnerId;
                }
            }
        } catch (e) {
            SNEED.log.error('Failed to load whisper history:', e);
        }
    }

    function saveHistory() {
        if (!globalEnabled) return;
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            const serialized = {};
            for (const [partner, data] of Object.entries(conversations)) {
                serialized[partner] = {
                    partnerId: data.partnerId,
                    messages: maxHistoryPerPartner > 0 ? data.messages.slice(-maxHistoryPerPartner) : data.messages
                };
            }
            SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HISTORY, serialized);
        }, 1000);
    }

    function addMessage(partnerUsername, partnerId, msg) {
        if (!conversations[partnerUsername]) {
            conversations[partnerUsername] = { partnerId: partnerId, messages: [], unread: 0 };
        }

        const convo = conversations[partnerUsername];
        convo.partnerId = partnerId;
        convo.messages.push(msg);

        // Cap history (0 = unlimited)
        if (maxHistoryPerPartner > 0 && convo.messages.length > maxHistoryPerPartner) {
            convo.messages = convo.messages.slice(-maxHistoryPerPartner);
        }

        if (partnerUsername !== activePartner && msg.direction !== 'out') {
            convo.unread++;
        }

        saveHistory();

        if (globalEnabled) {
            SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_LATEST, {
                partner: partnerUsername,
                partnerId: partnerId,
                msg: msg,
                ts: Date.now()
            });
        }
    }

    function markRead(partner) {
        if (conversations[partner]) {
            conversations[partner].unread = 0;
        }
    }

    function getPartnerList() {
        return Object.entries(conversations).map(([username, data]) => ({
            username,
            unread: data.unread
        }));
    }

    function ensureBox(doc) {
        if (boxElement && doc.getElementById('sneed-whisper-box')) return;

        boxElement = SNEED.ui.whisperBox.createWhisperBox(doc, {
            onToggle: (expanded) => {
                savedCollapsed = !expanded;
                saveState();
            },
            onClose: () => {
                if (boxElement) {
                    boxElement.remove();
                    boxElement = null;
                }
                closed = true;
                saveState();
                showReopenButton(doc);
            },
            onTabClick: (username) => {
                activePartner = username;
                markRead(username);
                refreshUI();
            },
            onTabClose: (username) => {
                delete conversations[username];
                if (activePartner === username) {
                    const keys = Object.keys(conversations);
                    activePartner = keys.length > 0 ? keys[0] : null;
                }
                saveHistory();
                refreshUI();
            },
            onSend: (text) => {
                if (!activePartner) return;
                sendWhisper(activePartner, text, doc);
            },
            onNewConversation: (username) => {
                if (!conversations[username]) {
                    conversations[username] = { partnerId: 0, messages: [], unread: 0 };
                }
                activePartner = username;
                refreshUI();
            },
            onPositionChange: (pos) => {
                savePosition(pos);
            }
        });

        doc.body.appendChild(boxElement);

        if (savedPosition) {
            SNEED.ui.whisperBox.applyPosition(boxElement, savedPosition, doc);
        }
        currentDoc = doc;
    }

    function refreshUI() {
        if (!boxElement) return;

        const partners = getPartnerList();
        SNEED.ui.whisperBox.renderTabs(boxElement, partners, activePartner, (username) => {
            activePartner = username;
            markRead(username);
            refreshUI();
        }, (username) => {
            delete conversations[username];
            if (activePartner === username) {
                const keys = Object.keys(conversations);
                activePartner = keys.length > 0 ? keys[0] : null;
            }
            saveHistory();
            refreshUI();
        }, (username) => {
            // Check activity panel for online status
            if (!currentDoc) return false;
            const lower = username.toLowerCase();
            const activities = currentDoc.querySelectorAll('#chat-activity .activity[data-username]');
            for (const el of activities) {
                if ((el.dataset.username || '').toLowerCase() === lower) return true;
            }
            return false;
        });

        const msgs = activePartner && conversations[activePartner]
            ? conversations[activePartner].messages
            : [];
        SNEED.ui.whisperBox.renderMessages(boxElement, msgs);

        const input = boxElement.querySelector('.whisper-input');
        if (input) {
            input.placeholder = activePartner ? `Whisper to ${activePartner}...` : 'Type a whisper...';
        }
    }

    function sendWhisper(partner, text, doc) {
        const chatInput = doc.getElementById('new-message-input');
        if (!chatInput) return;

        chatInput.textContent = `/w @${partner}, ${text}`;

        if (SNEED.util.positionCursorAtEnd) {
            SNEED.util.positionCursorAtEnd(doc, chatInput);
        }

        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        chatInput.dispatchEvent(enterEvent);
    }

    function addReopenButton(doc) {
        if (doc.getElementById('sneed-whisper-reopen')) return;

        const btn = doc.createElement('button');
        btn.id = 'sneed-whisper-reopen';
        btn.textContent = 'Whispers';
        btn.title = 'Open whisper box';
        btn.style.cssText = `
            position: fixed; bottom: 8px; right: 16px; z-index: 9998;
            background: #1a1a2e; color: #999; border: 1px solid #333;
            border-radius: 6px; padding: 4px 12px; font-size: 11px;
            cursor: pointer; font-family: inherit; display: none;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.color = '#fff'; btn.style.borderColor = '#4a9eff'; });
        btn.addEventListener('mouseleave', () => { btn.style.color = '#999'; btn.style.borderColor = '#333'; });
        btn.addEventListener('click', () => {
            closed = false;
            savedCollapsed = false;
            saveState();
            btn.style.display = 'none';
            ensureBox(doc);
            refreshUI();
        });

        doc.body.appendChild(btn);

        if (closed) btn.style.display = 'block';
    }

    function showReopenButton(doc) {
        const btn = doc.getElementById('sneed-whisper-reopen');
        if (btn) btn.style.display = 'block';
    }

    function hideReopenButton(doc) {
        const btn = doc.getElementById('sneed-whisper-reopen');
        if (btn) btn.style.display = 'none';
    }

    function sendWhisperNotification(partner, messageText, doc) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const docHasFocus = doc.hasFocus();
        let parentHasFocus = false;
        try {
            parentHasFocus = window.parent && window.parent.document.hasFocus();
        } catch (e) { /* cross-origin */ }
        if (docHasFocus || parentHasFocus) return;

        const body = messageText.length > 150 ? messageText.substring(0, 150) + '...' : messageText;

        const notification = new Notification(`Whisper from ${partner}`, {
            body: body,
            icon: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            tag: 'kees-whisper-' + Date.now(),
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            if (window.parent) window.parent.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 5000);
    }

    function extractWhisper(node) {
        if (!node.classList || !node.classList.contains('chat-message--whisper')) return null;

        const partner = node.dataset.whisperPartner;
        const partnerId = parseInt(node.dataset.whisperPartnerId || '0', 10);
        const authorId = parseInt(node.dataset.author || '0', 10);
        const timestamp = parseInt(node.dataset.timestamp || '0', 10);

        const messageEl = node.querySelector('.message');
        const html = messageEl ? messageEl.innerHTML : '';

        const directionEl = node.querySelector('.whisper-direction');
        const directionText = directionEl ? directionEl.textContent.trim().toLowerCase() : '';
        const direction = directionText === 'to' ? 'out' : 'in';

        const authorEl = node.querySelector('.author');
        const authorName = direction === 'out' ? 'You' : partner;

        if (!partner) return null;

        return {
            partner,
            partnerId,
            authorId,
            direction,
            author: authorName,
            html,
            timestamp
        };
    }

    async function start(doc) {
        await loadRetention();
        await loadGlobalState();
        await loadHideMainState();
        await loadPosition();
        await loadState();
        await loadHistory();

        chrome.storage.onChanged.addListener((changes) => {
            if (changes[SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL]) {
                globalEnabled = changes[SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL].newValue === true;
            }
            if (changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN]) {
                hideMainChat = changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN].newValue !== false;
            }
            if (changes[SNEED.state.STORAGE_KEYS.WHISPER_RETENTION]) {
                const val = parseInt(changes[SNEED.state.STORAGE_KEYS.WHISPER_RETENTION].newValue, 10);
                maxHistoryPerPartner = isNaN(val) ? 100 : val;
            }
        });

        // Listen for relayed whisper sends from non-chat tabs
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'relaySendWhisper' && message.partner && message.text) {
                sendWhisper(message.partner, message.text, doc);
            }
        });

        const container = doc.getElementById('chat-messages') || SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const observer = new MutationObserver((mutations) => {
            let newWhispers = false;

            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    const whisperNode = node.classList && node.classList.contains('chat-message--whisper')
                        ? node
                        : node.querySelector && node.querySelector('.chat-message--whisper');

                    const whisper = whisperNode ? extractWhisper(whisperNode) : null;
                    if (!whisper) continue;

                    if (hideMainChat) {
                        whisperNode.style.display = 'none';
                    }

                    addMessage(whisper.partner, whisper.partnerId, {
                        direction: whisper.direction,
                        author: whisper.author,
                        html: whisper.html,
                        timestamp: whisper.timestamp
                    });

                    newWhispers = true;

                    if (whisper.direction === 'in') {
                        const plainText = whisperNode.querySelector('.message')?.textContent?.trim() || '';
                        sendWhisperNotification(whisper.partner, plainText, doc);
                    }

                    if (!activePartner) {
                        activePartner = whisper.partner;
                        markRead(whisper.partner);
                    }
                }
            }

            if (newWhispers) {
                if (closed) {
                    closed = false;
                    savedCollapsed = false;
                    saveState();
                    hideReopenButton(doc);
                }
                ensureBox(doc);
                SNEED.ui.whisperBox.expand(boxElement);
                refreshUI();
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        SNEED.core.events.addManagedObserver(container, observer);

        if (!closed) {
            if (Object.keys(conversations).length > 0 && !activePartner) {
                activePartner = Object.keys(conversations)[0];
            }
            ensureBox(doc);
            refreshUI();
            if (savedCollapsed || Object.keys(conversations).length === 0) {
                const body = boxElement.querySelector('.whisper-body');
                const arrow = boxElement.querySelector('.whisper-toggle-arrow');
                if (body) body.classList.add('collapsed');
                if (arrow) arrow.classList.add('collapsed');
                boxElement.classList.remove('expanded');
                boxElement.style.height = '';
            }
        }

        addReopenButton(doc);
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.whisperBox = { start };

})();
