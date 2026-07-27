// features/tagging/member-tagging.js - Tagging UI on member profile pages.
//
// Adds a "User Tags" block to the profile with manual tag add/remove and a button
// to generate accurate forum-activity counts (which in turn drive auto-tags).
//
// The accurate pass reuses the same /search/member endpoint and parsing approach
// as user-forum-activity.js, but keeps the forum *id* (the activity index is keyed
// by id, while the existing profiler aggregates by name only) and writes with
// replace semantics so re-running refreshes rather than doubles the counts.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging) return;

    const MAX_PAGES = 20;
    const FETCH_DELAY = 300;
    const MANUAL_COLORS = ['#3a6ea5', '#6a4c93', '#1b7a4d', '#9c6b1e', '#9e3b4e', '#2f6f7a', '#7a5230'];

    function getUserInfo() {
        const m = window.location.pathname.match(/\/members\/([^.\/]+)\.(\d+)/);
        return m ? { username: decodeURIComponent(m[1]), userId: m[2] } : null;
    }

    function colorForLabel(label) {
        let h = 0;
        for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
        return MANUAL_COLORS[h % MANUAL_COLORS.length];
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function fetchDoc(url) {
        const res = await fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return new DOMParser().parseFromString(await res.text(), 'text/html');
    }

    function parseForumId(href) {
        const m = href && href.match(/\/forums\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    // Crawl the user's search results, accumulating forumId -> { name, count }.
    async function analyzeAccurate(userId, onProgress) {
        const forums = {};
        let url = window.location.origin + '/search/member?user_id=' + userId;
        let pages = 0;
        while (url && pages < MAX_PAGES) {
            pages++;
            onProgress('Fetching page ' + pages + '…');
            await delay(FETCH_DELAY);
            const doc = await fetchDoc(url);
            doc.querySelectorAll('.block-row, .contentRow').forEach(row => {
                row.querySelectorAll('li').forEach(li => {
                    if (!li.textContent.trim().startsWith('Forum:')) return;
                    const a = li.querySelector('a[href*="/forums/"]');
                    if (!a) return;
                    const id = parseForumId(a.getAttribute('href'));
                    if (!id) return;
                    const f = forums[id] || { name: a.textContent.trim(), count: 0 };
                    f.count++;
                    forums[id] = f;
                });
            });
            const next = doc.querySelector('.pageNav-jump--next');
            url = next ? next.getAttribute('href') : null;
            if (url && !url.startsWith('http')) url = window.location.origin + url;
        }
        return { forums, pages };
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
        manualWrap.innerHTML = '';
        autoWrap.innerHTML = '';

        const manual = (entry && entry.manual) || [];
        const auto = (entry && entry.auto) || [];

        if (!manual.length) {
            manualWrap.innerHTML = '<span style="color:#777;font-size:12px;">No manual tags</span>';
        } else {
            manual.forEach(t => manualWrap.appendChild(chip(t.label, t.color, async () => {
                await tagging.removeManualTag(userInfo.userId, t.label);
                renderTags(userInfo, manualWrap, autoWrap);
            })));
        }

        if (!auto.length) {
            autoWrap.innerHTML = '<span style="color:#777;font-size:12px;">No auto tags yet — generate activity below</span>';
        } else {
            auto.forEach(t => autoWrap.appendChild(chip(t.label, t.color, null)));
        }
    }

    function buildBox(userInfo) {
        const box = document.createElement('div');
        box.id = 'kees-user-tags';
        box.className = 'block';
        box.style.cssText = 'margin-top:16px;';
        box.innerHTML =
            '<div class="block-container">' +
            '  <h3 class="block-header" style="display:flex;justify-content:space-between;align-items:center;">' +
            '    <span>User Tags</span>' +
            '    <a id="kees-open-tag-manager" href="#" style="font-size:12px;font-weight:normal;color:#6fb3ff;">Manage all tags →</a>' +
            '  </h3>' +
            '  <div class="block-body" style="padding:16px;">' +
            '    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Manual</div>' +
            '    <div id="kees-tags-manual" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>' +
            '    <div style="display:flex;gap:8px;margin-bottom:16px;">' +
            '      <input id="kees-tag-input" type="text" placeholder="Add a tag…" style="flex:1;padding:6px 10px;background:#2a2a2a;border:1px solid #444;border-radius:4px;color:#fff;">' +
            '      <button id="kees-tag-add" class="button button--primary"><span class="button-text">Add</span></button>' +
            '    </div>' +
            '    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Auto (forum activity)</div>' +
            '    <div id="kees-tags-auto" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;"></div>' +
            '    <button id="kees-tag-generate" class="button"><span class="button-text">Generate from forum activity</span></button>' +
            '    <span id="kees-tag-genstatus" style="margin-left:10px;font-size:12px;color:#888;"></span>' +
            '  </div>' +
            '</div>';
        return box;
    }

    function wire(box, userInfo) {
        const manualWrap = box.querySelector('#kees-tags-manual');
        const autoWrap = box.querySelector('#kees-tags-auto');
        const input = box.querySelector('#kees-tag-input');
        const addBtn = box.querySelector('#kees-tag-add');
        const genBtn = box.querySelector('#kees-tag-generate');
        const genStatus = box.querySelector('#kees-tag-genstatus');

        renderTags(userInfo, manualWrap, autoWrap);

        const openMgr = box.querySelector('#kees-open-tag-manager');
        if (openMgr) openMgr.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({ type: 'kees-open-tags' });
        });

        async function addTag() {
            const label = input.value.trim();
            if (!label) return;
            const ok = await tagging.addManualTag(userInfo.userId, userInfo.username, label, colorForLabel(label));
            input.value = '';
            if (ok) renderTags(userInfo, manualWrap, autoWrap);
            else genStatus.textContent = 'Tag already exists';
        }
        addBtn.addEventListener('click', addTag);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTag(); });

        genBtn.addEventListener('click', async () => {
            genBtn.disabled = true;
            try {
                const { forums, pages } = await analyzeAccurate(userInfo.userId, (msg) => genStatus.textContent = msg);
                const fmap = {};
                let total = 0;
                for (const id of Object.keys(forums)) {
                    fmap[id] = { name: forums[id].name, add: forums[id].count };
                    total += forums[id].count;
                }
                await tagging.applyActivityBatch(
                    { [userInfo.userId]: { username: userInfo.username, forums: fmap } },
                    { replace: true }
                );
                genStatus.textContent = `Analyzed ${total} posts across ${pages} page(s)`;
                renderTags(userInfo, manualWrap, autoWrap);
            } catch (e) {
                console.error('[KEES] accurate analysis failed:', e);
                genStatus.textContent = 'Failed: ' + e.message;
            } finally {
                genBtn.disabled = false;
            }
        });

        // Keep auto tags in sync if regenerated elsewhere.
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes[tagging.TAGS_KEY]) {
                renderTags(userInfo, manualWrap, autoWrap);
            }
        });
    }

    function insert(userInfo) {
        if (document.getElementById('kees-user-tags')) return true;
        const anchor = document.querySelector('.block-tabHeader--memberTabs');
        if (!anchor) return false;
        const box = buildBox(userInfo);
        // Place just after the forum-activity box if present, else before the tabs.
        const activity = document.getElementById('kees-forum-activity');
        if (activity) activity.insertAdjacentElement('afterend', box);
        else anchor.parentNode.insertBefore(box, anchor);
        wire(box, userInfo);
        return true;
    }

    function init() {
        const userInfo = getUserInfo();
        if (!userInfo) return;
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
