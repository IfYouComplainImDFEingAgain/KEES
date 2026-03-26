// core/events.js - Event listener and observer management
(function() {
    'use strict';

    const SNEED = window.SNEED;

    const eventListeners = new WeakMap();
    const globalListeners = [];
    let listenerIdCounter = 0;

    function addManagedEventListener(element, event, handler, options) {
        if (!element) return;

        element.addEventListener(event, handler, options);

        if (!eventListeners.has(element)) {
            eventListeners.set(element, []);
        }
        eventListeners.get(element).push({ event, handler, options });
    }

    function removeElementListeners(element) {
        const listeners = eventListeners.get(element);
        if (listeners) {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            eventListeners.delete(element);
        }
    }

    function addGlobalEventListener(element, event, handler, options) {
        const id = ++listenerIdCounter;
        element.addEventListener(event, handler, options);
        globalListeners.push({ id, element, event, handler, options });
        return id;
    }

    function removeGlobalEventListener(id) {
        const idx = globalListeners.findIndex(l => l.id === id);
        if (idx !== -1) {
            const { element, event, handler, options } = globalListeners[idx];
            element.removeEventListener(event, handler, options);
            globalListeners.splice(idx, 1);
        }
    }

    function cleanupAllListeners() {
        globalListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        globalListeners.length = 0;
    }

    const observers = new WeakMap();
    const globalObservers = [];
    const resizeCache = new WeakMap();
    const iframeObservers = new WeakMap();

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

    function removeElementObservers(element) {
        const elementObservers = observers.get(element);
        if (elementObservers) {
            elementObservers.forEach(observer => {
                observer.disconnect();
            });
            observers.delete(element);
        }
    }

    function cleanupAllObservers() {
        globalObservers.forEach(({ observer }) => {
            observer.disconnect();
        });
        globalObservers.length = 0;

        document.querySelectorAll('[data-observer-attached]').forEach(element => {
            if (element._resizeObserver) {
                element._resizeObserver.disconnect();
                delete element._resizeObserver;
            }
            removeElementObservers(element);

            const cached = resizeCache.get(element);
            if (cached) {
                cached.cleanup();
                resizeCache.delete(element);
            }
        });
    }

    function addIframeObserver(iframe, observer) {
        if (!iframeObservers.has(iframe)) {
            iframeObservers.set(iframe, []);
        }
        iframeObservers.get(iframe).push(observer);
    }

    function cleanupIframeObservers(iframe) {
        const obs = iframeObservers.get(iframe);
        if (obs) {
            obs.forEach(o => o.disconnect());
            iframeObservers.delete(iframe);
        }
        if (iframe.__sneed_observed) {
            delete iframe.__sneed_observed;
        }
    }

    function getResizeCache(element) {
        return resizeCache.get(element);
    }

    function setResizeCache(element, cache) {
        resizeCache.set(element, cache);
    }

    function deleteResizeCache(element) {
        resizeCache.delete(element);
    }

    // Monitors for message confirmation in chat
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
            },
            destroy() {
                this.clear();
                obs.disconnect();
                delete doc.__sneed_sendWatcher;
            }
        };
        return doc.__sneed_sendWatcher;
    }

    SNEED.core = SNEED.core || {};
    SNEED.core.events = {
        addManagedEventListener,
        removeElementListeners,
        addGlobalEventListener,
        removeGlobalEventListener,
        cleanupAllListeners,
        addManagedObserver,
        removeElementObservers,
        cleanupAllObservers,
        addIframeObserver,
        cleanupIframeObservers,
        getResizeCache,
        setResizeCache,
        deleteResizeCache,
        ensureSendWatcher
    };

})();
