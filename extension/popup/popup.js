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
    const STORAGE_KEY_ZIPLINE_ENABLED = 'kees-zipline-enabled';
    const STORAGE_KEY_ZIPLINE_URL = 'kees-zipline-url';
    const STORAGE_KEY_ZIPLINE_API_KEY = 'kees-zipline-api-key';
    const STORAGE_KEY_MENTION_NOTIFICATIONS = 'kees-mention-notifications';
    const STORAGE_KEY_MENTION_SHOW_BODY = 'kees-mention-show-body';
    const STORAGE_KEY_SCROLLBACK_LIMIT = 'kees-scrollback-limit';
    const STORAGE_KEY_MUTE_DISRUPTIVE = 'kees-mute-disruptive-guests';

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

    // Zipline elements
    const ziplineEnabled = document.getElementById('zipline-enabled');
    const ziplineOptions = document.getElementById('zipline-options');
    const ziplineUrl = document.getElementById('zipline-url');
    const ziplineApiKey = document.getElementById('zipline-api-key');

    // Mention notifications elements
    const mentionNotifications = document.getElementById('mention-notifications');
    const mentionShowBody = document.getElementById('mention-show-body');
    const mentionBodySetting = document.getElementById('mention-body-setting');

    // Scrollback elements
    const scrollbackLimit = document.getElementById('scrollback-limit');

    // Disruptive guests element
    const muteDisruptiveGuests = document.getElementById('mute-disruptive-guests');

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
    chrome.storage.local.get([STORAGE_KEY_HOMEPAGE_CHAT, STORAGE_KEY_SPONSORED, STORAGE_KEY_MENTION_NOTIFICATIONS, STORAGE_KEY_MENTION_SHOW_BODY, STORAGE_KEY_MUTE_DISRUPTIVE], (result) => {
        disableHomepageChatCheckbox.checked = result[STORAGE_KEY_HOMEPAGE_CHAT] === true;
        disableSponsoredCheckbox.checked = result[STORAGE_KEY_SPONSORED] === true;
        mentionNotifications.checked = result[STORAGE_KEY_MENTION_NOTIFICATIONS] === true;
        mentionShowBody.checked = result[STORAGE_KEY_MENTION_SHOW_BODY] === true;
        mentionBodySetting.style.display = mentionNotifications.checked ? 'flex' : 'none';
        muteDisruptiveGuests.checked = result[STORAGE_KEY_MUTE_DISRUPTIVE] === true;
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

    // Save mute disruptive guests setting on change
    muteDisruptiveGuests.addEventListener('change', () => {
        const enabled = muteDisruptiveGuests.checked;

        chrome.storage.local.set({ [STORAGE_KEY_MUTE_DISRUPTIVE]: enabled }, () => {
            showStatus(enabled ? 'Disruptive guests muted' : 'Disruptive guests unmuted');
        });
    });

    // Save mention notifications setting on change
    mentionNotifications.addEventListener('change', () => {
        const enabled = mentionNotifications.checked;
        mentionBodySetting.style.display = enabled ? 'flex' : 'none';

        chrome.storage.local.set({ [STORAGE_KEY_MENTION_NOTIFICATIONS]: enabled }, () => {
            showStatus(enabled ? 'Mention notifications enabled' : 'Mention notifications disabled');
        });
    });

    // Save mention show body setting on change
    mentionShowBody.addEventListener('change', () => {
        const enabled = mentionShowBody.checked;

        chrome.storage.local.set({ [STORAGE_KEY_MENTION_SHOW_BODY]: enabled }, () => {
            showStatus('Settings saved!');
        });
    });

    // ============================================
    // SCROLLBACK SETTINGS
    // ============================================

    // Load scrollback setting
    chrome.storage.local.get([STORAGE_KEY_SCROLLBACK_LIMIT], (result) => {
        scrollbackLimit.value = result[STORAGE_KEY_SCROLLBACK_LIMIT] ?? 100;
    });

    // Save scrollback limit on change
    scrollbackLimit.addEventListener('change', () => {
        const value = parseInt(scrollbackLimit.value, 10) || 100;
        scrollbackLimit.value = Math.max(50, Math.min(5000, value));

        chrome.storage.local.set({ [STORAGE_KEY_SCROLLBACK_LIMIT]: scrollbackLimit.value }, () => {
            showStatus('Scrollback limit saved');
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
    // ZIPLINE SETTINGS
    // ============================================

    // Load Zipline settings
    chrome.storage.local.get([
        STORAGE_KEY_ZIPLINE_ENABLED,
        STORAGE_KEY_ZIPLINE_URL,
        STORAGE_KEY_ZIPLINE_API_KEY
    ], (result) => {
        ziplineEnabled.checked = result[STORAGE_KEY_ZIPLINE_ENABLED] === true;
        ziplineUrl.value = result[STORAGE_KEY_ZIPLINE_URL] || '';
        ziplineApiKey.value = result[STORAGE_KEY_ZIPLINE_API_KEY] || '';

        ziplineOptions.style.display = ziplineEnabled.checked ? 'block' : 'none';
    });

    // Toggle Zipline
    ziplineEnabled.addEventListener('change', () => {
        const enabled = ziplineEnabled.checked;
        ziplineOptions.style.display = enabled ? 'block' : 'none';

        chrome.storage.local.set({ [STORAGE_KEY_ZIPLINE_ENABLED]: enabled }, () => {
            showStatus(enabled ? 'Zipline enabled' : 'Zipline disabled');
        });
    });

    // Save Zipline URL
    ziplineUrl.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEY_ZIPLINE_URL]: ziplineUrl.value.trim() }, () => {
            showStatus('Zipline URL saved');
        });
    });

    // Save Zipline API key
    ziplineApiKey.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEY_ZIPLINE_API_KEY]: ziplineApiKey.value }, () => {
            showStatus('API key saved');
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
