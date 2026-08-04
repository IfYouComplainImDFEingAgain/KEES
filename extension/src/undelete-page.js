// undelete-page.js - Keep moderator-deleted chat messages in the DOM.
//
// Sneedchat deletes a message by pulling its element out of #chat-messages:
//
//     var el = document.getElementById("chat-message-" + id);
//     el.remove();
//
// so the only place to intervene is Element.prototype.remove. That has to happen
// in the *page* realm — a content script's prototype patches live in the isolated
// world and page scripts never see them — hence this file being injected as a
// web-accessible resource rather than living in src/features/.
//
// The same call is used to trim the backlog, so a removal is only treated as a
// deletion when the room is at or under Sneedchat's own scrollback cap; see
// shouldPreserve() for why that's both accurate and loop-safe.
(function() {
    'use strict';

    if (window.__kees_undelete) return;
    window.__kees_undelete = true;

    const CONTAINER_ID = 'chat-messages';
    const MESSAGE_CLASS = 'chat-message';
    const MARK_ATTR = 'data-kees-deleted';
    const FLAG_ATTR = 'data-kees-undelete';   // '1' | '0', set by the content script

    // Sneedchat prunes with `while (children.length > 200) children[0].remove()`.
    const PRUNE_CAP = 200;

    const originalRemove = Element.prototype.remove;

    let container = null;

    function chatContainer() {
        if (!container || !container.isConnected) {
            container = document.getElementById(CONTAINER_ID);
        }
        return container;
    }

    function enabled() {
        return document.documentElement.getAttribute(FLAG_ATTR) === '1';
    }

    function shouldPreserve(el) {
        if (!enabled()) return false;

        // Already preserved. Letting these through is what keeps the prune loop
        // terminating: the loop removes children[0] over and over, so the second
        // attempt on a message we just marked always succeeds.
        if (el.hasAttribute(MARK_ATTR)) return false;

        const messages = chatContainer();
        if (!messages || el.parentNode !== messages) return false;

        // Deletes arrive after the frame's new messages have been appended and
        // the backlog pruned, so the room is never over the cap at that point.
        // Anything removed while over the cap is the prune loop itself.
        if (messages.children.length > PRUNE_CAP) return false;

        return true;
    }

    Element.prototype.remove = function() {
        // Fast path — this runs for every removal the page makes.
        if (!this.classList || !this.classList.contains(MESSAGE_CLASS)) {
            return originalRemove.call(this);
        }

        if (!shouldPreserve(this)) {
            return originalRemove.call(this);
        }

        this.setAttribute(MARK_ATTR, '1');
        // No removal: the message stays put and the stylesheet the content
        // script injected paints it as deleted.
    };
})();
