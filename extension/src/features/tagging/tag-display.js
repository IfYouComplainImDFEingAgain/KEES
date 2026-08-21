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
    let autoEnabled = true;          // when off, auto chips are not drawn (data is kept)
    let hiddenUsers = new Set();     // per-user: ids whose chips are hidden

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    // Manual tags always come first: they are the user's own labels, and they
    // read ahead of anything the activity tagger guessed. Auto tags are dropped
    // entirely while auto-tagging is switched off — the stored bucket is left
    // alone, so flipping it back on needs no recompute.
    function mergedTags(userId) {
        const entry = tagsByUser[userId];
        if (!entry) return [];
        const manual = (entry.manual || []).map(t => ({ ...t, auto: false }));
        if (!autoEnabled) return manual;
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
            chip.setAttribute('data-kees-tag', t.auto ? 'auto' : 'manual');
            // Auto tags keep their own colour, which is stable per forum. Only
            // manual tags resolve through the library — an auto label comes from
            // a forum short name, so a library entry that happened to match one
            // would otherwise hijack it.
            const bg = t.auto ? (t.color || '#555555') : tagging.resolveTagColor(t.label, t.color);
            // Both keep a 1px border so the two kinds are the same height and
            // the row doesn't jitter when a user has one of each.
            chip.style.cssText =
                'display:inline-block;font-size:11px;line-height:1.4;padding:0 6px;border-radius:8px;' +
                'color:#fff;background:' + bg + ';' +
                (t.auto
                    ? 'opacity:0.85;border:1px dashed rgba(255,255,255,0.5);'
                    : 'font-weight:600;border:1px solid rgba(255,255,255,0.25);');
            wrap.appendChild(chip);
        });
        return wrap;
    }

    // Below the author name in each post.
    function decoratePosts() {
        document.querySelectorAll('article.message:not([' + MARK_ATTR + '])').forEach(article => {
            // Mark only once the author block has actually been found. Marking
            // up front permanently skipped any post seen mid-render, and nothing
            // short of an unrelated storage change would ever revisit it.
            const nameEl = article.querySelector('.message-name');
            if (!nameEl) return;   // still rendering — leave unmarked and retry
            const link = article.querySelector('.message-name .username[data-user-id], .message-userDetails .username[data-user-id], a.username[data-user-id]');
            const userId = link && (link.getAttribute('data-user-id') || parseUserFromHref(link.getAttribute('href')));
            if (!userId) {
                // Guest or deleted author: there is nobody to tag, so mark it
                // resolved rather than re-testing it on every pass.
                article.setAttribute(MARK_ATTR, '0');
                return;
            }
            article.setAttribute(MARK_ATTR, userId);
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
        autoEnabled = s.autoEnabled !== false;
        hiddenUsers = new Set((s.hiddenUsers || []).map(String));
    }

    async function init() {
        await tagging.loadLibraryCache();
        await loadTags();
        await loadVisibility();
        decorate();

        // Posts can load lazily (inline navigation, "show more"). The pass is
        // debounced because inserting a chip row is itself a childList mutation,
        // so an immediate re-run would keep re-arming off its own output.
        let pending = null;
        const observer = new MutationObserver(() => {
            if (pending) return;
            pending = setTimeout(() => { pending = null; decorate(); }, 150);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Re-render when tags change (popup edits, member-page edits, auto-tagging),
        // when the library is recoloured, or when hide/auto settings change.
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (area !== 'local') return;
            if (changes[tagging.TAGS_KEY]) {
                tagsByUser = changes[tagging.TAGS_KEY].newValue || {};
                redraw();
            }
            if (changes[tagging.LIBRARY_KEY]) {
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
