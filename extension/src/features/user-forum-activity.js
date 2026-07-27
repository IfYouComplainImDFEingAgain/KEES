// features/user-forum-activity.js - Analyze user forum posting activity
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_PREFIX = 'kees-user-forums-';
    const STORAGE_KEY_MAX_PAGES = 'kees-forum-activity-max-pages';
    const STORAGE_KEY_DEEP_SEARCH = 'kees-forum-activity-deep-search';
    const STORAGE_KEY_WINDOW_DAYS = 'kees-forum-activity-window-days';
    const STORAGE_KEY_MAX_SEARCHES = 'kees-forum-activity-max-searches';

    // The site allows at most ~10 result pages per search, so the quick
    // (single-search) mode can never exceed this regardless of the setting.
    const SEARCH_PAGE_CAP = 10;
    const DEFAULT_MAX_PAGES_TO_FETCH = 10;
    const DEFAULT_WINDOW_DAYS = 90;
    const DEFAULT_MAX_SEARCHES = 24;
    const MIN_WINDOW_DAYS = 3;      // stop subdividing date windows below this
    const FETCH_DELAY = 300;        // between pages of one search
    const SEARCH_DELAY = 900;       // between distinct searches (deep mode, politeness)

    function getSetting(key, fallback, opts) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                let v = result[key];
                if (opts && opts.number) {
                    v = parseInt(v, 10);
                    if (isNaN(v) || v <= 0) return resolve(fallback);
                    if (opts.min != null) v = Math.max(opts.min, v);
                    if (opts.max != null) v = Math.min(opts.max, v);
                    return resolve(v);
                }
                resolve(v === undefined ? fallback : v);
            });
        });
    }

    async function getMaxPagesToFetch() {
        return getSetting(STORAGE_KEY_MAX_PAGES, DEFAULT_MAX_PAGES_TO_FETCH, { number: true, min: 1, max: SEARCH_PAGE_CAP });
    }

    async function isDeepSearchEnabled() {
        return (await getSetting(STORAGE_KEY_DEEP_SEARCH, false)) === true;
    }

    async function getWindowDays() {
        return getSetting(STORAGE_KEY_WINDOW_DAYS, DEFAULT_WINDOW_DAYS, { number: true, min: 7, max: 365 });
    }

    async function getMaxSearches() {
        return getSetting(STORAGE_KEY_MAX_SEARCHES, DEFAULT_MAX_SEARCHES, { number: true, min: 1, max: 200 });
    }

    function getUserInfoFromUrl() {
        const match = window.location.pathname.match(/\/members\/([^\/]+)\.(\d+)/);
        if (match) {
            return {
                username: match[1],
                userId: parseInt(match[2], 10)
            };
        }
        return null;
    }

    function getStorageKey(userId) {
        return STORAGE_KEY_PREFIX + userId;
    }

    async function getCachedData(userId) {
        return new Promise((resolve) => {
            const key = getStorageKey(userId);
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    }

    async function saveCachedData(userId, data) {
        return new Promise((resolve) => {
            const key = getStorageKey(userId);
            chrome.storage.local.set({ [key]: data }, resolve);
        });
    }

    async function clearCachedData(userId) {
        return new Promise((resolve) => {
            const key = getStorageKey(userId);
            chrome.storage.local.remove([key], resolve);
        });
    }

    async function fetchPage(url) {
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'text/html'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            const parser = new DOMParser();
            return parser.parseFromString(html, 'text/html');
        } catch (e) {
            console.error(`[KEES] Failed to fetch ${url}:`, e);
            return null;
        }
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // Resolve a search-result row's post time (ms since epoch) from its XenForo
    // <time> element. NOTE: data-timestamp holds the unix seconds; the similarly
    // named data-time is a time-of-day string ("6:25 PM"), so it is NOT used here.
    // datetime (ISO 8601) is the fallback.
    function parsePostTime(row) {
        if (!row) return null;
        const timeEl = row.querySelector('time[data-timestamp], time[datetime]');
        if (!timeEl) return null;
        const secs = timeEl.getAttribute('data-timestamp');
        if (secs) {
            const n = parseInt(secs, 10);
            if (!isNaN(n)) return n * 1000;
        }
        const iso = timeEl.getAttribute('datetime');
        if (iso) {
            const t = Date.parse(iso);
            if (!isNaN(t)) return t;
        }
        return null;
    }

    function extractPostsFromPage(doc) {
        const posts = [];

        // Each search result carries one "Forum: <name>" meta item. Iterating those
        // <li>s directly (rather than the row wrappers) yields exactly one record per
        // post and sidesteps the double-count a nested .block-row/.contentRow match
        // would cause. The enclosing row gives us the post's timestamp.
        doc.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (!text.startsWith('Forum:')) return;
            const link = li.querySelector('a[href*="/forums/"]');
            if (!link) return;
            const row = li.closest('.block-row, .contentRow');
            // Best-effort permalink so the same post seen in two overlapping date
            // windows is only counted once (deep-search mode).
            const titleLink = row && row.querySelector('.contentRow-title a[href], h3 a[href], h4 a[href]');
            posts.push({
                name: link.textContent.trim(),
                url: link.getAttribute('href'),
                postUrl: titleLink ? titleLink.getAttribute('href') : null,
                timestamp: parsePostTime(row)
            });
        });

        console.log('[KEES] Extracted', posts.length, 'posts from page');
        return posts;
    }

    // Shared aggregator so the quick (single-search) and deep (dated-search) modes
    // build identical result shapes. Dedups by post permalink when available.
    function makeAccumulator() {
        const forumCounts = {};
        const dailyMap = {};
        const seen = new Set();
        let totalPosts = 0;
        return {
            add(p) {
                if (p.postUrl) {
                    if (seen.has(p.postUrl)) return;
                    seen.add(p.postUrl);
                }
                forumCounts[p.name] = (forumCounts[p.name] || 0) + 1;
                totalPosts++;
                if (p.timestamp) {
                    const day = dayStart(p.timestamp);
                    const bucket = dailyMap[day] || (dailyMap[day] = { total: 0, forums: {} });
                    bucket.total++;
                    bucket.forums[p.name] = (bucket.forums[p.name] || 0) + 1;
                }
            },
            get total() { return totalPosts; },
            build() {
                const forums = Object.entries(forumCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                const timeline = Object.keys(dailyMap)
                    .map(k => parseInt(k, 10))
                    .sort((a, b) => a - b)
                    .map(day => ({ t: day, total: dailyMap[day].total, forums: dailyMap[day].forums }));
                return { totalPosts, forums, timeline };
            }
        };
    }

    // --- date helpers (day granularity, local time) ---
    function fmtDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function addDays(d, n) {
        const r = new Date(d.getTime());
        r.setDate(r.getDate() + n);
        return r;
    }
    function daysBetween(a, b) {
        return Math.round((b.getTime() - a.getTime()) / 86400000);
    }
    function midpoint(a, b) {
        return addDays(a, Math.floor(daysBetween(a, b) / 2));
    }

    // --- deep-search (dated) helpers ---

    // XenForo embeds the CSRF token in every form's hidden input; the content script
    // can read it from the DOM (it cannot reach the page's XF.config global).
    function getCsrfToken() {
        const input = document.querySelector('input[name="_xfToken"]');
        return input && input.value ? input.value : null;
    }

    // The advanced search matches users by display name, not the URL slug, so read
    // the name from the profile header. The header's .username can contain nested
    // markup (e.g. a "Previous usernames" popup that lazy-loads "Loading…"), so read
    // only its direct text nodes — never textContent, which would slurp that blob in.
    function getDisplayName() {
        const el = document.querySelector('.memberHeader-name .username, h1 .username, .username[itemprop="name"]');
        if (!el) return null;
        let name = Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent)
            .join('');
        // Fallback: first non-empty line of textContent (name sits before the popup).
        if (!name.trim()) {
            name = (el.textContent || '').split('\n').map(s => s.trim()).find(Boolean) || '';
        }
        name = name.replace(/\s+/g, ' ').trim();
        return name || null;
    }

    function isChallenge(doc) {
        const root = doc.documentElement;
        return root.hasAttribute('data-sssg-challenge') || root.hasAttribute('data-ttrs-challenge');
    }

    // Read the highest page number from a results page's pager (XF condenses it,
    // but the last numeric link is the true last page).
    function getResultPageCount(doc) {
        let max = 1;
        doc.querySelectorAll('.pageNav-main li a, .pageNav-page a').forEach(a => {
            const n = parseInt(a.textContent.trim(), 10);
            if (!isNaN(n) && n > max) max = n;
        });
        return max;
    }

    // POST the advanced-search form for one user over one date window and return the
    // first results page (fetch follows the 302 to /search/<id>/). Returns null if
    // the request failed or the anti-bot gate re-triggered.
    async function postDatedSearch(displayName, token, newerThan, olderThan) {
        const body = new URLSearchParams();
        body.set('keywords', '');
        body.set('constraints', '');
        body.set('c[users]', displayName + ', ');
        body.set('c[newer_than]', newerThan);
        body.set('c[older_than]', olderThan);
        body.set('order', 'date');
        body.set('_xfToken', token);
        try {
            const res = await fetch(window.location.origin + '/search/search', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
                body: body.toString()
            });
            if (!res.ok) return null;
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            if (isChallenge(doc)) return null;
            return doc;
        } catch (e) {
            console.error('[KEES] dated search failed:', e);
            return null;
        }
    }

    // Walk a results doc across up to SEARCH_PAGE_CAP pages, feeding posts to acc.
    async function harvestSearchPages(firstDoc, acc) {
        let doc = firstDoc;
        let pages = 0;
        while (doc) {
            pages++;
            extractPostsFromPage(doc).forEach(p => acc.add(p));
            if (pages >= SEARCH_PAGE_CAP) break;
            let next = getNextPageUrl(doc);
            if (!next) break;
            if (!next.startsWith('http')) next = window.location.origin + next;
            await delay(FETCH_DELAY);
            doc = await fetchPage(next);
        }
        return pages;
    }

    function dayStart(ts) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    function getNextPageUrl(doc) {
        const nextLink = doc.querySelector('.pageNav-jump--next');
        if (nextLink) {
            return nextLink.getAttribute('href');
        }
        return null;
    }

    function getSearchUrl(userId) {
        return `/search/member?user_id=${userId}`;
    }

    // Quick mode: one member search, paginated up to the (site-capped) page limit.
    async function analyzeUserActivity(userId, progressCallback) {
        const acc = makeAccumulator();
        let pagesProcessed = 0;
        const maxPagesToFetch = await getMaxPagesToFetch();

        progressCallback('Starting search...');
        const searchUrl = window.location.origin + getSearchUrl(userId);
        console.log('[KEES] Search URL:', searchUrl);

        let stopReason = 'exhausted'; // 'exhausted' | 'limit' | 'error'
        let currentUrl = searchUrl;

        while (currentUrl && pagesProcessed < maxPagesToFetch) {
            pagesProcessed++;
            progressCallback(`Fetching page ${pagesProcessed}...`);

            await delay(FETCH_DELAY);
            const doc = await fetchPage(currentUrl);

            if (!doc) {
                stopReason = 'error';
                break;
            }

            extractPostsFromPage(doc).forEach(p => acc.add(p));
            progressCallback(`Page ${pagesProcessed}: ${acc.total} posts so far`);

            currentUrl = getNextPageUrl(doc);
            if (currentUrl && !currentUrl.startsWith('http')) {
                currentUrl = window.location.origin + currentUrl;
            }
        }

        // Distinguish "hit the configured page cap" (more pages existed) from
        // "the site ran out of result pages" (no further next-page link).
        if (stopReason !== 'error') {
            stopReason = (currentUrl && pagesProcessed >= maxPagesToFetch) ? 'limit' : 'exhausted';
        }

        const built = acc.build();
        return {
            userId,
            mode: 'quick',
            totalPosts: built.totalPosts,
            pagesAnalyzed: pagesProcessed,
            maxPages: maxPagesToFetch,
            stopReason,
            forums: built.forums,
            timeline: built.timeline,
            timestamp: Date.now()
        };
    }

    // Deep mode: tile the member's history with dated advanced searches. Each search
    // is site-capped at ~10 pages, so windows that overflow are recursively halved.
    // Bounded by maxSearches and by consecutive-empty-window detection.
    async function analyzeUserActivityDeep(displayName, progressCallback) {
        const token = getCsrfToken();
        if (!token) {
            throw new Error('Could not find a search token on this page (are you logged in?)');
        }
        if (!displayName) {
            throw new Error('Could not read this member\'s display name');
        }

        const acc = makeAccumulator();
        const windowDays = await getWindowDays();
        const maxSearches = await getMaxSearches();
        const EMPTY_STREAK_STOP = 2;

        let searches = 0;
        let stopReason = 'complete';
        let blocked = false;

        // Recursively search one [newer..older] window, splitting it if the site
        // truncates the result set to its page cap.
        async function processWindow(newerDate, olderDate) {
            if (blocked || searches >= maxSearches) return 0;
            searches++;
            progressCallback(`Search ${searches}/${maxSearches}: ${fmtDate(newerDate)} → ${fmtDate(olderDate)} (${acc.total} posts)`);

            await delay(SEARCH_DELAY);
            const doc = await postDatedSearch(displayName, token, fmtDate(newerDate), fmtDate(olderDate));
            if (!doc) { blocked = true; return 0; }

            // If the window fills the page cap, split it rather than losing pages past
            // the cap — unless it is already at minimum granularity. We test `>=`, not
            // `>`, because the site truncates a single search to its cap, so a dense
            // window's pager can read exactly SEARCH_PAGE_CAP even when more exists.
            if (getResultPageCount(doc) >= SEARCH_PAGE_CAP && daysBetween(newerDate, olderDate) > MIN_WINDOW_DAYS) {
                const mid = midpoint(newerDate, olderDate);
                const younger = await processWindow(addDays(mid, 1), olderDate);
                const older = await processWindow(newerDate, mid);
                return younger + older;
            }

            const before = acc.total;
            await harvestSearchPages(doc, acc);
            return acc.total - before;
        }

        // Walk non-overlapping windows backward from today until we run dry or hit
        // the search budget.
        let cursor = new Date();
        let emptyStreak = 0;
        while (searches < maxSearches && !blocked) {
            const olderDate = cursor;
            const newerDate = addDays(cursor, -(windowDays - 1));
            const got = await processWindow(newerDate, olderDate);
            if (got === 0) {
                if (++emptyStreak >= EMPTY_STREAK_STOP) break;
            } else {
                emptyStreak = 0;
            }
            cursor = addDays(newerDate, -1); // strictly older, no shared boundary day
        }

        if (blocked) stopReason = 'blocked';
        else if (searches >= maxSearches) stopReason = 'limit';
        else stopReason = 'complete';

        const built = acc.build();
        return {
            mode: 'deep',
            totalPosts: built.totalPosts,
            searchesRun: searches,
            maxSearches,
            windowDays,
            stopReason,
            forums: built.forums,
            timeline: built.timeline,
            timestamp: Date.now()
        };
    }

    function createActivityBox(userInfo) {
        const box = document.createElement('div');
        box.id = 'kees-forum-activity';
        box.className = 'block';
        box.style.cssText = 'margin-top: 16px;';

        box.innerHTML = `
            <div class="block-container">
                <h3 class="block-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Forum Activity Analysis</span>
                    <span id="kees-activity-status" style="font-size: 12px; font-weight: normal; color: #888;"></span>
                </h3>
                <div class="block-body" id="kees-activity-content" style="padding: 16px;">
                    <button id="kees-analyze-btn" class="button button--primary">
                        <span class="button-text">Analyze Forum Activity</span>
                    </button>
                    <button id="kees-refresh-btn" class="button" style="display: none; margin-left: 8px;">
                        <span class="button-text">Refresh</span>
                    </button>
                </div>
            </div>
        `;

        return box;
    }

    const CHART_TOTAL_COLOR = '#4a9eff';
    const CHART_FORUM_COLORS = ['#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
    const CHART_MAX_FORUM_LINES = 6;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    function formatDayLabel(ts, withYear) {
        const d = new Date(ts);
        const base = (d.getMonth() + 1) + '/' + d.getDate();
        return withYear ? base + '/' + String(d.getFullYear()).slice(-2) : base;
    }

    // Build an inline SVG line graph: one bright line for total posts/day plus a
    // colored line for each of the top forums. Self-contained (no external libs)
    // so it satisfies the extension CSP. Returns an HTML string.
    function buildActivityChartHtml(data) {
        const timeline = data.timeline || [];
        if (timeline.length === 0) {
            return `
                <div style="margin-top: 20px; color: #666; font-size: 13px;">
                    Posting-frequency graph unavailable (no post dates were found).
                </div>
            `;
        }

        const W = 800, H = 300;
        const padL = 46, padR = 14, padT = 14, padB = 46;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;

        const minDay = timeline[0].t;
        const maxDay = timeline[timeline.length - 1].t;
        const dayRange = maxDay - minDay;
        const withYear = dayRange > 365 * 24 * 3600 * 1000;
        const maxTotal = timeline.reduce((m, d) => Math.max(m, d.total), 0) || 1;

        const xFor = t => dayRange === 0 ? padL + plotW / 2 : padL + ((t - minDay) / dayRange) * plotW;
        const yFor = v => padT + plotH - (v / maxTotal) * plotH;

        // Horizontal gridlines + Y-axis labels.
        const yTicks = 4;
        let grid = '';
        for (let i = 0; i <= yTicks; i++) {
            const val = Math.round((maxTotal * i) / yTicks);
            const y = yFor(val).toFixed(1);
            grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#333" stroke-width="1"/>`;
            grid += `<text x="${padL - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#888" font-size="11">${val}</text>`;
        }

        // X-axis date labels (sample a handful, always include the last day).
        const step = Math.max(1, Math.ceil(timeline.length / 6));
        let xLabels = '';
        const labelled = new Set();
        for (let i = 0; i < timeline.length; i += step) {
            labelled.add(i);
        }
        labelled.add(timeline.length - 1);
        Array.from(labelled).sort((a, b) => a - b).forEach(i => {
            const d = timeline[i];
            xLabels += `<text x="${xFor(d.t).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" fill="#888" font-size="11">${formatDayLabel(d.t, withYear)}</text>`;
        });

        const topForums = data.forums.slice(0, CHART_MAX_FORUM_LINES).map(f => f.name);
        const drawDots = timeline.length <= 60;

        function series(valueAt, color, width, dotR) {
            const pts = timeline.map(d => `${xFor(d.t).toFixed(1)},${yFor(valueAt(d)).toFixed(1)}`).join(' ');
            let s = `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>`;
            if (drawDots) {
                timeline.forEach(d => {
                    s += `<circle cx="${xFor(d.t).toFixed(1)}" cy="${yFor(valueAt(d)).toFixed(1)}" r="${dotR}" fill="${color}"/>`;
                });
            }
            return s;
        }

        // Forum lines first, then the total on top so it stays readable.
        let lines = '';
        topForums.forEach((name, idx) => {
            const color = CHART_FORUM_COLORS[idx % CHART_FORUM_COLORS.length];
            lines += series(d => d.forums[name] || 0, color, 1.5, 2);
        });
        lines += series(d => d.total, CHART_TOTAL_COLOR, 2.5, 2.5);

        function legendItem(color, label) {
            return `<span style="display:inline-flex;align-items:center;gap:5px;margin:0 12px 4px 0;">
                <span style="width:14px;height:3px;background:${color};display:inline-block;border-radius:2px;"></span>
                <span style="color:#ccc;font-size:12px;">${label}</span></span>`;
        }

        let legend = legendItem(CHART_TOTAL_COLOR, 'Total posts / day');
        topForums.forEach((name, idx) => {
            legend += legendItem(CHART_FORUM_COLORS[idx % CHART_FORUM_COLORS.length], escapeHtml(name));
        });

        const omitted = data.forums.length - topForums.length;
        const omittedNote = omitted > 0
            ? `<div style="color:#666;font-size:11px;margin-top:4px;">+${omitted} more ${omitted === 1 ? 'forum' : 'forums'} not shown as lines (still counted in Total).</div>`
            : '';

        return `
            <div style="margin-top: 24px;">
                <div style="font-weight:600;margin-bottom:8px;">Posting Frequency</div>
                <div style="overflow-x:auto;">
                    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;min-width:520px;height:auto;display:block;">
                        ${grid}
                        ${lines}
                        ${xLabels}
                    </svg>
                </div>
                <div style="margin-top:10px;">${legend}</div>
                ${omittedNote}
            </div>
        `;
    }

    function renderResults(data, container) {
        const statusEl = document.getElementById('kees-activity-status');

        if (statusEl) {
            const date = new Date(data.timestamp);
            statusEl.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }

        let summary;
        if (data.mode === 'deep') {
            let note = '';
            if (data.stopReason === 'limit') {
                note = ` &mdash; stopped at the ${data.maxSearches}-search limit; raise "Deep search max searches" to go further back.`;
            } else if (data.stopReason === 'blocked') {
                note = ' &mdash; stopped early (a search request was blocked or failed; back off and retry later).';
            } else {
                note = ' &mdash; full history (searches ran dry).';
            }
            summary = `Analyzed ${data.totalPosts} posts via ${data.searchesRun} dated searches${note}`;
        } else {
            let note = '';
            if (data.stopReason === 'limit') {
                note = ` &mdash; stopped at the ${data.maxPages}-page limit; raise "Forum Activity Max Pages" in settings to crawl further.`;
            } else if (data.stopReason === 'exhausted') {
                note = ' &mdash; reached the last available search page (the site caps a single search at 10 pages; enable Deep search in settings for full history).';
            } else if (data.stopReason === 'error') {
                note = ' &mdash; stopped early after a failed request.';
            }
            summary = `Analyzed ${data.totalPosts} posts across ${data.pagesAnalyzed} pages${note}`;
        }

        let html = `
            <div style="margin-bottom: 12px; color: #888; font-size: 13px;">
                ${summary}
            </div>
        `;

        if (data.forums.length === 0) {
            html += '<p style="color: #666;">No forum activity found.</p>';
        } else {
            const maxCount = data.forums[0].count;

            html += '<div class="kees-forum-list">';
            data.forums.forEach((forum, index) => {
                const percentage = ((forum.count / data.totalPosts) * 100).toFixed(1);
                const barWidth = (forum.count / maxCount) * 100;

                html += `
                    <div class="kees-forum-item" style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span style="font-weight: ${index < 3 ? '600' : 'normal'};">${forum.name}</span>
                            <span style="color: #888;">${forum.count} posts (${percentage}%)</span>
                        </div>
                        <div style="background: #333; border-radius: 3px; height: 6px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #4a9eff, #2d7dd2); height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            html += buildActivityChartHtml(data);
        }

        container.innerHTML = html;

        const btnContainer = document.createElement('div');
        btnContainer.style.marginTop = '16px';
        btnContainer.innerHTML = `
            <button id="kees-refresh-btn" class="button">
                <span class="button-text">Refresh Analysis</span>
            </button>
        `;
        container.appendChild(btnContainer);

        document.getElementById('kees-refresh-btn').addEventListener('click', () => {
            startAnalysis(true);
        });
    }

    function showProgress(message, container) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="kees-spinner" style="
                    width: 20px;
                    height: 20px;
                    border: 2px solid #333;
                    border-top-color: #4a9eff;
                    border-radius: 50%;
                    animation: kees-spin 1s linear infinite;
                "></div>
                <span id="kees-progress-text">${message}</span>
            </div>
            <style>
                @keyframes kees-spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    function updateProgress(message) {
        const textEl = document.getElementById('kees-progress-text');
        if (textEl) {
            textEl.textContent = message;
        }
    }

    function showError(message, container) {
        container.innerHTML = `
            <div style="color: #e74c3c; margin-bottom: 12px;">
                <i class="fa--xf fal fa-exclamation-triangle" style="margin-right: 8px;"></i>
                ${message}
            </div>
            <button id="kees-analyze-btn" class="button button--primary">
                <span class="button-text">Try Again</span>
            </button>
        `;

        document.getElementById('kees-analyze-btn').addEventListener('click', () => {
            startAnalysis(false);
        });
    }

    let currentUserInfo = null;

    async function startAnalysis(forceRefresh = false) {
        const container = document.getElementById('kees-activity-content');
        const userInfo = currentUserInfo;

        if (!userInfo) {
            showError('Could not determine user ID', container);
            return;
        }

        if (!forceRefresh) {
            const cached = await getCachedData(userInfo.userId);
            if (cached) {
                renderResults(cached, container);
                return;
            }
        }

        if (forceRefresh) {
            await clearCachedData(userInfo.userId);
        }

        showProgress('Starting analysis...', container);

        try {
            const deep = await isDeepSearchEnabled();
            const data = deep
                ? await analyzeUserActivityDeep(userInfo.displayName || getDisplayName(), updateProgress)
                : await analyzeUserActivity(userInfo.userId, updateProgress);
            data.userId = userInfo.userId;
            await saveCachedData(userInfo.userId, data);
            renderResults(data, container);
        } catch (e) {
            console.error('[KEES] Analysis failed:', e);
            showError('Analysis failed: ' + e.message, container);
        }
    }

    async function init() {
        if (!window.location.pathname.includes('/members/')) {
            return;
        }

        const userInfo = getUserInfoFromUrl();
        if (!userInfo) {
            console.log('[KEES] Could not parse user info from URL');
            return;
        }

        userInfo.displayName = getDisplayName();
        currentUserInfo = userInfo;

        function insertBox() {
            const tabHeader = document.querySelector('.block-tabHeader--memberTabs');
            if (!tabHeader) {
                return false;
            }

            if (document.getElementById('kees-forum-activity')) {
                return true;
            }

            const box = createActivityBox(userInfo);
            tabHeader.parentNode.insertBefore(box, tabHeader);

            getCachedData(userInfo.userId).then(cached => {
                if (cached) {
                    renderResults(cached, document.getElementById('kees-activity-content'));
                }
            });

            document.getElementById('kees-analyze-btn').addEventListener('click', () => {
                startAnalysis(false);
            });

            document.getElementById('kees-refresh-btn').addEventListener('click', () => {
                startAnalysis(true);
            });

            return true;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', insertBox);
        } else {
            if (!insertBox()) {
                const observer = new MutationObserver(() => {
                    if (insertBox()) {
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => observer.disconnect(), 5000);
            }
        }

        console.log('[KEES] User forum activity initialized for', userInfo.username);
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.userForumActivity = {
        init,
        analyzeUserActivity,
        analyzeUserActivityDeep,
        getCachedData,
        clearCachedData
    };

    init();

})();
