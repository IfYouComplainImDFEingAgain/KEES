// mobile/settings/settings.js - Two controls: the muted-user list and the
// native video player toggle.
//
// Storage keys are deliberately identical to the desktop build's so a list
// exported from one can be imported into the other. They are separate add-ons
// with separate storage, so nothing is shared automatically.
(function() {
    'use strict';

    const STORAGE_KEY_MUTED_USERS = 'sneedchat-muted-users';

    // Every plain on/off setting. Keys match the desktop build's.
    const TOGGLES = [
        {
            id: 'disable-homepage-chat',
            key: 'sneedchat-disable-homepage-chat',
            on: 'Homepage chat hidden',
            off: 'Homepage chat shown'
        },
        {
            id: 'disable-sponsored',
            key: 'kees-disable-sponsored',
            on: 'Sponsored content hidden',
            off: 'Sponsored content shown'
        },
        {
            id: 'native-video-player',
            key: 'kees-native-video-player',
            on: 'Native video player on',
            off: 'Native video player off'
        }
    ];

    const mutedUsersList = document.getElementById('muted-users-list');
    const mutedUserInput = document.getElementById('muted-user-input');
    const addMutedUserBtn = document.getElementById('add-muted-user-btn');
    const statusEl = document.getElementById('status');
    const versionEl = document.getElementById('version');

    let statusTimer = null;

    function showStatus(message) {
        statusEl.textContent = message;
        statusEl.classList.add('visible');
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => statusEl.classList.remove('visible'), 2000);
    }

    // ============================================
    // MUTED USERS
    // ============================================

    function renderMutedUsers(users) {
        mutedUsersList.textContent = '';

        users.forEach(username => {
            const item = document.createElement('div');
            item.className = 'muted-user';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            nameSpan.textContent = username;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove';
            removeBtn.textContent = 'Remove';
            removeBtn.setAttribute('aria-label', `Unmute ${username}`);
            removeBtn.addEventListener('click', () => removeMutedUser(username));

            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            mutedUsersList.appendChild(item);
        });
    }

    function loadMutedUsers() {
        chrome.storage.local.get([STORAGE_KEY_MUTED_USERS], (result) => {
            renderMutedUsers(result[STORAGE_KEY_MUTED_USERS] || []);
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
            const users = (result[STORAGE_KEY_MUTED_USERS] || []).filter(u => u !== username);

            chrome.storage.local.set({ [STORAGE_KEY_MUTED_USERS]: users }, () => {
                renderMutedUsers(users);
                showStatus(`Unmuted ${username}`);
            });
        });
    }

    addMutedUserBtn.addEventListener('click', () => addMutedUser(mutedUserInput.value));

    mutedUserInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addMutedUser(mutedUserInput.value);
        }
    });

    // ============================================
    // TOGGLES
    // ============================================

    TOGGLES.forEach(t => {
        t.el = document.getElementById(t.id);
        t.el.addEventListener('change', () => {
            const enabled = t.el.checked;
            chrome.storage.local.set({ [t.key]: enabled }, () => {
                showStatus(enabled ? t.on : t.off);
            });
        });
    });

    function loadToggles() {
        chrome.storage.local.get(TOGGLES.map(t => t.key), (result) => {
            TOGGLES.forEach(t => { t.el.checked = result[t.key] === true; });
        });
    }

    // Keep the page honest if something changes from a content script while this
    // is open in a background tab.
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes[STORAGE_KEY_MUTED_USERS]) {
            renderMutedUsers(changes[STORAGE_KEY_MUTED_USERS].newValue || []);
        }
        TOGGLES.forEach(t => {
            if (changes[t.key]) t.el.checked = changes[t.key].newValue === true;
        });
    });

    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

    loadMutedUsers();
    loadToggles();
})();
