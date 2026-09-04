// features/tagging/tag-store.js - Storage + logic core for the user tagging feature.
//
// Self-contained: the SNEED.core.storage layer is only injected on /chat/* pages,
// so this module talks to chrome.storage.local directly (same approach as
// user-forum-activity.js). It exposes window.SNEED.tagging, consumed by the
// passive scanner, the on-page tag display, the member-page UI, and the popup.
//
// Data layout (chrome.storage.local):
//   kees-tagact-<userId>  -> { username, forums: { [forumId]: { name, count } }, total, updated }
//                            (one key per user so concurrent tabs don't clobber a single blob)
//   kees-user-tags        -> { [userId]: { username, manual: [tag], auto: [tag] } }  tag = { label, color }
//   kees-tag-library      -> [ { label, color } ]  the user's reusable tag list, in their order
//   kees-tag-aliases      -> { [forumId]: { full, short } }
//   kees-tag-settings     -> { autoEnabled, autoThresholdPct, autoMaxTags, crawl: {...} }
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const ACTIVITY_PREFIX = 'kees-tagact-';
    const TAGS_KEY = 'kees-user-tags';
    const LIBRARY_KEY = 'kees-tag-library';
    const ALIASES_KEY = 'kees-tag-aliases';
    const SETTINGS_KEY = 'kees-tag-settings';
    const CRAWL_STATUS_KEY = 'kees-tag-crawl-status';
    const CRAWL_HISTORY_KEY = 'kees-tag-crawl-history';
    const CRAWL_HISTORY_CAP = 25;
    const SEEN_PREFIX = 'kees-tagseen-'; // per-thread record of counted page numbers

    const DEFAULT_SETTINGS = {
        autoEnabled: true,
        autoThresholdPct: 25,   // a forum >= this % of a user's posts becomes an auto-tag
        autoMaxTags: 3,         // cap on number of auto-tags per user
        displayHidden: false,   // global: hide all tag chips on posts/profiles
        hiddenUsers: [],        // per-user: ids whose chips are hidden
        crawl: { forumIds: [], maxThreads: 15, maxThreadListPages: 2, maxPostPages: 3, maxThreadPages: 50, delayMs: 2000 }
    };

    // Palette for auto-generated tag chips (cycled by forum id for stability).
    const AUTO_COLORS = ['#2d7dd2', '#7d2d8b', '#1f8a4c', '#b8731b', '#a83246', '#2d6e8b'];
    // Palette proposed for hand-added tags (picked by label hash, so the same
    // label always suggests the same colour wherever it is typed).
    const MANUAL_COLORS = ['#3a6ea5', '#6a4c93', '#1b7a4d', '#9c6b1e', '#9e3b4e', '#2f6f7a', '#7a5230'];
    const DEFAULT_MANUAL_COLOR = '#555555';   // 6-digit: <input type="color"> rejects short hex

    // Stable colour suggestion for a label. Shared by the profile card, the Tag
    // Manager and the settings library editor so they never disagree.
    function suggestColor(label) {
        label = (label || '').trim().toLowerCase();
        if (!label) return DEFAULT_MANUAL_COLOR;
        let h = 0;
        for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
        return MANUAL_COLORS[h % MANUAL_COLORS.length];
    }

    // ----- low-level chrome.storage.local promise wrappers -----

    function getValue(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => resolve(result[key]));
        });
    }

    function setValue(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve(!chrome.runtime.lastError));
        });
    }

    function setMany(obj) {
        return new Promise((resolve) => {
            chrome.storage.local.set(obj, () => resolve(!chrome.runtime.lastError));
        });
    }

    function getAll() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => resolve(result || {}));
        });
    }

    function activityKey(userId) {
        return ACTIVITY_PREFIX + userId;
    }

    // ============================================================
    // SETTINGS
    // ============================================================

    async function getSettings() {
        const stored = await getValue(SETTINGS_KEY) || {};
        return {
            ...DEFAULT_SETTINGS,
            ...stored,
            crawl: { ...DEFAULT_SETTINGS.crawl, ...(stored.crawl || {}) }
        };
    }

    async function saveSettings(partial) {
        const current = await getSettings();
        const merged = { ...current, ...partial };
        if (partial && partial.crawl) {
            merged.crawl = { ...current.crawl, ...partial.crawl };
        }
        await setValue(SETTINGS_KEY, merged);
        return merged;
    }

    // ============================================================
    // TAG LIBRARY (the user's reusable label -> colour list)
    // ============================================================
    // Entirely optional: free-text tags keep working exactly as before. The
    // library exists so a label the user cares about has one colour everywhere
    // and can be recoloured in one place.
    //
    // Like the alias cache, a small in-memory copy is kept so chip renderers can
    // resolve a colour synchronously while painting. It is refreshed on change.

    let libraryCache = [];

    async function loadLibraryCache() {
        libraryCache = await getValue(LIBRARY_KEY) || [];
        return libraryCache;
    }

    function getLibrarySync() {
        return libraryCache;
    }

    async function getLibrary() {
        return await getValue(LIBRARY_KEY) || [];
    }

    async function saveLibrary(list) {
        const clean = (list || []).filter(t => t && t.label);
        await setValue(LIBRARY_KEY, clean);
        libraryCache = clean;
        return clean;
    }

    function findLibraryEntry(list, label) {
        const key = (label || '').trim().toLowerCase();
        if (!key) return null;
        return list.find(t => (t.label || '').toLowerCase() === key) || null;
    }

    // The single colour authority every chip renderer goes through. A label in
    // the library takes its colour from there, so recolouring is instant and
    // never has to walk kees-user-tags. Anything else keeps the colour stored on
    // the tag itself, which is what a plain free-text tag has.
    function resolveTagColor(label, fallback) {
        const entry = findLibraryEntry(libraryCache, label);
        if (entry && entry.color) return entry.color;
        return fallback || DEFAULT_MANUAL_COLOR;
    }

    async function addLibraryTag(label, color) {
        label = (label || '').trim();
        if (!label) return false;
        const list = await getLibrary();
        if (findLibraryEntry(list, label)) return false;
        list.push({ label, color: color || suggestColor(label) });
        await saveLibrary(list);
        return true;
    }

    async function removeLibraryTag(label) {
        const list = await getLibrary();
        const key = (label || '').trim().toLowerCase();
        const next = list.filter(t => (t.label || '').toLowerCase() !== key);
        if (next.length === list.length) return false;
        await saveLibrary(next);
        return true;
    }

    // Rename and/or recolour a library entry. Recolouring is library-only (chips
    // resolve through resolveTagColor). A *rename* is the one operation that has
    // to rewrite stored data, so it walks kees-user-tags once and renames the
    // matching manual tags — only ever on an explicit user action.
    async function updateLibraryTag(oldLabel, newLabel, color) {
        const list = await getLibrary();
        const entry = findLibraryEntry(list, oldLabel);
        if (!entry) return false;

        newLabel = (newLabel || '').trim() || entry.label;
        const renamed = newLabel.toLowerCase() !== entry.label.toLowerCase();

        // Refuse a rename that would collide with another library entry.
        if (renamed && findLibraryEntry(list, newLabel)) return false;

        entry.label = newLabel;
        if (color) entry.color = color;
        await saveLibrary(list);

        if (renamed) {
            const all = await getAllTags();
            const oldKey = (oldLabel || '').trim().toLowerCase();
            let touched = false;
            for (const userId of Object.keys(all)) {
                const manual = all[userId] && all[userId].manual;
                if (!Array.isArray(manual)) continue;
                for (const t of manual) {
                    if ((t.label || '').toLowerCase() !== oldKey) continue;
                    t.label = newLabel;
                    touched = true;
                }
            }
            if (touched) await setValue(TAGS_KEY, all);
        }
        return true;
    }

    // ============================================================
    // FORUM ALIASES (forumId -> short name)
    // ============================================================
    // A small in-memory cache is kept so the on-page display can resolve short
    // names synchronously while rendering. It is refreshed on storage changes.

    let aliasCache = {};
    let aliasCacheReady = false;

    async function loadAliasCache() {
        aliasCache = await getValue(ALIASES_KEY) || {};
        aliasCacheReady = true;
        return aliasCache;
    }

    function getAliasesSync() {
        return aliasCache;
    }

    async function getAliases() {
        return await getValue(ALIASES_KEY) || {};
    }

    async function saveAliases(map) {
        await setValue(ALIASES_KEY, map);
        aliasCache = map;
        return map;
    }

    // Resolve a forum's display label. Uses the user-set short name if present,
    // otherwise falls back to the full name.
    function shortName(forumId, fullName) {
        const entry = aliasCache[forumId];
        if (entry && entry.short) return entry.short;
        if (entry && entry.full) return entry.full;
        return fullName || ('Forum ' + forumId);
    }

    // Record a forum we've seen so it shows up in the alias editor. Does not
    // overwrite an existing short name; only fills in/refreshes the full name.
    async function ensureForumKnown(forumId, fullName) {
        if (!forumId) return;
        const map = await getAliases();
        const existing = map[forumId];
        if (existing && existing.full === fullName) return;
        map[forumId] = {
            full: fullName || (existing && existing.full) || '',
            short: existing ? existing.short : ''
        };
        await saveAliases(map);
    }

    async function setAlias(forumId, shortValue) {
        const map = await getAliases();
        const existing = map[forumId] || { full: '' };
        map[forumId] = { full: existing.full, short: (shortValue || '').trim() };
        return saveAliases(map);
    }

    // ============================================================
    // ACTIVITY INDEX (per-user forum post counts)
    // ============================================================

    async function getActivity(userId) {
        return await getValue(activityKey(userId)) || null;
    }

    async function getAllActivity() {
        const all = await getAll();
        const out = {};
        for (const key of Object.keys(all)) {
            if (key.startsWith(ACTIVITY_PREFIX)) {
                out[key.slice(ACTIVITY_PREFIX.length)] = all[key];
            }
        }
        return out;
    }

    function emptyRecord(username) {
        return { username: username || '', forums: {}, total: 0, updated: 0 };
    }

    // Merge a batch of increments collected from one page in a single read/write
    // pass. batch shape:
    //   { [userId]: { username, forums: { [forumId]: { name, add } } } }
    // Always additive: callers avoid double-counting by never re-submitting a
    // thread page they already tallied (see getSeenPages/addSeenPage).
    async function applyActivityBatch(batch) {
        const userIds = Object.keys(batch || {});
        if (!userIds.length) return;

        const keys = userIds.map(activityKey);
        const existing = await new Promise((resolve) => {
            chrome.storage.local.get(keys, (r) => resolve(r || {}));
        });

        const writes = {};
        const now = Date.now();
        for (const userId of userIds) {
            const incoming = batch[userId];
            const rec = existing[activityKey(userId)] || emptyRecord(incoming.username);
            if (incoming.username) rec.username = incoming.username;
            for (const forumId of Object.keys(incoming.forums || {})) {
                const f = incoming.forums[forumId];
                const cur = rec.forums[forumId] || { name: f.name || '', count: 0 };
                if (f.name) cur.name = f.name;
                cur.count += (f.add || 0);
                rec.forums[forumId] = cur;
            }
            rec.total = Object.values(rec.forums).reduce((s, f) => s + f.count, 0);
            rec.updated = now;
            writes[activityKey(userId)] = rec;
        }
        await setMany(writes);

        // Keep auto-tags fresh for the touched users.
        const settings = await getSettings();
        if (settings.autoEnabled) {
            for (const userId of userIds) {
                await refreshAutoTags(userId, writes[activityKey(userId)], settings);
            }
        }
    }

    async function clearActivity(userId) {
        return new Promise((resolve) => {
            chrome.storage.local.remove([activityKey(userId)], resolve);
        });
    }

    // ============================================================
    // TAGS (manual + auto buckets, kept separate)
    // ============================================================

    async function getAllTags() {
        return await getValue(TAGS_KEY) || {};
    }

    async function getTags(userId) {
        const all = await getAllTags();
        return all[userId] || null;
    }

    function tagsFor(all, userId, username) {
        if (!all[userId]) all[userId] = { username: username || '', manual: [], auto: [] };
        if (username) all[userId].username = username;
        if (!Array.isArray(all[userId].manual)) all[userId].manual = [];
        if (!Array.isArray(all[userId].auto)) all[userId].auto = [];
        return all[userId];
    }

    async function addManualTag(userId, username, label, color) {
        label = (label || '').trim();
        if (!userId || !label) return false;
        const all = await getAllTags();
        const entry = tagsFor(all, userId, username);
        if (entry.manual.some(t => t.label.toLowerCase() === label.toLowerCase())) return false;
        entry.manual.push({ label, color: color || resolveTagColor(label, suggestColor(label)) });
        await setValue(TAGS_KEY, all);
        return true;
    }

    async function removeManualTag(userId, label) {
        const all = await getAllTags();
        if (!all[userId]) return false;
        const before = all[userId].manual.length;
        all[userId].manual = all[userId].manual.filter(t => t.label !== label);
        if (all[userId].manual.length === before) return false;
        await setValue(TAGS_KEY, all);
        return true;
    }

    // Replace only the auto bucket; never touches manual tags.
    async function setAutoTags(userId, username, autoTags) {
        const all = await getAllTags();
        const entry = tagsFor(all, userId, username);
        entry.auto = autoTags || [];
        await setValue(TAGS_KEY, all);
    }

    // ============================================================
    // AUTO-TAGGER (derive tags from activity)
    // ============================================================

    function computeAutoTags(record, settings) {
        if (!record || !record.total) return [];
        const threshold = (settings.autoThresholdPct ?? DEFAULT_SETTINGS.autoThresholdPct) / 100;
        const maxTags = settings.autoMaxTags ?? DEFAULT_SETTINGS.autoMaxTags;
        const forums = Object.keys(record.forums).map(forumId => ({
            forumId,
            name: record.forums[forumId].name,
            count: record.forums[forumId].count,
            pct: record.forums[forumId].count / record.total
        }));
        forums.sort((a, b) => b.count - a.count);
        return forums
            .filter(f => f.pct >= threshold)
            .slice(0, maxTags)
            .map((f, i) => ({
                label: shortName(f.forumId, f.name),
                color: AUTO_COLORS[Math.abs(parseInt(f.forumId, 10) || i) % AUTO_COLORS.length],
                forumId: f.forumId // source forum, used to link the tag back to it
            }));
    }

    async function refreshAutoTags(userId, record, settings) {
        record = record || await getActivity(userId);
        settings = settings || await getSettings();
        if (!record) return;
        // Auto-tagging off is a *display* decision, not a data one: the computed
        // bucket is left intact so the toggle is instant and lossless in both
        // directions, and so it can never interfere with the user's own tags.
        // tag-display.js skips the auto half while autoEnabled is false.
        if (!settings.autoEnabled) return;
        await setAutoTags(userId, record.username, computeAutoTags(record, settings));
    }

    // Recompute auto-tags for every user with activity (e.g. after the user edits
    // aliases or the threshold). Returns the number of users updated.
    async function refreshAllAutoTags() {
        const settings = await getSettings();
        // Nothing to recompute while auto-tagging is off, and walking every
        // kees-tagact-* key to do nothing is not free.
        if (!settings.autoEnabled) return 0;
        const activity = await getAllActivity();
        const ids = Object.keys(activity);
        for (const userId of ids) {
            await refreshAutoTags(userId, activity[userId], settings);
        }
        return ids.length;
    }

    // ============================================================
    // EXPORT / IMPORT
    // ============================================================

    async function exportAll() {
        return {
            kind: 'kees-user-tags',
            version: 1,
            exported: Date.now(),
            tags: await getAllTags(),
            library: await getLibrary(),
            aliases: await getAliases(),
            activity: await getAllActivity(),
            settings: await getSettings()
        };
    }

    // Import a previously exported bundle. mode 'merge' (default) keeps existing
    // data and layers the import on top; mode 'replace' wipes tagging data first.
    async function importAll(bundle, mode) {
        if (!bundle || typeof bundle !== 'object') throw new Error('Invalid import data');
        mode = mode === 'replace' ? 'replace' : 'merge';

        if (mode === 'replace') {
            const all = await getAll();
            const remove = Object.keys(all).filter(k => k.startsWith(ACTIVITY_PREFIX));
            remove.push(TAGS_KEY, LIBRARY_KEY, ALIASES_KEY, SETTINGS_KEY);
            await new Promise((resolve) => chrome.storage.local.remove(remove, resolve));
        }

        if (bundle.settings) await saveSettings(bundle.settings);

        if (Array.isArray(bundle.library)) {
            // Union by lowercased label. On merge an entry the user already has
            // wins, so an imported (or preloaded) bundle can seed a starter
            // library without ever recolouring a tag they set themselves.
            const list = mode === 'merge' ? await getLibrary() : [];
            for (const t of bundle.library) {
                if (!t || !t.label) continue;
                if (findLibraryEntry(list, t.label)) continue;
                list.push({ label: t.label, color: t.color || suggestColor(t.label) });
            }
            await saveLibrary(list);
        }

        if (bundle.aliases) {
            const map = mode === 'merge' ? await getAliases() : {};
            for (const id of Object.keys(bundle.aliases)) {
                const incoming = bundle.aliases[id];
                if (mode === 'merge' && map[id]) {
                    map[id] = { full: incoming.full || map[id].full, short: incoming.short || map[id].short };
                } else {
                    map[id] = { full: incoming.full || '', short: incoming.short || '' };
                }
            }
            await saveAliases(map);
        }

        if (bundle.tags) {
            const all = mode === 'merge' ? await getAllTags() : {};
            for (const userId of Object.keys(bundle.tags)) {
                const incoming = bundle.tags[userId];
                if (mode === 'merge' && all[userId]) {
                    const entry = tagsFor(all, userId, incoming.username);
                    for (const t of (incoming.manual || [])) {
                        if (!entry.manual.some(x => x.label.toLowerCase() === t.label.toLowerCase())) entry.manual.push(t);
                    }
                    entry.auto = incoming.auto || entry.auto;
                } else {
                    all[userId] = {
                        username: incoming.username || '',
                        manual: incoming.manual || [],
                        auto: incoming.auto || []
                    };
                }
            }
            await setValue(TAGS_KEY, all);
        }

        if (bundle.activity) {
            const writes = {};
            const existing = mode === 'merge' ? await getAllActivity() : {};
            for (const userId of Object.keys(bundle.activity)) {
                const incoming = bundle.activity[userId];
                if (mode === 'merge' && existing[userId]) {
                    const rec = existing[userId];
                    for (const forumId of Object.keys(incoming.forums || {})) {
                        const f = incoming.forums[forumId];
                        const cur = rec.forums[forumId] || { name: f.name, count: 0 };
                        cur.count = Math.max(cur.count, f.count); // imported counts are authoritative snapshots
                        cur.name = f.name || cur.name;
                        rec.forums[forumId] = cur;
                    }
                    rec.total = Object.values(rec.forums).reduce((s, f) => s + f.count, 0);
                    writes[activityKey(userId)] = rec;
                } else {
                    writes[activityKey(userId)] = incoming;
                }
            }
            await setMany(writes);
        }
    }

    // ============================================================
    // SEEN PAGES (per-thread dedup so the same page is never counted twice)
    // ============================================================
    // Passive scanning and the crawler both record which thread-page numbers they
    // have already tallied, keyed per thread, so reloads / revisits / re-crawls
    // don't inflate the activity counts.

    async function getSeenPages(threadId) {
        return await getValue(SEEN_PREFIX + threadId) || [];
    }

    async function addSeenPage(threadId, page) {
        const arr = await getSeenPages(threadId);
        if (!arr.includes(page)) {
            arr.push(page);
            await setValue(SEEN_PREFIX + threadId, arr);
        }
    }

    // ============================================================
    // TAG DISPLAY VISIBILITY (global + per-user hide)
    // ============================================================

    async function setUserHidden(userId, hidden) {
        const s = await getSettings();
        const set = new Set((s.hiddenUsers || []).map(String));
        if (hidden) set.add(String(userId)); else set.delete(String(userId));
        return saveSettings({ hiddenUsers: [...set] });
    }

    // ============================================================
    // CRAWL STATUS / HISTORY (written by crawler.js, shown on the dashboard)
    // ============================================================

    async function getCrawlStatus() {
        return await getValue(CRAWL_STATUS_KEY) || null;
    }

    async function setCrawlStatus(status) {
        return setValue(CRAWL_STATUS_KEY, status);
    }

    async function getCrawlHistory() {
        return await getValue(CRAWL_HISTORY_KEY) || [];
    }

    async function addCrawlHistory(entry) {
        const history = await getCrawlHistory();
        history.unshift(entry);
        await setValue(CRAWL_HISTORY_KEY, history.slice(0, CRAWL_HISTORY_CAP));
    }

    async function clearCrawlHistory() {
        return setValue(CRAWL_HISTORY_KEY, []);
    }

    // ============================================================
    // DASHBOARD OVERVIEW (join tags + activity into display rows)
    // ============================================================

    async function getOverview() {
        const [tags, activity, aliases, settings] = await Promise.all([
            getAllTags(), getAllActivity(), getAliases(), getSettings()
        ]);

        const ids = new Set([...Object.keys(tags), ...Object.keys(activity)]);
        const hiddenSet = new Set((settings.hiddenUsers || []).map(String));
        const users = [];
        let manualTags = 0, autoTags = 0, totalPosts = 0;

        ids.forEach(id => {
            const t = tags[id] || { username: '', manual: [], auto: [] };
            const a = activity[id] || null;
            const manual = t.manual || [];
            // Auto tags are kept on disk while auto-tagging is off, so the
            // dashboard has to apply the same display gate the chips do.
            const auto = settings.autoEnabled ? (t.auto || []) : [];
            manualTags += manual.length;
            autoTags += auto.length;
            const total = a ? a.total : 0;
            totalPosts += total;

            let forums = [];
            if (a) {
                forums = Object.keys(a.forums).map(fid => ({
                    forumId: fid,
                    name: a.forums[fid].name,
                    count: a.forums[fid].count,
                    label: (aliases[fid] && aliases[fid].short) || a.forums[fid].name || ('Forum ' + fid)
                })).sort((x, y) => y.count - x.count);
            }

            users.push({
                userId: id,
                username: t.username || (a && a.username) || ('User ' + id),
                manual, auto, total, forums,
                hidden: hiddenSet.has(String(id))
            });
        });

        return {
            users,
            summary: {
                taggedUsers: Object.keys(tags).length,
                usersWithActivity: Object.keys(activity).length,
                manualTags, autoTags,
                forumsTracked: Object.keys(aliases).length,
                totalPosts
            }
        };
    }

    // ============================================================
    // INIT
    // ============================================================

    loadAliasCache();
    loadLibraryCache();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[ALIASES_KEY]) {
            aliasCache = changes[ALIASES_KEY].newValue || {};
        }
        if (changes[LIBRARY_KEY]) {
            libraryCache = changes[LIBRARY_KEY].newValue || [];
        }
    });

    SNEED.tagging = Object.assign(SNEED.tagging || {}, {
        // constants
        ACTIVITY_PREFIX, TAGS_KEY, LIBRARY_KEY, ALIASES_KEY, SETTINGS_KEY, DEFAULT_SETTINGS,
        CRAWL_STATUS_KEY, CRAWL_HISTORY_KEY,
        // settings
        getSettings, saveSettings,
        // tag library (optional reusable label -> colour list)
        getLibrary, saveLibrary, getLibrarySync, loadLibraryCache,
        addLibraryTag, removeLibraryTag, updateLibraryTag,
        resolveTagColor, suggestColor,
        // aliases
        getAliases, saveAliases, setAlias, ensureForumKnown, shortName, getAliasesSync,
        loadAliasCache, aliasCacheReady: () => aliasCacheReady,
        // activity
        getActivity, getAllActivity, applyActivityBatch, clearActivity,
        // tags
        getAllTags, getTags, addManualTag, removeManualTag, setAutoTags,
        // auto-tagger
        computeAutoTags, refreshAutoTags, refreshAllAutoTags,
        // seen pages (dedup)
        getSeenPages, addSeenPage,
        // display visibility
        setUserHidden,
        // crawl status/history + dashboard
        getCrawlStatus, setCrawlStatus, getCrawlHistory, addCrawlHistory, clearCrawlHistory,
        getOverview,
        // export/import
        exportAll, importAll
    });

})();
