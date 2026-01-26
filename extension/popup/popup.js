/**
 * popup.js - Extension popup settings UI
 */
(function() {
    'use strict';

    const STORAGE_KEY_HOMEPAGE_CHAT = 'sneedchat-disable-homepage-chat';
    const STORAGE_KEY_MUTED_USERS = 'sneedchat-muted-users';

    const disableHomepageChatCheckbox = document.getElementById('disable-homepage-chat');
    const statusDiv = document.getElementById('status');
    const mutedUsersList = document.getElementById('muted-users-list');
    const mutedUserInput = document.getElementById('muted-user-input');
    const addMutedUserBtn = document.getElementById('add-muted-user-btn');

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

    // Load current setting
    chrome.storage.local.get([STORAGE_KEY_HOMEPAGE_CHAT], (result) => {
        disableHomepageChatCheckbox.checked = result[STORAGE_KEY_HOMEPAGE_CHAT] === true;
    });

    // Save setting on change
    disableHomepageChatCheckbox.addEventListener('change', () => {
        const disabled = disableHomepageChatCheckbox.checked;

        chrome.storage.local.set({ [STORAGE_KEY_HOMEPAGE_CHAT]: disabled }, () => {
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
