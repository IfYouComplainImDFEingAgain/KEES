/**
 * homepage-content.js - Lightweight script for homepage cleanup
 * Runs on the forum homepage to optionally remove chat widget and sponsored content.
 */
(function() {
    'use strict';

    const STORAGE_KEY_CHAT = 'sneedchat-disable-homepage-chat';
    const STORAGE_KEY_SPONSORED = 'kees-disable-sponsored';

    let removedChat = false;
    let removedSponsored = false;

    /**
     * Remove the chat widget from the homepage
     */
    function removeChatWidget() {
        if (removedChat) return true;

        const chatBlock = document.querySelector('.hb-chat--block-container');
        if (chatBlock) {
            chatBlock.remove();
            removedChat = true;
            console.log('[KEES] Homepage chat widget removed');
            return true;
        }
        return false;
    }

    /**
     * Remove sponsored content from the homepage
     */
    function removeSponsoredContent() {
        if (removedSponsored) return true;

        const sponsoredBlocks = document.querySelectorAll('.hb-sponsored');
        if (sponsoredBlocks.length > 0) {
            sponsoredBlocks.forEach(block => block.remove());
            removedSponsored = true;
            console.log(`[KEES] Removed ${sponsoredBlocks.length} sponsored block(s)`);
            return true;
        }
        return false;
    }

    /**
     * Initialize - check settings and remove content if enabled
     */
    function init() {
        chrome.storage.local.get([STORAGE_KEY_CHAT, STORAGE_KEY_SPONSORED], (result) => {
            const removeChat = result[STORAGE_KEY_CHAT] === true;
            const removeSponsored = result[STORAGE_KEY_SPONSORED] === true;

            if (!removeChat && !removeSponsored) return;

            function tryRemove() {
                let allDone = true;

                if (removeChat && !removeChatWidget()) {
                    allDone = false;
                }
                if (removeSponsored && !removeSponsoredContent()) {
                    allDone = false;
                }

                return allDone;
            }

            // Try to remove immediately
            if (!tryRemove()) {
                // If not found yet, wait for DOM and try again
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', tryRemove);
                } else {
                    // Use MutationObserver as fallback for dynamically loaded content
                    const observer = new MutationObserver((mutations, obs) => {
                        if (tryRemove()) {
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
        });
    }

    // Run as early as possible
    init();
})();
