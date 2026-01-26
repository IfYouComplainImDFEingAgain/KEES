/**
 * bootstrap.js - Application entry point
 * Handles initialization, injection, and cleanup.
 * Async version for browser extension.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;
    const state = SNEED.state;
    const storage = SNEED.core.storage;
    const events = SNEED.core.events;
    const ui = SNEED.ui;
    const features = SNEED.features;
    const util = SNEED.util;

    // ============================================
    // INJECTION LOGIC
    // ============================================

    function injectEmoteBar() {
        const isIframe = util.isInIframe();

        if (isIframe) {
            // We're in the test-chat iframe
            const messageForm = document.getElementById('new-message-form');

            if (messageForm && !document.getElementById('custom-emote-bar')) {
                const emoteBar = ui.createEmoteBar(document);
                const formatBar = ui.createFormatBar(document);

                messageForm.parentNode.insertBefore(emoteBar, messageForm);
                messageForm.parentNode.insertBefore(formatBar, messageForm);

                features.addEmoteToggleButton(document);

                const directInput = document.getElementById('new-message-input');
                features.attachShiftEnterHandler(directInput, document);

                const root = messageForm.parentElement || document.body;
                if (root && !root.__sneed_bar_observed) {
                    observeForBarsRemoval(root, document);
                }

                // Start blacklist filter for chat messages
                if (features.startBlacklistFilter) {
                    features.startBlacklistFilter(document);
                }

                // Start watched users feature
                if (features.startWatchedUsers) {
                    features.startWatchedUsers(document);
                }

                log.info('Emote and format bars injected into test-chat');
            }
        } else {
            // We're in the parent page, need to wait for iframe
            const iframe = document.getElementById('rust-shim');

            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                    if (iframeDoc && iframeDoc.readyState === 'complete') {
                        const messageForm = iframeDoc.getElementById('new-message-form');

                        if (messageForm && !iframeDoc.getElementById('custom-emote-bar')) {
                            const emoteBar = ui.createEmoteBar(iframeDoc);
                            const formatBar = ui.createFormatBar(iframeDoc);

                            messageForm.parentNode.insertBefore(emoteBar, messageForm);
                            messageForm.parentNode.insertBefore(formatBar, messageForm);

                            features.addEmoteToggleButton(iframeDoc);

                            const iframeInput = iframeDoc.getElementById('new-message-input');
                            features.attachShiftEnterHandler(iframeInput, iframeDoc);

                            const root = messageForm.parentElement || iframeDoc.body;
                            if (root && !root.__sneed_bar_observed) {
                                observeForBarsRemoval(root, iframeDoc);
                            }

                            // Start blacklist filter for chat messages
                            if (features.startBlacklistFilter) {
                                features.startBlacklistFilter(iframeDoc);
                            }

                            // Start watched users feature
                            if (features.startWatchedUsers) {
                                features.startWatchedUsers(iframeDoc);
                            }

                            // Start YouTube titles feature
                            if (SNEED.features.youtubeTitles && SNEED.features.youtubeTitles.start) {
                                SNEED.features.youtubeTitles.start(iframeDoc);
                            }

                            // Start double-click to edit feature
                            if (SNEED.features.doubleClickEdit && SNEED.features.doubleClickEdit.start) {
                                SNEED.features.doubleClickEdit.start(iframeDoc);
                            }

                            log.info('Emote and format bars injected into iframe');
                        }
                    }
                } catch (e) {
                    log.info('Cannot access iframe content (cross-origin):', e);
                }
            }
        }
    }

    // ============================================
    // OBSERVERS
    // ============================================

    function observeForIframe(doc) {
        if (doc.__sneed_iframe_observed) return;
        doc.__sneed_iframe_observed = true;

        const obs = new MutationObserver(() => {
            const iframe = doc.getElementById('rust-shim');
            if (iframe && !iframe.__sneed_observed) {
                iframe.__sneed_observed = true;
                iframe.addEventListener('load', () => checkAndReinject(), { passive: true });
                state.addTimer(setTimeout(checkAndReinject, 50));

                // Setup cleanup when iframe unloads/reloads
                try {
                    const iframeWin = iframe.contentWindow;
                    if (iframeWin && !iframe.__sneed_unload_handler) {
                        iframe.__sneed_unload_handler = true;
                        iframeWin.addEventListener('beforeunload', () => {
                            events.cleanupIframeObservers(iframe);
                            // Clear iframe-specific state
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (iframeDoc) {
                                if (iframeDoc.__sneed_sendWatcher) {
                                    iframeDoc.__sneed_sendWatcher.destroy();
                                }
                                delete iframeDoc.__sneed_blacklistFilter;
                            }
                        });
                    }
                } catch (e) {
                    // Cross-origin - can't attach beforeunload
                }
            }
        });
        obs.observe(doc.documentElement, { childList: true, subtree: true });
        events.addManagedObserver(doc.documentElement, obs, true);
    }

    function observeForBarsRemoval(chatRoot, doc) {
        if (chatRoot.__sneed_bar_observed) return;
        chatRoot.__sneed_bar_observed = true;

        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const n of m.removedNodes) {
                    if (!n || n.nodeType !== 1) continue;
                    if (
                        n.id === 'custom-emote-bar' || n.id === 'custom-format-bar' ||
                        n.querySelector?.('#custom-emote-bar') || n.querySelector?.('#custom-format-bar')
                    ) {
                        ui.cleanupBars(doc);
                        checkAndReinject();
                        return;
                    }
                }
            }
        });
        obs.observe(chatRoot, { childList: true, subtree: true });
        events.addManagedObserver(chatRoot, obs);
    }

    // ============================================
    // REINJECT LOGIC
    // ============================================

    function checkAndReinject() {
        if (!state.canReinject()) return;

        const isIframe = util.isInIframe();

        if (isIframe) {
            if (!document.getElementById('custom-emote-bar') || !document.getElementById('custom-format-bar')) {
                injectEmoteBar();
                state.incrementReinjectAttempts();
            }
        } else {
            const iframe = document.getElementById('rust-shim');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && (!iframeDoc.getElementById('custom-emote-bar') || !iframeDoc.getElementById('custom-format-bar'))) {
                        injectEmoteBar();
                        state.incrementReinjectAttempts();
                    }
                } catch (e) {
                    // Silent fail for cross-origin
                }
            }
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function init() {
        if (state.isInitialized()) {
            log.warn('Already initialized');
            return;
        }

        log.info('Initializing Sneedchat Enhancer Extension...');

        // Initialize all storage caches (emotes, blacklist, wysiwyg mode)
        await storage.initAll();

        // Wait for DOM ready
        function waitForReady() {
            if (document.readyState === 'loading') {
                events.addGlobalEventListener(document, 'DOMContentLoaded', () => {
                    state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
                });
            } else {
                state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
            }

            // Observe for iframe on parent page
            observeForIframe(document);
        }

        waitForReady();

        // Visibility change handler
        events.addGlobalEventListener(document, 'visibilitychange', () => {
            if (!document.hidden) {
                checkAndReinject();
            }
        });

        // Focus handler
        events.addGlobalEventListener(window, 'focus', () => {
            checkAndReinject();
        });

        // Initial check after delay
        state.addTimer(setTimeout(checkAndReinject, state.CONFIG.POLLING_CHECK_DELAY));

        // Cleanup on unload
        events.addGlobalEventListener(window, 'unload', () => {
            state.clearAllTimers();
            events.cleanupAllObservers();
            events.cleanupAllListeners();
            ui.cleanupBars(document);

            // Cleanup send watcher on main document
            if (document.__sneed_sendWatcher) {
                document.__sneed_sendWatcher.destroy();
            }

            // Try to cleanup iframe too
            const iframe = document.getElementById('rust-shim');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        if (iframeDoc.__sneed_sendWatcher) {
                            iframeDoc.__sneed_sendWatcher.destroy();
                        }
                        ui.cleanupBars(iframeDoc);
                    }
                    events.cleanupIframeObservers(iframe);
                } catch (e) {
                    // Ignore cross-origin errors
                }
            }
        });

        state.setInitialized(true);
        log.info('Sneedchat Enhancer Extension initialized');
    }

    // ============================================
    // EXPORT INIT TO NAMESPACE
    // ============================================

    SNEED.init = init;
    SNEED.injectEmoteBar = injectEmoteBar;
    SNEED.checkAndReinject = checkAndReinject;

})();
