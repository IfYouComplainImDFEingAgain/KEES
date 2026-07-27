// features/tagging/preload.js - Load the bundled tag dataset that ships with the
// extension, so users get post-activity + tags out of the box without crawling.
//
// The dataset (data/preload.json) is generated offline by the author's crawler and
// committed into the extension. It is the same JSON bundle format produced by
// "Export" (exportAll), plus a `preloadVersion` integer. On a new extension
// release it is imported once (merge mode, so it never clobbers the user's own
// manual tags), then skipped on every subsequent page load.
//
// Nothing is ever uploaded — this is a one-way, read-only load of packaged data.
(function() {
    'use strict';

    const tagging = window.SNEED && window.SNEED.tagging;
    if (!tagging) return;

    const EXTVER_KEY = 'kees-tag-preload-extver';   // last extension version we ran the preload for
    const PVER_KEY = 'kees-tag-preload-version';     // highest preloadVersion already imported

    function get(key) {
        return new Promise(r => chrome.storage.local.get([key], x => r(x[key])));
    }
    function set(obj) {
        return new Promise(r => chrome.storage.local.set(obj, r));
    }

    async function run() {
        const extVer = chrome.runtime.getManifest().version;
        // Cheap gate: only attempt the (possibly large) fetch+import once per release.
        if ((await get(EXTVER_KEY)) === extVer) return;

        let bundle;
        try {
            const res = await fetch(chrome.runtime.getURL('data/preload.json'));
            if (!res.ok) { await set({ [EXTVER_KEY]: extVer }); return; }
            bundle = await res.json();
        } catch (e) {
            return; // no bundle packaged / unreadable — nothing to do
        }

        const pv = (bundle && bundle.preloadVersion) || 0;
        const storedPv = (await get(PVER_KEY)) || 0;
        if (pv > storedPv) {
            try {
                // Seed tags/aliases/activity only — never reset the user's own
                // preferences (auto-tag threshold, hide settings, crawl limits).
                delete bundle.settings;
                await tagging.importAll(bundle, 'merge');
                await set({ [PVER_KEY]: pv });
                console.log('[KEES] preloaded tag dataset v' + pv);
            } catch (e) {
                console.error('[KEES] preload import failed:', e);
                return; // leave EXTVER unset so we retry next load
            }
        }
        await set({ [EXTVER_KEY]: extVer });
    }

    run();

})();
