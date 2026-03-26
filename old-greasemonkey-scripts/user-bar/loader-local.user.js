// ==UserScript==
// @name         Sneedchat User Bar (Local Dev)
// @namespace    http://tampermonkey.net/
// @version      local
// @description  Local development version - loads from filesystem
// @author
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/core/namespace.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/util/dom.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/core/state.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/core/storage.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/core/events.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/core/bbcode-converter.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/ui/styles.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/ui/color-picker.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/ui/dialogs.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/ui/bars.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/features/formatting.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/features/input.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/features/blacklist-filter.js
// @require      file:///home/derp/workbench/sneedchat-enhancer/user-bar/bootstrap.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = 'local-dev';

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

    log.info(`Sneedchat User Bar ${VERSION} - LOCAL FILE DEVELOPMENT`);

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
