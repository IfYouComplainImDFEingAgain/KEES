// ==UserScript==
// @name         Sneedchat User Bar (Modular)
// @namespace    http://tampermonkey.net/
// @version      dev
// @description  Adds a toggleable custom emote and format bar with image blacklist and emote management.
// @author
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/core/namespace.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/util/dom.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/core/state.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/core/storage.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/core/events.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/core/bbcode-converter.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/ui/styles.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/ui/color-picker.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/ui/dialogs.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/ui/bars.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/features/formatting.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/features/input.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/features/blacklist-filter.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/features/watched-users.js
// @require      https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/bootstrap.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = 'dev';

    // Get the real page global
    const g = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // Ensure global namespace exists
    g.SNEED = g.SNEED || {};
    g.SNEED.version = VERSION;

    // Logging
    const log = {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };
    g.SNEED.log = g.SNEED.log || log;

    log.info(`Sneedchat User Bar ${VERSION} - @require modular load`);

    // Wait for DOM ready then initialize
    function initWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (g.SNEED.init) {
                    g.SNEED.init();
                } else {
                    log.error('Bootstrap module not loaded - SNEED.init() not available');
                }
            }, { once: true });
        } else {
            if (g.SNEED.init) {
                g.SNEED.init();
            } else {
                log.error('Bootstrap module not loaded - SNEED.init() not available');
            }
        }
    }

    initWhenReady();
})();
