/**
 * core/namespace.js - Global namespace initialization
 * Must be loaded FIRST before all other modules.
 * Ensures SNEED exists on the correct global object (unsafeWindow for userscript sandboxes).
 */
(function() {
    'use strict';

    // Get the real page global - unsafeWindow in userscript sandbox, otherwise window
    const g = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // Initialize SNEED namespace on the global
    g.SNEED = g.SNEED || {};

    // Initialize all sub-namespaces
    g.SNEED.util = g.SNEED.util || {};
    g.SNEED.core = g.SNEED.core || {};
    g.SNEED.ui = g.SNEED.ui || {};
    g.SNEED.features = g.SNEED.features || {};
    g.SNEED.state = g.SNEED.state || {};

    // Basic logging (may be overwritten by loader)
    g.SNEED.log = g.SNEED.log || {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };

})();
