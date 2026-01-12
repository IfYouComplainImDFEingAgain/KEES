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
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION - Update these for new releases
    // ============================================
    const VERSION = '3.5.0';
    const BASE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/sneedchat-enhancer/v' + VERSION + '/user-bar/';
    // For local development, use:
    // const BASE_URL = 'http://localhost:8080/user-bar/';

    // ============================================
    // GLOBAL NAMESPACE
    // ============================================
    window.SNEED = window.SNEED || {};
    window.SNEED.version = VERSION;
    window.SNEED.state = {};
    window.SNEED.ui = {};
    window.SNEED.features = {};
    window.SNEED.util = {};
    window.SNEED.core = {};

    // ============================================
    // LOGGING
    // ============================================
    const log = {
        info: (...args) => console.log('[SNEED]', ...args),
        error: (...args) => console.error('[SNEED]', ...args),
        warn: (...args) => console.warn('[SNEED]', ...args)
    };
    window.SNEED.log = log;

    // ============================================
    // MODULE LOADER
    // ============================================
    const loadedModules = [];
    const failedModules = [];

    async function fetchModule(url) {
        const response = await fetch(url, {
            cache: 'no-cache',
            headers: {
                'Accept': 'application/javascript'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }

    async function loadModule(modulePath) {
        const url = BASE_URL + modulePath;

        try {
            log.info(`Loading module: ${modulePath}`);
            const code = await fetchModule(url);

            // Evaluate the module in a try-catch to isolate errors
            try {
                // Use indirect eval to execute in global scope
                (0, eval)(code);
                loadedModules.push(modulePath);
                log.info(`Loaded: ${modulePath}`);
                return true;
            } catch (evalError) {
                log.error(`Eval error in ${modulePath}:`, evalError);
                failedModules.push({ module: modulePath, error: evalError.message });
                return false;
            }
        } catch (fetchError) {
            log.error(`Fetch error for ${modulePath}:`, fetchError);
            failedModules.push({ module: modulePath, error: fetchError.message });
            return false;
        }
    }

    async function loadManifest() {
        const url = BASE_URL + 'manifest.json';

        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            log.error('Failed to load manifest:', error);
            // Fallback to hardcoded module list
            return {
                version: VERSION,
                modules: [
                    'util/dom.js',
                    'core/state.js',
                    'core/storage.js',
                    'core/events.js',
                    'ui/styles.js',
                    'ui/color-picker.js',
                    'ui/dialogs.js',
                    'ui/bars.js',
                    'features/formatting.js',
                    'features/input.js',
                    'bootstrap.js'
                ]
            };
        }
    }

    async function init() {
        log.info(`Sneedchat User Bar v${VERSION} - Loading...`);

        // Wait for DOM ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        // Load manifest
        const manifest = await loadManifest();
        log.info(`Manifest loaded: ${manifest.modules.length} modules`);

        // Load modules in order (sequential to maintain dependencies)
        for (const modulePath of manifest.modules) {
            const success = await loadModule(modulePath);
            if (!success) {
                log.warn(`Module ${modulePath} failed to load, continuing...`);
            }
        }

        // Report status
        log.info(`Loaded ${loadedModules.length}/${manifest.modules.length} modules`);

        if (failedModules.length > 0) {
            log.warn('Failed modules:', failedModules);
        }

        // Initialize the application if bootstrap loaded successfully
        if (window.SNEED.init) {
            try {
                window.SNEED.init();
                log.info('Application initialized');
            } catch (initError) {
                log.error('Initialization error:', initError);
            }
        } else {
            log.error('Bootstrap module not loaded - SNEED.init() not available');
        }
    }

    // Start loading
    init().catch(error => {
        log.error('Fatal initialization error:', error);
    });
})();
