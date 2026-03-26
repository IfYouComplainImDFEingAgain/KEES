// core/storage.js - chrome.storage.local persistence (all methods return Promises)
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const state = SNEED.state;
    const log = SNEED.log;

    function getStorageValue(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    function setStorageValue(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    log.error('Storage error:', chrome.runtime.lastError);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    async function getEmotes() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.EMOTES);
            if (stored && Array.isArray(stored) && stored.length > 0) {
                return stored;
            }
            return state.defaultEmotes;
        } catch (e) {
            log.error('Failed to load emotes:', e);
            return state.defaultEmotes;
        }
    }

    async function saveEmotes(emotesList) {
        try {
            const success = await setStorageValue(state.STORAGE_KEYS.EMOTES, emotesList);
            if (success) {
                state.setEmotes(emotesList);
            }
            return success;
        } catch (e) {
            log.error('Failed to save emotes:', e);
            return false;
        }
    }

    async function resetEmotesToDefault() {
        return saveEmotes(state.defaultEmotes);
    }

    async function initEmotes() {
        const emotes = await getEmotes();
        state.setEmotes(emotes);
        return emotes;
    }

    async function getBlacklist() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.BLACKLIST);
            return stored || [];
        } catch (e) {
            log.error('Failed to load blacklist:', e);
            return [];
        }
    }

    async function saveBlacklist(blacklist) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.BLACKLIST, blacklist);
        } catch (e) {
            log.error('Failed to save blacklist:', e);
            return false;
        }
    }

    async function isBlacklisted(url) {
        if (!url) return false;
        const blacklist = await getBlacklist();
        return blacklist.includes(url);
    }

    // Sync version using cached data, for use in hot paths where async is not feasible
    function isBlacklistedSync(url) {
        if (!url) return false;
        const cachedBlacklist = state.runtime.cachedBlacklist;
        if (cachedBlacklist) {
            return cachedBlacklist.includes(url);
        }
        return false;
    }

    async function addToBlacklist(url) {
        if (!url) return false;
        const blacklist = await getBlacklist();
        if (!blacklist.includes(url)) {
            blacklist.push(url);
            const success = await saveBlacklist(blacklist);
            if (success) {
                state.runtime.cachedBlacklist = blacklist;
            }
            return success;
        }
        return false;
    }

    async function removeFromBlacklist(url) {
        if (!url) return false;
        const blacklist = await getBlacklist();
        const index = blacklist.indexOf(url);
        if (index > -1) {
            blacklist.splice(index, 1);
            const success = await saveBlacklist(blacklist);
            if (success) {
                state.runtime.cachedBlacklist = blacklist;
            }
            return success;
        }
        return false;
    }

    async function clearBlacklist() {
        const success = await saveBlacklist([]);
        if (success) {
            state.runtime.cachedBlacklist = [];
        }
        return success;
    }

    async function initBlacklist() {
        const blacklist = await getBlacklist();
        state.runtime.cachedBlacklist = blacklist;
    }

    async function getWysiwygMode() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.WYSIWYG_MODE);
            if (stored !== undefined && stored !== null) {
                return stored === true || stored === 'true';
            }
            return true; // Default to WYSIWYG mode
        } catch (e) {
            log.error('Failed to load WYSIWYG mode:', e);
            return true;
        }
    }

    async function saveWysiwygMode(enabled) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.WYSIWYG_MODE, enabled);
        } catch (e) {
            log.error('Failed to save WYSIWYG mode:', e);
            return false;
        }
    }

    async function initWysiwygMode() {
        const mode = await getWysiwygMode();
        state.setWysiwygMode(mode);
        return mode;
    }

    async function getDisableHomepageChat() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT);
            if (stored !== undefined && stored !== null) {
                return stored === true || stored === 'true';
            }
            return false;
        } catch (e) {
            log.error('Failed to load disable homepage chat setting:', e);
            return false;
        }
    }

    async function saveDisableHomepageChat(disabled) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT, disabled);
        } catch (e) {
            log.error('Failed to save disable homepage chat setting:', e);
            return false;
        }
    }

    async function initDisableHomepageChat() {
        const disabled = await getDisableHomepageChat();
        state.setDisableHomepageChat(disabled);
        return disabled;
    }

    const DEFAULT_WATCHED_USERS = ['Null'];

    async function getWatchedUsers() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.WATCHED_USERS);
            return stored || [...DEFAULT_WATCHED_USERS];
        } catch (e) {
            log.error('Failed to load watched users:', e);
            return [...DEFAULT_WATCHED_USERS];
        }
    }

    async function saveWatchedUsers(users) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.WATCHED_USERS, users);
        } catch (e) {
            log.error('Failed to save watched users:', e);
            return false;
        }
    }

    async function getEveryoneList() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.EVERYONE_LIST);
            return stored || [];
        } catch (e) {
            log.error('Failed to load @everyone list:', e);
            return [];
        }
    }

    async function saveEveryoneList(users) {
        try {
            const success = await setStorageValue(state.STORAGE_KEYS.EVERYONE_LIST, users);
            if (success) {
                state.setEveryoneList(users);
            }
            return success;
        } catch (e) {
            log.error('Failed to save @everyone list:', e);
            return false;
        }
    }

    async function initEveryoneList() {
        const list = await getEveryoneList();
        state.setEveryoneList(list);
        return list;
    }

    async function initAll() {
        await Promise.all([
            initEmotes(),
            initWysiwygMode(),
            initBlacklist(),
            initDisableHomepageChat(),
            initEveryoneList()
        ]);

        // Keep caches in sync when storage changes (e.g. from popup)
        chrome.storage.onChanged.addListener((changes) => {
            if (changes[state.STORAGE_KEYS.EVERYONE_LIST]) {
                state.setEveryoneList(changes[state.STORAGE_KEYS.EVERYONE_LIST].newValue || []);
            }
        });
    }

    SNEED.core = SNEED.core || {};
    SNEED.core.storage = {
        getStorageValue,
        setStorageValue,
        getEmotes,
        saveEmotes,
        resetEmotesToDefault,
        initEmotes,
        getBlacklist,
        saveBlacklist,
        isBlacklisted,
        isBlacklistedSync,
        addToBlacklist,
        removeFromBlacklist,
        clearBlacklist,
        initBlacklist,
        getWysiwygMode,
        saveWysiwygMode,
        initWysiwygMode,
        getWatchedUsers,
        saveWatchedUsers,
        getDisableHomepageChat,
        saveDisableHomepageChat,
        initDisableHomepageChat,
        getEveryoneList,
        saveEveryoneList,
        initEveryoneList,
        initAll
    };

})();
