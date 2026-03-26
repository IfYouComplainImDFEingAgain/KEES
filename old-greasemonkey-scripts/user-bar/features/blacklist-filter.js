/**
 * features/blacklist-filter.js - Filter blacklisted images from chat messages
 * Strips blacklisted images from incoming messages while preserving text.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const storage = SNEED.core.storage;
    const events = SNEED.core.events;
    const util = SNEED.util;
    const log = SNEED.log;

    // ============================================
    // IMAGE FILTERING
    // ============================================

    /**
     * Check and hide blacklisted images in an element
     * @param {Element} element - Element to scan for images
     */
    function filterBlacklistedImages(element) {
        if (!element || element.nodeType !== 1) return;

        const images = element.querySelectorAll('img');
        images.forEach(img => {
            if (img.dataset.blacklistChecked) return;
            img.dataset.blacklistChecked = 'true';

            const src = img.src || img.getAttribute('src');
            if (src && storage.isBlacklisted(src)) {
                img.style.display = 'none';
                img.dataset.blacklisted = 'true';
                log.info('Filtered blacklisted image:', src);
            }
        });
    }

    /**
     * Scan existing messages for blacklisted images
     * @param {Document} doc - Document to scan
     */
    function scanExistingMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (container) {
            filterBlacklistedImages(container);
        }
    }

    /**
     * Start observing for new messages and filter blacklisted images
     * @param {Document} doc - Document to observe
     */
    function startBlacklistFilter(doc) {
        if (doc.__sneed_blacklistFilter) return;

        const container = util.findMessageContainer(doc);
        if (!container) {
            log.warn('Could not find message container for blacklist filter');
            return;
        }

        // Scan existing messages
        scanExistingMessages(doc);

        // Observe for new messages
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

    /**
     * Re-scan all messages (call after blacklist changes)
     * @param {Document} doc - Document to rescan
     */
    function rescanMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (!container) return;

        // Reset all checked flags and rescan
        const images = container.querySelectorAll('img[data-blacklist-checked]');
        images.forEach(img => {
            delete img.dataset.blacklistChecked;

            const src = img.src || img.getAttribute('src');
            if (src && storage.isBlacklisted(src)) {
                img.style.display = 'none';
                img.dataset.blacklisted = 'true';
            } else if (img.dataset.blacklisted) {
                img.style.display = '';
                delete img.dataset.blacklisted;
            }
        });
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.startBlacklistFilter = startBlacklistFilter;
    SNEED.features.rescanMessages = rescanMessages;

})();
