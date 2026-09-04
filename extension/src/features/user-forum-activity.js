// features/user-forum-activity.js - Analyze user forum posting activity
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_PREFIX = 'kees-user-forums-';
    // Raw per-post records live under their own key: they are only ever read by the
    // JSON export, so keeping them out of the summary blob keeps every profile view
    // from deserialising thousands of records it will not display.
    const STORAGE_KEY_POSTS_PREFIX = 'kees-user-forum-posts-';
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

    function getPostsStorageKey(userId) {
        return STORAGE_KEY_POSTS_PREFIX + userId;
    }

    async function getCachedData(userId) {
        return new Promise((resolve) => {
            const key = getStorageKey(userId);
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    }

    // Returns the raw post records for a user, or null when the cache predates the
    // export feature (the summary alone cannot be reconstructed back into posts).
    async function getCachedPosts(userId) {
        return new Promise((resolve) => {
            const key = getPostsStorageKey(userId);
            chrome.storage.local.get([key], (result) => {
                const entry = result[key];
                resolve(entry && Array.isArray(entry.posts) ? entry.posts : null);
            });
        });
    }

    async function saveCachedData(userId, data) {
        const { posts, ...summary } = data;
        return new Promise((resolve) => {
            const write = { [getStorageKey(userId)]: summary };
            if (Array.isArray(posts)) {
                write[getPostsStorageKey(userId)] = { timestamp: data.timestamp, posts };
            }
            chrome.storage.local.set(write, resolve);
        });
    }

    async function clearCachedData(userId) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(
                [getStorageKey(userId), getPostsStorageKey(userId)], resolve);
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
                title: titleLink ? titleLink.textContent.trim() : null,
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
        const records = [];
        let totalPosts = 0;
        return {
            add(p) {
                if (p.postUrl) {
                    if (seen.has(p.postUrl)) return;
                    seen.add(p.postUrl);
                }
                records.push(p);
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
                // Newest post first, matching how the search results were walked.
                const posts = records.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                return { totalPosts, forums, timeline, posts };
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
            posts: built.posts,
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
            posts: built.posts,
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

    // Distinct hues for the top forums; everything else collapses into "Other".
    const CHART_FORUM_COLORS = ['#4a9eff', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
    const CHART_OTHER_COLOR = '#6b7280';
    const CHART_MAX_FORUM_SERIES = 6;
    const CHART_MAX_BARS = 60;    // above this the buckets coarsen (day -> week -> month)

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // --- bucketing (the timeline is sparse day buckets; bars need a dense axis) ---

    function weekStart(ts) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d.getTime();
    }

    function monthStart(ts) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        return d.getTime();
    }

    function nextBucketStart(ts, unit) {
        const d = new Date(ts);
        if (unit === 'day') d.setDate(d.getDate() + 1);
        else if (unit === 'week') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        return d.getTime();
    }

    function chooseBucketUnit(minT, maxT) {
        const days = Math.round((maxT - minT) / 86400000) + 1;
        if (days <= CHART_MAX_BARS) return 'day';
        if (Math.ceil(days / 7) <= CHART_MAX_BARS) return 'week';
        return 'month';
    }

    // Roll sparse daily entries up into contiguous buckets, zero-filling the gaps so
    // a quiet stretch reads as empty space rather than being squeezed out.
    function bucketTimeline(timeline, unit) {
        const startOf = unit === 'day' ? dayStart : unit === 'week' ? weekStart : monthStart;
        const map = new Map();
        timeline.forEach(d => {
            const k = startOf(d.t);
            let b = map.get(k);
            if (!b) { b = { t: k, total: 0, forums: {} }; map.set(k, b); }
            b.total += d.total;
            Object.keys(d.forums).forEach(name => {
                b.forums[name] = (b.forums[name] || 0) + d.forums[name];
            });
        });
        const keys = Array.from(map.keys()).sort((a, b) => a - b);
        const out = [];
        const last = keys[keys.length - 1];
        for (let t = keys[0]; t <= last; t = nextBucketStart(t, unit)) {
            out.push(map.get(t) || { t, total: 0, forums: {} });
        }
        return out;
    }

    function formatBucketLabel(ts, unit, withYear) {
        const d = new Date(ts);
        const yy = String(d.getFullYear()).slice(-2);
        if (unit === 'month') return (d.getMonth() + 1) + '/' + yy;
        const base = (d.getMonth() + 1) + '/' + d.getDate();
        return withYear ? base + '/' + yy : base;
    }

    function bucketRangeLabel(ts, unit) {
        const d = new Date(ts);
        if (unit === 'month') {
            return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }
        const start = d.toLocaleDateString();
        if (unit === 'day') return start;
        const end = new Date(nextBucketStart(ts, 'week') - 86400000);
        return `${start} – ${end.toLocaleDateString()}`;
    }

    // Round a raw tick spacing up to the nearest 1/2/5 x 10^n so axis labels stay whole.
    function niceStep(v) {
        if (v <= 1) return 1;
        const pow = Math.pow(10, Math.floor(Math.log10(v)));
        const n = v / pow;
        const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
        return s * pow;
    }

    // Build an inline SVG stacked bar chart: one bar per time bucket, segmented by
    // forum (top forums coloured, the tail merged into "Other"). Self-contained (no
    // external libs) so it satisfies the extension CSP. Returns an HTML string.
    function buildActivityChartHtml(data) {
        const timeline = data.timeline || [];
        if (timeline.length === 0) {
            return `
                <div style="margin-top: 20px; color: #666; font-size: 13px;">
                    Posting-frequency graph unavailable (no post dates were found).
                </div>
            `;
        }

        const unit = chooseBucketUnit(timeline[0].t, timeline[timeline.length - 1].t);
        const buckets = bucketTimeline(timeline, unit);

        const topForums = data.forums.slice(0, CHART_MAX_FORUM_SERIES).map(f => f.name);
        const topSet = new Set(topForums);
        const otherCount = data.forums.length - topForums.length;

        // Series are stacked bottom-up in this order; "Other" always caps the stack.
        const series = topForums.map((name, idx) => ({
            name,
            label: escapeHtml(name),
            color: CHART_FORUM_COLORS[idx % CHART_FORUM_COLORS.length],
            valueAt: b => b.forums[name] || 0
        }));
        if (otherCount > 0) {
            series.push({
                name: '__other__',
                label: `Other (${otherCount} ${otherCount === 1 ? 'forum' : 'forums'})`,
                color: CHART_OTHER_COLOR,
                valueAt: b => Object.keys(b.forums).reduce(
                    (sum, n) => topSet.has(n) ? sum : sum + b.forums[n], 0)
            });
        }

        const W = 800, H = 300;
        const padL = 46, padR = 14, padT = 14, padB = 46;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;

        const maxTotal = buckets.reduce((m, b) => Math.max(m, b.total), 0) || 1;
        const tickStep = niceStep(maxTotal / 4);
        const axisMax = tickStep * Math.ceil(maxTotal / tickStep);
        const yTicks = Math.round(axisMax / tickStep);

        const yFor = v => padT + plotH - (v / axisMax) * plotH;

        const slotW = plotW / buckets.length;
        const barW = Math.max(1, Math.min(slotW - 1, slotW * 0.82));
        const xFor = i => padL + i * slotW + (slotW - barW) / 2;

        // Horizontal gridlines + Y-axis labels.
        let grid = '';
        for (let i = 0; i <= yTicks; i++) {
            const val = tickStep * i;
            const y = yFor(val).toFixed(1);
            grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#333" stroke-width="1"/>`;
            grid += `<text x="${padL - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#888" font-size="11">${val}</text>`;
        }

        // X-axis labels (sample a handful, always include the last bucket).
        const spanMs = buckets[buckets.length - 1].t - buckets[0].t;
        const withYear = spanMs > 365 * 24 * 3600 * 1000;
        const step = Math.max(1, Math.ceil(buckets.length / 7));
        const labelled = new Set();
        for (let i = 0; i < buckets.length; i += step) labelled.add(i);
        labelled.add(buckets.length - 1);
        let xLabels = '';
        Array.from(labelled).sort((a, b) => a - b).forEach(i => {
            const cx = (xFor(i) + barW / 2).toFixed(1);
            xLabels += `<text x="${cx}" y="${H - padB + 18}" text-anchor="middle" fill="#888" font-size="11">${formatBucketLabel(buckets[i].t, unit, withYear)}</text>`;
        });

        // Each bar is a full-height transparent hit area (so the whole column is
        // hoverable, empty ones included) carrying the breakdown tooltip, plus the
        // stacked segments themselves.
        let bars = '';
        buckets.forEach((b, i) => {
            const x = xFor(i).toFixed(2);
            const wid = barW.toFixed(2);

            const parts = series
                .map(s => ({ label: s.name === '__other__' ? 'Other' : s.name, v: s.valueAt(b) }))
                .filter(p => p.v > 0)
                .map(p => `${p.label}: ${p.v}`);
            const tip = escapeHtml(
                `${bucketRangeLabel(b.t, unit)}\n${b.total} ${b.total === 1 ? 'post' : 'posts'}` +
                (parts.length ? '\n' + parts.join('\n') : '')
            );

            bars += `<rect x="${x}" y="${padT}" width="${wid}" height="${plotH}" fill="transparent"><title>${tip}</title></rect>`;

            let acc = 0;
            series.forEach(s => {
                const v = s.valueAt(b);
                if (v <= 0) return;
                const yTop = yFor(acc + v);
                const h = yFor(acc) - yTop;
                acc += v;
                bars += `<rect x="${x}" y="${yTop.toFixed(2)}" width="${wid}" height="${Math.max(0.5, h).toFixed(2)}" fill="${s.color}" pointer-events="none"/>`;
            });
        });

        const baseline = `<line x1="${padL}" y1="${yFor(0).toFixed(1)}" x2="${W - padR}" y2="${yFor(0).toFixed(1)}" stroke="#555" stroke-width="1"/>`;

        function legendItem(color, label) {
            return `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 4px 0;">
                <span style="width:11px;height:11px;background:${color};display:inline-block;border-radius:2px;"></span>
                <span style="color:#ccc;font-size:12px;">${label}</span></span>`;
        }

        // Legend reads top-of-stack first so it matches what the bars look like.
        const legend = series.slice().reverse()
            .map(s => legendItem(s.color, s.label)).join('');

        const unitWord = unit === 'day' ? 'day' : unit === 'week' ? 'week' : 'month';

        return `
            <div style="margin-top: 24px;">
                <div style="font-weight:600;margin-bottom:8px;">
                    Posting Frequency
                    <span style="font-weight:normal;color:#888;font-size:12px;">(posts per ${unitWord}, by forum)</span>
                </div>
                <div style="overflow-x:auto;">
                    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;min-width:520px;height:auto;display:block;">
                        ${grid}
                        ${bars}
                        ${baseline}
                        ${xLabels}
                    </svg>
                </div>
                <div style="margin-top:10px;">${legend}</div>
            </div>
        `;
    }

    // --- JSON export -------------------------------------------------------

    const EXPORT_FORMAT_VERSION = 1;

    // Search-result hrefs are site-relative; absolute URLs survive leaving the page.
    function absoluteUrl(href) {
        if (!href) return null;
        try {
            return new URL(href, window.location.origin).href;
        } catch (e) {
            return href;
        }
    }

    function isoDay(ts) {
        const d = new Date(ts);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    }

    // Display names are user-controlled, so keep only inert characters and refuse
    // to emit leading/repeated dots (hidden files, traversal-looking names).
    function slugForFilename(s) {
        return String(s || 'user')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/\.{2,}/g, '.')
            .replace(/^[.\-]+|[.\-]+$/g, '')
            .slice(0, 60)
            .replace(/^[.\-]+|[.\-]+$/g, '') || 'user';
    }

    // Everything the analysis produced: the run's own parameters, the two aggregates
    // the page renders (forum totals and the daily timeline), and the deduped post
    // records those aggregates were counted from.
    function buildExportPayload(data, posts, userInfo) {
        const analysis = {
            mode: data.mode,
            analyzedAt: new Date(data.timestamp).toISOString(),
            analyzedAtMs: data.timestamp,
            stopReason: data.stopReason || null
        };
        if (data.mode === 'deep') {
            analysis.searchesRun = data.searchesRun;
            analysis.maxSearches = data.maxSearches;
            analysis.windowDays = data.windowDays;
        } else {
            analysis.pagesAnalyzed = data.pagesAnalyzed;
            analysis.maxPages = data.maxPages;
        }

        const payload = {
            exportFormat: EXPORT_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            generatedBy: 'KEES forum activity analysis',
            source: {
                site: window.location.origin,
                userId: data.userId || (userInfo && userInfo.userId) || null,
                displayName: (userInfo && userInfo.displayName) || null,
                profileUrl: absoluteUrl(window.location.pathname)
            },
            analysis,
            // The timeline buckets by local day (the same bucketing the on-page chart
            // uses) while post timestamps are absolute, so re-bucketing postedAtMs in
            // another zone will not always reproduce `timeline` exactly.
            timezone: {
                name: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
                utcOffsetMinutes: -new Date(data.timestamp).getTimezoneOffset()
            },
            totalPosts: data.totalPosts,
            forums: (data.forums || []).map(f => ({ forum: f.name, count: f.count })),
            timeline: (data.timeline || []).map(d => ({
                date: isoDay(d.t),
                dayStartMs: d.t,
                total: d.total,
                forums: d.forums
            }))
        };

        if (posts) {
            payload.posts = posts.map(p => ({
                postedAt: p.timestamp ? new Date(p.timestamp).toISOString() : null,
                postedAtMs: p.timestamp || null,
                forum: p.name,
                forumUrl: absoluteUrl(p.url),
                threadTitle: p.title || null,
                postUrl: absoluteUrl(p.postUrl)
            }));
        } else {
            payload.posts = null;
            payload.postsNote = 'Per-post records were not stored for this cached ' +
                'analysis. Click Refresh to re-run the analysis and capture them.';
        }

        return payload;
    }

    function downloadJson(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoking synchronously can race the download starting in some builds.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    async function exportActivityJson(data, statusEl) {
        const userInfo = currentUserInfo;
        const userId = data.userId || (userInfo && userInfo.userId);
        const posts = userId ? await getCachedPosts(userId) : (data.posts || null);
        const payload = buildExportPayload(data, posts || data.posts || null, userInfo);

        const who = slugForFilename((userInfo && userInfo.displayName) || userId);
        downloadJson(`kees-forum-activity-${who}-${isoDay(Date.now())}.json`, payload);

        if (statusEl) {
            const n = payload.posts ? payload.posts.length : 0;
            statusEl.textContent = payload.posts
                ? `Exported ${n} post ${n === 1 ? 'record' : 'records'}.`
                : 'Exported summary only (re-run the analysis to include post records).';
            statusEl.style.color = payload.posts ? '#2ecc71' : '#e67e22';
            setTimeout(() => { statusEl.textContent = ''; }, 8000);
        }
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
        btnContainer.style.cssText = 'margin-top: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
        btnContainer.innerHTML = `
            <button id="kees-refresh-btn" class="button">
                <span class="button-text">Refresh Analysis</span>
            </button>
            <button id="kees-export-btn" class="button" title="Download the forum totals, daily timeline and raw post records as JSON">
                <span class="button-text">Export JSON</span>
            </button>
            <span id="kees-export-status" style="font-size: 12px; color: #888;"></span>
        `;
        container.appendChild(btnContainer);

        document.getElementById('kees-refresh-btn').addEventListener('click', () => {
            startAnalysis(true);
        });

        document.getElementById('kees-export-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const status = document.getElementById('kees-export-status');
            btn.disabled = true;
            exportActivityJson(data, status)
                .catch(err => {
                    console.error('[KEES] Export failed:', err);
                    if (status) {
                        status.textContent = 'Export failed: ' + err.message;
                        status.style.color = '#e74c3c';
                    }
                })
                .finally(() => { btn.disabled = false; });
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
        getCachedPosts,
        clearCachedData
    };

    init();

})();
