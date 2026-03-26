// features/user-forum-activity.js - Analyze user forum posting activity
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_PREFIX = 'kees-user-forums-';
    const MAX_PAGES_TO_FETCH = 20;
    const FETCH_DELAY = 300;

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

    function extractForumsFromPage(doc) {
        const forums = [];

        const postRows = doc.querySelectorAll('.block-row, .contentRow');
        console.log('[KEES] Found', postRows.length, 'post rows');

        postRows.forEach(row => {
            const listItems = row.querySelectorAll('li');
            listItems.forEach(li => {
                const text = li.textContent.trim();
                if (text.startsWith('Forum:')) {
                    const link = li.querySelector('a[href*="/forums/"]');
                    if (link) {
                        forums.push({
                            name: link.textContent.trim(),
                            url: link.getAttribute('href')
                        });
                    }
                }
            });
        });

        console.log('[KEES] Extracted', forums.length, 'forums from page');
        return forums;
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

    async function analyzeUserActivity(userId, progressCallback) {
        const forumCounts = {};
        let totalPosts = 0;
        let pagesProcessed = 0;

        progressCallback('Starting search...');
        const searchUrl = window.location.origin + getSearchUrl(userId);
        console.log('[KEES] Search URL:', searchUrl);

        {
            let currentUrl = searchUrl;

            while (currentUrl && pagesProcessed < MAX_PAGES_TO_FETCH) {
                pagesProcessed++;
                progressCallback(`Fetching page ${pagesProcessed}...`);

                await delay(FETCH_DELAY);
                const doc = await fetchPage(currentUrl);

                if (!doc) {
                    break;
                }

                const forums = extractForumsFromPage(doc);
                forums.forEach(f => {
                    forumCounts[f.name] = (forumCounts[f.name] || 0) + 1;
                    totalPosts++;
                });

                progressCallback(`Page ${pagesProcessed}: Found ${forums.length} posts with forums (${totalPosts} total)`);

                currentUrl = getNextPageUrl(doc);

                if (currentUrl && !currentUrl.startsWith('http')) {
                    currentUrl = window.location.origin + currentUrl;
                }
            }
        }

        const sortedForums = Object.entries(forumCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        return {
            userId,
            totalPosts,
            pagesAnalyzed: pagesProcessed,
            forums: sortedForums,
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

    function renderResults(data, container) {
        const statusEl = document.getElementById('kees-activity-status');

        if (statusEl) {
            const date = new Date(data.timestamp);
            statusEl.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }

        let html = `
            <div style="margin-bottom: 12px; color: #888; font-size: 13px;">
                Analyzed ${data.totalPosts} posts across ${data.pagesAnalyzed} pages
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
            const data = await analyzeUserActivity(userInfo.userId, updateProgress);
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
        getCachedData,
        clearCachedData
    };

    init();

})();
