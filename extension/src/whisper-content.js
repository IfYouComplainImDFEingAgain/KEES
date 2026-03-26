/**
 * whisper-content.js - Lightweight whisper box for non-chat pages
 * Renders the whisper box on all site pages when global whisper is enabled.
 * Receives whispers via chrome.storage changes, sends via background relay.
 */
(function() {
    'use strict';

    const STORAGE_KEYS = {
        WHISPER_GLOBAL: 'kees-whisper-global',
        WHISPER_HISTORY: 'kees-whisper-history',
        WHISPER_LATEST: 'kees-whisper-latest',
        WHISPER_POSITION: 'kees-whisper-position-global',
        WHISPER_STATE: 'kees-whisper-state-global',
        WHISPER_HIDE_MAIN: 'kees-whisper-hide-main',
        WHISPER_RETENTION: 'kees-whisper-retention',
        GLOBAL_CHAT: 'kees-global-chat',
        CHAT_WS_URL: 'kees-chat-ws-url',
        CHAT_LAST_ROOM: 'kees-chat-last-room',
        CHAT_USER: 'kees-chat-user'
    };

    let maxHistory = 100;
    const conversations = {};
    let activePartner = null;
    let boxElement = null;
    let closed = false;
    let savedCollapsed = false;
    let savedPosition = null;

    // View mode: 'whispers' or 'chat'
    let viewMode = 'whispers';
    let globalChatEnabled = false;

    // ============================================
    // GLOBAL CHAT - WEBSOCKET CLIENT
    // ============================================

    let chatWs = null;
    let chatWsUrl = null;
    let chatRoom = null;
    let chatUser = null;
    let chatMessages = [];
    let chatReconnectTimer = null;
    let chatRooms = []; // [{ id, name }]
    const CHAT_MAX_MESSAGES = 200;
    const onlineUsers = new Map(); // id -> username

    function isUserOnline(username) {
        const lower = username.toLowerCase();
        for (const name of onlineUsers.values()) {
            if (name.toLowerCase() === lower) return true;
        }
        return false;
    }

    function scrapeWsUrl() {
        // Try to find chat_ws_url in inline scripts on any page
        const scripts = document.querySelectorAll('script:not([src])');
        for (const script of scripts) {
            const match = script.textContent.match(/chat_ws_url\s*[:=]\s*["']([^"']+)["']/);
            if (match) return match[1];
        }
        // Construct from known path pattern — the chat.js overrides
        // host/port/protocol anyway, so we just need the WS path
        // Common path: /ws or /chat/ws
        // Try to find it from any script that mentions a websocket path
        for (const script of scripts) {
            const wsMatch = script.textContent.match(/["'](wss?:\/\/[^"']*\/ws[^"']*)["']/);
            if (wsMatch) return wsMatch[1];
        }
        return null;
    }

    function scrapeRooms() {
        const links = document.querySelectorAll('a[href*="/chat/"]');
        const rooms = [];
        links.forEach(a => {
            const match = a.href.match(/\/chat\/[^/]+\.(\d+)\//);
            if (match) {
                const id = parseInt(match[1], 10);
                const name = a.textContent.trim();
                if (id && name && !rooms.find(r => r.id === id)) {
                    rooms.push({ id, name });
                }
            }
        });
        return rooms;
    }

    function chatConnect() {
        if (!chatWsUrl || !chatRoom) return;
        chatDisconnect();

        try {
            const url = new URL(chatWsUrl);
            url.hostname = window.location.hostname;
            url.port = window.location.port;
            url.protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';

            chatWs = new WebSocket(url.href);

            chatWs.addEventListener('open', () => {
                chatWs.send('/join ' + chatRoom);
                chatAddSystemMessage('Connected to chat');
            });

            chatWs.addEventListener('message', (e) => {
                chatHandleMessage(e.data);
            });

            chatWs.addEventListener('close', () => {
                onlineUsers.clear();
                chatAddSystemMessage('Disconnected. Reconnecting...');
                chatReconnectTimer = setTimeout(chatConnect, 3000);
            });

            chatWs.addEventListener('error', () => {
                // close event will handle reconnect
            });
        } catch (e) {
            chatAddSystemMessage('Failed to connect: ' + e.message);
        }
    }

    function chatDisconnect() {
        if (chatReconnectTimer) {
            clearTimeout(chatReconnectTimer);
            chatReconnectTimer = null;
        }
        if (chatWs) {
            chatWs.onopen = null;
            chatWs.onclose = null;
            chatWs.onerror = null;
            chatWs.onmessage = null;
            if (chatWs.readyState === WebSocket.OPEN || chatWs.readyState === WebSocket.CONNECTING) {
                chatWs.close(1000, 'Closing');
            }
            chatWs = null;
        }
    }

    function chatHandleMessage(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch {
            chatAddSystemMessage(data);
            return;
        }

        if (parsed.system) {
            chatAddSystemMessage(parsed.system);
        }

        if (parsed.messages) {
            for (const msg of parsed.messages) {
                const author = msg.author ? msg.author.username : null;
                const text = msg.message || '';
                chatAddMessage(author, text, msg.message_date);
            }
        }

        if (parsed.whisper) {
            // Whispers are handled separately via storage
        }

        // Track user presence
        let presenceChanged = false;
        if (parsed.users) {
            for (const [id, user] of Object.entries(parsed.users)) {
                if (id !== '0' && user && user.username) {
                    onlineUsers.set(id, user.username);
                    presenceChanged = true;
                }
            }
        }
        if (parsed.user) {
            for (const [id, user] of Object.entries(parsed.user)) {
                if (user === false) {
                    onlineUsers.delete(id);
                    presenceChanged = true;
                }
            }
        }
        if (presenceChanged && viewMode === 'whispers') {
            renderTabs();
        }
    }

    function chatAddSystemMessage(text) {
        chatMessages.push({ system: true, text: text, timestamp: Math.floor(Date.now() / 1000) });
        if (chatMessages.length > CHAT_MAX_MESSAGES) {
            chatMessages = chatMessages.slice(-CHAT_MAX_MESSAGES);
        }
        if (viewMode === 'chat') renderChatMessages();
    }

    function chatAddMessage(author, html, timestamp) {
        chatMessages.push({
            system: false,
            author: author || 'Unknown',
            html: html,
            timestamp: timestamp || Math.floor(Date.now() / 1000)
        });
        if (chatMessages.length > CHAT_MAX_MESSAGES) {
            chatMessages = chatMessages.slice(-CHAT_MAX_MESSAGES);
        }
        if (viewMode === 'chat') renderChatMessages();
    }

    function chatSend(text) {
        if (!chatWs || chatWs.readyState !== WebSocket.OPEN) return;
        chatWs.send(text);
    }

    function renderChatMessages() {
        if (!boxElement) return;
        const container = boxElement.querySelector('.whisper-messages');
        if (!container) return;
        container.replaceChildren();

        if (chatMessages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'whisper-empty';
            empty.textContent = chatWsUrl ? 'No messages yet' : 'Visit a chat page first to connect';
            container.appendChild(empty);
            return;
        }

        for (const msg of chatMessages) {
            const el = document.createElement('div');

            if (msg.system) {
                el.className = 'whisper-msg chat-system';
                el.textContent = msg.text;
            } else {
                el.className = 'whisper-msg chat-msg';
                const authorSpan = document.createElement('span');
                authorSpan.className = 'chat-msg-author';
                authorSpan.textContent = msg.author;

                const sep = document.createTextNode(': ');

                const contentSpan = document.createElement('span');
                contentSpan.className = 'chat-msg-content';
                contentSpan.innerHTML = sanitizeHTML(msg.html);

                el.appendChild(authorSpan);
                el.appendChild(sep);
                el.appendChild(contentSpan);
            }

            container.appendChild(el);
        }

        container.scrollTop = container.scrollHeight;
    }

    // ============================================
    // STORAGE HELPERS
    // ============================================

    function storageGet(key) {
        return new Promise(resolve => {
            chrome.storage.local.get([key], result => resolve(result[key]));
        });
    }

    function storageSet(key, value) {
        chrome.storage.local.set({ [key]: value });
    }

    // ============================================
    // STYLES (inline, self-contained)
    // ============================================

    function injectStyles() {
        if (document.getElementById('sneed-whisper-global-styles')) return;
        const style = document.createElement('style');
        style.id = 'sneed-whisper-global-styles';
        style.textContent = `
            #sneed-whisper-box {
                position: fixed;
                bottom: 0;
                right: 16px;
                width: 340px;
                min-width: 250px;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                border-radius: 8px 8px 0 0;
                box-shadow: 0 -2px 16px rgba(0,0,0,0.4);
                display: flex;
                flex-direction: column;
            }
            #sneed-whisper-box.expanded {
                min-height: 80px;
                max-height: 70vh;
                resize: both;
                overflow: auto;
            }
            #sneed-whisper-box .whisper-header {
                display: flex; align-items: center; background: #1a1a2e;
                padding: 6px 8px; cursor: grab; user-select: none;
                border-bottom: 1px solid #333; min-height: 32px;
            }
            #sneed-whisper-box .whisper-header:active { cursor: grabbing; }
            #sneed-whisper-box .whisper-header-title { color: #ccc; font-size: 12px; font-weight: 600; margin-right: auto; }
            #sneed-whisper-box .whisper-toggle-arrow { color: #aaa; font-size: 14px; margin-right: 6px; transition: transform 0.3s ease; cursor: pointer; }
            #sneed-whisper-box .whisper-toggle-arrow.collapsed { transform: rotate(180deg); }
            #sneed-whisper-box .whisper-close-btn { background: none; border: none; color: #888; font-size: 16px; cursor: pointer; padding: 0 4px; line-height: 1; }
            #sneed-whisper-box .whisper-close-btn:hover { color: #ff4444; }
            #sneed-whisper-box .whisper-body { display: flex; flex-direction: column; background: #0f0f1a; flex: 1; overflow: hidden; min-height: 0; }
            #sneed-whisper-box .whisper-body.collapsed { display: none; }
            #sneed-whisper-box .whisper-tabs-row { display: flex; background: #16162a; border-bottom: 1px solid #333; min-height: 30px; }
            #sneed-whisper-box .whisper-tabs { display: flex; overflow-x: auto; flex: 1; min-height: 30px; scrollbar-width: thin; }
            #sneed-whisper-box .whisper-tab { padding: 5px 10px; color: #999; font-size: 11px; cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent; transition: all 0.15s; flex-shrink: 0; }
            #sneed-whisper-box .whisper-tab:hover { color: #ddd; background: rgba(255,255,255,0.05); }
            #sneed-whisper-box .whisper-tab.active { color: #fff; border-bottom-color: #4a9eff; }
            #sneed-whisper-box .whisper-tab .status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
            #sneed-whisper-box .whisper-tab .status-dot.online { background: #44cc44; box-shadow: 0 0 3px #44cc44; }
            #sneed-whisper-box .whisper-tab .status-dot.offline { background: #555; }
            #sneed-whisper-box .whisper-tab .unread-badge { display: inline-block; background: #ff4444; color: #fff; font-size: 9px; font-weight: bold; border-radius: 50%; min-width: 14px; height: 14px; line-height: 14px; text-align: center; margin-left: 4px; padding: 0 3px; }
            #sneed-whisper-box .whisper-add-tab { background: none; border: none; border-left: 1px solid #333; color: #666; font-size: 16px; cursor: pointer; padding: 0 10px; transition: color 0.15s; flex-shrink: 0; }
            #sneed-whisper-box .whisper-add-tab:hover { color: #4a9eff; }
            #sneed-whisper-box .whisper-new-user-row { display: flex; gap: 4px; padding: 6px; background: #16162a; border-bottom: 1px solid #333; }
            #sneed-whisper-box .whisper-new-user-input { flex: 1; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #eee; padding: 4px 8px; font-size: 11px; outline: none; }
            #sneed-whisper-box .whisper-new-user-input:focus { border-color: #4a9eff; }
            #sneed-whisper-box .whisper-new-user-input::placeholder { color: #555; }
            #sneed-whisper-box .whisper-new-user-ok { background: #4a9eff; border: none; border-radius: 4px; color: #fff; padding: 4px 8px; cursor: pointer; font-size: 11px; font-weight: 600; }
            #sneed-whisper-box .whisper-messages { flex: 1; overflow-y: auto; padding: 8px; min-height: 0; scrollbar-width: thin; display: flex; flex-direction: column; }
            #sneed-whisper-box .whisper-msg { margin-bottom: 6px; padding: 4px 8px; border-radius: 6px; max-width: 85%; word-wrap: break-word; font-size: 12px; line-height: 1.4; }
            #sneed-whisper-box .whisper-msg.incoming { background: #2a1a2a; color: #ddd; align-self: flex-start; border-bottom-left-radius: 2px; }
            #sneed-whisper-box .whisper-msg.outgoing { background: #1a2a3a; color: #eee; align-self: flex-end; border-bottom-right-radius: 2px; }
            #sneed-whisper-box .whisper-msg .whisper-msg-time { font-size: 9px; color: #666; margin-top: 2px; }
            #sneed-whisper-box .whisper-msg .whisper-msg-author { font-size: 10px; color: #4a9eff; font-weight: 600; margin-bottom: 1px; }
            #sneed-whisper-box .whisper-empty { color: #555; font-style: italic; text-align: center; padding: 40px 16px; font-size: 12px; }
            #sneed-whisper-box .whisper-time-separator { display: flex; align-items: center; gap: 8px; margin: 8px 0; color: #555; font-size: 10px; }
            #sneed-whisper-box .whisper-time-separator::before, #sneed-whisper-box .whisper-time-separator::after { content: ''; flex: 1; height: 1px; background: #333; }
            #sneed-whisper-box .whisper-input-row { display: flex; padding: 6px; background: #16162a; border-top: 1px solid #333; gap: 4px; }
            #sneed-whisper-box .whisper-input { flex: 1; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #eee; padding: 6px 8px; font-size: 12px; outline: none; font-family: inherit; }
            #sneed-whisper-box .whisper-input:focus { border-color: #4a9eff; }
            #sneed-whisper-box .whisper-input::placeholder { color: #555; }
            #sneed-whisper-box .whisper-send { background: #4a9eff; border: none; border-radius: 4px; color: #fff; padding: 6px 10px; cursor: pointer; font-size: 12px; font-weight: 600; }
            #sneed-whisper-box .whisper-send:hover { background: #3a8eef; }
            #sneed-whisper-box .whisper-no-chat { color: #ff8844; font-size: 10px; text-align: center; padding: 2px; background: #16162a; border-top: 1px solid #333; }
            #sneed-whisper-box .whisper-view-toggle { background: none; border: 1px solid #444; border-radius: 3px; color: #999; font-size: 10px; cursor: pointer; padding: 2px 6px; margin-right: 6px; transition: all 0.15s; }
            #sneed-whisper-box .whisper-view-toggle:hover { color: #fff; border-color: #666; }
            #sneed-whisper-box .whisper-view-toggle.active { color: #4a9eff; border-color: #4a9eff; }
            #sneed-whisper-box .chat-system { color: #666; font-style: italic; font-size: 11px; padding: 2px 0; align-self: center; max-width: 100%; }
            #sneed-whisper-box .chat-msg { color: #ddd; font-size: 12px; padding: 2px 0; max-width: 100%; align-self: stretch; word-wrap: break-word; }
            #sneed-whisper-box .chat-msg-author { color: #4a9eff; font-weight: 600; font-size: 12px; }
            #sneed-whisper-box .chat-msg-content { color: #ddd; }
            #sneed-whisper-box .chat-msg-content img { max-height: 80px; max-width: 100%; vertical-align: middle; }
            #sneed-whisper-box .chat-msg-content a { color: #6ab0ff; }
            #sneed-whisper-box .chat-room-selector { display: flex; align-items: center; padding: 4px 8px; background: #16162a; border-bottom: 1px solid #333; gap: 4px; }
            #sneed-whisper-box .chat-room-select { flex: 1; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #eee; padding: 3px 6px; font-size: 11px; outline: none; font-family: inherit; }
            #sneed-whisper-box .chat-room-select:focus { border-color: #4a9eff; }
            #sneed-whisper-box .chat-room-label { color: #888; font-size: 10px; flex-shrink: 0; }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // HTML SANITIZATION
    // ============================================

    const ALLOWED_TAGS = new Set([
        'b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike', 'code', 'pre',
        'span', 'div', 'p', 'br', 'a', 'img', 'ul', 'ol', 'li', 'blockquote'
    ]);
    const ALLOWED_ATTRS = {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'width', 'height', 'title'],
        'span': ['class', 'style'],
        'div': ['class', 'style']
    };
    const SAFE_URL_RE = /^https?:\/\//i;

    function sanitizeHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        sanitizeNode(template.content);
        return template.innerHTML;
    }

    function sanitizeNode(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === Node.TEXT_NODE) continue;
            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                continue;
            }
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) {
                child.replaceWith(document.createTextNode(child.textContent));
                continue;
            }
            const allowed = ALLOWED_ATTRS[tag] || [];
            for (const attr of Array.from(child.attributes)) {
                if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
            }
            if (tag === 'a') {
                const href = child.getAttribute('href');
                if (href && !SAFE_URL_RE.test(href)) child.removeAttribute('href');
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
            if (tag === 'img') {
                const src = child.getAttribute('src');
                if (src && !SAFE_URL_RE.test(src)) { child.remove(); continue; }
            }
            if (child.hasAttribute('style')) {
                const style = child.getAttribute('style');
                const safeStyle = style.replace(/[^;]+/g, (rule) => {
                    const prop = rule.split(':')[0].trim().toLowerCase();
                    return ['color', 'font-size', 'text-align', 'text-decoration', 'font-weight', 'font-style'].includes(prop) ? rule : '';
                }).replace(/;{2,}/g, ';').replace(/^;|;$/g, '');
                if (safeStyle) child.setAttribute('style', safeStyle);
                else child.removeAttribute('style');
            }
            sanitizeNode(child);
        }
    }

    // ============================================
    // LOAD DATA
    // ============================================

    async function loadHistory() {
        const history = await storageGet(STORAGE_KEYS.WHISPER_HISTORY);
        if (history && typeof history === 'object') {
            for (const [partner, data] of Object.entries(history)) {
                conversations[partner] = {
                    partnerId: data.partnerId || 0,
                    messages: data.messages || [],
                    unread: 0
                };
            }
        }
    }

    async function loadPosition() {
        const pos = await storageGet(STORAGE_KEYS.WHISPER_POSITION);
        if (pos && typeof pos.x === 'number') savedPosition = pos;
    }

    async function loadState() {
        const state = await storageGet(STORAGE_KEYS.WHISPER_STATE);
        if (state && typeof state === 'object') {
            savedCollapsed = state.collapsed === true;
            closed = state.closed === true;
        }
    }

    function saveState() {
        storageSet(STORAGE_KEYS.WHISPER_STATE, {
            collapsed: savedCollapsed,
            closed: closed
        });
    }

    // ============================================
    // UI
    // ============================================

    function getPartnerList() {
        return Object.entries(conversations).map(([username, data]) => ({
            username, unread: data.unread
        }));
    }

    function renderTabs() {
        if (!boxElement) return;
        const tabs = boxElement.querySelector('.whisper-tabs');
        if (!tabs) return;
        tabs.replaceChildren();

        getPartnerList().forEach(p => {
            const tab = document.createElement('div');
            tab.className = 'whisper-tab' + (p.username === activePartner ? ' active' : '');

            const dot = document.createElement('span');
            dot.className = 'status-dot ' + (isUserOnline(p.username) ? 'online' : 'offline');
            tab.appendChild(dot);

            tab.appendChild(document.createTextNode(p.username));
            if (p.unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = p.unread > 9 ? '9+' : String(p.unread);
                tab.appendChild(badge);
            }

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '\u00d7';
            closeBtn.style.cssText = 'margin-left:4px;color:#666;font-size:12px;cursor:pointer;line-height:1;';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                delete conversations[p.username];
                if (activePartner === p.username) {
                    const keys = Object.keys(conversations);
                    activePartner = keys.length > 0 ? keys[0] : null;
                }
                refreshUI();
            });
            tab.appendChild(closeBtn);

            tab.addEventListener('click', () => {
                activePartner = p.username;
                if (conversations[p.username]) conversations[p.username].unread = 0;
                refreshUI();
            });
            tabs.appendChild(tab);
        });
    }

    function renderMessages() {
        if (!boxElement) return;
        const container = boxElement.querySelector('.whisper-messages');
        if (!container) return;
        container.replaceChildren();

        const msgs = activePartner && conversations[activePartner]
            ? conversations[activePartner].messages : [];

        if (msgs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'whisper-empty';
            empty.textContent = activePartner ? 'No messages in this conversation' : 'No whispers yet';
            container.appendChild(empty);
            return;
        }

        const ONE_HOUR = 3600;
        let lastTs = 0;
        msgs.forEach(msg => {
            if (lastTs > 0 && (msg.timestamp - lastTs) > ONE_HOUR) {
                const sep = document.createElement('div');
                sep.className = 'whisper-time-separator';
                sep.textContent = new Date(msg.timestamp * 1000).toLocaleString();
                container.appendChild(sep);
            }
            lastTs = msg.timestamp;

            const el = document.createElement('div');
            el.className = 'whisper-msg ' + (msg.direction === 'out' ? 'outgoing' : 'incoming');

            const author = document.createElement('div');
            author.className = 'whisper-msg-author';
            author.textContent = msg.author;

            const content = document.createElement('div');
            content.innerHTML = sanitizeHTML(msg.html);

            const time = document.createElement('div');
            time.className = 'whisper-msg-time';
            time.textContent = new Date(msg.timestamp * 1000).toLocaleTimeString();

            el.appendChild(author);
            el.appendChild(content);
            el.appendChild(time);
            container.appendChild(el);
        });

        container.scrollTop = container.scrollHeight;
    }

    function switchView() {
        if (!boxElement) return;

        const title = boxElement.querySelector('.whisper-header-title');
        if (title) title.textContent = viewMode === 'chat' ? 'Chat' : 'Whispers';

        // Update toggle button states
        boxElement.querySelectorAll('.whisper-view-toggle').forEach(btn => {
            const isChat = btn.textContent === 'Chat';
            btn.classList.toggle('active', (isChat && viewMode === 'chat') || (!isChat && viewMode === 'whispers'));
        });

        // Show/hide view-specific UI
        const tabsRow = boxElement.querySelector('.whisper-tabs-row');
        const newUserRow = boxElement.querySelector('.whisper-new-user-row');
        const roomSel = boxElement.querySelector('.chat-room-selector');
        if (tabsRow) tabsRow.style.display = viewMode === 'whispers' ? 'flex' : 'none';
        if (newUserRow && viewMode === 'chat') newUserRow.style.display = 'none';
        if (roomSel) roomSel.style.display = viewMode === 'chat' ? 'flex' : 'none';

        refreshUI();
    }

    function refreshUI() {
        if (viewMode === 'chat') {
            renderChatMessages();
            const input = boxElement ? boxElement.querySelector('.whisper-input') : null;
            if (input) input.placeholder = 'Send a message...';
        } else {
            renderTabs();
            renderMessages();
            const input = boxElement ? boxElement.querySelector('.whisper-input') : null;
            if (input) {
                input.placeholder = activePartner ? `Whisper to ${activePartner}...` : 'Type a whisper...';
            }
        }
    }

    function applyPosition(applySize) {
        if (!boxElement || !savedPosition) return;
        const x = Math.max(0, Math.min(window.innerWidth - boxElement.offsetWidth, savedPosition.x * window.innerWidth));
        const y = Math.max(0, Math.min(window.innerHeight - 32, savedPosition.y * window.innerHeight));
        boxElement.style.bottom = 'auto';
        boxElement.style.right = 'auto';
        boxElement.style.left = x + 'px';
        boxElement.style.top = y + 'px';
        if (applySize) {
            if (savedPosition.width) boxElement.style.width = savedPosition.width + 'px';
            if (savedPosition.height) boxElement.style.height = savedPosition.height + 'px';
        }
        adjustOrientation();
    }

    function savePositionDebounced() {
        clearTimeout(savePositionDebounced._timer);
        savePositionDebounced._timer = setTimeout(() => {
            if (!boxElement) return;
            const rect = boxElement.getBoundingClientRect();
            savedPosition = {
                x: rect.left / window.innerWidth,
                y: rect.top / window.innerHeight,
                width: rect.width,
                height: rect.height
            };
            storageSet(STORAGE_KEYS.WHISPER_POSITION, savedPosition);
        }, 300);
    }

    function adjustOrientation() {
        if (!boxElement) return;
        requestAnimationFrame(() => {
            const rect = boxElement.getBoundingClientRect();
            const vh = window.innerHeight;
            const vw = window.innerWidth;
            const nearBottom = rect.top > vh * 0.5;

            if (nearBottom) {
                boxElement.style.flexDirection = 'column-reverse';
                boxElement.style.borderRadius = '0 0 8px 8px';
            } else {
                boxElement.style.flexDirection = 'column';
                boxElement.style.borderRadius = '8px 8px 0 0';
            }

            // Clamp to viewport
            let changed = false;
            let top = rect.top;
            let left = rect.left;

            if (rect.bottom > vh) { top = vh - rect.height; changed = true; }
            if (top < 0) { top = 0; changed = true; }
            if (rect.right > vw) { left = vw - rect.width; changed = true; }
            if (left < 0) { left = 0; changed = true; }

            if (changed) {
                boxElement.style.top = top + 'px';
                boxElement.style.left = left + 'px';
                boxElement.style.bottom = 'auto';
                boxElement.style.right = 'auto';
            }
        });
    }

    function sendWhisperNotification(partner, messageText) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        if (document.hasFocus()) return;

        const body = messageText.length > 150 ? messageText.substring(0, 150) + '...' : messageText;

        const notification = new Notification(`Whisper from ${partner}`, {
            body: body,
            icon: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            tag: 'kees-whisper-' + Date.now(),
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 5000);
    }

    function sendWhisper(text) {
        if (!activePartner || !text) return;
        chrome.runtime.sendMessage({
            type: 'sendWhisper',
            partner: activePartner,
            text: text
        }, (response) => {
            if (response && !response.success) {
                // Show no-chat indicator briefly
                const indicator = boxElement ? boxElement.querySelector('.whisper-no-chat') : null;
                if (indicator) {
                    indicator.textContent = 'No chat tab open - cannot send';
                    indicator.style.display = 'block';
                    setTimeout(() => { indicator.style.display = 'none'; }, 3000);
                }
            }
        });
    }

    function createBox() {
        if (boxElement) return;
        injectStyles();

        boxElement = document.createElement('div');
        boxElement.id = 'sneed-whisper-box';
        boxElement.classList.add('expanded');

        // Header
        const header = document.createElement('div');
        header.className = 'whisper-header';

        const arrow = document.createElement('span');
        arrow.className = 'whisper-toggle-arrow';
        arrow.textContent = '\u25BC';

        const title = document.createElement('span');
        title.className = 'whisper-header-title';
        title.textContent = viewMode === 'chat' ? 'Chat' : 'Whispers';

        // View toggle buttons (only if global chat is enabled)
        const viewBtns = document.createElement('span');
        if (globalChatEnabled) {
            const whisperBtn = document.createElement('button');
            whisperBtn.className = 'whisper-view-toggle' + (viewMode === 'whispers' ? ' active' : '');
            whisperBtn.textContent = 'Whispers';
            whisperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewMode = 'whispers';
                switchView();
            });

            const chatBtn = document.createElement('button');
            chatBtn.className = 'whisper-view-toggle' + (viewMode === 'chat' ? ' active' : '');
            chatBtn.textContent = 'Chat';
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewMode = 'chat';
                switchView();
            });

            viewBtns.appendChild(whisperBtn);
            viewBtns.appendChild(chatBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'whisper-close-btn';
        closeBtn.textContent = '\u00d7';

        header.appendChild(arrow);
        header.appendChild(title);
        header.appendChild(viewBtns);
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'whisper-body';

        // Tabs row
        const tabsRow = document.createElement('div');
        tabsRow.className = 'whisper-tabs-row';
        const tabs = document.createElement('div');
        tabs.className = 'whisper-tabs';
        const addTabBtn = document.createElement('button');
        addTabBtn.className = 'whisper-add-tab';
        addTabBtn.textContent = '+';
        tabsRow.appendChild(tabs);
        tabsRow.appendChild(addTabBtn);

        // New user row
        const newUserRow = document.createElement('div');
        newUserRow.className = 'whisper-new-user-row';
        newUserRow.style.display = 'none';
        const newUserInput = document.createElement('input');
        newUserInput.className = 'whisper-new-user-input';
        newUserInput.type = 'text';
        newUserInput.placeholder = 'Username...';
        const newUserOk = document.createElement('button');
        newUserOk.className = 'whisper-new-user-ok';
        newUserOk.textContent = 'Start';
        newUserRow.appendChild(newUserInput);
        newUserRow.appendChild(newUserOk);

        function submitNewUser() {
            const username = newUserInput.value.trim();
            if (username) {
                if (!conversations[username]) {
                    conversations[username] = { partnerId: 0, messages: [], unread: 0 };
                }
                activePartner = username;
                newUserInput.value = '';
                newUserRow.style.display = 'none';
                refreshUI();
            }
        }

        addTabBtn.addEventListener('click', () => {
            const visible = newUserRow.style.display !== 'none';
            newUserRow.style.display = visible ? 'none' : 'flex';
            if (!visible) newUserInput.focus();
        });
        newUserOk.addEventListener('click', submitNewUser);
        newUserInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submitNewUser(); }
            else if (e.key === 'Escape') { newUserRow.style.display = 'none'; }
        });

        // Room selector (chat mode)
        const roomSelector = document.createElement('div');
        roomSelector.className = 'chat-room-selector';
        roomSelector.style.display = viewMode === 'chat' ? 'flex' : 'none';

        const roomLabel = document.createElement('span');
        roomLabel.className = 'chat-room-label';
        roomLabel.textContent = 'Room:';

        const roomSelect = document.createElement('select');
        roomSelect.className = 'chat-room-select';

        function populateRooms() {
            roomSelect.replaceChildren();
            chatRooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = String(r.id);
                opt.textContent = r.name;
                if (r.id === chatRoom) opt.selected = true;
                roomSelect.appendChild(opt);
            });
        }

        populateRooms();

        roomSelect.addEventListener('change', () => {
            const newRoom = parseInt(roomSelect.value, 10);
            if (newRoom && newRoom !== chatRoom) {
                chatRoom = newRoom;
                storageSet(STORAGE_KEYS.CHAT_LAST_ROOM, chatRoom);
                chatMessages = [];
                chatConnect();
            }
        });

        roomSelector.appendChild(roomLabel);
        roomSelector.appendChild(roomSelect);

        // Messages
        const messages = document.createElement('div');
        messages.className = 'whisper-messages';

        // Input row
        const inputRow = document.createElement('div');
        inputRow.className = 'whisper-input-row';
        const input = document.createElement('input');
        input.className = 'whisper-input';
        input.type = 'text';
        input.placeholder = 'Type a whisper...';
        const sendBtn = document.createElement('button');
        sendBtn.className = 'whisper-send';
        sendBtn.textContent = 'Send';
        inputRow.appendChild(input);
        inputRow.appendChild(sendBtn);

        // No chat indicator
        const noChat = document.createElement('div');
        noChat.className = 'whisper-no-chat';
        noChat.style.display = 'none';

        body.appendChild(tabsRow);
        body.appendChild(newUserRow);
        body.appendChild(roomSelector);
        body.appendChild(messages);
        body.appendChild(inputRow);
        body.appendChild(noChat);

        boxElement.appendChild(header);
        boxElement.appendChild(body);

        // Drag
        let isDragging = false, hasDragged = false, dragStartX = 0, dragStartY = 0, boxStartX = 0, boxStartY = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn) return;
            isDragging = true; hasDragged = false;
            dragStartX = e.clientX; dragStartY = e.clientY;
            const rect = boxElement.getBoundingClientRect();
            boxStartX = rect.left; boxStartY = rect.top;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onDragEnd);
            e.preventDefault();
        });

        function onDrag(e) {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
            let nx = Math.max(0, Math.min(window.innerWidth - boxElement.offsetWidth, boxStartX + dx));
            let ny = Math.max(0, Math.min(window.innerHeight - 32, boxStartY + dy));
            boxElement.style.bottom = 'auto'; boxElement.style.right = 'auto';
            boxElement.style.left = nx + 'px'; boxElement.style.top = ny + 'px';
        }

        function onDragEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
            if (hasDragged) {
                savePositionDebounced();
                adjustOrientation();
            }
        }

        // Resize save
        const resizeObs = new ResizeObserver(() => {
            if (!body.classList.contains('collapsed')) savePositionDebounced();
        });
        resizeObs.observe(boxElement);

        // Toggle
        header.addEventListener('click', (e) => {
            if (e.target === closeBtn || hasDragged) return;
            const collapsing = !body.classList.contains('collapsed');
            body.classList.toggle('collapsed');
            arrow.classList.toggle('collapsed');
            if (collapsing) {
                const rect = boxElement.getBoundingClientRect();
                boxElement.dataset.prevHeight = boxElement.style.height || '';
                boxElement.dataset.prevWidth = boxElement.style.width || '';
                boxElement.dataset.prevBottom = String(rect.bottom);
                boxElement.style.height = '';
                boxElement.classList.remove('expanded');

                if (boxElement.style.flexDirection === 'column-reverse') {
                    const headerHeight = header.offsetHeight || 32;
                    boxElement.style.top = (rect.bottom - headerHeight) + 'px';
                    boxElement.style.bottom = 'auto';
                }
            } else {
                boxElement.classList.add('expanded');
                if (boxElement.dataset.prevHeight) {
                    boxElement.style.height = boxElement.dataset.prevHeight;
                } else if (savedPosition && savedPosition.height) {
                    boxElement.style.height = savedPosition.height + 'px';
                }

                if (boxElement.style.flexDirection === 'column-reverse' && boxElement.dataset.prevBottom) {
                    const newHeight = boxElement.offsetHeight;
                    const prevBottom = parseFloat(boxElement.dataset.prevBottom);
                    boxElement.style.top = (prevBottom - newHeight) + 'px';
                    boxElement.style.bottom = 'auto';
                }
                adjustOrientation();
            }
            savedCollapsed = collapsing;
            saveState();
        });

        // Close
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            boxElement.remove();
            boxElement = null;
            closed = true;
            saveState();
        });

        // Send
        function doSend() {
            const text = input.value.trim();
            if (!text) return;
            if (viewMode === 'chat') {
                chatSend(text);
            } else {
                sendWhisper(text);
            }
            input.value = '';
            input.focus();
        }
        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doSend(); }
        });

        document.body.appendChild(boxElement);
        applyPosition(false);
        refreshUI();

        // Start collapsed
        body.classList.add('collapsed');
        arrow.classList.add('collapsed');
        boxElement.classList.remove('expanded');
        boxElement.style.height = '';
    }

    // ============================================
    // INIT
    // ============================================

    async function init() {
        const enabled = await storageGet(STORAGE_KEYS.WHISPER_GLOBAL);
        if (!enabled) return;

        const retVal = await storageGet(STORAGE_KEYS.WHISPER_RETENTION);
        if (retVal !== undefined && retVal !== null) {
            maxHistory = parseInt(retVal, 10) || 0;
        }

        // Load global chat config
        globalChatEnabled = (await storageGet(STORAGE_KEYS.GLOBAL_CHAT)) === true;
        if (globalChatEnabled) {
            chatWsUrl = await storageGet(STORAGE_KEYS.CHAT_WS_URL);
            chatRoom = await storageGet(STORAGE_KEYS.CHAT_LAST_ROOM);
            chatUser = await storageGet(STORAGE_KEYS.CHAT_USER);
            chatRooms = scrapeRooms();

            // Try to scrape WS URL from page if not stored
            if (!chatWsUrl) {
                chatWsUrl = scrapeWsUrl();
                if (chatWsUrl) {
                    storageSet(STORAGE_KEYS.CHAT_WS_URL, chatWsUrl);
                }
            }


            // Construct WS URL if not stored or if stored URL has wrong path
            if (!chatWsUrl || !chatWsUrl.includes('/chat.ws')) {
                const proto = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
                const host = window.location.hostname;
                const port = window.location.port ? ':' + window.location.port : '';
                chatWsUrl = proto + '//' + host + port + '/chat.ws';
                storageSet(STORAGE_KEYS.CHAT_WS_URL, chatWsUrl);
            }

            // Default to first room if none saved
            if (!chatRoom && chatRooms.length > 0) {
                chatRoom = chatRooms[0].id;
            }
        }

        await loadHistory();
        await loadPosition();
        await loadState();

        // If global chat is enabled, show the box even without whisper history
        if (globalChatEnabled && !closed) {
            if (!boxElement) {
                viewMode = 'chat';
                createBox();
            }
            if (chatWsUrl && chatRoom) {
                chatConnect();
            } else {
                chatAddSystemMessage('Visit a chat page once to enable global chat');
            }
        }

        if (Object.keys(conversations).length > 0 && !closed) {
            activePartner = Object.keys(conversations)[0];
            createBox();
            // Apply saved collapsed state
            if (!savedCollapsed && boxElement) {
                const body = boxElement.querySelector('.whisper-body');
                const arrow = boxElement.querySelector('.whisper-toggle-arrow');
                if (body) body.classList.remove('collapsed');
                if (arrow) arrow.classList.remove('collapsed');
                boxElement.classList.add('expanded');
                if (savedPosition && savedPosition.height) {
                    boxElement.style.height = savedPosition.height + 'px';
                }
                adjustOrientation();
            }
        }

        // Listen for new whispers from chat tab
        chrome.storage.onChanged.addListener((changes) => {
            if (changes[STORAGE_KEYS.WHISPER_LATEST]) {
                const latest = changes[STORAGE_KEYS.WHISPER_LATEST].newValue;
                if (!latest) return;

                const { partner, partnerId, msg } = latest;
                if (!conversations[partner]) {
                    conversations[partner] = { partnerId: partnerId || 0, messages: [], unread: 0 };
                }
                conversations[partner].messages.push(msg);
                if (maxHistory > 0 && conversations[partner].messages.length > maxHistory) {
                    conversations[partner].messages = conversations[partner].messages.slice(-maxHistory);
                }

                if (partner !== activePartner && msg.direction !== 'out') {
                    conversations[partner].unread++;
                }

                if (!activePartner) activePartner = partner;

                // Notify for incoming whispers
                if (msg.direction === 'in') {
                    // Extract plain text from HTML
                    const tmp = document.createElement('div');
                    tmp.innerHTML = msg.html;
                    sendWhisperNotification(partner, tmp.textContent.trim());
                }

                if (closed) {
                    closed = false;
                    savedCollapsed = false;
                    saveState();
                }

                if (!boxElement) {
                    createBox();
                    // Expand on new message
                    const body = boxElement.querySelector('.whisper-body');
                    const arrow = boxElement.querySelector('.whisper-toggle-arrow');
                    if (body) body.classList.remove('collapsed');
                    if (arrow) arrow.classList.remove('collapsed');
                    boxElement.classList.add('expanded');
                    if (savedPosition && savedPosition.height) {
                        boxElement.style.height = savedPosition.height + 'px';
                    }
                    adjustOrientation();
                }

                refreshUI();
            }

            if (changes[STORAGE_KEYS.WHISPER_RETENTION]) {
                const val = parseInt(changes[STORAGE_KEYS.WHISPER_RETENTION].newValue, 10);
                maxHistory = isNaN(val) ? 100 : val;
            }

            if (changes[STORAGE_KEYS.WHISPER_GLOBAL]) {
                if (changes[STORAGE_KEYS.WHISPER_GLOBAL].newValue !== true && boxElement) {
                    chatDisconnect();
                    boxElement.remove();
                    boxElement = null;
                }
            }

            if (changes[STORAGE_KEYS.GLOBAL_CHAT]) {
                globalChatEnabled = changes[STORAGE_KEYS.GLOBAL_CHAT].newValue === true;
                if (!globalChatEnabled) {
                    chatDisconnect();
                }
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        chatDisconnect();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
