/**
 * homepage-content.js - Lightweight script for homepage chat removal
 * Runs on the forum homepage to disable the chat widget if setting is enabled.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'sneedchat-disable-homepage-chat';

    /**
     * Remove the chat widget from the homepage
     */
    function removeChatWidget() {
        // Find the chat block container
        const chatBlock = document.querySelector('.hb-chat--block-container');

        if (chatBlock) {
            // Remove the entire chat block
            chatBlock.remove();
            console.log('[SNEED] Homepage chat widget removed');
            return true;
        }

        return false;
    }

    /**
     * Initialize - check setting and remove chat if enabled
     */
    function init() {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            if (result[STORAGE_KEY] === true) {
                // Try to remove immediately
                if (!removeChatWidget()) {
                    // If not found yet, wait for DOM and try again
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', removeChatWidget);
                    } else {
                        // Use MutationObserver as fallback for dynamically loaded content
                        const observer = new MutationObserver((mutations, obs) => {
                            if (removeChatWidget()) {
                                obs.disconnect();
                            }
                        });
                        observer.observe(document.body || document.documentElement, {
                            childList: true,
                            subtree: true
                        });

                        // Safety timeout - stop observing after 5 seconds
                        setTimeout(() => observer.disconnect(), 5000);
                    }
                }
            }
        });
    }

    // Run as early as possible
    init();
})();
