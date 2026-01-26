/**
 * popup.js - Extension popup settings UI
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'sneedchat-disable-homepage-chat';

    const disableHomepageChatCheckbox = document.getElementById('disable-homepage-chat');
    const statusDiv = document.getElementById('status');

    // Load current setting
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        disableHomepageChatCheckbox.checked = result[STORAGE_KEY] === true;
    });

    // Save setting on change
    disableHomepageChatCheckbox.addEventListener('change', () => {
        const disabled = disableHomepageChatCheckbox.checked;

        chrome.storage.local.set({ [STORAGE_KEY]: disabled }, () => {
            // Show status message
            statusDiv.classList.add('show');
            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, 1500);
        });
    });
})();
