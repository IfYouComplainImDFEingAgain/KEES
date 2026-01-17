/**
 * features/watched-users.js - Pin watched users to top of chat-activity
 * Shows a list of watched users at the top of chat-activity if they're present.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const events = SNEED.core.events;
    const log = SNEED.log;

    // Default watched users list
    const DEFAULT_WATCHED_USERS = ['Null'];
    const STORAGE_KEY = 'sneedchat-watched-users';

    // ============================================
    // STORAGE
    // ============================================

    function getWatchedUsers() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            log.error('Failed to load watched users:', e);
        }
        return [...DEFAULT_WATCHED_USERS];
    }

    function saveWatchedUsers(users) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
        } catch (e) {
            log.error('Failed to save watched users:', e);
        }
    }

    // ============================================
    // UI
    // ============================================

    function createWatchedUsersPanel(doc) {
        const panel = doc.createElement('div');
        panel.id = 'sneed-watched-users';
        panel.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 6px 8px;
            display: none;
        `;

        const header = doc.createElement('div');
        header.style.cssText = `
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        header.textContent = 'Watched Users';
        panel.appendChild(header);

        const list = doc.createElement('div');
        list.id = 'sneed-watched-users-list';
        list.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;
        panel.appendChild(list);

        return panel;
    }

    function updateWatchedUsersPanel(doc) {
        const chatActivity = doc.querySelector('#chat-activity');
        if (!chatActivity) return;

        let panel = doc.getElementById('sneed-watched-users');
        if (!panel) {
            panel = createWatchedUsersPanel(doc);
            chatActivity.insertBefore(panel, chatActivity.firstChild);
        }

        const list = doc.getElementById('sneed-watched-users-list');
        if (!list) return;

        const watchedUsers = getWatchedUsers();
        const foundUsers = [];

        // Find all user entries in chat-activity
        const userEntries = chatActivity.querySelectorAll('#chat-activity-row, .activity-row, [class*="activity"] [class*="user"], [data-username]');

        userEntries.forEach(entry => {
            // Try to extract username from various possible structures
            const usernameEl = entry.querySelector('.username, .user-name, [class*="username"]') || entry;
            const username = entry.dataset?.username || usernameEl.textContent?.trim();

            if (username && watchedUsers.some(w => w.toLowerCase() === username.toLowerCase())) {
                if (!foundUsers.find(f => f.username.toLowerCase() === username.toLowerCase())) {
                    foundUsers.push({
                        username: username,
                        element: entry.cloneNode(true)
                    });
                }
            }
        });

        // Update panel visibility and content
        list.innerHTML = '';

        if (foundUsers.length > 0) {
            panel.style.display = 'block';
            foundUsers.forEach(({ element }) => {
                element.style.cssText = `
                    background: rgba(255, 200, 0, 0.1);
                    border-left: 2px solid rgba(255, 200, 0, 0.5);
                    padding-left: 6px;
                    margin: 0;
                `;
                list.appendChild(element);
            });
        } else {
            panel.style.display = 'none';
        }
    }

    // ============================================
    // CLICK-TO-MENTION
    // ============================================

    function insertMention(username, doc) {
        const input = doc.getElementById('new-message-input');
        if (!input) return;

        const mention = `@${username} `;

        // Insert at cursor or append
        if (input.contentEditable === 'true') {
            const win = doc.defaultView || window;
            const selection = win.getSelection();

            // Focus and get/create range
            input.focus();

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(doc.createTextNode(mention));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                input.textContent += mention;
            }
        } else {
            input.value += mention;
        }

        // Trigger input event for any listeners
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setupActivityClickToMention(chatActivity, doc) {
        events.addManagedEventListener(chatActivity, 'click', (e) => {
            // Check if clicked on a.user inside .activity
            const userLink = e.target.closest('.activity a.user');
            if (!userLink) return;

            e.preventDefault();
            e.stopPropagation();

            // Get username from parent .activity's data-username or link text
            const activityEl = userLink.closest('.activity');
            const username = activityEl?.dataset?.username || userLink.textContent?.trim();

            if (username) {
                insertMention(username, doc);
                log.info(`Inserted mention for: ${username}`);
            }
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function startWatchedUsers(doc) {
        if (doc.__sneed_watchedUsers) return;

        const chatActivity = doc.querySelector('#chat-activity');
        if (!chatActivity) {
            log.warn('Could not find chat-activity for watched users');
            return;
        }

        // Initial update
        updateWatchedUsersPanel(doc);

        // Setup click-to-mention for activity users
        setupActivityClickToMention(chatActivity, doc);

        // Debounced update
        let debounceTimer = null;
        const debouncedUpdate = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                updateWatchedUsersPanel(doc);
            }, 250);
        };

        // Observe for changes (only childList, not subtree for better performance)
        const observer = new MutationObserver(debouncedUpdate);
        observer.observe(chatActivity, { childList: true });
        events.addManagedObserver(chatActivity, observer);

        doc.__sneed_watchedUsers = true;
        log.info('Watched users feature started');
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.startWatchedUsers = startWatchedUsers;
    SNEED.features.getWatchedUsers = getWatchedUsers;
    SNEED.features.saveWatchedUsers = saveWatchedUsers;
    SNEED.features.updateWatchedUsersPanel = updateWatchedUsersPanel;

})();
