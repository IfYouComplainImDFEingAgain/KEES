// features/tagging/crawl-ui.js - In-page crawl buttons on forum pages.
//
// Adds crawl controls directly where forums live, instead of typing IDs into the
// settings page:
//   * a "Crawl this forum" button next to the forum title (current forum's threads)
//   * a small "Crawl" button on each sub-forum box (.node--forum)
//   * a "Crawl all sub-forums" button when sub-forums are listed
//
// All buttons drive the shared engine in crawler.js via SNEED.tagging.crawler and
// reuse the limits saved in settings. A small floating HUD shows live progress and
// a Stop button. The crawl runs while this page stays open (navigating away cancels
// it; collected counts are already persisted).
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging || !tagging.crawler) return;
    const PATH = window.location.pathname;
    const ON_FORUM = PATH.includes('/forums/');
    const ON_THREAD = PATH.includes('/threads/');
    if (!ON_FORUM && !ON_THREAD) return;

    const CONFIRM_FORUM_COUNT = 4; // confirm before bulk-crawling this many forums

    function parseForumId(href) {
        const m = href && href.match(/\/forums\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    // --- buttons ---

    function makeBtn(label, small) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'kees-crawl-btn';
        b.textContent = label;
        b.style.cssText =
            'display:inline-block;cursor:pointer;border-radius:4px;border:1px solid #3a6ea5;' +
            'background:#27496d;color:#fff;vertical-align:middle;' +
            (small ? 'font-size:11px;padding:1px 7px;margin-left:8px;' : 'font-size:12px;padding:3px 10px;margin-left:10px;');
        return b;
    }

    function setButtonsDisabled(disabled) {
        document.querySelectorAll('.kees-crawl-btn').forEach(b => {
            b.disabled = disabled;
            b.style.opacity = disabled ? '0.5' : '1';
            b.style.cursor = disabled ? 'default' : 'pointer';
        });
    }

    // --- floating status HUD ---

    let hud, hudText, hideTimer = null, pollTimer = null;

    function ensureHud() {
        if (hud) return;
        hud = document.createElement('div');
        hud.id = 'kees-crawl-hud';
        hud.style.cssText =
            'position:fixed;bottom:20px;right:20px;z-index:99999;background:#1f1f1f;' +
            'border:1px solid #2b2b2b;border-radius:8px;padding:10px 12px;color:#e0e0e0;' +
            'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:340px;display:none;';
        hudText = document.createElement('span');
        const stop = document.createElement('button');
        stop.textContent = 'Stop';
        stop.style.cssText = 'cursor:pointer;border:1px solid #a83246;background:#7a2738;color:#fff;border-radius:4px;padding:2px 10px;font-size:12px;';
        stop.addEventListener('click', () => { tagging.crawler.stop(); });
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;';
        row.appendChild(hudText);
        row.appendChild(stop);
        hud.appendChild(row);
        document.body.appendChild(hud);
    }

    function showHud() {
        ensureHud();
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        hud.style.display = 'block';
    }

    function renderHud(st) {
        const parts = [st.message];
        if (st.forumsTotal > 1) parts.push(`forums ${st.forumsDone}/${st.forumsTotal}`);
        if (st.threadsDone) parts.push(`${st.threadsDone} threads`);
        if (st.postsCounted) parts.push(`${st.postsCounted} posts`);
        hudText.textContent = parts.filter(Boolean).join(' · ');
    }

    function startPolling() {
        if (pollTimer) return;
        const tick = () => {
            const st = tagging.crawler.getStatus();
            renderHud(st);
            if (!st.running) {
                clearInterval(pollTimer);
                pollTimer = null;
                setButtonsDisabled(false);
                hideTimer = setTimeout(() => { if (hud) hud.style.display = 'none'; }, 6000);
            }
        };
        pollTimer = setInterval(tick, 700);
        tick();
    }

    async function startCrawl(job) {
        const forumIds = [...new Set((job.forumIds || []).map(String).filter(Boolean))];
        const threadUrls = [...new Set((job.threadUrls || []).filter(Boolean))];
        if (!forumIds.length && !threadUrls.length) return;

        const settings = await tagging.getSettings();
        const c = settings.crawl || {};
        if (forumIds.length >= CONFIRM_FORUM_COUNT) {
            const perForum = c.maxThreads || 15;
            const ok = window.confirm(
                `Crawl ${forumIds.length} forums?\n\nUp to ~${forumIds.length * perForum} threads will be read, ` +
                `throttled at ${(c.delayMs || 2000)}ms per request. This can take a while and hits the site repeatedly — ` +
                `it auto-stops if the anti-bot gate triggers.`);
            if (!ok) return;
        }
        if (threadUrls.length) {
            const ok = window.confirm(
                `Crawl this thread?\n\nReads up to ${c.maxThreadPages || 50} pages at ${c.delayMs || 2000}ms each ` +
                `(megathreads can be long). It auto-stops if the anti-bot gate triggers.`);
            if (!ok) return;
        }

        const config = {
            forumIds,
            threadUrls,
            maxThreads: c.maxThreads,
            delayMs: c.delayMs,
            maxThreadListPages: c.maxThreadListPages,
            maxPostPages: c.maxPostPages,
            maxThreadPages: c.maxThreadPages
        };
        const res = tagging.crawler.start(config);
        showHud();
        if (!res.ok) { hudText.textContent = res.reason === 'already running' ? 'A crawl is already running' : 'Could not start'; return; }
        setButtonsDisabled(true);
        startPolling();
    }

    // --- injection ---

    function collectSubforumIds() {
        const ids = [];
        document.querySelectorAll('.node--forum').forEach(node => {
            const a = node.querySelector('.node-title a[href*="/forums/"]');
            const id = a && parseForumId(a.getAttribute('href'));
            if (id) ids.push(id);
        });
        return [...new Set(ids)];
    }

    function injectTopButtons() {
        const title = document.querySelector('.p-title-value');
        if (!title || title.querySelector('.kees-crawl-btn')) return;

        const forumId = parseForumId(window.location.pathname);
        if (forumId) {
            const b = makeBtn('⟳ Crawl this forum');
            b.title = 'Read this forum’s threads and tally posts per user';
            b.addEventListener('click', () => startCrawl({ forumIds: [forumId] }));
            title.appendChild(b);
        }

        const subs = collectSubforumIds();
        if (subs.length) {
            const b = makeBtn('⟳ Crawl all sub-forums (' + subs.length + ')');
            b.title = 'Crawl every sub-forum listed on this page';
            b.addEventListener('click', () => startCrawl({ forumIds: subs }));
            title.appendChild(b);
        }
    }

    function parseThreadId(href) {
        const m = href && href.match(/\/threads\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function injectThreadButton() {
        const title = document.querySelector('.p-title-value');
        if (!title || title.querySelector('.kees-crawl-btn')) return;
        const threadId = parseThreadId(window.location.pathname);
        if (!threadId) return;
        const b = makeBtn('⟳ Crawl this thread');
        b.title = 'Read every page of this thread and tally posts per user (good for megathreads)';
        // Start from page 1 so the whole thread is covered regardless of current page.
        const threadUrl = window.location.origin + '/threads/' + threadId + '/';
        b.addEventListener('click', () => startCrawl({ threadUrls: [threadUrl] }));
        title.appendChild(b);
    }

    function injectSubforumButtons() {
        document.querySelectorAll('.node--forum .node-title').forEach(titleEl => {
            if (titleEl.querySelector('.kees-crawl-btn')) return;
            const a = titleEl.querySelector('a[href*="/forums/"]');
            const id = a && parseForumId(a.getAttribute('href'));
            if (!id) return;
            const b = makeBtn('Crawl', true);
            b.title = 'Crawl this sub-forum';
            b.addEventListener('click', (e) => { e.preventDefault(); startCrawl({ forumIds: [id] }); });
            titleEl.appendChild(b);
        });
    }

    function init() {
        if (ON_FORUM) {
            injectTopButtons();
            injectSubforumButtons();
        }
        if (ON_THREAD) {
            injectThreadButton();
        }
        // Reflect a crawl already in progress (e.g. started before a soft refresh).
        if (tagging.crawler.isRunning()) {
            showHud();
            setButtonsDisabled(true);
            startPolling();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
