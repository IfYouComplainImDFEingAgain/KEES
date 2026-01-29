/**
 * features/disruptive-guest-filter.js - Filter messages from disruptive guests
 * Hides messages from users marked as "Disruptive Guest" when enabled.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const util = SNEED.util;
    const log = SNEED.log;

    const STORAGE_KEY = 'kees-mute-disruptive-guests';

    // Cache the setting for synchronous checks
    let muteDisruptiveGuests = false;

    // Track if extension context is still valid
    let contextValid = true;

    function isExtensionContextValid() {
        try {
            return contextValid && chrome.runtime && !!chrome.runtime.id;
        } catch (e) {
            contextValid = false;
            return false;
        }
    }

    // ============================================
    // STORAGE
    // ============================================

    async function loadSetting() {
        if (!isExtensionContextValid()) return false;

        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        contextValid = false;
                        resolve(false);
                        return;
                    }
                    muteDisruptiveGuests = result[STORAGE_KEY] === true;
                    resolve(muteDisruptiveGuests);
                });
            } catch (e) {
                contextValid = false;
                resolve(false);
            }
        });
    }

    // ============================================
    // MESSAGE FILTERING
    // ============================================

    /**
     * Check if a message element is from a disruptive guest
     * @param {Element} element - Message element to check
     * @returns {boolean}
     */
    function isDisruptiveGuest(element) {
        // Look for the disruptive-user icon within the message
        return element.querySelector('i.disruptive-user') !== null;
    }

    /**
     * Hide messages from disruptive guests in an element
     * @param {Element} element - Element to scan for messages
     */
    function filterDisruptiveMessages(element) {
        if (!element || element.nodeType !== 1) return;
        if (!muteDisruptiveGuests) return;

        // Check if this element itself is a message with disruptive user
        if (element.classList && element.classList.contains('message')) {
            processMessage(element);
        }

        // Check child messages
        const messages = element.querySelectorAll('.message');
        messages.forEach(processMessage);
    }

    /**
     * Process a single message element
     * @param {Element} msg - Message element
     */
    function processMessage(msg) {
        if (msg.dataset.disruptiveChecked) return;
        msg.dataset.disruptiveChecked = 'true';

        if (isDisruptiveGuest(msg)) {
            if (muteDisruptiveGuests) {
                msg.style.display = 'none';
                msg.dataset.disruptiveHidden = 'true';
                log.info('Filtered disruptive guest message');
            }
        }
    }

    /**
     * Scan existing messages for disruptive guests
     * @param {Document} doc - Document to scan
     */
    function scanExistingMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (container) {
            filterDisruptiveMessages(container);
        }
    }

    /**
     * Re-scan all messages (call after setting changes)
     * @param {Document} doc - Document to rescan
     */
    function rescanMessages(doc) {
        const container = util.findMessageContainer(doc);
        if (!container) return;

        // Reset all checked flags and rescan
        const messages = container.querySelectorAll('.message[data-disruptive-checked]');
        messages.forEach(msg => {
            delete msg.dataset.disruptiveChecked;

            if (isDisruptiveGuest(msg)) {
                if (muteDisruptiveGuests) {
                    msg.style.display = 'none';
                    msg.dataset.disruptiveHidden = 'true';
                } else if (msg.dataset.disruptiveHidden) {
                    msg.style.display = '';
                    delete msg.dataset.disruptiveHidden;
                }
            }
        });
    }

    /**
     * Start observing for new messages and filter disruptive guests
     * @param {Document} doc - Document to observe
     */
    function startDisruptiveFilter(doc) {
        if (doc.__sneed_disruptiveFilter) return;

        const container = util.findMessageContainer(doc);
        if (!container) {
            log.warn('Could not find message container for disruptive guest filter');
            return;
        }

        // Scan existing messages
        scanExistingMessages(doc);

        // Observe for new messages
        const observer = new MutationObserver((mutations) => {
            if (!muteDisruptiveGuests) return;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        filterDisruptiveMessages(node);
                    }
                }
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        SNEED.core.events.addManagedObserver(container, observer);

        doc.__sneed_disruptiveFilter = true;
        log.info('Disruptive guest filter started');
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function init(doc) {
        if (!isExtensionContextValid()) return;

        await loadSetting();
        startDisruptiveFilter(doc);

        // Listen for setting changes
        try {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (!isExtensionContextValid()) return;
                if (areaName === 'local' && changes[STORAGE_KEY]) {
                    muteDisruptiveGuests = changes[STORAGE_KEY].newValue === true;
                    rescanMessages(doc);
                }
            });
        } catch (e) {
            contextValid = false;
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.disruptiveGuestFilter = {
        init,
        startDisruptiveFilter,
        rescanMessages
    };

})();
