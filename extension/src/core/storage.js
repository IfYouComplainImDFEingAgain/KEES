/**
 * core/storage.js - chrome.storage.local persistence
 * Async storage adapter for browser extension.
 * All methods return Promises.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const state = SNEED.state;
    const log = SNEED.log;

    // ============================================
    // STORAGE HELPER
    // ============================================

    /**
     * Get value from chrome.storage.local
     * @param {string} key - Storage key
     * @returns {Promise<any>}
     */
    function getStorageValue(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    /**
     * Set value in chrome.storage.local
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise<boolean>}
     */
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

    // ============================================
    // EMOTES STORAGE
    // ============================================

    /**
     * Load emotes from storage
     * @returns {Promise<Array>} - Array of emote objects
     */
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

    /**
     * Save emotes to storage
     * @param {Array} emotesList - Array of emote objects
     * @returns {Promise<boolean>} - Success status
     */
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

    /**
     * Reset emotes to default
     * @returns {Promise<boolean>} - Success status
     */
    async function resetEmotesToDefault() {
        return saveEmotes(state.defaultEmotes);
    }

    /**
     * Initialize emotes from storage
     * @returns {Promise<Array>}
     */
    async function initEmotes() {
        const emotes = await getEmotes();
        state.setEmotes(emotes);
        return emotes;
    }

    // ============================================
    // BLACKLIST STORAGE
    // ============================================

    /**
     * Load blacklist from storage
     * @returns {Promise<Array>} - Array of blacklisted URLs
     */
    async function getBlacklist() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.BLACKLIST);
            return stored || [];
        } catch (e) {
            log.error('Failed to load blacklist:', e);
            return [];
        }
    }

    /**
     * Save blacklist to storage
     * @param {Array} blacklist - Array of URLs
     * @returns {Promise<boolean>} - Success status
     */
    async function saveBlacklist(blacklist) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.BLACKLIST, blacklist);
        } catch (e) {
            log.error('Failed to save blacklist:', e);
            return false;
        }
    }

    /**
     * Check if a URL is blacklisted
     * @param {string} url - URL to check
     * @returns {Promise<boolean>}
     */
    async function isBlacklisted(url) {
        if (!url) return false;
        const blacklist = await getBlacklist();
        return blacklist.includes(url);
    }

    /**
     * Check if a URL is blacklisted (sync version using cached data)
     * For use in hot paths where async is not feasible
     * @param {string} url - URL to check
     * @returns {boolean}
     */
    function isBlacklistedSync(url) {
        if (!url) return false;
        // Use cached blacklist if available
        const cachedBlacklist = state.runtime.cachedBlacklist;
        if (cachedBlacklist) {
            return cachedBlacklist.includes(url);
        }
        return false;
    }

    /**
     * Add a URL to the blacklist
     * @param {string} url - URL to add
     * @returns {Promise<boolean>} - Success status
     */
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

    /**
     * Remove a URL from the blacklist
     * @param {string} url - URL to remove
     * @returns {Promise<boolean>} - Success status
     */
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

    /**
     * Clear the entire blacklist
     * @returns {Promise<boolean>} - Success status
     */
    async function clearBlacklist() {
        const success = await saveBlacklist([]);
        if (success) {
            state.runtime.cachedBlacklist = [];
        }
        return success;
    }

    /**
     * Initialize blacklist cache
     * @returns {Promise<void>}
     */
    async function initBlacklist() {
        const blacklist = await getBlacklist();
        state.runtime.cachedBlacklist = blacklist;
    }

    // ============================================
    // WYSIWYG MODE STORAGE
    // ============================================

    /**
     * Load WYSIWYG mode setting from storage
     * @returns {Promise<boolean>} - true for WYSIWYG, false for raw BBCode
     */
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

    /**
     * Save WYSIWYG mode setting to storage
     * @param {boolean} enabled - true for WYSIWYG, false for raw BBCode
     * @returns {Promise<boolean>} - Success status
     */
    async function saveWysiwygMode(enabled) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.WYSIWYG_MODE, enabled);
        } catch (e) {
            log.error('Failed to save WYSIWYG mode:', e);
            return false;
        }
    }

    /**
     * Initialize WYSIWYG mode from storage
     * @returns {Promise<boolean>}
     */
    async function initWysiwygMode() {
        const mode = await getWysiwygMode();
        state.setWysiwygMode(mode);
        return mode;
    }

    // ============================================
    // DISABLE HOMEPAGE CHAT STORAGE
    // ============================================

    /**
     * Load disable homepage chat setting from storage
     * @returns {Promise<boolean>}
     */
    async function getDisableHomepageChat() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT);
            if (stored !== undefined && stored !== null) {
                return stored === true || stored === 'true';
            }
            return false; // Default to not disabled
        } catch (e) {
            log.error('Failed to load disable homepage chat setting:', e);
            return false;
        }
    }

    /**
     * Save disable homepage chat setting to storage
     * @param {boolean} disabled
     * @returns {Promise<boolean>}
     */
    async function saveDisableHomepageChat(disabled) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT, disabled);
        } catch (e) {
            log.error('Failed to save disable homepage chat setting:', e);
            return false;
        }
    }

    /**
     * Initialize disable homepage chat setting from storage
     * @returns {Promise<boolean>}
     */
    async function initDisableHomepageChat() {
        const disabled = await getDisableHomepageChat();
        state.setDisableHomepageChat(disabled);
        return disabled;
    }

    // ============================================
    // WATCHED USERS STORAGE
    // ============================================

    const DEFAULT_WATCHED_USERS = ['Null'];

    /**
     * Load watched users from storage
     * @returns {Promise<Array>}
     */
    async function getWatchedUsers() {
        try {
            const stored = await getStorageValue(state.STORAGE_KEYS.WATCHED_USERS);
            return stored || [...DEFAULT_WATCHED_USERS];
        } catch (e) {
            log.error('Failed to load watched users:', e);
            return [...DEFAULT_WATCHED_USERS];
        }
    }

    /**
     * Save watched users to storage
     * @param {Array} users - Array of usernames
     * @returns {Promise<boolean>}
     */
    async function saveWatchedUsers(users) {
        try {
            return await setStorageValue(state.STORAGE_KEYS.WATCHED_USERS, users);
        } catch (e) {
            log.error('Failed to save watched users:', e);
            return false;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize all storage caches
     * @returns {Promise<void>}
     */
    async function initAll() {
        await Promise.all([
            initEmotes(),
            initWysiwygMode(),
            initBlacklist(),
            initDisableHomepageChat()
        ]);
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.core = SNEED.core || {};
    SNEED.core.storage = {
        // Helpers
        getStorageValue,
        setStorageValue,

        // Emotes
        getEmotes,
        saveEmotes,
        resetEmotesToDefault,
        initEmotes,

        // Blacklist
        getBlacklist,
        saveBlacklist,
        isBlacklisted,
        isBlacklistedSync,
        addToBlacklist,
        removeFromBlacklist,
        clearBlacklist,
        initBlacklist,

        // WYSIWYG Mode
        getWysiwygMode,
        saveWysiwygMode,
        initWysiwygMode,

        // Watched Users
        getWatchedUsers,
        saveWatchedUsers,

        // Disable Homepage Chat
        getDisableHomepageChat,
        saveDisableHomepageChat,
        initDisableHomepageChat,

        // Init
        initAll
    };

})();
