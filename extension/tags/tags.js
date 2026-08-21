// tags.js - KEES Tag Manager dashboard.
//
// A dedicated page (opened in its own tab) for viewing and managing everything
// tagging-related: tagged users with their manual + auto tags and forum activity,
// auto-tag settings, forum short names, crawl status/history, and JSON backup.
// Reuses the SNEED.tagging API from tag-store.js (included before this script).
(function() {
    'use strict';

    const tagging = window.SNEED && window.SNEED.tagging;
    const ORIGIN = 'https://kiwifarms.st';
    const ROW_CAP = 400;

    if (!tagging) {
        document.body.innerHTML = '<p style="color:#d87c7c;padding:24px;">tag-store failed to load.</p>';
        return;
    }

    const $ = (id) => document.getElementById(id);
    let overview = { users: [], summary: {} };
    let refreshTimer = null;

    // ---------- toast ----------
    const toastEl = $('toast');
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 1600);
    }

    // ---------- summary ----------
    function renderSummary(s) {
        const stats = [
            ['Tagged users', s.taggedUsers],
            ['Manual tags', s.manualTags],
            ['Auto tags', s.autoTags],
            ['Users w/ activity', s.usersWithActivity],
            ['Forums tracked', s.forumsTracked],
            ['Posts recorded', s.totalPosts]
        ];
        $('summary').innerHTML = stats.map(([l, n]) =>
            `<div class="stat"><div class="n">${(n || 0).toLocaleString()}</div><div class="l">${l}</div></div>`
        ).join('');
    }

    // ---------- users table ----------
    function chipEl(t, isAuto, onRemove, href) {
        // When href is given the chip is an anchor linking to its source forum.
        const c = document.createElement(href ? 'a' : 'span');
        c.className = 'chip' + (isAuto ? ' auto' : '') + (href ? ' chip-link' : '');
        // Auto tags keep their stable per-forum colour; manual tags resolve
        // through the library so a recolour there shows up here too.
        c.style.background = isAuto ? (t.color || '#555') : tagging.resolveTagColor(t.label, t.color);
        if (href) {
            c.href = href;
            c.target = '_blank';
            c.rel = 'noopener';
            c.style.color = '#fff';
            c.title = (isAuto ? 'Auto tag' : 'Manual tag') + ' — open source';
        } else {
            c.title = isAuto ? 'Auto tag (forum activity)' : 'Manual tag';
        }
        c.appendChild(document.createTextNode(t.label));
        if (onRemove) {
            const x = document.createElement('span');
            x.className = 'x';
            x.textContent = '×';
            x.addEventListener('click', (e) => { e.preventDefault(); onRemove(); });
            c.appendChild(x);
        }
        return c;
    }

    // Inline replacement for the old window.prompt. It exists mainly so a tag
    // added here carries a real colour — the prompt passed none, which is why
    // every tag added from this page used to come out the default grey.
    function openAddTag(u, addBtn, manualWrap) {
        if (manualWrap.querySelector('.addtag-edit')) return;
        addBtn.style.display = 'none';

        const box = document.createElement('span');
        box.className = 'addtag-edit';

        const text = document.createElement('input');
        text.type = 'text';
        text.setAttribute('list', 'tag-lib-options');
        text.placeholder = 'Tag for ' + u.username;

        const color = document.createElement('input');
        color.type = 'color';
        color.value = tagging.suggestColor('');
        color.title = 'Tag colour';

        // Follow the label until the user picks a colour by hand, so a library
        // tag shows its real colour before it is even added.
        let colorTouched = false;
        color.addEventListener('input', () => { colorTouched = true; });
        text.addEventListener('input', () => {
            if (colorTouched) return;
            const label = text.value.trim();
            color.value = label ? tagging.resolveTagColor(label, tagging.suggestColor(label)) : tagging.suggestColor('');
        });

        function close() {
            box.remove();
            addBtn.style.display = '';
        }

        async function commit() {
            const label = text.value.trim();
            if (!label) return close();
            const ok = await tagging.addManualTag(u.userId, u.username, label, color.value);
            close();
            if (ok) refreshSoon(true);
            else toast('That user already has that tag');
        }

        text.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
        });

        const ok = document.createElement('button');
        ok.className = 'addtag';
        ok.textContent = 'Add';
        ok.addEventListener('click', commit);

        const cancel = document.createElement('button');
        cancel.className = 'addtag';
        cancel.textContent = '×';
        cancel.title = 'Cancel';
        cancel.addEventListener('click', close);

        box.appendChild(text);
        box.appendChild(color);
        box.appendChild(ok);
        box.appendChild(cancel);
        manualWrap.appendChild(box);
        text.focus();
    }

    // Populate the shared datalist of saved tag labels.
    async function loadLibraryOptions() {
        const list = document.getElementById('tag-lib-options');
        if (!list) return;
        const library = await tagging.getLibrary();
        list.innerHTML = '';
        library.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.label;
            list.appendChild(opt);
        });
    }

    // Resolve a bucket id to its link: numeric = forum, "t<id>" = thread (megathread).
    function bucketHref(id) {
        if (!id) return null;
        const m = String(id).match(/^t(\d+)$/);
        if (m) return ORIGIN + '/threads/' + m[1] + '/';
        if (/^\d+$/.test(id)) return ORIGIN + '/forums/' + id + '/';
        return null;
    }

    // The source bucket of an auto tag: stored on the tag, or matched by label.
    function autoForumId(u, t) {
        if (t.forumId) return t.forumId;
        const f = u.forums.find(f => f.label === t.label);
        return f ? f.forumId : null;
    }

    function passesFilter(u, q, onlyTagged) {
        if (onlyTagged && !u.manual.length && !u.auto.length) return false;
        if (!q) return true;
        if (u.username.toLowerCase().includes(q)) return true;
        return [...u.manual, ...u.auto].some(t => t.label.toLowerCase().includes(q));
    }

    function sortUsers(list, mode) {
        const by = {
            posts: (a, b) => b.total - a.total,
            name: (a, b) => a.username.localeCompare(b.username),
            manual: (a, b) => b.manual.length - a.manual.length || b.total - a.total
        }[mode] || ((a, b) => b.total - a.total);
        return list.slice().sort(by);
    }

    function renderUsers() {
        const q = $('user-search').value.trim().toLowerCase();
        const onlyTagged = $('only-tagged').checked;
        const mode = $('user-sort').value;

        const filtered = sortUsers(overview.users.filter(u => passesFilter(u, q, onlyTagged)), mode);
        const shown = filtered.slice(0, ROW_CAP);

        const body = $('users-body');
        body.innerHTML = '';
        const frag = document.createDocumentFragment();

        shown.forEach(u => {
            const tr = document.createElement('tr');
            if (u.hidden) tr.style.opacity = '0.55';

            // user
            const tdUser = document.createElement('td');
            tdUser.innerHTML = `<a class="uname" href="${ORIGIN}/members/${u.userId}/" target="_blank" rel="noopener">${escapeHtml(u.username)}</a> <span class="uid">#${u.userId}</span>`;
            const hideBtn = document.createElement('button');
            hideBtn.className = 'addtag';
            hideBtn.style.marginLeft = '8px';
            hideBtn.textContent = u.hidden ? 'show' : 'hide';
            hideBtn.title = u.hidden ? 'Tags hidden for this user — click to show' : 'Hide this user’s tags everywhere';
            hideBtn.addEventListener('click', async () => {
                await tagging.setUserHidden(u.userId, !u.hidden);
                refreshSoon(true);
            });
            tdUser.appendChild(hideBtn);
            tr.appendChild(tdUser);

            // manual tags (+ add)
            const tdManual = document.createElement('td');
            const manualWrap = document.createElement('div');
            manualWrap.className = 'chips';
            u.manual.forEach(t => manualWrap.appendChild(chipEl(t, false, async () => {
                await tagging.removeManualTag(u.userId, t.label);
                refreshSoon(true);
            })));
            const add = document.createElement('button');
            add.className = 'addtag';
            add.textContent = '+ tag';
            add.addEventListener('click', () => openAddTag(u, add, manualWrap));
            manualWrap.appendChild(add);
            tdManual.appendChild(manualWrap);
            tr.appendChild(tdManual);

            // auto tags
            const tdAuto = document.createElement('td');
            const autoWrap = document.createElement('div');
            autoWrap.className = 'chips';
            u.auto.forEach(t => autoWrap.appendChild(chipEl(t, true, null, bucketHref(autoForumId(u, t)))));
            if (!u.auto.length) autoWrap.innerHTML = '<span class="muted">—</span>';
            tdAuto.appendChild(autoWrap);
            tr.appendChild(tdAuto);

            // posts
            const tdPosts = document.createElement('td');
            tdPosts.className = 'num';
            tdPosts.textContent = u.total ? u.total.toLocaleString() : '—';
            tr.appendChild(tdPosts);

            // top forums (+ expand)
            const tdForums = document.createElement('td');
            if (!u.forums.length) {
                tdForums.innerHTML = '<span class="muted">—</span>';
            } else {
                const forumLink = (f) => `<a class="forum-link" href="${bucketHref(f.forumId)}" target="_blank" rel="noopener">${escapeHtml(f.label)}</a> (${f.count})`;
                const top = u.forums.slice(0, 3).map(forumLink).join(', ');
                const mini = document.createElement('div');
                mini.className = 'forum-mini';
                mini.innerHTML = top; // labels escaped; forumId is numeric
                if (u.forums.length > 3) {
                    const more = document.createElement('span');
                    more.className = 'more';
                    more.textContent = `  +${u.forums.length - 3} more`;
                    const full = document.createElement('div');
                    full.className = 'forum-full';
                    full.innerHTML = u.forums.map(forumLink).join(' · ');
                    more.addEventListener('click', () => full.classList.toggle('open'));
                    mini.appendChild(more);
                    tdForums.appendChild(mini);
                    tdForums.appendChild(full);
                } else {
                    tdForums.appendChild(mini);
                }
            }
            tr.appendChild(tdForums);

            frag.appendChild(tr);
        });

        body.appendChild(frag);
        $('users-count').textContent = filtered.length > shown.length
            ? `(showing ${shown.length} of ${filtered.length})`
            : `(${filtered.length})`;
        $('users-empty').textContent = filtered.length ? '' : 'No users match.';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---------- settings ----------
    async function loadSettings() {
        const s = await tagging.getSettings();
        $('auto-enabled').checked = s.autoEnabled;
        $('auto-threshold').value = s.autoThresholdPct;
        $('auto-max').value = s.autoMaxTags;
        const c = s.crawl || {};
        if (Array.isArray(c.forumIds) && c.forumIds.length) $('crawl-ids').value = c.forumIds.join(', ');
        $('lim-delay').value = c.delayMs ?? 2000;
        $('lim-threads').value = c.maxThreads ?? 15;
        $('lim-threadpages').value = c.maxThreadPages ?? 50;
        $('show-chips').checked = !s.displayHidden;
    }

    function wireSettings() {
        $('auto-enabled').addEventListener('change', async () => {
            await tagging.saveSettings({ autoEnabled: $('auto-enabled').checked });
            await tagging.refreshAllAutoTags();
            toast($('auto-enabled').checked ? 'Auto-tagging enabled' : 'Auto-tagging disabled');
        });
        $('auto-threshold').addEventListener('change', async () => {
            const v = Math.max(1, Math.min(100, parseInt($('auto-threshold').value, 10) || 25));
            $('auto-threshold').value = v;
            await tagging.saveSettings({ autoThresholdPct: v });
            toast('Threshold saved');
        });
        $('auto-max').addEventListener('change', async () => {
            const v = Math.max(1, Math.min(10, parseInt($('auto-max').value, 10) || 3));
            $('auto-max').value = v;
            await tagging.saveSettings({ autoMaxTags: v });
            toast('Saved');
        });
        $('recompute-btn').addEventListener('click', async () => {
            $('recompute-btn').disabled = true;
            const n = await tagging.refreshAllAutoTags();
            $('recompute-btn').disabled = false;
            toast(`Recomputed tags for ${n} user(s)`);
        });
    }

    // ---------- aliases ----------
    async function loadAliases() {
        const map = await tagging.getAliases();
        const list = $('alias-list');
        list.innerHTML = '';
        Object.keys(map)
            .sort((a, b) => (map[a].full || '').localeCompare(map[b].full || ''))
            .forEach(id => {
                const row = document.createElement('div');
                row.className = 'alias';
                const name = document.createElement('span');
                name.className = 'name';
                const label = map[id].full || ('Forum ' + id);
                const a = document.createElement('a');
                a.href = bucketHref(id);
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = label;
                a.title = label + ' — open forum';
                name.appendChild(a);
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'short';
                input.value = map[id].short || '';
                input.addEventListener('change', async () => {
                    await tagging.setAlias(id, input.value);
                    toast('Short name saved');
                });
                row.appendChild(name);
                row.appendChild(input);
                list.appendChild(row);
            });
    }

    // ---------- backup ----------
    function wireBackup() {
        $('export-btn').addEventListener('click', async () => {
            const bundle = await tagging.exportAll();
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'kees-tags-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            toast('Exported');
        });
        $('import-btn').addEventListener('click', () => $('import-file').click());
        $('import-file').addEventListener('change', async () => {
            const file = $('import-file').files && $('import-file').files[0];
            if (!file) return;
            try {
                const bundle = JSON.parse(await file.text());
                const mode = $('import-replace').checked ? 'replace' : 'merge';
                await tagging.importAll(bundle, mode);
                await loadAll();
                toast('Imported (' + mode + ')');
            } catch (e) {
                toast('Import failed: ' + e.message);
            } finally {
                $('import-file').value = '';
            }
        });
    }

    // ---------- crawl ----------
    function findKiwiTabs() {
        return new Promise((resolve) => {
            chrome.tabs.query({ url: 'https://kiwifarms.st/*' }, (tabs) => resolve(tabs || []));
        });
    }
    function sendToTab(tabId, message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (resp) => resolve(chrome.runtime.lastError ? null : resp));
        });
    }

    function renderCrawlLive(st) {
        const el = $('crawl-live');
        if (!st) { el.textContent = 'No crawl running'; el.classList.remove('running'); $('crawl-stop').disabled = true; $('crawl-start').disabled = false; return; }
        const parts = [st.message];
        if (st.forumsTotal > 1) parts.push(`forums ${st.forumsDone}/${st.forumsTotal}`);
        if (st.threadsDone) parts.push(`${st.threadsDone} threads`);
        if (st.postsCounted) parts.push(`${st.postsCounted} posts`);
        el.textContent = parts.filter(Boolean).join(' · ');
        el.classList.toggle('running', !!st.running);
        $('crawl-stop').disabled = !st.running;
        $('crawl-start').disabled = !!st.running;
    }

    async function loadCrawlLive() {
        renderCrawlLive(await tagging.getCrawlStatus());
    }

    async function loadCrawlHistory() {
        const history = await tagging.getCrawlHistory();
        const el = $('crawl-history');
        if (!history.length) { el.innerHTML = '<div class="hist-item">No crawls yet</div>'; return; }
        el.innerHTML = history.map(h => {
            const when = new Date(h.finished || h.ts).toLocaleString();
            const err = h.error ? ' err' : '';
            const target = [];
            if ((h.forumIds || []).length) target.push('forums ' + h.forumIds.join(', '));
            if (h.threads) target.push(h.threads + ' thread' + (h.threads > 1 ? 's' : ''));
            const label = target.length ? target.join(' + ') : '—';
            return `<div class="hist-item${err}"><span class="when">${when}</span> — ${escapeHtml(label)}: ${h.postsCounted || 0} posts (${escapeHtml(h.message || '')})</div>`;
        }).join('');
    }

    function parseThreadId(v) {
        v = (v || '').trim();
        if (!v) return null;
        const m = v.match(/\/threads\/(?:[^.\/]+\.)?(\d+)/) || v.match(/^(\d+)$/);
        return m ? m[1] : null;
    }

    async function startViaTab(jobConfig, label) {
        const s = await tagging.getSettings();
        const c = s.crawl || {};
        const config = Object.assign({
            maxThreads: c.maxThreads, delayMs: c.delayMs,
            maxThreadListPages: c.maxThreadListPages, maxPostPages: c.maxPostPages,
            maxThreadPages: c.maxThreadPages
        }, jobConfig);
        const tabs = await findKiwiTabs();
        if (!tabs.length) { toast('Open a kiwifarms.st tab first'); return; }
        const resp = await sendToTab(tabs[0].id, { type: 'kees-crawl-start', config });
        if (!resp) toast('Open a kiwifarms.st thread/forum tab first');
        else if (!resp.ok) toast(resp.reason || 'Could not start');
        else toast(label || 'Crawl started');
    }

    function wireCrawl() {
        // limit inputs persist to settings.crawl
        $('lim-delay').addEventListener('change', async () => {
            const v = Math.max(800, parseInt($('lim-delay').value, 10) || 2000);
            $('lim-delay').value = v;
            await tagging.saveSettings({ crawl: { delayMs: v } });
            toast('Delay saved');
        });
        $('lim-threads').addEventListener('change', async () => {
            const v = Math.max(1, Math.min(100, parseInt($('lim-threads').value, 10) || 15));
            $('lim-threads').value = v;
            await tagging.saveSettings({ crawl: { maxThreads: v } });
            toast('Saved');
        });
        $('lim-threadpages').addEventListener('change', async () => {
            const v = Math.max(1, Math.min(500, parseInt($('lim-threadpages').value, 10) || 50));
            $('lim-threadpages').value = v;
            await tagging.saveSettings({ crawl: { maxThreadPages: v } });
            toast('Saved');
        });

        $('crawl-start').addEventListener('click', async () => {
            const forumIds = $('crawl-ids').value.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s));
            if (!forumIds.length) { toast('Enter at least one numeric forum ID'); return; }
            await tagging.saveSettings({ crawl: { forumIds } });
            startViaTab({ forumIds }, 'Forum crawl started');
        });

        $('crawl-thread-start').addEventListener('click', async () => {
            const id = parseThreadId($('crawl-thread').value);
            if (!id) { toast('Enter a thread ID or URL'); return; }
            const s = await tagging.getSettings();
            const pages = s.crawl?.maxThreadPages || 50;
            if (!window.confirm(`Crawl thread ${id}?\n\nReads up to ${pages} pages — megathreads can be long.`)) return;
            startViaTab({ threadUrls: [ORIGIN + '/threads/' + id + '/'] }, 'Thread crawl started');
        });

        $('crawl-stop').addEventListener('click', async () => {
            const tabs = await findKiwiTabs();
            for (const t of tabs) await sendToTab(t.id, { type: 'kees-crawl-stop' });
            toast('Stop requested');
        });
        $('hist-clear').addEventListener('click', async () => {
            await tagging.clearCrawlHistory();
            loadCrawlHistory();
        });
    }

    // ---------- load + live updates ----------
    async function loadAll() {
        overview = await tagging.getOverview();
        renderSummary(overview.summary);
        renderUsers();
    }

    function refreshSoon(immediate) {
        if (immediate) { loadAll(); return; }
        if (refreshTimer) return;
        refreshTimer = setTimeout(() => { refreshTimer = null; loadAll(); }, 1200);
    }

    function wireControls() {
        $('refresh-btn').addEventListener('click', () => { loadAll(); loadCrawlLive(); loadCrawlHistory(); loadAliases(); });
        ['user-search', 'user-sort', 'only-tagged'].forEach(id => {
            $(id).addEventListener('input', renderUsers);
            $(id).addEventListener('change', renderUsers);
        });
        $('show-chips').addEventListener('change', async () => {
            await tagging.saveSettings({ displayHidden: !$('show-chips').checked });
            toast($('show-chips').checked ? 'Tag chips shown' : 'Tag chips hidden');
        });
    }

    function wireLiveUpdates() {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes[tagging.CRAWL_STATUS_KEY]) {
                renderCrawlLive(changes[tagging.CRAWL_STATUS_KEY].newValue);
                if (changes[tagging.CRAWL_STATUS_KEY].newValue && !changes[tagging.CRAWL_STATUS_KEY].newValue.running) loadCrawlHistory();
            }
            if (changes[tagging.CRAWL_HISTORY_KEY]) loadCrawlHistory();
            if (changes[tagging.ALIASES_KEY]) loadAliases();
            if (changes[tagging.LIBRARY_KEY]) {
                loadLibraryOptions();
                refreshSoon(false); // manual chip colours resolve through the library
            }
            if (changes[tagging.SETTINGS_KEY]) {
                const nv = changes[tagging.SETTINGS_KEY].newValue || {};
                $('show-chips').checked = !nv.displayHidden;
                $('auto-enabled').checked = nv.autoEnabled !== false;
                refreshSoon(false); // per-user hidden flags / the auto gate may have changed
            }
            const activityChanged = Object.keys(changes).some(k => k.startsWith(tagging.ACTIVITY_PREFIX));
            if (changes[tagging.TAGS_KEY] || activityChanged) refreshSoon(false);
        });
    }

    // ---------- init ----------
    wireControls();
    wireSettings();
    wireBackup();
    wireCrawl();
    wireLiveUpdates();
    loadSettings();
    loadAliases();
    loadCrawlLive();
    loadCrawlHistory();
    loadLibraryOptions();
    // Prime the sync colour cache before the first paint so manual chips render
    // with their library colour rather than flashing the stored fallback.
    tagging.loadLibraryCache().then(loadAll);

})();
