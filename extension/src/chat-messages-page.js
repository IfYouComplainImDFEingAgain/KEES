// chat-messages-page.js - Page-realm control over the lifetime of chat messages.
//
// Two features need to sit in front of the same piece of Sneedchat behaviour, so
// they live in one file with one source of truth:
//
//   Undelete   - a deleted message is dropped with `el.remove()`, so the removal
//                is intercepted and the message is marked instead.
//   Scrollback - the backlog is trimmed with
//                    while (messagesEl.children.length > 200) messagesEl.children[0].remove()
//                which cannot be stopped by refusing the removals: the condition
//                would never go false and the tab would hang. It is stopped by
//                clamping what `children.length` reports on #chat-messages, so
//                the loop is never entered and KEES trims to the user's limit.
//
// This has to be the page realm. A content script's patches to Element.prototype
// live in the isolated world and page scripts never see them, hence the file
// being injected as a web-accessible resource (see core/chat-page.js).
//
// Settings arrive as attributes on <html>, written by the content-script halves:
//   data-kees-undelete   '1' | '0'
//   data-kees-scrollback  messages to keep, '' / absent while unconfigured
(function() {
    'use strict';

    if (window.__kees_chat_messages) return;
    window.__kees_chat_messages = true;

    const CONTAINER_ID = 'chat-messages';
    const MESSAGE_CLASS = 'chat-message';
    const MARK_ATTR = 'data-kees-deleted';
    const UNDELETE_ATTR = 'data-kees-undelete';
    const LIMIT_ATTR = 'data-kees-scrollback';

    // Sneedchat's own cap, i.e. the number the prune loop compares against.
    const SITE_CAP = 200;
    const MAX_LIMIT = 1000;

    const nativeRemove = Element.prototype.remove;
    const childrenDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'children');
    const nativeChildren = childrenDescriptor && childrenDescriptor.get;

    let container = null;
    let undelete = false;
    let limit = 0;

    let clampInstalled = false;
    let breakerTripped = false;

    // Per-synchronous-turn state for the circuit breaker; see readChildren().
    let removedThisTurn = false;
    let turnScheduled = false;

    const messageObserver = new MutationObserver(trim);

    function observeContainer() {
        if (container) messageObserver.observe(container, { childList: true });
    }

    function chatContainer() {
        if (!container || !container.isConnected) {
            container = document.getElementById(CONTAINER_ID);
            clampInstalled = false;
            installClamp();
            observeContainer();
        }
        return container;
    }

    function liveChildren(el) {
        // Never `el.children` — that is the clamped view when the shadow is installed.
        return nativeChildren ? nativeChildren.call(el) : el.children;
    }

    // ---------- settings ----------

    function readSettings() {
        const root = document.documentElement;
        undelete = root.getAttribute(UNDELETE_ATTR) === '1';

        const parsed = parseInt(root.getAttribute(LIMIT_ATTR), 10);
        limit = (!isNaN(parsed) && parsed > 0) ? Math.min(parsed, MAX_LIMIT) : 0;
    }

    // The clamp only earns its keep when the room is meant to hold more than
    // Sneedchat would keep on its own — and only counts once it is really in
    // place, since everything downstream keys off it to decide whether the site
    // is still capable of pruning.
    function clampActive() {
        return clampInstalled && !breakerTripped && limit > SITE_CAP;
    }

    // ---------- scrollback ----------

    function endTurn() {
        removedThisTurn = false;
        turnScheduled = false;
    }

    function noteTurn() {
        if (turnScheduled) return;
        turnScheduled = true;
        setTimeout(endTurn, 0);
    }

    function tripBreaker() {
        breakerTripped = true;
        if (container && clampInstalled) {
            delete container.children;
            clampInstalled = false;
        }
        console.warn('[KEES] Scrollback clamp disabled: the chat kept pruning through it.');
    }

    // A view of the container's children that reports the site's own cap as its
    // length, so `while (children.length > 200)` is never entered.
    function clampedView(live) {
        return new Proxy(live, {
            get(target, prop) {
                if (prop === 'length') return SITE_CAP;
                const value = Reflect.get(target, prop);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
    }

    function readChildren(el) {
        const live = nativeChildren.call(el);
        if (!clampActive() || live.length <= SITE_CAP) return live;

        // Circuit breaker. Sneedchat reads this once per pushed message and, with
        // the clamp answering, is done. Reading it again *after* having removed a
        // message means the clamp is not ending its loop — its cap is no longer
        // the one assumed here — so stop lying before the room is emptied. The
        // fallout is one ordinary prune down to whatever the site's real cap is.
        if (removedThisTurn) {
            tripBreaker();
            return live;
        }

        return clampedView(live);
    }

    function installClamp() {
        if (clampInstalled || breakerTripped || !nativeChildren || !container) return;

        Object.defineProperty(container, 'children', {
            configurable: true,
            enumerable: true,
            get: function() { return readChildren(this); }
        });
        clampInstalled = true;
    }

    // Enforce the user's limit ourselves. nativeRemove keeps this out of the
    // interception below, so trimmed messages are never mistaken for deletions.
    function trim() {
        const messages = chatContainer();
        if (!messages || limit <= 0) return;

        const kids = liveChildren(messages);
        while (kids.length > limit) {
            nativeRemove.call(kids[0]);
        }
    }

    // ---------- undelete ----------

    function shouldPreserve(el) {
        if (!undelete) return false;

        // Already preserved. Letting these through is what keeps Sneedchat's prune
        // loop terminating when the clamp is off: it removes children[0] over and
        // over, so the second attempt on a message just marked always succeeds.
        if (el.hasAttribute(MARK_ATTR)) return false;

        const messages = chatContainer();
        if (!messages || el.parentNode !== messages) return false;

        // With the clamp active the site never prunes, so every removal it makes
        // is a deletion. Without it, deletes arrive after the frame's messages
        // have been appended and pruned — the room is never over the cap at that
        // point, so anything removed while over it is the prune loop.
        if (!clampActive() && liveChildren(messages).length > SITE_CAP) return false;

        return true;
    }

    Element.prototype.remove = function() {
        // Fast path — this runs for every removal the page makes.
        if (!this.classList || !this.classList.contains(MESSAGE_CLASS)) {
            return nativeRemove.call(this);
        }

        if (shouldPreserve(this)) {
            this.setAttribute(MARK_ATTR, '1');
            // No removal: the message stays put and the stylesheet the content
            // script injected paints it as deleted.
            return;
        }

        if (this.parentNode === chatContainer() && clampActive()) {
            removedThisTurn = true;
            noteTurn();
        }

        return nativeRemove.call(this);
    };

    // ---------- lifecycle ----------

    readSettings();

    new MutationObserver(() => {
        readSettings();
        installClamp();
        trim();
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: [UNDELETE_ATTR, LIMIT_ATTR]
    });

    function watchContainer() {
        if (!chatContainer()) return false;
        trim();
        return true;
    }

    if (!watchContainer()) {
        // The chat document is normally fully built by the time this runs, but a
        // reloading iframe can get here first.
        const retry = setInterval(() => {
            if (watchContainer()) clearInterval(retry);
        }, 250);
        setTimeout(() => clearInterval(retry), 15000);
    }
})();
