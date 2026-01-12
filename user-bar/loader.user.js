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
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      github.com
// ==/UserScript==

// Initialize global SNEED namespace BEFORE the IIFE so it exists as a true global
var SNEED = window.SNEED = window.SNEED || {};

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION - Update these for new releases
    // ============================================
    const VERSION = 'user-bar-v3.5.0';
    const BASE_URL = 'https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/' + VERSION + '/user-bar/';
    // For local development, use:
    // const BASE_URL = 'http://localhost:8080/user-bar/';

    const DEBUG = false; // Set to true to stop on first module failure

    // ============================================
    // NAMESPACE PRELUDE
    // Evaluated before modules to ensure SNEED is accessible in eval context
    // ============================================
    const NAMESPACE_PRELUDE = `
var SNEED = window.SNEED = window.SNEED || {};
SNEED.util = SNEED.util || {};
SNEED.core = SNEED.core || {};
SNEED.ui = SNEED.ui || {};
SNEED.features = SNEED.features || {};
SNEED.state = SNEED.state || {};
`;

    // ============================================
    // GLOBAL NAMESPACE SETUP
    // ============================================
    window.SNEED.version = VERSION;
    window.SNEED.state = window.SNEED.state || {};
    window.SNEED.ui = window.SNEED.ui || {};
    window.SNEED.features = window.SNEED.features || {};
    window.SNEED.util = window.SNEED.util || {};
    window.SNEED.core = window.SNEED.core || {};

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
    // GM_xmlhttpRequest HELPER
    // ============================================
    function gmGetText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 30000,
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status}: ${response.statusText} - ${url}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Network error fetching ${url}: ${error.statusText || 'Unknown error'}`));
                },
                ontimeout: function() {
                    reject(new Error(`Timeout fetching ${url}`));
                }
            });
        });
    }

    // ============================================
    // MODULE LOADER
    // ============================================
    const loadedModules = [];
    const failedModules = [];

    async function loadModule(modulePath) {
        const url = BASE_URL + modulePath;

        try {
            log.info(`Loading module: ${modulePath}`);
            const moduleCode = await gmGetText(url);

            // Prefix module code with namespace prelude for robustness
            const code = NAMESPACE_PRELUDE + '\n' + moduleCode;

            // Evaluate the module in a try-catch to isolate errors
            try {
                // Use indirect eval to execute in global scope
                (0, eval)(code);
                loadedModules.push(modulePath);
                log.info(`Loaded: ${modulePath}`);
                return true;
            } catch (evalError) {
                log.error(`Eval error in ${modulePath}:`, evalError);
                failedModules.push({ module: modulePath, url: url, error: evalError.message });
                return false;
            }
        } catch (fetchError) {
            log.error(`Fetch error for ${modulePath} (${url}):`, fetchError);
            failedModules.push({ module: modulePath, url: url, error: fetchError.message });
            return false;
        }
    }

    async function loadManifest() {
        const url = BASE_URL + 'manifest.json';

        try {
            const text = await gmGetText(url);
            return JSON.parse(text);
        } catch (error) {
            log.error(`Failed to load manifest (${url}):`, error);
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
        log.info(`Base URL: ${BASE_URL}`);

        // Wait for DOM ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }

        // Initialize namespace in eval context before loading any modules
        try {
            (0, eval)(NAMESPACE_PRELUDE);
            log.info('Namespace initialized in eval context');
        } catch (e) {
            log.error('Failed to initialize namespace prelude:', e);
        }

        // Load manifest
        const manifest = await loadManifest();
        log.info(`Manifest loaded: ${manifest.modules.length} modules`);

        // Load modules in order (sequential to maintain dependencies)
        for (const modulePath of manifest.modules) {
            const success = await loadModule(modulePath);
            if (!success) {
                if (DEBUG) {
                    log.error(`Module ${modulePath} failed to load, stopping (DEBUG mode)`);
                    break;
                } else {
                    log.warn(`Module ${modulePath} failed to load, continuing...`);
                }
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
