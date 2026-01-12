// ==UserScript==
// @name         Sneedchat User Bar (Modular)
// @namespace    http://tampermonkey.net/
// @version      3.5.0
// @description  Adds a toggleable custom emote and format bar with image blacklist and emote management.
// @author
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/util/dom.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/core/state.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/core/storage.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/core/events.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/ui/styles.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/ui/color-picker.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/ui/dialogs.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/ui/bars.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/features/formatting.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/features/input.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/user-bar-v3.5.0/user-bar/bootstrap.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = 'user-bar-v3.5.0';

    // Ensure global namespace exists
    window.SNEED = window.SNEED || {};
    window.SNEED.version = VERSION;

    // Logging
    const log = {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };
    window.SNEED.log = window.SNEED.log || log;

    log.info(`Sneedchat User Bar ${VERSION} - @require modular load`);

    // Wait for DOM ready then initialize
    function initWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (window.SNEED.init) {
                    window.SNEED.init();
                } else {
                    log.error('Bootstrap module not loaded - SNEED.init() not available');
                }
            }, { once: true });
        } else {
            if (window.SNEED.init) {
                window.SNEED.init();
            } else {
                log.error('Bootstrap module not loaded - SNEED.init() not available');
            }
        }
    }

    initWhenReady();
})();
