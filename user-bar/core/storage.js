/**
 * core/storage.js - localStorage persistence
 * Handles saving and loading emotes and blacklist data.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const state = SNEED.state;
    const log = SNEED.log;

    // ============================================
    // EMOTES STORAGE
    // ============================================

    /**
     * Load emotes from localStorage
     * @returns {Array} - Array of emote objects
     */
    function getEmotes() {
        try {
            const stored = localStorage.getItem(state.STORAGE_KEYS.EMOTES);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed : state.defaultEmotes;
            }
            return state.defaultEmotes;
        } catch (e) {
            log.error('Failed to load emotes:', e);
            return state.defaultEmotes;
        }
    }

    /**
     * Save emotes to localStorage
     * @param {Array} emotesList - Array of emote objects
     * @returns {boolean} - Success status
     */
    function saveEmotes(emotesList) {
        try {
            localStorage.setItem(state.STORAGE_KEYS.EMOTES, JSON.stringify(emotesList));
            state.setEmotes(emotesList);
            return true;
        } catch (e) {
            log.error('Failed to save emotes:', e);
            return false;
        }
    }

    /**
     * Reset emotes to default
     * @returns {boolean} - Success status
     */
    function resetEmotesToDefault() {
        return saveEmotes(state.defaultEmotes);
    }

    /**
     * Initialize emotes from storage
     */
    function initEmotes() {
        const emotes = getEmotes();
        state.setEmotes(emotes);
        return emotes;
    }

    // ============================================
    // BLACKLIST STORAGE
    // ============================================

    /**
     * Load blacklist from localStorage
     * @returns {Array} - Array of blacklisted URLs
     */
    function getBlacklist() {
        try {
            const stored = localStorage.getItem(state.STORAGE_KEYS.BLACKLIST);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            log.error('Failed to load blacklist:', e);
            return [];
        }
    }

    /**
     * Save blacklist to localStorage
     * @param {Array} blacklist - Array of URLs
     * @returns {boolean} - Success status
     */
    function saveBlacklist(blacklist) {
        try {
            localStorage.setItem(state.STORAGE_KEYS.BLACKLIST, JSON.stringify(blacklist));
            return true;
        } catch (e) {
            log.error('Failed to save blacklist:', e);
            return false;
        }
    }

    /**
     * Check if a URL is blacklisted
     * @param {string} url - URL to check
     * @returns {boolean}
     */
    function isBlacklisted(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        return blacklist.includes(url);
    }

    /**
     * Add a URL to the blacklist
     * @param {string} url - URL to add
     * @returns {boolean} - Success status
     */
    function addToBlacklist(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        if (!blacklist.includes(url)) {
            blacklist.push(url);
            return saveBlacklist(blacklist);
        }
        return false;
    }

    /**
     * Remove a URL from the blacklist
     * @param {string} url - URL to remove
     * @returns {boolean} - Success status
     */
    function removeFromBlacklist(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        const index = blacklist.indexOf(url);
        if (index > -1) {
            blacklist.splice(index, 1);
            return saveBlacklist(blacklist);
        }
        return false;
    }

    /**
     * Clear the entire blacklist
     * @returns {boolean} - Success status
     */
    function clearBlacklist() {
        return saveBlacklist([]);
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.core = SNEED.core || {};
    SNEED.core.storage = {
        // Emotes
        getEmotes,
        saveEmotes,
        resetEmotesToDefault,
        initEmotes,

        // Blacklist
        getBlacklist,
        saveBlacklist,
        isBlacklisted,
        addToBlacklist,
        removeFromBlacklist,
        clearBlacklist
    };

})();
