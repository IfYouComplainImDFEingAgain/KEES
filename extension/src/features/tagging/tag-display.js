// features/tagging/tag-display.js - Render tag chips in two places only:
//   1. Below the author's name inside each post (article.message)
//   2. On the member profile header
// Tag chips reflect the merged manual + auto tags and live-update when tags change.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging) return;

    const CHIP_CLASS = 'kees-tag-chips';
    const MARK_ATTR = 'data-kees-tagged';

    let tagsByUser = {};
    let displayHidden = false;       // global: hide all chips
    let hiddenUsers = new Set();     // per-user: ids whose chips are hidden

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function mergedTags(userId) {
        const entry = tagsByUser[userId];
        if (!entry) return [];
        const manual = (entry.manual || []).map(t => ({ ...t, auto: false }));
        const auto = (entry.auto || []).map(t => ({ ...t, auto: true }));
        return manual.concat(auto);
    }

    // A block-level chip row, so it sits on its own line below the name.
    function buildChips(userId) {
        if (displayHidden || hiddenUsers.has(String(userId))) return null;
        const tags = mergedTags(userId);
        if (!tags.length) return null;
        const wrap = document.createElement('div');
        wrap.className = CHIP_CLASS;
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;';
        tags.forEach(t => {
            const chip = document.createElement('span');
            chip.textContent = t.label;
            chip.title = t.auto ? 'Auto tag (forum activity)' : 'Manual tag';
            chip.style.cssText =
                'display:inline-block;font-size:11px;line-height:1.4;padding:0 6px;border-radius:8px;' +
                'color:#fff;background:' + (t.color || '#555') + ';' +
                (t.auto ? 'opacity:0.85;border:1px dashed rgba(255,255,255,0.5);' : '');
            wrap.appendChild(chip);
        });
        return wrap;
    }

    // Below the author name in each post.
    function decoratePosts() {
        document.querySelectorAll('article.message:not([' + MARK_ATTR + '])').forEach(article => {
            article.setAttribute(MARK_ATTR, '1');
            const nameEl = article.querySelector('.message-name');
            if (!nameEl) return;
            const link = article.querySelector('.message-name .username[data-user-id], .message-userDetails .username[data-user-id], a.username[data-user-id]');
            if (!link) return;
            const userId = link.getAttribute('data-user-id') || parseUserFromHref(link.getAttribute('href'));
            if (!userId) return;
            const chips = buildChips(userId);
            if (chips) nameEl.insertAdjacentElement('afterend', chips);
        });
    }

    // On the member profile header (username often lacks data-user-id; use the URL).
    function decorateMemberHeader() {
        const match = window.location.pathname.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        if (!match) return;
        const nameEl = document.querySelector('.memberHeader-name');
        if (!nameEl || nameEl.querySelector('.' + CHIP_CLASS)) return;
        const chips = buildChips(match[1]);
        if (chips) nameEl.appendChild(chips);
    }

    function decorate() {
        decoratePosts();
        decorateMemberHeader();
    }

    function redraw() {
        // Clear existing chips and marks so changed tags re-render cleanly.
        document.querySelectorAll('.' + CHIP_CLASS).forEach(el => el.remove());
        document.querySelectorAll('[' + MARK_ATTR + ']').forEach(el => el.removeAttribute(MARK_ATTR));
        decorate();
    }

    async function loadTags() {
        tagsByUser = await tagging.getAllTags();
    }

    async function loadVisibility() {
        const s = await tagging.getSettings();
        displayHidden = !!s.displayHidden;
        hiddenUsers = new Set((s.hiddenUsers || []).map(String));
    }

    async function init() {
        await loadTags();
        await loadVisibility();
        decorate();

        // Posts can load lazily (inline navigation, "show more").
        const observer = new MutationObserver(() => decorate());
        observer.observe(document.body, { childList: true, subtree: true });

        // Re-render when tags change (popup edits, member-page edits, auto-tagging)
        // or when hide settings change (global toggle / per-user hide).
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (area !== 'local') return;
            if (changes[tagging.TAGS_KEY]) {
                tagsByUser = changes[tagging.TAGS_KEY].newValue || {};
                redraw();
            }
            if (changes[tagging.SETTINGS_KEY]) {
                await loadVisibility();
                redraw();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
