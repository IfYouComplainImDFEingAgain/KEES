/**
 * core/events.js - Event listener and observer management
 * Provides centralized cleanup for event listeners and MutationObservers.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;

    // ============================================
    // EVENT LISTENER MANAGEMENT
    // ============================================

    const eventListeners = new WeakMap();
    const globalListeners = [];

    /**
     * Add a managed event listener to an element
     * @param {Element} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    function addManagedEventListener(element, event, handler, options) {
        if (!element) return;

        element.addEventListener(event, handler, options);

        // Store listener info for cleanup
        if (!eventListeners.has(element)) {
            eventListeners.set(element, []);
        }
        eventListeners.get(element).push({ event, handler, options });
    }

    /**
     * Remove all managed listeners from an element
     * @param {Element} element - Target element
     */
    function removeElementListeners(element) {
        const listeners = eventListeners.get(element);
        if (listeners) {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            eventListeners.delete(element);
        }
    }

    /**
     * Add a global event listener (tracked for cleanup)
     * @param {Element} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    function addGlobalEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        globalListeners.push({ element, event, handler, options });
    }

    /**
     * Cleanup all global event listeners
     */
    function cleanupAllListeners() {
        globalListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        globalListeners.length = 0;
    }

    // ============================================
    // OBSERVER MANAGEMENT
    // ============================================

    const observers = new WeakMap();
    const globalObservers = [];
    const resizeCache = new WeakMap();

    /**
     * Add a managed observer
     * @param {Element} element - Target element
     * @param {MutationObserver} observer - Observer instance
     * @param {boolean} isGlobal - Whether this is a global observer
     * @returns {MutationObserver}
     */
    function addManagedObserver(element, observer, isGlobal = false) {
        if (isGlobal) {
            globalObservers.push({ observer, element });
        } else if (element) {
            if (!observers.has(element)) {
                observers.set(element, []);
            }
            observers.get(element).push(observer);
        }
        return observer;
    }

    /**
     * Remove all observers from an element
     * @param {Element} element - Target element
     */
    function removeElementObservers(element) {
        const elementObservers = observers.get(element);
        if (elementObservers) {
            elementObservers.forEach(observer => {
                observer.disconnect();
            });
            observers.delete(element);
        }
    }

    /**
     * Cleanup all global observers
     */
    function cleanupAllObservers() {
        // Cleanup global observers
        globalObservers.forEach(({ observer }) => {
            observer.disconnect();
        });
        globalObservers.length = 0;

        // Cleanup any stored resize observers and resizers
        document.querySelectorAll('[data-observer-attached]').forEach(element => {
            if (element._resizeObserver) {
                element._resizeObserver.disconnect();
                delete element._resizeObserver;
            }
            removeElementObservers(element);

            // Cleanup optimized resizers
            const cached = resizeCache.get(element);
            if (cached) {
                cached.cleanup();
                resizeCache.delete(element);
            }
        });
    }

    // ============================================
    // RESIZE CACHE MANAGEMENT
    // ============================================

    /**
     * Get resize cache for an element
     * @param {Element} element - Target element
     * @returns {Object|undefined}
     */
    function getResizeCache(element) {
        return resizeCache.get(element);
    }

    /**
     * Set resize cache for an element
     * @param {Element} element - Target element
     * @param {Object} cache - Cache object
     */
    function setResizeCache(element, cache) {
        resizeCache.set(element, cache);
    }

    /**
     * Delete resize cache for an element
     * @param {Element} element - Target element
     */
    function deleteResizeCache(element) {
        resizeCache.delete(element);
    }

    // ============================================
    // SEND WATCHER
    // ============================================

    /**
     * Create or get the send watcher for a document
     * Monitors for message confirmation in chat
     * @param {Document} doc - Document context
     * @returns {Object} - Watcher interface
     */
    function ensureSendWatcher(doc) {
        if (doc.__sneed_sendWatcher) return doc.__sneed_sendWatcher;

        const state = { pending: null, timer: null };
        const container = SNEED.util.findMessageContainer(doc);

        const obs = new MutationObserver((mutations) => {
            if (!state.pending) return;
            const want = (state.pending.text || '').trim();
            if (!want) return;

            for (const m of mutations) {
                for (const n of m.addedNodes) {
                    if (!n || n.nodeType !== 1) continue;
                    const t = n.textContent || '';
                    if (t.includes(want)) {
                        const done = state.pending;
                        state.pending = null;
                        if (state.timer) { clearTimeout(state.timer); state.timer = null; }
                        done.onConfirm && done.onConfirm();
                        return;
                    }
                }
            }
        });

        obs.observe(container, { childList: true, subtree: true });
        addManagedObserver(container, obs);

        doc.__sneed_sendWatcher = {
            arm(pending) {
                state.pending = pending;
                if (state.timer) clearTimeout(state.timer);
                state.timer = setTimeout(() => {
                    const still = state.pending;
                    state.pending = null;
                    if (still && still.onFail) still.onFail();
                }, SNEED.state.CONFIG.SEND_TIMEOUT);
            },
            clear() {
                state.pending = null;
                if (state.timer) { clearTimeout(state.timer); state.timer = null; }
            }
        };
        return doc.__sneed_sendWatcher;
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.core = SNEED.core || {};
    SNEED.core.events = {
        // Event listeners
        addManagedEventListener,
        removeElementListeners,
        addGlobalEventListener,
        cleanupAllListeners,

        // Observers
        addManagedObserver,
        removeElementObservers,
        cleanupAllObservers,

        // Resize cache
        getResizeCache,
        setResizeCache,
        deleteResizeCache,

        // Send watcher
        ensureSendWatcher
    };

})();
