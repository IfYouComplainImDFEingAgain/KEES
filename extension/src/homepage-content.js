// homepage-content.js - CSS hides chat/sponsored content by default, shows back if not disabled
(function() {
    'use strict';

    const STORAGE_KEY_CHAT = 'sneedchat-disable-homepage-chat';
    const STORAGE_KEY_SPONSORED = 'kees-disable-sponsored';

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

        if (document.documentElement) {
            apply();
        } else {
            const observer = new MutationObserver(() => {
                if (document.documentElement) {
                    apply();
                    observer.disconnect();
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    }

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

    init();
})();
