/**
 * homepage-content.js - Lightweight script for homepage cleanup
 * CSS hides chat and sponsored content by default at document_start.
 * This script shows them back if the user hasn't enabled hiding.
 */
(function() {
    'use strict';

    const STORAGE_KEY_CHAT = 'sneedchat-disable-homepage-chat';
    const STORAGE_KEY_SPONSORED = 'kees-disable-sponsored';

    /**
     * Add class to document element to show content
     * This overrides the CSS hiding
     */
    function showContent(showChat, showSponsored) {
        function apply() {
            const root = document.documentElement;
            if (showChat) {
                root.classList.add('kees-show-chat');
            }
            if (showSponsored) {
                root.classList.add('kees-show-sponsored');
            }
        }

        // Apply immediately if possible, otherwise wait for documentElement
        if (document.documentElement) {
            apply();
        } else {
            // Very early - wait for documentElement
            const observer = new MutationObserver(() => {
                if (document.documentElement) {
                    apply();
                    observer.disconnect();
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    }

    /**
     * Initialize - check settings and show content if not hidden
     */
    function init() {
        chrome.storage.local.get([STORAGE_KEY_CHAT, STORAGE_KEY_SPONSORED], (result) => {
            const hideChat = result[STORAGE_KEY_CHAT] === true;
            const hideSponsored = result[STORAGE_KEY_SPONSORED] === true;

            // Show content that user doesn't want hidden
            // (CSS hides everything by default for instant hiding)
            showContent(!hideChat, !hideSponsored);

            if (hideChat || hideSponsored) {
                console.log('[KEES] Homepage cleanup:',
                    hideChat ? 'chat hidden' : '',
                    hideSponsored ? 'sponsored hidden' : '');
            }
        });
    }

    // Run as early as possible
    init();
})();
