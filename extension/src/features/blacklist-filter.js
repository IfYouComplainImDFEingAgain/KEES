// features/blacklist-filter.js - Filter blacklisted images from chat messages
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const storage = SNEED.core.storage;
    const events = SNEED.core.events;
    const util = SNEED.util;
    const log = SNEED.log;

    function filterBlacklistedImages(element) {
        if (!element || element.nodeType !== 1) return;

        const images = element.querySelectorAll('img');
        images.forEach(img => {
            if (img.dataset.blacklistChecked) return;
            img.dataset.blacklistChecked = 'true';

            const src = img.src || img.getAttribute('src');
            if (src && storage.isBlacklistedSync(src)) {
                img.style.display = 'none';
                img.dataset.blacklisted = 'true';
                log.info('Filtered blacklisted image:', src);
            }
        });
    }

    function scanExistingMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (container) {
            filterBlacklistedImages(container);
        }
    }

    function startBlacklistFilter(doc) {
        if (doc.__sneed_blacklistFilter) return;

        const container = util.findMessageContainer(doc);
        if (!container) {
            log.warn('Could not find message container for blacklist filter');
            return;
        }

        scanExistingMessages(doc);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        filterBlacklistedImages(node);
                    }
                }
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        events.addManagedObserver(container, observer);

        doc.__sneed_blacklistFilter = true;
        log.info('Blacklist filter started');
    }

    function rescanMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (!container) return;

        const images = container.querySelectorAll('img[data-blacklist-checked]');
        images.forEach(img => {
            delete img.dataset.blacklistChecked;

            const src = img.src || img.getAttribute('src');
            if (src && storage.isBlacklistedSync(src)) {
                img.style.display = 'none';
                img.dataset.blacklisted = 'true';
            } else if (img.dataset.blacklisted) {
                img.style.display = '';
                delete img.dataset.blacklisted;
            }
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.startBlacklistFilter = startBlacklistFilter;
    SNEED.features.rescanMessages = rescanMessages;

})();
