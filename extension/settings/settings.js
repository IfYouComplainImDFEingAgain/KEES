/**
 * settings.js - KEES full-page settings UI (opened in a tab via the toolbar icon)
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
    const STORAGE_KEY_ZIPLINE_STRIP_EXIF = 'kees-zipline-strip-exif';
    const STORAGE_KEY_MENTION_NOTIFICATIONS = 'kees-mention-notifications';
    const STORAGE_KEY_MENTION_SHOW_BODY = 'kees-mention-show-body';
    const STORAGE_KEY_SCROLLBACK_LIMIT = 'kees-scrollback-limit';
    const STORAGE_KEY_NEW_USER_BADGE = 'kees-new-user-badge';
    const STORAGE_KEY_NEW_USER_DAYS = 'kees-new-user-days';
    const JOIN_DATE_PREFIX = 'kees-joined-';
    const STORAGE_KEY_MUTE_DISRUPTIVE = 'kees-mute-disruptive-guests';
    const STORAGE_KEY_ATTACHMENT_STRIP_EXIF = 'kees-attachment-strip-exif';
    const STORAGE_KEY_EVERYONE_LIST = 'sneedchat-everyone-list';
    const STORAGE_KEY_WHISPER_GLOBAL = 'kees-whisper-global';
    const STORAGE_KEY_WHISPER_HIDE_MAIN = 'kees-whisper-hide-main';
    const STORAGE_KEY_WHISPER_RETENTION = 'kees-whisper-retention';
    const STORAGE_KEY_GLOBAL_CHAT = 'kees-global-chat';
    const STORAGE_KEY_BOSSMAN_LIVE_NOTIFY = 'kees-bossman-live-notify';
    const STORAGE_KEY_BOT_USERS = 'kees-bot-users';
    const STORAGE_KEY_BOT_COLUMN_ENABLED = 'kees-bot-column-enabled';
    const STORAGE_KEY_BOT_COLUMN_HIDE_MAIN = 'kees-bot-column-hide-main';
    const STORAGE_KEY_MUTE_GAMBLING = 'kees-mute-gambling';
    const STORAGE_KEY_SCORCHED_EARTH = 'kees-scorched-earth';
    const STORAGE_KEY_NATIVE_VIDEO = 'kees-native-video-player';
    const STORAGE_KEY_FORUM_ACTIVITY_MAX_PAGES = 'kees-forum-activity-max-pages';
    const STORAGE_KEY_FORUM_ACTIVITY_DEEP = 'kees-forum-activity-deep-search';
    const STORAGE_KEY_FORUM_ACTIVITY_WINDOW = 'kees-forum-activity-window-days';
    const STORAGE_KEY_FORUM_ACTIVITY_MAX_SEARCHES = 'kees-forum-activity-max-searches';

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
    const ziplineStripExif = document.getElementById('zipline-strip-exif');

    // Mention notifications elements
    const mentionNotifications = document.getElementById('mention-notifications');
    const mentionShowBody = document.getElementById('mention-show-body');
    const mentionBodySetting = document.getElementById('mention-body-setting');

    // Scrollback elements
    const scrollbackLimit = document.getElementById('scrollback-limit');

    // New-account badge elements
    const newUserBadge = document.getElementById('new-user-badge');
    const newUserOptions = document.getElementById('new-user-options');
    const newUserDays = document.getElementById('new-user-days');
    const newUserCacheRow = document.getElementById('new-user-cache-row');
    const newUserCacheCount = document.getElementById('new-user-cache-count');
    const clearJoinCacheBtn = document.getElementById('clear-join-cache-btn');

    // Disruptive guests element
    const muteDisruptiveGuests = document.getElementById('mute-disruptive-guests');

    // Attachment EXIF element
    const attachmentStripExif = document.getElementById('attachment-strip-exif');

    // Native video player element
    const nativeVideoPlayer = document.getElementById('native-video-player');

    // Forum activity elements
    const forumActivityMaxPages = document.getElementById('forum-activity-max-pages');
    const forumActivityDeepSearch = document.getElementById('forum-activity-deep-search');
    const forumActivityDeepOptions = document.getElementById('forum-activity-deep-options');
    const forumActivityWindowDays = document.getElementById('forum-activity-window-days');
    const forumActivityMaxSearches = document.getElementById('forum-activity-max-searches');

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
    // Whisper elements
    const whisperGlobal = document.getElementById('whisper-global');
    const whisperHideMain = document.getElementById('whisper-hide-main');

    // Gambling mute element
    const muteGambling = document.getElementById('mute-gambling');

    // Scorched earth element
    const scorchedEarth = document.getElementById('scorched-earth');

    // Bossman live alert element
    const bossmanLiveNotify = document.getElementById('bossman-live-notify');

    chrome.storage.local.get([STORAGE_KEY_HOMEPAGE_CHAT, STORAGE_KEY_SPONSORED, STORAGE_KEY_MENTION_NOTIFICATIONS, STORAGE_KEY_MENTION_SHOW_BODY, STORAGE_KEY_MUTE_DISRUPTIVE, STORAGE_KEY_ATTACHMENT_STRIP_EXIF, STORAGE_KEY_WHISPER_GLOBAL, STORAGE_KEY_WHISPER_HIDE_MAIN, STORAGE_KEY_BOSSMAN_LIVE_NOTIFY, STORAGE_KEY_MUTE_GAMBLING, STORAGE_KEY_SCORCHED_EARTH, STORAGE_KEY_NATIVE_VIDEO], (result) => {
        disableHomepageChatCheckbox.checked = result[STORAGE_KEY_HOMEPAGE_CHAT] === true;
        disableSponsoredCheckbox.checked = result[STORAGE_KEY_SPONSORED] === true;
        mentionNotifications.checked = result[STORAGE_KEY_MENTION_NOTIFICATIONS] === true;
        mentionShowBody.checked = result[STORAGE_KEY_MENTION_SHOW_BODY] === true;
        mentionBodySetting.style.display = mentionNotifications.checked ? 'flex' : 'none';
        muteDisruptiveGuests.checked = result[STORAGE_KEY_MUTE_DISRUPTIVE] === true;
        // Default to true for privacy
        attachmentStripExif.checked = result[STORAGE_KEY_ATTACHMENT_STRIP_EXIF] !== false;
        whisperGlobal.checked = result[STORAGE_KEY_WHISPER_GLOBAL] === true;
        // Default to true
        whisperHideMain.checked = result[STORAGE_KEY_WHISPER_HIDE_MAIN] !== false;
        bossmanLiveNotify.checked = result[STORAGE_KEY_BOSSMAN_LIVE_NOTIFY] === true;
        muteGambling.checked = result[STORAGE_KEY_MUTE_GAMBLING] === true;
        scorchedEarth.checked = result[STORAGE_KEY_SCORCHED_EARTH] === true;
        nativeVideoPlayer.checked = result[STORAGE_KEY_NATIVE_VIDEO] === true;
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

    // Save attachment EXIF strip setting on change
    attachmentStripExif.addEventListener('change', () => {
        const enabled = attachmentStripExif.checked;

        chrome.storage.local.set({ [STORAGE_KEY_ATTACHMENT_STRIP_EXIF]: enabled }, () => {
            showStatus(enabled ? 'Attachment EXIF stripping enabled' : 'Attachment EXIF stripping disabled');
        });
    });

    // Save native video player setting on change
    nativeVideoPlayer.addEventListener('change', () => {
        const enabled = nativeVideoPlayer.checked;

        chrome.storage.local.set({ [STORAGE_KEY_NATIVE_VIDEO]: enabled }, () => {
            showStatus(enabled ? 'Native video player enabled' : 'Native video player disabled');
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

    // Save mute gambling setting on change
    muteGambling.addEventListener('change', () => {
        const enabled = muteGambling.checked;

        chrome.storage.local.set({ [STORAGE_KEY_MUTE_GAMBLING]: enabled }, () => {
            showStatus(enabled ? 'Gambling messages muted' : 'Gambling messages unmuted');
        });
    });

    // Save scorched earth setting on change
    scorchedEarth.addEventListener('change', () => {
        const enabled = scorchedEarth.checked;

        chrome.storage.local.set({ [STORAGE_KEY_SCORCHED_EARTH]: enabled }, () => {
            showStatus(enabled ? 'Scorched earth enabled' : 'Scorched earth disabled');
        });
    });

    // Save bossman live alert setting on change
    bossmanLiveNotify.addEventListener('change', () => {
        const enabled = bossmanLiveNotify.checked;

        chrome.storage.local.set({ [STORAGE_KEY_BOSSMAN_LIVE_NOTIFY]: enabled }, () => {
            showStatus(enabled ? 'Bossman live alerts enabled' : 'Bossman live alerts disabled');
        });
    });

    // Global chat element
    const globalChat = document.getElementById('global-chat');

    chrome.storage.local.get([STORAGE_KEY_GLOBAL_CHAT], (result) => {
        globalChat.checked = result[STORAGE_KEY_GLOBAL_CHAT] === true;
    });

    globalChat.addEventListener('change', () => {
        const enabled = globalChat.checked;
        chrome.storage.local.set({ [STORAGE_KEY_GLOBAL_CHAT]: enabled }, () => {
            showStatus(enabled ? 'Global chat box enabled' : 'Global chat box disabled');
        });
    });

    // Whisper retention element
    const whisperRetention = document.getElementById('whisper-retention');

    // Load whisper retention
    chrome.storage.local.get([STORAGE_KEY_WHISPER_RETENTION], (result) => {
        whisperRetention.value = result[STORAGE_KEY_WHISPER_RETENTION] ?? 100;
    });

    // Save whisper retention on change
    whisperRetention.addEventListener('change', () => {
        const value = parseInt(whisperRetention.value, 10);
        whisperRetention.value = Math.max(0, Math.min(10000, isNaN(value) ? 100 : value));

        chrome.storage.local.set({ [STORAGE_KEY_WHISPER_RETENTION]: parseInt(whisperRetention.value, 10) }, () => {
            showStatus('Whisper retention saved');
        });
    });

    // Save whisper global setting on change
    whisperGlobal.addEventListener('change', () => {
        const enabled = whisperGlobal.checked;

        chrome.storage.local.set({ [STORAGE_KEY_WHISPER_GLOBAL]: enabled }, () => {
            showStatus(enabled ? 'Global whisper box enabled' : 'Global whisper box disabled');
        });
    });

    // Save whisper hide main setting on change
    whisperHideMain.addEventListener('change', () => {
        const enabled = whisperHideMain.checked;

        chrome.storage.local.set({ [STORAGE_KEY_WHISPER_HIDE_MAIN]: enabled }, () => {
            showStatus(enabled ? 'Whispers hidden from main chat' : 'Whispers shown in main chat');
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
    // NEW ACCOUNT BADGE SETTINGS
    // ============================================

    function updateNewUserVisibility() {
        const show = newUserBadge.checked ? '' : 'none';
        newUserOptions.style.display = show;
        newUserCacheRow.style.display = show;
    }

    // Count the per-user kees-joined-<id> cache entries for the "Clear" row.
    function refreshJoinCacheCount() {
        chrome.storage.local.get(null, (all) => {
            const count = Object.keys(all || {}).filter(k => k.startsWith(JOIN_DATE_PREFIX)).length;
            newUserCacheCount.textContent = count;
        });
    }

    chrome.storage.local.get([STORAGE_KEY_NEW_USER_BADGE, STORAGE_KEY_NEW_USER_DAYS], (result) => {
        newUserBadge.checked = result[STORAGE_KEY_NEW_USER_BADGE] !== false;
        newUserDays.value = result[STORAGE_KEY_NEW_USER_DAYS] ?? 30;
        updateNewUserVisibility();
        refreshJoinCacheCount();
    });

    newUserBadge.addEventListener('change', () => {
        updateNewUserVisibility();
        chrome.storage.local.set({ [STORAGE_KEY_NEW_USER_BADGE]: newUserBadge.checked }, () => {
            showStatus(newUserBadge.checked ? 'New account badge enabled' : 'New account badge disabled');
        });
    });

    newUserDays.addEventListener('change', () => {
        const value = parseInt(newUserDays.value, 10) || 30;
        newUserDays.value = Math.max(1, Math.min(365, value));

        chrome.storage.local.set({ [STORAGE_KEY_NEW_USER_DAYS]: newUserDays.value }, () => {
            showStatus('New account age saved');
        });
    });

    clearJoinCacheBtn.addEventListener('click', () => {
        chrome.storage.local.get(null, (all) => {
            const keys = Object.keys(all || {}).filter(k => k.startsWith(JOIN_DATE_PREFIX));
            if (!keys.length) {
                showStatus('No cached join dates');
                return;
            }
            chrome.storage.local.remove(keys, () => {
                refreshJoinCacheCount();
                showStatus('Cleared ' + keys.length + ' cached join dates');
            });
        });
    });

    // ============================================
    // FORUM ACTIVITY SETTINGS
    // ============================================

    // Load forum activity settings
    chrome.storage.local.get([
        STORAGE_KEY_FORUM_ACTIVITY_MAX_PAGES,
        STORAGE_KEY_FORUM_ACTIVITY_DEEP,
        STORAGE_KEY_FORUM_ACTIVITY_WINDOW,
        STORAGE_KEY_FORUM_ACTIVITY_MAX_SEARCHES
    ], (result) => {
        forumActivityMaxPages.value = result[STORAGE_KEY_FORUM_ACTIVITY_MAX_PAGES] ?? 10;
        forumActivityDeepSearch.checked = result[STORAGE_KEY_FORUM_ACTIVITY_DEEP] === true;
        forumActivityWindowDays.value = result[STORAGE_KEY_FORUM_ACTIVITY_WINDOW] ?? 90;
        forumActivityMaxSearches.value = result[STORAGE_KEY_FORUM_ACTIVITY_MAX_SEARCHES] ?? 24;
        forumActivityDeepOptions.style.display = forumActivityDeepSearch.checked ? 'flex' : 'none';
    });

    // Save forum activity max pages on change (site caps a single search at 10)
    forumActivityMaxPages.addEventListener('change', () => {
        const value = parseInt(forumActivityMaxPages.value, 10) || 10;
        forumActivityMaxPages.value = Math.max(1, Math.min(10, value));

        chrome.storage.local.set({ [STORAGE_KEY_FORUM_ACTIVITY_MAX_PAGES]: parseInt(forumActivityMaxPages.value, 10) }, () => {
            showStatus('Forum activity page limit saved');
        });
    });

    // Toggle deep history search
    forumActivityDeepSearch.addEventListener('change', () => {
        const enabled = forumActivityDeepSearch.checked;
        forumActivityDeepOptions.style.display = enabled ? 'flex' : 'none';
        chrome.storage.local.set({ [STORAGE_KEY_FORUM_ACTIVITY_DEEP]: enabled }, () => {
            showStatus(enabled ? 'Deep history search enabled' : 'Deep history search disabled');
        });
    });

    // Save deep-search window size
    forumActivityWindowDays.addEventListener('change', () => {
        const value = parseInt(forumActivityWindowDays.value, 10) || 90;
        forumActivityWindowDays.value = Math.max(7, Math.min(365, value));
        chrome.storage.local.set({ [STORAGE_KEY_FORUM_ACTIVITY_WINDOW]: parseInt(forumActivityWindowDays.value, 10) }, () => {
            showStatus('Search window saved');
        });
    });

    // Save deep-search max searches
    forumActivityMaxSearches.addEventListener('change', () => {
        const value = parseInt(forumActivityMaxSearches.value, 10) || 24;
        forumActivityMaxSearches.value = Math.max(1, Math.min(200, value));
        chrome.storage.local.set({ [STORAGE_KEY_FORUM_ACTIVITY_MAX_SEARCHES]: parseInt(forumActivityMaxSearches.value, 10) }, () => {
            showStatus('Max searches saved');
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
        STORAGE_KEY_ZIPLINE_API_KEY,
        STORAGE_KEY_ZIPLINE_STRIP_EXIF
    ], (result) => {
        ziplineEnabled.checked = result[STORAGE_KEY_ZIPLINE_ENABLED] === true;
        ziplineUrl.value = result[STORAGE_KEY_ZIPLINE_URL] || '';
        ziplineApiKey.value = result[STORAGE_KEY_ZIPLINE_API_KEY] || '';
        // Default to true for privacy
        ziplineStripExif.checked = result[STORAGE_KEY_ZIPLINE_STRIP_EXIF] !== false;

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

    // Save Zipline strip EXIF setting
    ziplineStripExif.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEY_ZIPLINE_STRIP_EXIF]: ziplineStripExif.checked }, () => {
            showStatus(ziplineStripExif.checked ? 'EXIF stripping enabled' : 'EXIF stripping disabled');
        });
    });

    // ============================================
    // BOT COLUMN MANAGEMENT
    // ============================================

    const botColumnEnabled = document.getElementById('bot-column-enabled');
    const botColumnHideMain = document.getElementById('bot-column-hide-main');
    const botUsersList = document.getElementById('bot-users-list');
    const botUserInput = document.getElementById('bot-user-input');
    const addBotUserBtn = document.getElementById('add-bot-user-btn');

    chrome.storage.local.get([STORAGE_KEY_BOT_COLUMN_ENABLED, STORAGE_KEY_BOT_COLUMN_HIDE_MAIN], (result) => {
        botColumnEnabled.checked = result[STORAGE_KEY_BOT_COLUMN_ENABLED] === true;
        botColumnHideMain.checked = result[STORAGE_KEY_BOT_COLUMN_HIDE_MAIN] === true;
    });

    botColumnEnabled.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEY_BOT_COLUMN_ENABLED]: botColumnEnabled.checked }, () => {
            showStatus(botColumnEnabled.checked ? 'Bot column enabled' : 'Bot column disabled');
        });
    });

    botColumnHideMain.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEY_BOT_COLUMN_HIDE_MAIN]: botColumnHideMain.checked }, () => {
            showStatus(botColumnHideMain.checked ? 'Bots hidden from main chat' : 'Bots shown in main chat');
        });
    });

    function renderBotUsers(users) {
        botUsersList.innerHTML = '';
        users.forEach(username => {
            const item = document.createElement('div');
            item.className = 'muted-user';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            nameSpan.textContent = username;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'muted-user-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeBotUser(username));
            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            botUsersList.appendChild(item);
        });
    }

    function loadBotUsers() {
        chrome.storage.local.get([STORAGE_KEY_BOT_USERS], (result) => {
            renderBotUsers(result[STORAGE_KEY_BOT_USERS] || []);
        });
    }

    function addBotUser(username) {
        if (!username || !username.trim()) return;
        username = username.trim();
        chrome.storage.local.get([STORAGE_KEY_BOT_USERS], (result) => {
            const users = result[STORAGE_KEY_BOT_USERS] || [];
            if (users.includes(username)) { showStatus('User already in list'); return; }
            users.push(username);
            chrome.storage.local.set({ [STORAGE_KEY_BOT_USERS]: users }, () => {
                renderBotUsers(users);
                botUserInput.value = '';
                showStatus(`Added ${username}`);
            });
        });
    }

    function removeBotUser(username) {
        chrome.storage.local.get([STORAGE_KEY_BOT_USERS], (result) => {
            let users = result[STORAGE_KEY_BOT_USERS] || [];
            users = users.filter(u => u !== username);
            chrome.storage.local.set({ [STORAGE_KEY_BOT_USERS]: users }, () => {
                renderBotUsers(users);
                showStatus(`Removed ${username}`);
            });
        });
    }

    addBotUserBtn.addEventListener('click', () => addBotUser(botUserInput.value));
    botUserInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addBotUser(botUserInput.value); });
    loadBotUsers();

    // ============================================
    // @EVERYONE LIST MANAGEMENT
    // ============================================

    const everyoneList = document.getElementById('everyone-list');
    const everyoneUserInput = document.getElementById('everyone-user-input');
    const addEveryoneUserBtn = document.getElementById('add-everyone-user-btn');

    function renderEveryoneList(users) {
        everyoneList.innerHTML = '';
        users.forEach(username => {
            const item = document.createElement('div');
            item.className = 'muted-user';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            nameSpan.textContent = username;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'muted-user-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeEveryoneUser(username));

            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            everyoneList.appendChild(item);
        });
    }

    function loadEveryoneList() {
        chrome.storage.local.get([STORAGE_KEY_EVERYONE_LIST], (result) => {
            const users = result[STORAGE_KEY_EVERYONE_LIST] || [];
            renderEveryoneList(users);
        });
    }

    function addEveryoneUser(username) {
        if (!username || !username.trim()) return;
        username = username.trim();

        chrome.storage.local.get([STORAGE_KEY_EVERYONE_LIST], (result) => {
            const users = result[STORAGE_KEY_EVERYONE_LIST] || [];
            if (users.includes(username)) {
                showStatus('User already in list');
                return;
            }
            users.push(username);
            chrome.storage.local.set({ [STORAGE_KEY_EVERYONE_LIST]: users }, () => {
                renderEveryoneList(users);
                everyoneUserInput.value = '';
                showStatus(`Added ${username}`);
            });
        });
    }

    function removeEveryoneUser(username) {
        chrome.storage.local.get([STORAGE_KEY_EVERYONE_LIST], (result) => {
            let users = result[STORAGE_KEY_EVERYONE_LIST] || [];
            users = users.filter(u => u !== username);
            chrome.storage.local.set({ [STORAGE_KEY_EVERYONE_LIST]: users }, () => {
                renderEveryoneList(users);
                showStatus(`Removed ${username}`);
            });
        });
    }

    addEveryoneUserBtn.addEventListener('click', () => {
        addEveryoneUser(everyoneUserInput.value);
    });

    everyoneUserInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addEveryoneUser(everyoneUserInput.value);
        }
    });

    loadEveryoneList();

    // ============================================
    // PII GUARD MANAGEMENT
    // ============================================

    const STORAGE_KEY_PII_PATTERNS = 'kees-pii-patterns';
    const STORAGE_KEY_PII_ENABLED = 'kees-pii-guard-enabled';
    const piiGuardEnabled = document.getElementById('pii-guard-enabled');
    const piiGuardOptions = document.getElementById('pii-guard-options');
    const piiPatternsList = document.getElementById('pii-patterns-list');
    const piiPatternInput = document.getElementById('pii-pattern-input');
    const addPiiPatternBtn = document.getElementById('add-pii-pattern-btn');

    chrome.storage.local.get([STORAGE_KEY_PII_ENABLED], (result) => {
        piiGuardEnabled.checked = result[STORAGE_KEY_PII_ENABLED] === true;
        piiGuardOptions.style.display = piiGuardEnabled.checked ? 'block' : 'none';
    });

    piiGuardEnabled.addEventListener('change', () => {
        const on = piiGuardEnabled.checked;
        piiGuardOptions.style.display = on ? 'block' : 'none';
        chrome.storage.local.set({ [STORAGE_KEY_PII_ENABLED]: on }, () => {
            showStatus(on ? 'PII guard enabled' : 'PII guard disabled');
        });
    });

    function renderPiiPatterns(list) {
        piiPatternsList.innerHTML = '';
        list.forEach(pattern => {
            const item = document.createElement('div');
            item.className = 'muted-user';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            // Mask the pattern in the UI to limit exposure
            nameSpan.textContent = pattern.length <= 4
                ? '*'.repeat(pattern.length)
                : pattern.slice(0, 2) + '*'.repeat(pattern.length - 4) + pattern.slice(-2);
            nameSpan.title = 'Pattern is masked for security';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'muted-user-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removePiiPattern(pattern));
            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            piiPatternsList.appendChild(item);
        });
    }

    function loadPiiPatterns() {
        chrome.storage.local.get([STORAGE_KEY_PII_PATTERNS], (result) => {
            renderPiiPatterns(result[STORAGE_KEY_PII_PATTERNS] || []);
        });
    }

    function addPiiPattern(pattern) {
        if (!pattern || !pattern.trim()) return;
        pattern = pattern.trim();
        chrome.storage.local.get([STORAGE_KEY_PII_PATTERNS], (result) => {
            const list = result[STORAGE_KEY_PII_PATTERNS] || [];
            const lower = pattern.toLowerCase();
            if (list.some(p => p.toLowerCase() === lower)) {
                showStatus('Pattern already exists');
                return;
            }
            list.push(pattern);
            chrome.storage.local.set({ [STORAGE_KEY_PII_PATTERNS]: list }, () => {
                renderPiiPatterns(list);
                piiPatternInput.value = '';
                showStatus('Protected pattern added');
            });
        });
    }

    function removePiiPattern(pattern) {
        chrome.storage.local.get([STORAGE_KEY_PII_PATTERNS], (result) => {
            let list = result[STORAGE_KEY_PII_PATTERNS] || [];
            list = list.filter(p => p !== pattern);
            chrome.storage.local.set({ [STORAGE_KEY_PII_PATTERNS]: list }, () => {
                renderPiiPatterns(list);
                showStatus('Protected pattern removed');
            });
        });
    }

    addPiiPatternBtn.addEventListener('click', () => addPiiPattern(piiPatternInput.value));
    piiPatternInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPiiPattern(piiPatternInput.value); });
    loadPiiPatterns();

    // ============================================
    // KEYWORD FILTER MANAGEMENT
    // ============================================

    const STORAGE_KEY_FILTERED_KEYWORDS = 'kees-filtered-keywords';
    const filteredKeywordsList = document.getElementById('filtered-keywords-list');
    const keywordInput = document.getElementById('keyword-input');
    const addKeywordBtn = document.getElementById('add-keyword-btn');

    function renderKeywords(keywords) {
        filteredKeywordsList.innerHTML = '';
        keywords.forEach(keyword => {
            const item = document.createElement('div');
            item.className = 'muted-user';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'muted-user-name';
            nameSpan.textContent = keyword;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'muted-user-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeKeyword(keyword));
            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            filteredKeywordsList.appendChild(item);
        });
    }

    function loadKeywords() {
        chrome.storage.local.get([STORAGE_KEY_FILTERED_KEYWORDS], (result) => {
            renderKeywords(result[STORAGE_KEY_FILTERED_KEYWORDS] || []);
        });
    }

    function addKeyword(keyword) {
        if (!keyword || !keyword.trim()) return;
        keyword = keyword.trim();
        chrome.storage.local.get([STORAGE_KEY_FILTERED_KEYWORDS], (result) => {
            const keywords = result[STORAGE_KEY_FILTERED_KEYWORDS] || [];
            const lower = keyword.toLowerCase();
            if (keywords.some(k => k.toLowerCase() === lower)) {
                showStatus('Keyword already in list');
                return;
            }
            keywords.push(keyword);
            chrome.storage.local.set({ [STORAGE_KEY_FILTERED_KEYWORDS]: keywords }, () => {
                renderKeywords(keywords);
                keywordInput.value = '';
                showStatus(`Filtering "${keyword}"`);
            });
        });
    }

    function removeKeyword(keyword) {
        chrome.storage.local.get([STORAGE_KEY_FILTERED_KEYWORDS], (result) => {
            let keywords = result[STORAGE_KEY_FILTERED_KEYWORDS] || [];
            keywords = keywords.filter(k => k !== keyword);
            chrome.storage.local.set({ [STORAGE_KEY_FILTERED_KEYWORDS]: keywords }, () => {
                renderKeywords(keywords);
                showStatus(`Removed "${keyword}"`);
            });
        });
    }

    addKeywordBtn.addEventListener('click', () => addKeyword(keywordInput.value));
    keywordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addKeyword(keywordInput.value); });
    loadKeywords();

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

    // ============================================
    // USER TAGS
    // ============================================
    // Full tag management lives in the dedicated Tag Manager page (tags/tags.html);
    // here we keep just the auto-tag toggle and a launcher. Uses the SNEED.tagging
    // API from tag-store.js (included before this script).

    const tagging = (window.SNEED && window.SNEED.tagging) || null;

    if (tagging) {
        const tagAutoEnabled = document.getElementById('tag-auto-enabled');
        const tagDisplayShow = document.getElementById('tag-display-show');
        const openTagManagerBtn = document.getElementById('open-tag-manager-btn');

        tagging.getSettings().then((s) => {
            tagAutoEnabled.checked = s.autoEnabled;
            tagDisplayShow.checked = !s.displayHidden;
        });

        tagAutoEnabled.addEventListener('change', async () => {
            await tagging.saveSettings({ autoEnabled: tagAutoEnabled.checked });
            await tagging.refreshAllAutoTags();
            showStatus(tagAutoEnabled.checked ? 'Auto-tagging enabled' : 'Auto-tagging disabled');
        });

        tagDisplayShow.addEventListener('change', async () => {
            await tagging.saveSettings({ displayHidden: !tagDisplayShow.checked });
            showStatus(tagDisplayShow.checked ? 'Tag chips shown' : 'Tag chips hidden');
        });

        openTagManagerBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('tags/tags.html') });
        });
    }

})();
