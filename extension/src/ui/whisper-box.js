/**
 * ui/whisper-box.js - Floating whisper chat box UI
 * Renders the whisper conversation window with tabs, messages, and input.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;

    const WHISPER_STYLES = `
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
            resize: both;
            overflow: auto;
        }
        #sneed-whisper-box .whisper-header {
            display: flex;
            align-items: center;
            background: #1a1a2e;
            padding: 6px 8px;
            cursor: grab;
            user-select: none;
            border-bottom: 1px solid #333;
            min-height: 32px;
        }
        #sneed-whisper-box .whisper-header:active {
            cursor: grabbing;
        }
        #sneed-whisper-box .whisper-header-title {
            color: #ccc;
            font-size: 12px;
            font-weight: 600;
            margin-right: auto;
        }
        #sneed-whisper-box .whisper-toggle-arrow {
            color: #aaa;
            font-size: 14px;
            margin-right: 6px;
            transition: transform 0.3s ease;
            cursor: pointer;
        }
        #sneed-whisper-box .whisper-toggle-arrow.collapsed {
            transform: rotate(180deg);
        }
        #sneed-whisper-box .whisper-close-btn {
            background: none;
            border: none;
            color: #888;
            font-size: 16px;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
        }
        #sneed-whisper-box .whisper-close-btn:hover {
            color: #ff4444;
        }
        #sneed-whisper-box .whisper-body {
            display: flex;
            flex-direction: column;
            background: #0f0f1a;
            flex: 1;
            overflow: hidden;
        }
        #sneed-whisper-box .whisper-body.collapsed {
            display: none;
        }
        #sneed-whisper-box .whisper-tab {
            padding: 5px 10px;
            color: #999;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
            border-bottom: 2px solid transparent;
            transition: all 0.15s;
            position: relative;
            flex-shrink: 0;
        }
        #sneed-whisper-box .whisper-tab:hover {
            color: #ddd;
            background: rgba(255,255,255,0.05);
        }
        #sneed-whisper-box .whisper-tab.active {
            color: #fff;
            border-bottom-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-tabs-row {
            display: flex;
            background: #16162a;
            border-bottom: 1px solid #333;
            min-height: 30px;
        }
        #sneed-whisper-box .whisper-tabs {
            display: flex;
            overflow-x: auto;
            flex: 1;
            min-height: 30px;
            scrollbar-width: thin;
        }
        #sneed-whisper-box .whisper-tabs::-webkit-scrollbar {
            height: 3px;
        }
        #sneed-whisper-box .whisper-tabs::-webkit-scrollbar-thumb {
            background: #444;
        }
        #sneed-whisper-box .whisper-add-tab {
            background: none;
            border: none;
            border-left: 1px solid #333;
            color: #666;
            font-size: 16px;
            cursor: pointer;
            padding: 0 10px;
            transition: color 0.15s;
            flex-shrink: 0;
        }
        #sneed-whisper-box .whisper-add-tab:hover {
            color: #4a9eff;
        }
        #sneed-whisper-box .whisper-new-user-row {
            display: flex;
            gap: 4px;
            padding: 6px;
            background: #16162a;
            border-bottom: 1px solid #333;
        }
        #sneed-whisper-box .whisper-new-user-input {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #eee;
            padding: 4px 8px;
            font-size: 11px;
            outline: none;
            font-family: inherit;
        }
        #sneed-whisper-box .whisper-new-user-input:focus {
            border-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-new-user-input::placeholder {
            color: #555;
        }
        #sneed-whisper-box .whisper-new-user-ok {
            background: #4a9eff;
            border: none;
            border-radius: 4px;
            color: #fff;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
        }
        #sneed-whisper-box .whisper-new-user-ok:hover {
            background: #3a8eef;
        }
        #sneed-whisper-box .whisper-autocomplete {
            position: absolute;
            bottom: 100%;
            left: 6px;
            right: 6px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px 4px 0 0;
            max-height: 150px;
            overflow-y: auto;
            z-index: 10;
            scrollbar-width: thin;
        }
        #sneed-whisper-box .whisper-autocomplete-item {
            padding: 5px 10px;
            color: #ccc;
            font-size: 12px;
            cursor: pointer;
        }
        #sneed-whisper-box .whisper-autocomplete-item:hover,
        #sneed-whisper-box .whisper-autocomplete-item.active {
            background: rgba(74, 158, 255, 0.2);
            color: #fff;
        }
        #sneed-whisper-box .whisper-tab .unread-badge {
            display: inline-block;
            background: #ff4444;
            color: #fff;
            font-size: 9px;
            font-weight: bold;
            border-radius: 50%;
            min-width: 14px;
            height: 14px;
            line-height: 14px;
            text-align: center;
            margin-left: 4px;
            padding: 0 3px;
        }
        #sneed-whisper-box .whisper-messages {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            min-height: 80px;
            scrollbar-width: thin;
            display: flex;
            flex-direction: column;
        }
        #sneed-whisper-box .whisper-messages::-webkit-scrollbar {
            width: 4px;
        }
        #sneed-whisper-box .whisper-messages::-webkit-scrollbar-thumb {
            background: #444;
        }
        #sneed-whisper-box .whisper-msg {
            margin-bottom: 6px;
            padding: 4px 8px;
            border-radius: 6px;
            max-width: 85%;
            word-wrap: break-word;
            font-size: 12px;
            line-height: 1.4;
        }
        #sneed-whisper-box .whisper-msg.incoming {
            background: #2a1a2a;
            color: #ddd;
            align-self: flex-start;
            border-bottom-left-radius: 2px;
        }
        #sneed-whisper-box .whisper-msg.outgoing {
            background: #1a2a3a;
            color: #eee;
            align-self: flex-end;
            border-bottom-right-radius: 2px;
        }
        #sneed-whisper-box .whisper-time-separator {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            color: #555;
            font-size: 10px;
        }
        #sneed-whisper-box .whisper-time-separator::before,
        #sneed-whisper-box .whisper-time-separator::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #333;
        }
        #sneed-whisper-box .whisper-msg .whisper-msg-time {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
        }
        #sneed-whisper-box .whisper-msg .whisper-msg-author {
            font-size: 10px;
            color: #4a9eff;
            font-weight: 600;
            margin-bottom: 1px;
        }
        #sneed-whisper-box .whisper-empty {
            color: #555;
            font-style: italic;
            text-align: center;
            padding: 40px 16px;
            font-size: 12px;
        }
        #sneed-whisper-box .whisper-input-row {
            display: flex;
            padding: 6px;
            background: #16162a;
            border-top: 1px solid #333;
            gap: 4px;
        }
        #sneed-whisper-box .whisper-input {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #eee;
            padding: 6px 8px;
            font-size: 12px;
            outline: none;
            font-family: inherit;
        }
        #sneed-whisper-box .whisper-input:focus {
            border-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-input::placeholder {
            color: #555;
        }
        #sneed-whisper-box .whisper-send {
            background: #4a9eff;
            border: none;
            border-radius: 4px;
            color: #fff;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: background 0.15s;
        }
        #sneed-whisper-box .whisper-send:hover {
            background: #3a8eef;
        }
    `;

    /**
     * Inject whisper box styles into document
     */
    function injectStyles(doc) {
        if (doc.getElementById('sneed-whisper-styles')) return;
        const style = doc.createElement('style');
        style.id = 'sneed-whisper-styles';
        style.textContent = WHISPER_STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    /**
     * Create the whisper box DOM structure
     * @param {Document} doc
     * @param {Object} callbacks - { onToggle, onClose, onTabClick, onSend }
     * @returns {HTMLElement}
     */
    function createWhisperBox(doc, callbacks) {
        injectStyles(doc);

        const box = doc.createElement('div');
        box.id = 'sneed-whisper-box';
        box.classList.add('expanded');

        // Header
        const header = doc.createElement('div');
        header.className = 'whisper-header';

        const arrow = doc.createElement('span');
        arrow.className = 'whisper-toggle-arrow';
        arrow.textContent = '\u25BC'; // ▼

        const title = doc.createElement('span');
        title.className = 'whisper-header-title';
        title.textContent = 'Whispers';

        const closeBtn = doc.createElement('button');
        closeBtn.className = 'whisper-close-btn';
        closeBtn.textContent = '\u00d7'; // ×
        closeBtn.title = 'Close whisper box';

        header.appendChild(arrow);
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Body (collapsible)
        const body = doc.createElement('div');
        body.className = 'whisper-body';

        // Tabs row (tabs + add button)
        const tabsRow = doc.createElement('div');
        tabsRow.className = 'whisper-tabs-row';

        const tabs = doc.createElement('div');
        tabs.className = 'whisper-tabs';

        const addTabBtn = doc.createElement('button');
        addTabBtn.className = 'whisper-add-tab';
        addTabBtn.textContent = '+';
        addTabBtn.title = 'New whisper conversation';

        tabsRow.appendChild(tabs);
        tabsRow.appendChild(addTabBtn);

        // New user input row (hidden by default)
        const newUserRow = doc.createElement('div');
        newUserRow.className = 'whisper-new-user-row';
        newUserRow.style.display = 'none';
        newUserRow.style.position = 'relative';

        const newUserInput = doc.createElement('input');
        newUserInput.className = 'whisper-new-user-input';
        newUserInput.type = 'text';
        newUserInput.placeholder = 'Username...';

        const newUserOk = doc.createElement('button');
        newUserOk.className = 'whisper-new-user-ok';
        newUserOk.textContent = 'Start';

        newUserRow.appendChild(newUserInput);
        newUserRow.appendChild(newUserOk);

        // Autocomplete
        let acDropdown = null;
        let acIndex = -1;

        function getChatUsers() {
            const users = [];
            const activities = doc.querySelectorAll('#chat-activity .activity');
            activities.forEach(el => {
                const name = el.dataset.username;
                if (name) users.push(name);
            });
            return users;
        }

        function closeAutocomplete() {
            if (acDropdown) {
                acDropdown.remove();
                acDropdown = null;
            }
            acIndex = -1;
        }

        function showAutocomplete(filter) {
            closeAutocomplete();
            const query = filter.toLowerCase();
            const users = getChatUsers().filter(u => u.toLowerCase().startsWith(query));
            if (users.length === 0 || !query) return;

            acDropdown = doc.createElement('div');
            acDropdown.className = 'whisper-autocomplete';

            users.slice(0, 10).forEach((username, i) => {
                const item = doc.createElement('div');
                item.className = 'whisper-autocomplete-item';
                item.textContent = username;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    newUserInput.value = username;
                    closeAutocomplete();
                });
                acDropdown.appendChild(item);
            });

            newUserRow.appendChild(acDropdown);
        }

        function highlightAcItem() {
            if (!acDropdown) return;
            const items = acDropdown.querySelectorAll('.whisper-autocomplete-item');
            items.forEach((item, i) => {
                item.classList.toggle('active', i === acIndex);
            });
        }

        function submitNewUser() {
            closeAutocomplete();
            const username = newUserInput.value.trim();
            if (username && callbacks.onNewConversation) {
                callbacks.onNewConversation(username);
                newUserInput.value = '';
                newUserRow.style.display = 'none';
            }
        }

        addTabBtn.addEventListener('click', () => {
            const visible = newUserRow.style.display !== 'none';
            newUserRow.style.display = visible ? 'none' : 'flex';
            if (visible) {
                closeAutocomplete();
            } else {
                newUserInput.focus();
            }
        });

        newUserOk.addEventListener('click', submitNewUser);

        newUserInput.addEventListener('input', () => {
            const val = newUserInput.value.trim();
            if (val) {
                showAutocomplete(val);
            } else {
                closeAutocomplete();
            }
        });

        newUserInput.addEventListener('keydown', (e) => {
            if (acDropdown) {
                const items = acDropdown.querySelectorAll('.whisper-autocomplete-item');
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    acIndex = Math.min(acIndex + 1, items.length - 1);
                    highlightAcItem();
                    return;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    acIndex = Math.max(acIndex - 1, 0);
                    highlightAcItem();
                    return;
                } else if ((e.key === 'Enter' || e.key === 'Tab') && acIndex >= 0 && items[acIndex]) {
                    e.preventDefault();
                    newUserInput.value = items[acIndex].textContent;
                    closeAutocomplete();
                    return;
                }
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                submitNewUser();
            } else if (e.key === 'Escape') {
                if (acDropdown) {
                    closeAutocomplete();
                } else {
                    newUserRow.style.display = 'none';
                }
            }
        });

        newUserInput.addEventListener('blur', () => {
            // Delay to allow mousedown on autocomplete items
            setTimeout(closeAutocomplete, 150);
        });

        // Messages
        const messages = doc.createElement('div');
        messages.className = 'whisper-messages';

        const empty = doc.createElement('div');
        empty.className = 'whisper-empty';
        empty.textContent = 'No whispers yet';
        messages.appendChild(empty);

        // Input row
        const inputRow = doc.createElement('div');
        inputRow.className = 'whisper-input-row';

        const input = doc.createElement('input');
        input.className = 'whisper-input';
        input.type = 'text';
        input.placeholder = 'Type a whisper...';

        const sendBtn = doc.createElement('button');
        sendBtn.className = 'whisper-send';
        sendBtn.textContent = 'Send';

        inputRow.appendChild(input);
        inputRow.appendChild(sendBtn);

        body.appendChild(tabsRow);
        body.appendChild(newUserRow);
        body.appendChild(messages);
        body.appendChild(inputRow);

        box.appendChild(header);
        box.appendChild(body);

        // Drag state
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let boxStartX = 0;
        let boxStartY = 0;
        let hasDragged = false;
        let savePositionTimer = null;

        function onMouseDown(e) {
            // Don't drag from close button
            if (e.target === closeBtn) return;
            isDragging = true;
            hasDragged = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = box.getBoundingClientRect();
            boxStartX = rect.left;
            boxStartY = rect.top;

            doc.addEventListener('mousemove', onMouseMove);
            doc.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }

        function onMouseMove(e) {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasDragged = true;
            }

            let newX = boxStartX + dx;
            let newY = boxStartY + dy;

            // Clamp to viewport
            const win = doc.defaultView || window;
            newX = Math.max(0, Math.min(win.innerWidth - box.offsetWidth, newX));
            newY = Math.max(0, Math.min(win.innerHeight - 32, newY));

            // Switch from bottom/right to top/left positioning
            box.style.bottom = 'auto';
            box.style.right = 'auto';
            box.style.left = newX + 'px';
            box.style.top = newY + 'px';
        }

        function onMouseUp() {
            if (!isDragging) return;
            isDragging = false;
            doc.removeEventListener('mousemove', onMouseMove);
            doc.removeEventListener('mouseup', onMouseUp);

            if (hasDragged) {
                saveBoxLayout();
            }
        }

        function saveBoxLayout() {
            if (savePositionTimer) clearTimeout(savePositionTimer);
            savePositionTimer = setTimeout(() => {
                const rect = box.getBoundingClientRect();
                const win = doc.defaultView || window;
                if (callbacks.onPositionChange) {
                    callbacks.onPositionChange({
                        x: rect.left / win.innerWidth,
                        y: rect.top / win.innerHeight,
                        width: rect.width,
                        height: rect.height
                    });
                }
            }, 300);
        }

        // Save size when resized via browser drag handle
        const resizeObserver = new ResizeObserver(() => {
            if (!body.classList.contains('collapsed')) {
                saveBoxLayout();
            }
        });
        resizeObserver.observe(box);

        header.addEventListener('mousedown', onMouseDown);

        // Toggle on click (only if not dragged)
        header.addEventListener('click', (e) => {
            if (e.target === closeBtn) return;
            if (hasDragged) return;
            const isCollapsing = !body.classList.contains('collapsed');
            body.classList.toggle('collapsed');
            arrow.classList.toggle('collapsed');
            if (isCollapsing) {
                // Store current size and strip inline height/resize from browser resize handle
                box.dataset.prevHeight = box.style.height || '';
                box.style.height = '';
                box.classList.remove('expanded');
            } else {
                box.classList.add('expanded');
                if (box.dataset.prevHeight) {
                    box.style.height = box.dataset.prevHeight;
                }
            }
            if (callbacks.onToggle) callbacks.onToggle(!isCollapsing);
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (callbacks.onClose) callbacks.onClose();
        });

        sendBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (text && callbacks.onSend) {
                callbacks.onSend(text);
                input.value = '';
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = input.value.trim();
                if (text && callbacks.onSend) {
                    callbacks.onSend(text);
                    input.value = '';
                }
            }
        });

        return box;
    }

    /**
     * Render tabs for conversation partners
     * @param {HTMLElement} box
     * @param {Array} partners - [{ username, unread }]
     * @param {string} activePartner
     * @param {Function} onTabClick
     */
    function renderTabs(box, partners, activePartner, onTabClick) {
        const tabs = box.querySelector('.whisper-tabs');
        if (!tabs) return;
        tabs.innerHTML = '';

        partners.forEach(p => {
            const tab = document.createElement('div');
            tab.className = 'whisper-tab' + (p.username === activePartner ? ' active' : '');
            tab.textContent = p.username;

            if (p.unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = p.unread > 9 ? '9+' : String(p.unread);
                tab.appendChild(badge);
            }

            tab.addEventListener('click', () => {
                if (onTabClick) onTabClick(p.username);
            });

            tabs.appendChild(tab);
        });
    }

    /**
     * Render messages for the active conversation
     * @param {HTMLElement} box
     * @param {Array} msgs - [{ direction, author, html, timestamp }]
     */
    function renderMessages(box, msgs) {
        const container = box.querySelector('.whisper-messages');
        if (!container) return;
        container.innerHTML = '';

        if (!msgs || msgs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'whisper-empty';
            empty.textContent = 'No messages in this conversation';
            container.appendChild(empty);
            return;
        }

        const ONE_HOUR = 3600;
        let lastTimestamp = 0;

        msgs.forEach(msg => {
            // Insert time separator if gap > 1 hour
            if (lastTimestamp > 0 && (msg.timestamp - lastTimestamp) > ONE_HOUR) {
                const sep = document.createElement('div');
                sep.className = 'whisper-time-separator';
                const sepDate = new Date(msg.timestamp * 1000);
                sep.textContent = sepDate.toLocaleString();
                container.appendChild(sep);
            }
            lastTimestamp = msg.timestamp;

            const el = document.createElement('div');
            el.className = 'whisper-msg ' + (msg.direction === 'out' ? 'outgoing' : 'incoming');

            const author = document.createElement('div');
            author.className = 'whisper-msg-author';
            author.textContent = msg.author;

            const content = document.createElement('div');
            content.innerHTML = msg.html;

            const time = document.createElement('div');
            time.className = 'whisper-msg-time';
            const d = new Date(msg.timestamp * 1000);
            time.textContent = d.toLocaleTimeString();

            el.appendChild(author);
            el.appendChild(content);
            el.appendChild(time);
            container.appendChild(el);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Apply a saved position to the whisper box
     * @param {HTMLElement} box
     * @param {{ x: number, y: number }} pos - Normalized position (0-1)
     * @param {Document} doc
     */
    function applyPosition(box, pos, doc) {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
        const win = doc.defaultView || window;
        const x = Math.max(0, Math.min(win.innerWidth - box.offsetWidth, pos.x * win.innerWidth));
        const y = Math.max(0, Math.min(win.innerHeight - 32, pos.y * win.innerHeight));
        box.style.bottom = 'auto';
        box.style.right = 'auto';
        box.style.left = x + 'px';
        box.style.top = y + 'px';
        if (pos.width) box.style.width = pos.width + 'px';
        if (pos.height) box.style.height = pos.height + 'px';
    }

    /**
     * Show the whisper box (expand if collapsed)
     * @param {HTMLElement} box
     */
    function expand(box) {
        const body = box.querySelector('.whisper-body');
        const arrow = box.querySelector('.whisper-toggle-arrow');
        if (body) body.classList.remove('collapsed');
        if (arrow) arrow.classList.remove('collapsed');
        box.classList.add('expanded');
        if (box.dataset.prevHeight) {
            box.style.height = box.dataset.prevHeight;
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.ui = SNEED.ui || {};
    SNEED.ui.whisperBox = {
        createWhisperBox,
        renderTabs,
        renderMessages,
        applyPosition,
        expand
    };

})();
