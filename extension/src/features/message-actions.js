// features/message-actions.js - Replace the chat's lone hover "report" button
// with a row of actions parked at the end of the message meta line.
//
// The site puts a single report link in .buttons, off on the far side of the
// row where it's easy to hit by accident and useless for anything else. That
// link is hidden (not removed - the report URL is read back off it) and three
// buttons are appended to .meta instead: copy the message UUID, open the
// poster's profile, and report.
//
// .meta is also where the new-user badge lands, and that badge is painted right
// after .author, so appending keeps these buttons after both the badge and the
// timestamp no matter which feature runs first.
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const log = SNEED.log;

    const MARK_ATTR = 'data-kees-actions';
    const GROUP_CLASS = 'kees-actions';
    const BTN_CLASS = 'kees-action';

    const STYLES = `
        .chat-message .buttons .button.report { display: none !important; }

        .${GROUP_CLASS} {
            display: inline-flex;
            gap: 2px;
            margin-left: 6px;
            vertical-align: middle;
        }
        .${GROUP_CLASS} .${BTN_CLASS} {
            display: inline-block;
            min-width: 16px;
            padding: 0 3px;
            border: 0;
            border-radius: 3px;
            background: rgba(127, 127, 127, 0.18);
            color: inherit;
            opacity: 0.55;
            font-size: 10px;
            font-weight: 700;
            line-height: 15px;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
        }
        .${GROUP_CLASS} .${BTN_CLASS}:hover {
            opacity: 1;
            background: rgba(127, 127, 127, 0.35);
            text-decoration: none;
        }
        .${GROUP_CLASS} .${BTN_CLASS}.kees-action-report:hover {
            background: #8b1a1a;
            color: #fff;
        }
        .${GROUP_CLASS} .${BTN_CLASS}.kees-copied {
            opacity: 1;
            background: #2e7d32;
            color: #fff;
        }
    `;

    function injectStyles(doc) {
        if (doc.getElementById('kees-message-actions-styles')) return;
        const style = doc.createElement('style');
        style.id = 'kees-message-actions-styles';
        style.textContent = STYLES;
        (doc.head || doc.documentElement).appendChild(style);
    }

    // ---------- message identity ----------

    function messageUuid(msgEl) {
        const id = msgEl.id || (msgEl.dataset && msgEl.dataset.id) || '';
        const uuid = id.replace(/^chat-message-/, '');
        return uuid || null;
    }

    // Anything inside .message is post *content*, so a member link someone
    // pasted there belongs to a third party - only the meta row identifies the
    // poster.
    function profileHref(msgEl) {
        const authorEl = msgEl.querySelector('.author[data-id]');
        const userId = authorEl && authorEl.getAttribute('data-id');

        for (const a of msgEl.querySelectorAll('a[href*="/members/"]')) {
            if (a.closest('.message')) continue;
            return a.getAttribute('href');
        }

        if (userId && /^\d+$/.test(userId) && userId !== '0') {
            return '/members/' + userId + '/';
        }
        return null;
    }

    // The native link is authoritative; build the URL only when the site left
    // it out (own messages carry edit/delete instead).
    function reportHref(msgEl, uuid) {
        const native = msgEl.querySelector('.buttons .button.report[href]');
        if (native) return native.getAttribute('href');
        return uuid ? '/chat/messages/' + uuid + '/report' : null;
    }

    // ---------- clipboard ----------

    function copyText(doc, text) {
        const nav = (doc.defaultView || window).navigator;
        if (nav && nav.clipboard && nav.clipboard.writeText) {
            return nav.clipboard.writeText(text).catch(() => legacyCopy(doc, text));
        }
        return Promise.resolve(legacyCopy(doc, text));
    }

    // Clipboard API is blocked in some embeddings (and when the chat iframe
    // isn't focused); the scratch-textarea route still works there.
    function legacyCopy(doc, text) {
        const ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        doc.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = doc.execCommand('copy');
        } catch (e) {
            log.warn('UUID copy failed', e);
        }
        ta.remove();
        return ok;
    }

    function flashCopied(btn) {
        const original = btn.textContent;
        btn.classList.add('kees-copied');
        btn.textContent = '✓';
        setTimeout(() => {
            btn.classList.remove('kees-copied');
            btn.textContent = original;
        }, 900);
    }

    // ---------- building ----------

    function makeButton(doc, tag, className, text, title) {
        const el = doc.createElement(tag);
        el.className = BTN_CLASS + ' ' + className;
        el.textContent = text;
        el.title = title;
        if (tag === 'button') el.type = 'button';
        return el;
    }

    function decorate(msgEl) {
        if (!msgEl.classList || !msgEl.classList.contains('chat-message')) return;
        if (msgEl.hasAttribute(MARK_ATTR)) return;

        const meta = msgEl.querySelector('.meta');
        if (!meta) return;

        const doc = msgEl.ownerDocument;
        const uuid = messageUuid(msgEl);
        const profile = profileHref(msgEl);
        const report = reportHref(msgEl, uuid);
        if (!uuid && !profile && !report) return;

        msgEl.setAttribute(MARK_ATTR, '1');

        const group = doc.createElement('span');
        group.className = GROUP_CLASS;

        if (uuid) {
            const copy = makeButton(doc, 'button', 'kees-action-copy', '⧉', 'Copy message UUID\n' + uuid);
            copy.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Promise.resolve(copyText(doc, uuid)).then(() => flashCopied(copy));
            });
            group.appendChild(copy);
        }

        if (profile) {
            const link = makeButton(doc, 'a', 'kees-action-profile', '@', 'Go to profile');
            link.href = profile;
            link.target = '_blank';
            link.rel = 'noopener';
            link.setAttribute('role', 'button');
            group.appendChild(link);
        }

        if (report) {
            const link = makeButton(doc, 'a', 'kees-action-report', '⚑', 'Report message');
            link.href = report;
            link.target = '_blank';
            link.rel = 'noopener';
            link.setAttribute('role', 'button');
            group.appendChild(link);
        }

        meta.appendChild(group);
    }

    function rescan(doc) {
        const container = doc.getElementById('chat-messages') || SNEED.util.findMessageContainer(doc);
        if (!container) return;
        for (const msgEl of container.querySelectorAll('.chat-message')) decorate(msgEl);
    }

    function start(doc) {
        if (doc.__kees_messageActions) return;
        doc.__kees_messageActions = true;

        injectStyles(doc);
        rescan(doc);

        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) decorate(node);
        });

        log.info('Message actions started');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.messageActions = { start };

})();
