/**
 * popup.js - Extension popup settings UI
 */
(function() {
    'use strict';

    const STORAGE_KEY_HOMEPAGE_CHAT = 'sneedchat-disable-homepage-chat';
    const STORAGE_KEY_SPONSORED = 'kees-disable-sponsored';
    const STORAGE_KEY_MUTED_USERS = 'sneedchat-muted-users';
    const STORAGE_KEY_REACTION_ENABLED = 'kees-reaction-filter-enabled';
    const STORAGE_KEY_REACTION_MIN = 'kees-reaction-filter-min-reacts';
    const STORAGE_KEY_REACTION_THRESHOLD = 'kees-reaction-filter-bad-threshold';

    const disableHomepageChatCheckbox = document.getElementById('disable-homepage-chat');
    const disableSponsoredCheckbox = document.getElementById('disable-sponsored');
    const statusDiv = document.getElementById('status');
    const mutedUsersList = document.getElementById('muted-users-list');
    const mutedUserInput = document.getElementById('muted-user-input');
    const addMutedUserBtn = document.getElementById('add-muted-user-btn');

    // Reaction filter elements
    const reactionFilterEnabled = document.getElementById('reaction-filter-enabled');
    const reactionFilterOptions = document.getElementById('reaction-filter-options');
    const reactionMinReacts = document.getElementById('reaction-min-reacts');
    const reactionBadThreshold = document.getElementById('reaction-bad-threshold');

    // ============================================
    // STATUS MESSAGE
    // ============================================

    function showStatus(message) {
        statusDiv.textContent = message;
        statusDiv.classList.add('show');
        setTimeout(() => {
            statusDiv.classList.remove('show');
        }, 1500);
    }

    // ============================================
    // HOMEPAGE CHAT SETTING
    // ============================================

    // Load current settings
    chrome.storage.local.get([STORAGE_KEY_HOMEPAGE_CHAT, STORAGE_KEY_SPONSORED], (result) => {
        disableHomepageChatCheckbox.checked = result[STORAGE_KEY_HOMEPAGE_CHAT] === true;
        disableSponsoredCheckbox.checked = result[STORAGE_KEY_SPONSORED] === true;
    });

    // Save homepage chat setting on change
    disableHomepageChatCheckbox.addEventListener('change', () => {
        const disabled = disableHomepageChatCheckbox.checked;

        chrome.storage.local.set({ [STORAGE_KEY_HOMEPAGE_CHAT]: disabled }, () => {
            showStatus('Settings saved!');
        });
    });

    // Save sponsored content setting on change
    disableSponsoredCheckbox.addEventListener('change', () => {
        const disabled = disableSponsoredCheckbox.checked;

        chrome.storage.local.set({ [STORAGE_KEY_SPONSORED]: disabled }, () => {
            showStatus('Settings saved!');
        });
    });

    // ============================================
    // REACTION FILTER SETTINGS
    // ============================================

    // Load reaction filter settings
    chrome.storage.local.get([
        STORAGE_KEY_REACTION_ENABLED,
        STORAGE_KEY_REACTION_MIN,
        STORAGE_KEY_REACTION_THRESHOLD
    ], (result) => {
        reactionFilterEnabled.checked = result[STORAGE_KEY_REACTION_ENABLED] === true;
        reactionMinReacts.value = result[STORAGE_KEY_REACTION_MIN] ?? 5;
        reactionBadThreshold.value = result[STORAGE_KEY_REACTION_THRESHOLD] ?? 50;

        // Show/hide options based on enabled state
        reactionFilterOptions.style.display = reactionFilterEnabled.checked ? 'flex' : 'none';
    });

    // Toggle reaction filter
    reactionFilterEnabled.addEventListener('change', () => {
        const enabled = reactionFilterEnabled.checked;
        reactionFilterOptions.style.display = enabled ? 'flex' : 'none';

        chrome.storage.local.set({ [STORAGE_KEY_REACTION_ENABLED]: enabled }, () => {
            showStatus(enabled ? 'Reaction filter enabled' : 'Reaction filter disabled');
        });
    });

    // Save min reacts on change
    reactionMinReacts.addEventListener('change', () => {
        const value = parseInt(reactionMinReacts.value, 10) || 5;
        reactionMinReacts.value = Math.max(1, Math.min(100, value));

        chrome.storage.local.set({ [STORAGE_KEY_REACTION_MIN]: reactionMinReacts.value }, () => {
            showStatus('Settings saved!');
        });
    });

    // Save threshold on change
    reactionBadThreshold.addEventListener('change', () => {
        const value = parseInt(reactionBadThreshold.value, 10) || 50;
        reactionBadThreshold.value = Math.max(1, Math.min(100, value));

        chrome.storage.local.set({ [STORAGE_KEY_REACTION_THRESHOLD]: reactionBadThreshold.value }, () => {
            showStatus('Settings saved!');
        });
    });

    // ============================================
    // MUTED USERS MANAGEMENT
    // ============================================

    function renderMutedUsers(users) {
        mutedUsersList.innerHTML = '';

        users.forEach(username => {
            const item = document.createElement('div');
            item.className = 'muted-user';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            nameSpan.textContent = username;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'muted-user-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeMutedUser(username));

            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            mutedUsersList.appendChild(item);
        });
    }

    function loadMutedUsers() {
        chrome.storage.local.get([STORAGE_KEY_MUTED_USERS], (result) => {
            const users = result[STORAGE_KEY_MUTED_USERS] || [];
            renderMutedUsers(users);
        });
    }

    function addMutedUser(username) {
        if (!username || !username.trim()) return;

        username = username.trim();

        chrome.storage.local.get([STORAGE_KEY_MUTED_USERS], (result) => {
            const users = result[STORAGE_KEY_MUTED_USERS] || [];

            if (users.includes(username)) {
                showStatus('User already muted');
                return;
            }

            users.push(username);

            chrome.storage.local.set({ [STORAGE_KEY_MUTED_USERS]: users }, () => {
                renderMutedUsers(users);
                mutedUserInput.value = '';
                showStatus(`Muted ${username}`);
            });
        });
    }

    function removeMutedUser(username) {
        chrome.storage.local.get([STORAGE_KEY_MUTED_USERS], (result) => {
            let users = result[STORAGE_KEY_MUTED_USERS] || [];
            users = users.filter(u => u !== username);

            chrome.storage.local.set({ [STORAGE_KEY_MUTED_USERS]: users }, () => {
                renderMutedUsers(users);
                showStatus(`Unmuted ${username}`);
            });
        });
    }

    // Event listeners for adding muted users
    addMutedUserBtn.addEventListener('click', () => {
        addMutedUser(mutedUserInput.value);
    });

    mutedUserInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addMutedUser(mutedUserInput.value);
        }
    });

    // Initial load
    loadMutedUsers();

})();
