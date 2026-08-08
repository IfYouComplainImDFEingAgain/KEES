// mobile/settings/settings.js - Two controls: the muted-user list and the
// native video player toggle.
//
// Storage keys are deliberately identical to the desktop build's so a list
// exported from one can be imported into the other. They are separate add-ons
// with separate storage, so nothing is shared automatically.
(function() {
    'use strict';

    const STORAGE_KEY_MUTED_USERS = 'sneedchat-muted-users';
    const STORAGE_KEY_NATIVE_VIDEO = 'kees-native-video-player';

    const mutedUsersList = document.getElementById('muted-users-list');
    const mutedUserInput = document.getElementById('muted-user-input');
    const addMutedUserBtn = document.getElementById('add-muted-user-btn');
    const nativeVideoToggle = document.getElementById('native-video-player');
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
    // NATIVE VIDEO PLAYER
    // ============================================

    function loadNativeVideoSetting() {
        chrome.storage.local.get([STORAGE_KEY_NATIVE_VIDEO], (result) => {
            nativeVideoToggle.checked = result[STORAGE_KEY_NATIVE_VIDEO] === true;
        });
    }

    nativeVideoToggle.addEventListener('change', () => {
        const enabled = nativeVideoToggle.checked;
        chrome.storage.local.set({ [STORAGE_KEY_NATIVE_VIDEO]: enabled }, () => {
            showStatus(enabled ? 'Native video player on' : 'Native video player off');
        });
    });

    // Keep the page honest if the muted list changes from a thread page while
    // this is open in a background tab.
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes[STORAGE_KEY_MUTED_USERS]) {
            renderMutedUsers(changes[STORAGE_KEY_MUTED_USERS].newValue || []);
        }
        if (changes[STORAGE_KEY_NATIVE_VIDEO]) {
            nativeVideoToggle.checked = changes[STORAGE_KEY_NATIVE_VIDEO].newValue === true;
        }
    });

    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

    loadMutedUsers();
    loadNativeVideoSetting();
})();
