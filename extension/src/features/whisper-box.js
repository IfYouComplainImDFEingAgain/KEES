/**
 * features/whisper-box.js - Whisper conversation manager
 * Intercepts whisper messages, manages conversations, and controls the whisper UI.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const MAX_HISTORY_PER_PARTNER = 100;

    // Conversation state: { partnerUsername: { partnerId, messages: [], unread: 0 } }
    const conversations = {};
    let activePartner = null;
    let boxElement = null;
    let currentDoc = null;
    let closed = false; // User explicitly closed the box
    let persistenceEnabled = false;
    let hideMainChat = true; // Default to true
    let saveDebounceTimer = null;
    let savedPosition = null;

    // ============================================
    // PERSISTENCE
    // ============================================

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

    async function loadPersistenceState() {
        try {
            const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_PERSISTENCE);
            persistenceEnabled = result === true;
        } catch (e) {
            persistenceEnabled = false;
        }
    }

    async function loadHideMainState() {
        try {
            const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN);
            // Default to true
            hideMainChat = result !== false;
        } catch (e) {
            hideMainChat = true;
        }
    }

    async function loadHistory() {
        if (!persistenceEnabled) return;
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
        if (!persistenceEnabled) return;
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            const serialized = {};
            for (const [partner, data] of Object.entries(conversations)) {
                serialized[partner] = {
                    partnerId: data.partnerId,
                    messages: data.messages.slice(-MAX_HISTORY_PER_PARTNER)
                };
            }
            SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HISTORY, serialized);
        }, 1000);
    }

    // ============================================
    // CONVERSATION MANAGEMENT
    // ============================================

    function addMessage(partnerUsername, partnerId, msg) {
        if (!conversations[partnerUsername]) {
            conversations[partnerUsername] = { partnerId: partnerId, messages: [], unread: 0 };
        }

        const convo = conversations[partnerUsername];
        convo.partnerId = partnerId;
        convo.messages.push(msg);

        // Cap history
        if (convo.messages.length > MAX_HISTORY_PER_PARTNER) {
            convo.messages = convo.messages.slice(-MAX_HISTORY_PER_PARTNER);
        }

        // Track unread if not the active conversation
        if (partnerUsername !== activePartner) {
            convo.unread++;
        }

        saveHistory();
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

    // ============================================
    // UI MANAGEMENT
    // ============================================

    function ensureBox(doc) {
        if (boxElement && doc.getElementById('sneed-whisper-box')) return;

        boxElement = SNEED.ui.whisperBox.createWhisperBox(doc, {
            onToggle: () => {},
            onClose: () => {
                if (boxElement) {
                    boxElement.remove();
                    boxElement = null;
                }
                closed = true;
            },
            onTabClick: (username) => {
                activePartner = username;
                markRead(username);
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

        // Apply saved position
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
        });

        const msgs = activePartner && conversations[activePartner]
            ? conversations[activePartner].messages
            : [];
        SNEED.ui.whisperBox.renderMessages(boxElement, msgs);

        // Update placeholder
        const input = boxElement.querySelector('.whisper-input');
        if (input) {
            input.placeholder = activePartner ? `Whisper to ${activePartner}...` : 'Type a whisper...';
        }
    }

    // ============================================
    // SEND WHISPER
    // ============================================

    function sendWhisper(partner, text, doc) {
        const chatInput = doc.getElementById('new-message-input');
        if (!chatInput) return;

        chatInput.textContent = `/w @${partner}, ${text}`;

        // Position cursor at end
        if (SNEED.util.positionCursorAtEnd) {
            SNEED.util.positionCursorAtEnd(doc, chatInput);
        }

        // Dispatch Enter key to trigger send
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

    // ============================================
    // WHISPER INTERCEPTION
    // ============================================

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

    // ============================================
    // START
    // ============================================

    async function start(doc) {
        await loadPersistenceState();
        await loadHideMainState();
        await loadPosition();
        await loadHistory();

        // Listen for setting changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes[SNEED.state.STORAGE_KEYS.WHISPER_PERSISTENCE]) {
                persistenceEnabled = changes[SNEED.state.STORAGE_KEYS.WHISPER_PERSISTENCE].newValue === true;
            }
            if (changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN]) {
                hideMainChat = changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN].newValue !== false;
            }
        });

        const container = SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const observer = new MutationObserver((mutations) => {
            let newWhispers = false;

            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    const whisper = extractWhisper(node);
                    if (!whisper) continue;

                    // Hide from main chat if enabled
                    if (hideMainChat) {
                        node.style.display = 'none';
                    }

                    addMessage(whisper.partner, whisper.partnerId, {
                        direction: whisper.direction,
                        author: whisper.author,
                        html: whisper.html,
                        timestamp: whisper.timestamp
                    });

                    newWhispers = true;

                    // Auto-select first partner
                    if (!activePartner) {
                        activePartner = whisper.partner;
                        markRead(whisper.partner);
                    }
                }
            }

            if (newWhispers) {
                if (closed) {
                    // Re-open on new whisper
                    closed = false;
                }
                ensureBox(doc);
                SNEED.ui.whisperBox.expand(boxElement);
                refreshUI();
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        SNEED.core.events.addManagedObserver(container, observer);

        // If we have history from storage, show the box
        if (Object.keys(conversations).length > 0) {
            if (!activePartner) {
                activePartner = Object.keys(conversations)[0];
            }
            ensureBox(doc);
            refreshUI();
            // Start collapsed if loaded from history
            const body = boxElement.querySelector('.whisper-body');
            const arrow = boxElement.querySelector('.whisper-toggle-arrow');
            if (body) body.classList.add('collapsed');
            if (arrow) arrow.classList.add('collapsed');
            boxElement.classList.remove('expanded');
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.whisperBox = { start };

})();
