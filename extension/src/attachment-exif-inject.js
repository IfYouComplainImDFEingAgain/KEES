/**
 * attachment-exif-inject.js - Early injection for EXIF stripping
 * Must run at document_start to intercept XHR before page JS loads.
 * Loads page script via web_accessible_resources to bypass CSP.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'kees-attachment-strip-exif';

    // Inject script via src (bypasses CSP)
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/attachment-exif-page.js');
    script.onload = function() {
        script.remove();
    };
    (document.documentElement || document.head || document.body).appendChild(script);

    // Load and apply setting
    chrome.storage.local.get([STORAGE_KEY], function(result) {
        const enabled = result[STORAGE_KEY] !== false;
        window.dispatchEvent(new CustomEvent('kees-exif-setting', {
            detail: { enabled: enabled }
        }));
    });

    // Listen for setting changes
    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
            const enabled = changes[STORAGE_KEY].newValue !== false;
            window.dispatchEvent(new CustomEvent('kees-exif-setting', {
                detail: { enabled: enabled }
            }));
        }
    });

})();
