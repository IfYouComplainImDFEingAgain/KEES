// features/tagging/crawler.js - Opt-in, bounded forum crawler.
//
// Runs in the content-script context of an open kiwifarms tab, which is already
// authenticated and past the Tartarus/KiwiFlare PoW gate, so no PoW handling is
// needed here. It is controlled from the popup via chrome.tabs.sendMessage.
//
// SAFETY: the site runs an active anti-bot gate, so this crawler is deliberately
// conservative — every request is throttled with jitter, hard caps bound the total
// work, and it AUTO-STOPS the instant it sees a non-200 response or a page that
// carries a PoW challenge (a sign the gate has re-triggered). It writes counts
// incrementally, so a stop/close never loses collected data.
//
// Note: re-running the crawler ADDS to counts (it cannot know which posts a prior
// run already saw across sessions). For an exact per-user snapshot, use the
// "Generate from forum activity" button on a member profile instead.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging) return;

    const DEFAULTS = {
        maxThreadListPages: 2,  // forum index pages to harvest thread links from
        maxThreads: 15,         // threads to visit per forum
        maxPostPages: 3,        // post pages to read per thread during a forum crawl
        maxThreadPages: 50,     // post pages to read when crawling a single thread (megathreads)
        delayMs: 2000           // base delay between requests (+ up to 500ms jitter)
    };

    const state = {
        running: false,
        stop: false,
        message: 'idle',
        forumId: null,
        forumsTotal: 0,
        forumsDone: 0,
        threadsDone: 0,
        postsCounted: 0,
        error: null
    };

    const seenPosts = new Set();

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
    function jitter(base) { return base + Math.floor(Math.random() * 500); }

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function parseThreadId(href) {
        const m = href && href.match(/\/threads\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function parsePageNum(href) {
        const m = href && href.match(/\/page-(\d+)/);
        return m ? parseInt(m[1], 10) : 1;
    }

    function absolute(href) {
        if (!href) return null;
        return href.startsWith('http') ? href : window.location.origin + href;
    }

    // Throws { blocked: true } if the gate re-triggered or the request failed.
    async function fetchDoc(url) {
        const res = await fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } });
        if (!res.ok) {
            const err = new Error('HTTP ' + res.status);
            err.blocked = true;
            throw err;
        }
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const root = doc.documentElement;
        if (root.hasAttribute('data-sssg-challenge') || root.hasAttribute('data-ttrs-challenge')) {
            const err = new Error('PoW challenge re-triggered');
            err.blocked = true;
            throw err;
        }
        return doc;
    }

    function extractPosts(doc) {
        const out = [];
        doc.querySelectorAll('article.message[data-content], article.message[id^="js-post-"]').forEach(article => {
            const postId = article.getAttribute('data-content') || article.id;
            if (!postId || seenPosts.has(postId)) return;
            const link = article.querySelector('.message-userDetails .username, .message-name .username, a.username[data-user-id]');
            if (!link) return;
            const userId = link.getAttribute('data-user-id') || parseUserFromHref(link.getAttribute('href'));
            if (!userId) return;
            seenPosts.add(postId);
            out.push({ userId, username: link.textContent.trim() || article.getAttribute('data-author') || '' });
        });
        return out;
    }

    // The thread's parent forum = the last /forums/ link in the breadcrumb.
    function readForumFromDoc(doc) {
        const links = doc.querySelectorAll('.p-breadcrumbs a[href*="/forums/"]');
        if (!links.length) return null;
        const link = links[links.length - 1];
        const m = link.getAttribute('href').match(/\/forums\/(?:[^.\/]+\.)?(\d+)/);
        if (!m) return null;
        return { forumId: m[1], name: link.textContent.trim() };
    }

    // Scan a thread's post pages, attributing each post to `forum`. When `forum` is
    // null (a standalone thread crawl) it is derived from the first page's breadcrumb.
    // `pageCap` defaults to the forum-crawl per-thread cap; thread crawls pass a
    // higher cap so megathreads are covered.
    async function scanThread(threadUrl, forum, cfg, pageCap) {
        let url = absolute(threadUrl);
        let page = 0;
        pageCap = pageCap || cfg.maxPostPages;
        const standalone = !forum;
        const threadId = parseThreadId(url);
        // Pages already counted (passively or by a prior crawl) — never re-tally them.
        const seenPages = threadId ? new Set(await tagging.getSeenPages(threadId)) : new Set();

        while (url && page < pageCap && !state.stop) {
            page++;
            const pageNum = parsePageNum(url);
            await delay(jitter(cfg.delayMs));
            const doc = await fetchDoc(url);

            if (!forum) {
                forum = readForumFromDoc(doc);
                if (!forum) return; // can't attribute without a parent forum
                await tagging.ensureForumKnown(forum.forumId, forum.name);
            }
            state.message = standalone
                ? `Thread in ${forum.name}: page ${page}`
                : `Forum ${forum.forumId}: thread ${state.threadsDone + 1}, page ${page}`;

            if (!seenPages.has(pageNum)) {
                const posts = extractPosts(doc);
                if (posts.length) {
                    const batch = {};
                    posts.forEach(p => {
                        const slot = batch[p.userId] || { username: p.username, forums: { [forum.forumId]: { name: forum.name, add: 0 } } };
                        if (p.username) slot.username = p.username;
                        slot.forums[forum.forumId].add += 1;
                        batch[p.userId] = slot;
                    });
                    await tagging.applyActivityBatch(batch);
                    state.postsCounted += posts.length;
                }
                seenPages.add(pageNum);
                if (threadId) await tagging.addSeenPage(threadId, pageNum);
            }
            if (standalone) tagging.setCrawlStatus(statusSnapshot());
            const next = doc.querySelector('.pageNav-jump--next');
            url = next ? absolute(next.getAttribute('href')) : null;
        }
    }

    async function crawlForum(forumId, cfg) {
        state.forumId = forumId;
        const threadUrls = new Set();
        let forumName = 'Forum ' + forumId;

        // Harvest thread links from the forum index pages.
        for (let p = 1; p <= cfg.maxThreadListPages && !state.stop; p++) {
            state.message = `Forum ${forumId}: index page ${p}`;
            await delay(jitter(cfg.delayMs));
            const url = window.location.origin + '/forums/' + forumId + '/page-' + p;
            const doc = await fetchDoc(url);
            const title = doc.querySelector('.p-title-value');
            if (title) forumName = title.textContent.trim();
            const before = threadUrls.size;
            doc.querySelectorAll('.structItem-title a[href*="/threads/"]').forEach(a => {
                threadUrls.add(a.getAttribute('href'));
            });
            if (threadUrls.size === before) break; // no new threads -> end of forum
        }

        await tagging.ensureForumKnown(forumId, forumName);
        const forum = { forumId, name: forumName };
        const threads = Array.from(threadUrls).slice(0, cfg.maxThreads);
        for (const t of threads) {
            if (state.stop) break;
            await scanThread(t, forum, cfg);
            state.threadsDone++;
            tagging.setCrawlStatus(statusSnapshot());
        }
    }

    async function run(config) {
        const cfg = {
            maxThreadListPages: config.maxThreadListPages || DEFAULTS.maxThreadListPages,
            maxThreads: config.maxThreads || DEFAULTS.maxThreads,
            maxPostPages: config.maxPostPages || DEFAULTS.maxPostPages,
            maxThreadPages: config.maxThreadPages || DEFAULTS.maxThreadPages,
            delayMs: Math.max(800, config.delayMs || DEFAULTS.delayMs)
        };
        const forumIds = (config.forumIds || []).map(String).filter(Boolean);
        const threadUrls = (config.threadUrls || []).map(String).filter(Boolean);

        Object.assign(state, {
            running: true, stop: false, error: null, message: 'starting…',
            forumsTotal: forumIds.length + threadUrls.length, forumsDone: 0, threadsDone: 0, postsCounted: 0
        });
        seenPosts.clear();
        const startedAt = Date.now();
        tagging.setCrawlStatus(statusSnapshot());

        try {
            for (const forumId of forumIds) {
                if (state.stop) break;
                await crawlForum(forumId, cfg);
                state.forumsDone++;
            }
            for (const threadUrl of threadUrls) {
                if (state.stop) break;
                await scanThread(threadUrl, null, cfg, cfg.maxThreadPages);
                state.threadsDone++;
                state.forumsDone++;
                tagging.setCrawlStatus(statusSnapshot());
            }
            state.message = state.stop ? 'stopped' : 'done';
        } catch (e) {
            state.error = e.message;
            state.message = e.blocked
                ? 'Auto-stopped: ' + e.message + ' (back off and retry later)'
                : 'Error: ' + e.message;
            console.warn('[KEES] crawler stopped:', e);
        } finally {
            state.running = false;
            tagging.setCrawlStatus(statusSnapshot());
            await tagging.addCrawlHistory({
                ts: startedAt,
                finished: Date.now(),
                forumIds: forumIds.slice(),
                threads: threadUrls.length,
                forumsDone: state.forumsDone,
                threadsDone: state.threadsDone,
                postsCounted: state.postsCounted,
                message: state.message,
                error: state.error
            });
        }
    }

    function statusSnapshot() {
        return { ...state };
    }

    // Public API — used by the in-page crawl buttons (crawl-ui.js) and the popup
    // message bridge below. Only one crawl runs at a time (guarded by state.running).
    function start(config) {
        if (state.running) return { ok: false, reason: 'already running', status: statusSnapshot() };
        run(config || {});
        return { ok: true, status: statusSnapshot() };
    }

    function stop() {
        if (state.running) { state.stop = true; state.message = 'stopping…'; }
        return { ok: true, status: statusSnapshot() };
    }

    const SN = window.SNEED || {};
    SN.tagging = SN.tagging || {};
    SN.tagging.crawler = {
        start,
        stop,
        getStatus: statusSnapshot,
        isRunning: () => state.running
    };

    // Popup bridge: lets the settings page control a crawl in this tab.
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type === 'kees-crawl-start') { sendResponse(start(msg.config || {})); return; }
        if (msg.type === 'kees-crawl-stop') { sendResponse(stop()); return; }
        if (msg.type === 'kees-crawl-status') { sendResponse({ ok: true, status: statusSnapshot() }); return; }
    });

})();
