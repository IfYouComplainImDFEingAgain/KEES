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

    // Shared message observer - one MutationObserver per document, many handlers
    const messageObservers = new WeakMap(); // doc -> { handlers, observer, container }
    const pendingHandlers = new WeakMap(); // doc -> Set of handlers waiting for container

    function findChatContainer(doc) {
        // Find actual chat message container, excluding doc.body fallback
        return (
            doc.querySelector('#chat-messages') ||
            doc.querySelector('.messages') ||
            doc.querySelector('#messages') ||
            doc.querySelector('[class*="messages"]') ||
            doc.querySelector('[class*="chat-messages"]') ||
            doc.querySelector('.chat-log') ||
            doc.querySelector('[role="log"]')
        );
    }

    function ensureSharedMessageObserver(doc) {
        if (messageObservers.has(doc)) return messageObservers.get(doc);

        const container = findChatContainer(doc);
        if (!container) return null;

        const entry = {
            handlers: new Set(),
            observer: null,
            container: container
        };

        // Flush any handlers that were queued before the container existed
        const pending = pendingHandlers.get(doc);
        if (pending) {
            for (const h of pending) entry.handlers.add(h);
            pendingHandlers.delete(doc);
        }

        entry.observer = new MutationObserver((mutations) => {
            if (entry.handlers.size === 0) return;

            const addedElements = [];
            for (const m of mutations) {
                for (const n of m.addedNodes) {
                    if (n.nodeType === 1) addedElements.push(n);
                }
            }

            if (addedElements.length === 0) return;

            for (const handler of entry.handlers) {
                try {
                    handler(addedElements);
                } catch (e) {
                    console.error('[KEES] Message handler error:', e);
                }
            }
        });

        entry.observer.observe(container, { childList: true, subtree: true });
        addManagedObserver(container, entry.observer);

        messageObservers.set(doc, entry);
        return entry;
    }

    function addMessageHandler(doc, handler) {
        const entry = ensureSharedMessageObserver(doc);
        if (entry) {
            entry.handlers.add(handler);
        } else {
            // Container not ready yet — queue the handler
            if (!pendingHandlers.has(doc)) pendingHandlers.set(doc, new Set());
            pendingHandlers.get(doc).add(handler);
        }
        return handler;
    }

    function removeMessageHandler(doc, handler) {
        const entry = messageObservers.get(doc);
        if (entry) {
            entry.handlers.delete(handler);
        }
        const pending = pendingHandlers.get(doc);
        if (pending) {
            pending.delete(handler);
        }
    }

    // Monitors for message confirmation in chat
    function ensureSendWatcher(doc) {
        if (doc.__sneed_sendWatcher) return doc.__sneed_sendWatcher;

        const state = { pending: null, timer: null };

        function sendWatcherHandler(addedElements) {
            if (!state.pending) return;
            const want = (state.pending.text || '').trim();
            if (!want) return;

            for (const n of addedElements) {
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

        addMessageHandler(doc, sendWatcherHandler);

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
                removeMessageHandler(doc, sendWatcherHandler);
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
        addMessageHandler,
        removeMessageHandler,
        initMessageObserver: ensureSharedMessageObserver,
        ensureSendWatcher
    };

})();
