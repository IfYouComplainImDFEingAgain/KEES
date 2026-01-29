/**
 * features/watched-users.js - Pin watched users to top of chat-activity
 * Shows a list of watched users at the top of chat-activity if they're present.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const events = SNEED.core.events;
    const storage = SNEED.core.storage;
    const log = SNEED.log;

    // Default watched users list
    const DEFAULT_WATCHED_USERS = ['Null'];

    // Cache for watched users
    let watchedUsersCache = null;
    let watchedUsersLowerCache = null;

    // ============================================
    // STORAGE
    // ============================================

    async function getWatchedUsers() {
        if (watchedUsersCache) return watchedUsersCache;

        try {
            const stored = await storage.getWatchedUsers();
            watchedUsersCache = stored || [...DEFAULT_WATCHED_USERS];
            watchedUsersLowerCache = watchedUsersCache.map(u => u.toLowerCase());
            return watchedUsersCache;
        } catch (e) {
            log.error('Failed to load watched users:', e);
            watchedUsersCache = [...DEFAULT_WATCHED_USERS];
            watchedUsersLowerCache = watchedUsersCache.map(u => u.toLowerCase());
            return watchedUsersCache;
        }
    }

    async function saveWatchedUsers(users) {
        try {
            await storage.saveWatchedUsers(users);
            // Invalidate cache
            watchedUsersCache = users;
            watchedUsersLowerCache = users.map(u => u.toLowerCase());
        } catch (e) {
            log.error('Failed to save watched users:', e);
        }
    }

    function isWatchedUser(username) {
        if (!watchedUsersLowerCache) return false;
        return watchedUsersLowerCache.includes(username.toLowerCase());
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

        const foundUsernames = new Set();
        const foundElements = [];

        // Find all activity entries with data-username (more specific selector)
        const userEntries = chatActivity.querySelectorAll('.activity[data-username]');

        for (const entry of userEntries) {
            const username = entry.dataset.username;
            if (!username) continue;

            const usernameLower = username.toLowerCase();
            if (isWatchedUser(username) && !foundUsernames.has(usernameLower)) {
                foundUsernames.add(usernameLower);
                foundElements.push(entry.cloneNode(true));
            }
        }

        // Update panel visibility and content
        list.innerHTML = '';

        if (foundElements.length > 0) {
            panel.style.display = 'block';
            for (const element of foundElements) {
                element.style.cssText = `
                    background: rgba(255, 200, 0, 0.1);
                    border-left: 2px solid rgba(255, 200, 0, 0.5);
                    padding-left: 6px;
                    margin: 0;
                `;
                list.appendChild(element);
            }
        } else {
            panel.style.display = 'none';
        }
    }

    // ============================================
    // CLICK-TO-MENTION
    // ============================================

    // Store last known cursor position in the input
    let lastCursorRange = null;

    function trackCursorPosition(doc) {
        const input = doc.getElementById('new-message-input');
        if (!input) return;

        // Save cursor position on selection change and blur
        const saveCursor = () => {
            const win = doc.defaultView || window;
            const selection = win.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                // Only save if selection is within the input
                if (input.contains(range.commonAncestorContainer) || input === range.commonAncestorContainer) {
                    lastCursorRange = range.cloneRange();
                }
            }
        };

        events.addManagedEventListener(input, 'keyup', saveCursor);
        events.addManagedEventListener(input, 'mouseup', saveCursor);
        events.addManagedEventListener(input, 'blur', saveCursor);
    }

    function insertMention(username, doc) {
        const input = doc.getElementById('new-message-input');
        if (!input) return;

        const mention = `@${username} `;

        // Insert at cursor or append
        if (input.contentEditable === 'true') {
            const win = doc.defaultView || window;
            const selection = win.getSelection();

            input.focus();

            // Use saved cursor position if available
            if (lastCursorRange) {
                selection.removeAllRanges();
                selection.addRange(lastCursorRange);
            }

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                // Verify the range is within the input
                if (input.contains(range.commonAncestorContainer) || input === range.commonAncestorContainer) {
                    range.deleteContents();
                    const textNode = doc.createTextNode(mention);
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    // Update saved position
                    lastCursorRange = range.cloneRange();
                } else {
                    // Fallback: append to end
                    input.focus();
                    const range = doc.createRange();
                    range.selectNodeContents(input);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    doc.execCommand('insertText', false, mention);
                }
            } else {
                // No range, append to end
                input.textContent += mention;
            }
        } else {
            input.value += mention;
        }

        // Trigger input event for any listeners
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setupActivityClickToMention(chatActivity, doc) {
        // Start tracking cursor position
        trackCursorPosition(doc);

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

    async function startWatchedUsers(doc) {
        if (doc.__sneed_watchedUsers) return;

        const chatActivity = doc.querySelector('#chat-activity');
        if (!chatActivity) {
            log.warn('Could not find chat-activity for watched users');
            return;
        }

        // Load watched users into cache
        await getWatchedUsers();

        // Initial update
        updateWatchedUsersPanel(doc);

        // Setup click-to-mention for activity users
        setupActivityClickToMention(chatActivity, doc);

        // Debounced update with cleanup tracking
        let debounceTimer = null;
        const debouncedUpdate = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                updateWatchedUsersPanel(doc);
            }, 250);
        };

        // Observe for changes (only childList, not subtree for better performance)
        const observer = new MutationObserver(debouncedUpdate);
        observer.observe(chatActivity, { childList: true });
        events.addManagedObserver(chatActivity, observer);

        // Store cleanup function
        doc.__sneed_watchedUsers = {
            cleanup: () => {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                    debounceTimer = null;
                }
                observer.disconnect();
                const panel = doc.getElementById('sneed-watched-users');
                if (panel) panel.remove();
            }
        };

        log.info('Watched users feature started');
    }

    function stopWatchedUsers(doc) {
        if (doc.__sneed_watchedUsers && doc.__sneed_watchedUsers.cleanup) {
            doc.__sneed_watchedUsers.cleanup();
            doc.__sneed_watchedUsers = null;
            log.info('Watched users feature stopped');
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.startWatchedUsers = startWatchedUsers;
    SNEED.features.stopWatchedUsers = stopWatchedUsers;
    SNEED.features.getWatchedUsers = getWatchedUsers;
    SNEED.features.saveWatchedUsers = saveWatchedUsers;
    SNEED.features.updateWatchedUsersPanel = updateWatchedUsersPanel;

})();
