// bootstrap.js - Application entry point, handles initialization, injection, and cleanup
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

    function captureChatConfig() {
        window.addEventListener('__kees_chat_config', (e) => {
            const data = e.detail;
            if (data && data.wsUrl) {
                chrome.storage.local.set({
                    [state.STORAGE_KEYS.CHAT_WS_URL]: data.wsUrl,
                    [state.STORAGE_KEYS.CHAT_USER]: data.user || null
                });
            }
        }, { once: true });

        // Inject external script to read APP config (CSP-safe)
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/capture-chat-config.js');
        document.documentElement.appendChild(script);
        script.addEventListener('load', () => script.remove());

        function saveRoom() {
            const room = parseInt(window.location.hash.substring(1), 10);
            if (room > 0) {
                chrome.storage.local.set({ [state.STORAGE_KEYS.CHAT_LAST_ROOM]: room });
            }
        }
        saveRoom();
        window.addEventListener('hashchange', saveRoom);
    }

    function hideOfficialToolbar(doc) {
        if (doc.getElementById('sneed-hide-toolbar')) return;
        const style = doc.createElement('style');
        style.id = 'sneed-hide-toolbar';
        style.textContent = '.chat-toolbar { display: none !important; }';
        (doc.head || doc.documentElement).appendChild(style);
    }

    function injectEmoteBar() {
        const isIframe = util.isInIframe();

        if (isIframe) {
            const messageForm = document.getElementById('new-message-form');

            if (messageForm && !document.getElementById('custom-emote-bar')) {
                hideOfficialToolbar(document);

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

                if (features.startBlacklistFilter) {
                    features.startBlacklistFilter(document);
                }

                if (features.startWatchedUsers) {
                    features.startWatchedUsers(document);
                }

                if (SNEED.features.ziplineUpload && SNEED.features.ziplineUpload.start) {
                    SNEED.features.ziplineUpload.start(document);
                }

                if (SNEED.features.youtubeTitles && SNEED.features.youtubeTitles.start) {
                    SNEED.features.youtubeTitles.start(document);
                }

                if (SNEED.features.doubleClickEdit && SNEED.features.doubleClickEdit.start) {
                    SNEED.features.doubleClickEdit.start(document);
                }

                if (SNEED.features.mentionNotifications && SNEED.features.mentionNotifications.start) {
                    SNEED.features.mentionNotifications.start(document);
                }

                if (SNEED.features.mentionSort && SNEED.features.mentionSort.start) {
                    SNEED.features.mentionSort.start(document);
                }

                if (SNEED.features.whisperBox && SNEED.features.whisperBox.start) {
                    SNEED.features.whisperBox.start(document);
                }

                if (SNEED.features.botColumn && SNEED.features.botColumn.start) {
                    SNEED.features.botColumn.start(document);
                }

                if (SNEED.features.waveAnimation && SNEED.features.waveAnimation.start) {
                    SNEED.features.waveAnimation.start(document);
                }

                log.info('Emote and format bars injected into test-chat');
            }
        } else {
            const iframe = document.getElementById('rust-shim');

            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                    if (iframeDoc && iframeDoc.readyState === 'complete') {
                        const messageForm = iframeDoc.getElementById('new-message-form');

                        if (messageForm && !iframeDoc.getElementById('custom-emote-bar')) {
                            hideOfficialToolbar(iframeDoc);

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

                            if (features.startBlacklistFilter) {
                                features.startBlacklistFilter(iframeDoc);
                            }

                            if (features.startWatchedUsers) {
                                features.startWatchedUsers(iframeDoc);
                            }

                            if (SNEED.features.youtubeTitles && SNEED.features.youtubeTitles.start) {
                                SNEED.features.youtubeTitles.start(iframeDoc);
                            }

                            if (SNEED.features.doubleClickEdit && SNEED.features.doubleClickEdit.start) {
                                SNEED.features.doubleClickEdit.start(iframeDoc);
                            }

                            if (SNEED.features.ziplineUpload && SNEED.features.ziplineUpload.start) {
                                SNEED.features.ziplineUpload.start(iframeDoc);
                            }

                            if (SNEED.features.mentionNotifications && SNEED.features.mentionNotifications.start) {
                                SNEED.features.mentionNotifications.start(iframeDoc);
                            }

                            if (SNEED.features.mentionSort && SNEED.features.mentionSort.start) {
                                SNEED.features.mentionSort.start(iframeDoc);
                            }

                            if (SNEED.features.whisperBox && SNEED.features.whisperBox.start) {
                                SNEED.features.whisperBox.start(iframeDoc);
                            }

                            if (SNEED.features.botColumn && SNEED.features.botColumn.start) {
                                SNEED.features.botColumn.start(iframeDoc);
                            }

                            if (SNEED.features.waveAnimation && SNEED.features.waveAnimation.start) {
                                SNEED.features.waveAnimation.start(iframeDoc);
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

    function observeForIframe(doc) {
        if (doc.__sneed_iframe_observed) return;
        doc.__sneed_iframe_observed = true;

        const obs = new MutationObserver(() => {
            const iframe = doc.getElementById('rust-shim');
            if (iframe && !iframe.__sneed_observed) {
                iframe.__sneed_observed = true;
                iframe.addEventListener('load', () => checkAndReinject(), { passive: true });
                state.addTimer(setTimeout(checkAndReinject, 50));

                try {
                    const iframeWin = iframe.contentWindow;
                    if (iframeWin && !iframe.__sneed_unload_handler) {
                        iframe.__sneed_unload_handler = true;
                        iframeWin.addEventListener('beforeunload', () => {
                            events.cleanupIframeObservers(iframe);
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

    async function init() {
        if (state.isInitialized()) {
            log.warn('Already initialized');
            return;
        }

        log.info('Initializing Sneedchat Enhancer Extension...');

        await storage.initAll();

        captureChatConfig();

        function waitForReady() {
            if (document.readyState === 'loading') {
                events.addGlobalEventListener(document, 'DOMContentLoaded', () => {
                    state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
                });
            } else {
                state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
            }

            observeForIframe(document);
        }

        waitForReady();

        events.addGlobalEventListener(document, 'visibilitychange', () => {
            if (!document.hidden) {
                checkAndReinject();
            }
        });

        events.addGlobalEventListener(window, 'focus', () => {
            checkAndReinject();
        });

        state.addTimer(setTimeout(checkAndReinject, state.CONFIG.POLLING_CHECK_DELAY));

        events.addGlobalEventListener(window, 'unload', () => {
            state.clearAllTimers();
            events.cleanupAllObservers();
            events.cleanupAllListeners();
            ui.cleanupBars(document);

            if (document.__sneed_sendWatcher) {
                document.__sneed_sendWatcher.destroy();
            }

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

    SNEED.init = init;
    SNEED.injectEmoteBar = injectEmoteBar;
    SNEED.checkAndReinject = checkAndReinject;

    // Auto-initialize
    SNEED.init();

})();
