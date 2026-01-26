/**
 * core/namespace.js - Global namespace initialization
 * Must be loaded FIRST before all other modules.
 */
(function() {
    'use strict';

    // Initialize SNEED namespace on window
    window.SNEED = window.SNEED || {};

    // Initialize all sub-namespaces
    window.SNEED.util = window.SNEED.util || {};
    window.SNEED.core = window.SNEED.core || {};
    window.SNEED.ui = window.SNEED.ui || {};
    window.SNEED.features = window.SNEED.features || {};
    window.SNEED.state = window.SNEED.state || {};

    // Basic logging
    window.SNEED.log = window.SNEED.log || {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };

})();
