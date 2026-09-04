// features/tagging/member-tagging.js - Tagging UI on member profile pages.
//
// Adds a "Tags" profile tab holding manual tag add/remove, plus a
// read-only view of the auto-tags derived from the activity index (tag-store.js).
// Activity itself is collected by the passive post-scanner and the crawler; this
// block only reads and never fetches anything of its own.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging) return;

    function getUserInfo() {
        const m = window.location.pathname.match(/\/members\/([^.\/]+)\.(\d+)/);
        return m ? { username: decodeURIComponent(m[1]), userId: m[2] } : null;
    }

    // ----- rendering -----

    function chip(label, color, onRemove) {
        const span = document.createElement('span');
        span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:2px 8px;' +
            'border-radius:10px;color:#fff;background:' + (color || '#555') + ';';
        const text = document.createElement('span');
        text.textContent = label;
        span.appendChild(text);
        if (onRemove) {
            const x = document.createElement('span');
            x.textContent = '×';
            x.style.cssText = 'cursor:pointer;font-weight:bold;opacity:0.8;';
            x.title = 'Remove tag';
            x.addEventListener('click', onRemove);
            span.appendChild(x);
        }
        return span;
    }

    async function renderTags(userInfo, manualWrap, autoWrap) {
        const entry = await tagging.getTags(userInfo.userId);
        const settings = await tagging.getSettings();
        manualWrap.innerHTML = '';
        autoWrap.innerHTML = '';

        const manual = (entry && entry.manual) || [];
        // Auto tags survive the toggle on disk, so this card applies the same
        // display gate the on-page chips do rather than showing tags the rest
        // of the site is hiding.
        if (!settings.autoEnabled) {
            autoWrap.innerHTML = '<span style="color:#777;font-size:12px;">Auto-tagging is off</span>';
        }
        const auto = settings.autoEnabled ? ((entry && entry.auto) || []) : [];

        if (!manual.length) {
            manualWrap.innerHTML = '<span style="color:#777;font-size:12px;">No manual tags</span>';
        } else {
            manual.forEach(t => manualWrap.appendChild(chip(t.label, tagging.resolveTagColor(t.label, t.color), async () => {
                await tagging.removeManualTag(userInfo.userId, t.label);
                renderTags(userInfo, manualWrap, autoWrap);
            })));
        }

        if (!settings.autoEnabled) {
            // message already set above
        } else if (!auto.length) {
            autoWrap.innerHTML = '<span style="color:#777;font-size:12px;">No auto tags yet — activity is collected as you browse threads</span>';
        } else {
            auto.forEach(t => autoWrap.appendChild(chip(t.label, t.color, null)));  // auto keeps its stable per-forum colour
        }
    }

    function buildBox(userInfo) {
        const box = document.createElement('div');
        box.id = 'kees-user-tags';
        box.className = 'block';
        box.innerHTML =
            '<div class="block-container">' +
            '  <h3 class="block-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;">' +
            '    <span style="flex:1 1 auto;text-align:left;">User Tags</span>' +
            '    <a id="kees-open-tag-manager" href="#" style="flex:0 0 auto;margin-left:auto;text-align:right;white-space:nowrap;font-size:12px;font-weight:normal;color:#6fb3ff;">Manage all tags →</a>' +
            '  </h3>' +
            '  <div class="block-body" style="padding:16px;">' +
            '    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Manual</div>' +
            '    <div id="kees-tags-manual" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>' +
            '    <div style="display:flex;gap:8px;margin-bottom:6px;max-width:360px;">' +
            '      <input id="kees-tag-input" type="text" list="kees-tag-library-list" placeholder="Add a tag…" style="flex:1 1 auto;min-width:0;padding:6px 10px;background:#2a2a2a;border:1px solid #444;border-radius:4px;color:#fff;">' +
            '      <datalist id="kees-tag-library-list"></datalist>' +
            '      <button id="kees-tag-add" class="button button--primary"><span class="button-text">Add</span></button>' +
            '    </div>' +
            '    <div id="kees-tag-status" style="font-size:12px;color:#888;margin-bottom:16px;"></div>' +
            '    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Auto (forum activity)</div>' +
            '    <div id="kees-tags-auto" style="display:flex;flex-wrap:wrap;gap:6px;"></div>' +
            '  </div>' +
            '</div>';
        return box;
    }

    function wire(box, userInfo) {
        const manualWrap = box.querySelector('#kees-tags-manual');
        const autoWrap = box.querySelector('#kees-tags-auto');
        const input = box.querySelector('#kees-tag-input');
        const addBtn = box.querySelector('#kees-tag-add');
        const statusEl = box.querySelector('#kees-tag-status');

        renderTags(userInfo, manualWrap, autoWrap);

        // Offer the user's saved tags as suggestions. Typing anything else still
        // works — the library is a convenience, never a gate.
        const datalist = box.querySelector('#kees-tag-library-list');
        async function renderLibraryOptions() {
            const library = await tagging.getLibrary();
            datalist.innerHTML = '';
            library.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.label;
                datalist.appendChild(opt);
            });
        }
        renderLibraryOptions();

        const openMgr = box.querySelector('#kees-open-tag-manager');
        if (openMgr) openMgr.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({ type: 'kees-open-tags' });
        });

        async function addTag() {
            const label = input.value.trim();
            if (!label) return;
            const ok = await tagging.addManualTag(userInfo.userId, userInfo.username, label, tagging.resolveTagColor(label, tagging.suggestColor(label)));
            input.value = '';
            if (ok) { statusEl.textContent = ''; renderTags(userInfo, manualWrap, autoWrap); }
            else statusEl.textContent = 'Tag already exists';
        }
        addBtn.addEventListener('click', addTag);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTag(); });

        // Keep tags in sync if regenerated or recoloured elsewhere.
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes[tagging.TAGS_KEY] || changes[tagging.LIBRARY_KEY] || changes[tagging.SETTINGS_KEY]) {
                renderTags(userInfo, manualWrap, autoWrap);
            }
            if (changes[tagging.LIBRARY_KEY]) renderLibraryOptions();
        });
    }

    // A profile whose owner restricts who may view it renders nothing but a
    // .blockMessage - no member tabs, no activity box. Tagging must still work
    // there, so fall through a chain of anchors instead of depending on the tabs.
    // Direct-child match, not a descendant one: a normal profile can contain a
    // .blockMessage somewhere inside a tab, and matching that would drop the box
    // in the wrong place. On a restricted profile the notice *is* the page body.
    function isLimitedProfile() {
        return !document.querySelector('.block-tabHeader--memberTabs')
            && !!document.querySelector('.p-body-pageContent > .blockMessage, .p-body-content > .blockMessage');
    }

    function place(box) {
        // Preferred: its own profile tab, beside Postings/About.
        const memberTabs = SNEED.memberTabs;
        const pane = memberTabs && memberTabs.add({
            tabId: 'kees-tags-tab',
            paneId: 'kees-tags-pane',
            label: 'Tags'
        });
        if (pane) { pane.appendChild(box); return true; }

        // Only reach for the fallbacks once we know the tabs are never coming.
        // On a normal profile the observer should keep waiting instead, or the
        // box lands somewhere the tab layout will not account for.
        if (!isLimitedProfile()) return false;

        // Off-tab the block stands on its own, so give it some breathing room.
        box.style.marginTop = '16px';

        // This wraps the "member limits who may view" notice.
        const pageContent = document.querySelector('.p-body-pageContent');
        if (pageContent) { pageContent.insertBefore(box, pageContent.firstChild); return true; }

        // The profile header survives the privacy setting even when the body
        // does not.
        const header = document.querySelector('.memberHeader');
        if (header) { header.insertAdjacentElement('afterend', box); return true; }

        const main = document.querySelector('.p-body-main');
        if (main) { main.appendChild(box); return true; }

        return false;
    }

    function insert(userInfo) {
        if (document.getElementById('kees-user-tags')) return true;
        const box = buildBox(userInfo);
        if (!place(box)) return false;
        wire(box, userInfo);
        return true;
    }

    async function init() {
        const userInfo = getUserInfo();
        if (!userInfo) return;
        await tagging.loadLibraryCache();
        if (insert(userInfo)) return;
        const observer = new MutationObserver(() => { if (insert(userInfo)) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
