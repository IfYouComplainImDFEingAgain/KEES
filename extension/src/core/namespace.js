// core/namespace.js - Global namespace initialization (must load first)
(function() {
    'use strict';

    window.SNEED = window.SNEED || {};

    window.SNEED.util = window.SNEED.util || {};
    window.SNEED.core = window.SNEED.core || {};
    window.SNEED.ui = window.SNEED.ui || {};
    window.SNEED.features = window.SNEED.features || {};
    window.SNEED.state = window.SNEED.state || {};

    window.SNEED.log = window.SNEED.log || {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };

})();
