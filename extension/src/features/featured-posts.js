/**
 * features/featured-posts.js - Featured post consolidation
 * Walks pages forward/backward to collect and display featured posts.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    // ============================================
    // CONFIGURATION
    // ============================================

    const DEFAULT_PAGES_FORWARD = 10;
    const DEFAULT_PAGES_BACKWARD = 10;
    // Featured posts have the award icon (fa-award), not the highlighter icon
    // They also have aria-label="Feature" instead of "xf_hb_feature"
    const FEATURED_POST_SELECTOR = 'a.hbReact-message-postmark[aria-label="Feature"]';
    const POST_SELECTOR = 'article.message';

    // ============================================
    // URL/PAGE UTILITIES
    // ============================================

    function getCurrentPageInfo() {
        const url = window.location.href;
        const pageMatch = url.match(/\/page-(\d+)/);
        const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;

        // Get thread base URL (without page number)
        const baseUrl = url.replace(/\/page-\d+/, '').replace(/#.*$/, '');

        // Get max page from pagination
        const lastPageLink = document.querySelector('.pageNav-page:last-child a');
        const maxPage = lastPageLink ? parseInt(lastPageLink.textContent, 10) : currentPage;

        return { currentPage, baseUrl, maxPage };
    }

    function getPageUrl(baseUrl, pageNum) {
        if (pageNum === 1) {
            return baseUrl;
        }
        // Insert page number before any query string or hash
        const urlParts = baseUrl.split('?');
        const basePart = urlParts[0].replace(/\/$/, '');
        const queryPart = urlParts[1] ? '?' + urlParts[1] : '';
        return `${basePart}/page-${pageNum}${queryPart}`;
    }

    // ============================================
    // FETCH AND PARSE
    // ============================================

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
            console.error(`[SNEED] Failed to fetch ${url}:`, e);
            return null;
        }
    }

    function extractFeaturedPosts(doc, pageNum, pageUrl) {
        const posts = [];
        const postElements = doc.querySelectorAll(POST_SELECTOR);

        postElements.forEach(post => {
            const featuredBadge = post.querySelector(FEATURED_POST_SELECTOR);
            if (featuredBadge) {
                // Clone the post element
                const postClone = post.cloneNode(true);

                // Add page info
                postClone.dataset.sourcePage = pageNum;
                postClone.dataset.sourceUrl = pageUrl;

                posts.push({
                    element: postClone,
                    pageNum: pageNum,
                    pageUrl: pageUrl,
                    postId: post.dataset.content || post.id
                });
            }
        });

        return posts;
    }

    // ============================================
    // UI: CONSOLIDATION BUTTON
    // ============================================

    function addConsolidationButton() {
        // Find the "Next" button
        const nextButton = document.querySelector('.pageNav-jump--next');
        if (!nextButton || document.getElementById('sneed-featured-btn')) {
            return;
        }

        const btn = document.createElement('a');
        btn.id = 'sneed-featured-btn';
        btn.className = 'pageNav-jump';
        btn.href = '#';
        btn.innerHTML = '<i class="fa--xf fal fa-award" style="margin-right: 4px;"></i> Featured';
        btn.title = 'Consolidate featured posts from nearby pages';
        btn.style.cssText = `
            background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
            color: #000;
            font-weight: 600;
            margin-left: 8px;
            padding: 6px 12px;
            border-radius: 4px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        `;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showConsolidationDialog();
        });

        // Insert after Next button
        nextButton.parentNode.insertBefore(btn, nextButton.nextSibling);
    }

    // ============================================
    // UI: CONSOLIDATION DIALOG
    // ============================================

    function showConsolidationDialog() {
        // Remove existing dialog
        const existing = document.getElementById('sneed-featured-dialog');
        if (existing) existing.remove();

        const { currentPage, maxPage } = getCurrentPageInfo();

        const dialog = document.createElement('div');
        dialog.id = 'sneed-featured-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            min-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #e0e0e0;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #ffd700; font-size: 18px;">
                <i class="fa--xf fal fa-award" style="margin-right: 8px;"></i>
                Consolidate Featured Posts
            </h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #999;">
                Current page: ${currentPage} of ${maxPage}
            </p>
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">Pages backward</label>
                    <input type="number" id="sneed-pages-back" value="${Math.min(DEFAULT_PAGES_BACKWARD, currentPage - 1)}" min="0" max="${currentPage - 1}"
                        style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 14px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">Pages forward</label>
                    <input type="number" id="sneed-pages-fwd" value="${Math.min(DEFAULT_PAGES_FORWARD, maxPage - currentPage)}" min="0" max="${maxPage - currentPage}"
                        style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 14px;">
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="sneed-featured-start" style="
                    flex: 1;
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
                    border: none;
                    border-radius: 4px;
                    color: #000;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                ">Collect Featured Posts</button>
                <button id="sneed-featured-cancel" style="
                    padding: 10px 16px;
                    background: #333;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
            </div>
            <div id="sneed-featured-progress" style="display: none; margin-top: 16px;">
                <div style="background: #333; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div id="sneed-progress-bar" style="background: linear-gradient(90deg, #ffd700, #ff8c00); height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <p id="sneed-progress-text" style="margin: 8px 0 0 0; font-size: 12px; color: #999; text-align: center;"></p>
            </div>
        `;

        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'sneed-featured-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;
        backdrop.addEventListener('click', () => closeDialog());

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);

        // Event handlers
        document.getElementById('sneed-featured-cancel').addEventListener('click', closeDialog);
        document.getElementById('sneed-featured-start').addEventListener('click', () => {
            const pagesBack = parseInt(document.getElementById('sneed-pages-back').value, 10) || 0;
            const pagesFwd = parseInt(document.getElementById('sneed-pages-fwd').value, 10) || 0;
            startConsolidation(pagesBack, pagesFwd);
        });
    }

    function closeDialog() {
        const dialog = document.getElementById('sneed-featured-dialog');
        const backdrop = document.getElementById('sneed-featured-backdrop');
        if (dialog) dialog.remove();
        if (backdrop) backdrop.remove();
    }

    function updateProgress(current, total, text) {
        const progressDiv = document.getElementById('sneed-featured-progress');
        const progressBar = document.getElementById('sneed-progress-bar');
        const progressText = document.getElementById('sneed-progress-text');

        if (progressDiv) progressDiv.style.display = 'block';
        if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
        if (progressText) progressText.textContent = text;
    }

    // ============================================
    // CONSOLIDATION LOGIC
    // ============================================

    async function startConsolidation(pagesBack, pagesFwd) {
        const { currentPage, baseUrl, maxPage } = getCurrentPageInfo();

        // Disable the start button
        const startBtn = document.getElementById('sneed-featured-start');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Collecting...';
        }

        const startPage = Math.max(1, currentPage - pagesBack);
        const endPage = Math.min(maxPage, currentPage + pagesFwd);
        const totalPages = endPage - startPage + 1;

        const allFeaturedPosts = [];
        let pagesProcessed = 0;

        // Process pages sequentially to be nice to the server
        for (let page = startPage; page <= endPage; page++) {
            const pageUrl = getPageUrl(baseUrl, page);
            updateProgress(pagesProcessed, totalPages, `Fetching page ${page}...`);

            let doc;
            if (page === currentPage) {
                // Use current page document
                doc = document;
            } else {
                doc = await fetchPage(pageUrl);
            }

            if (doc) {
                const posts = extractFeaturedPosts(doc, page, pageUrl);
                allFeaturedPosts.push(...posts);
                updateProgress(pagesProcessed + 0.5, totalPages, `Found ${posts.length} featured on page ${page}`);
            }

            pagesProcessed++;
            updateProgress(pagesProcessed, totalPages, `Processed ${pagesProcessed}/${totalPages} pages`);

            // Small delay between requests
            if (page !== endPage && page !== currentPage) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        closeDialog();
        showFeaturedPostsView(allFeaturedPosts, startPage, endPage);
    }

    // ============================================
    // UI: FEATURED POSTS VIEW
    // ============================================

    function showFeaturedPostsView(posts, startPage, endPage) {
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'sneed-featured-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0f0f0f;
            z-index: 10000;
            overflow-y: auto;
            padding: 20px;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            max-width: 1200px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #333;
        `;

        header.innerHTML = `
            <div>
                <h2 style="margin: 0; color: #ffd700; font-size: 20px;">
                    <i class="fa--xf fal fa-award" style="margin-right: 8px;"></i>
                    Featured Posts
                </h2>
                <p style="margin: 8px 0 0 0; color: #888; font-size: 13px;">
                    Found ${posts.length} featured posts from pages ${startPage} to ${endPage}
                </p>
            </div>
            <button id="sneed-close-featured" style="
                padding: 10px 20px;
                background: #333;
                border: 1px solid #444;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
            ">Close</button>
        `;

        overlay.appendChild(header);

        // Posts container
        const postsContainer = document.createElement('div');
        postsContainer.style.cssText = `
            max-width: 1200px;
            margin: 0 auto;
        `;

        if (posts.length === 0) {
            postsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <i class="fa--xf fal fa-search" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                    <p style="font-size: 16px;">No featured posts found in the selected page range.</p>
                </div>
            `;
        } else {
            posts.forEach((post, index) => {
                const postWrapper = document.createElement('div');
                postWrapper.style.cssText = `
                    margin-bottom: 16px;
                    background: #1a1a1a;
                    border-radius: 8px;
                    border: 1px solid #333;
                    overflow: hidden;
                `;

                // Page indicator
                const pageIndicator = document.createElement('div');
                pageIndicator.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.1) 100%);
                    border-bottom: 1px solid #333;
                    font-size: 12px;
                    color: #ffd700;
                `;
                pageIndicator.innerHTML = `
                    <a href="${post.pageUrl}" target="_blank" style="color: #ffd700; text-decoration: none;">
                        Page ${post.pageNum}
                    </a>
                    <span style="color: #666; margin-left: 8px;">• Post #${index + 1}</span>
                `;

                postWrapper.appendChild(pageIndicator);

                // The actual post content
                const postContent = document.createElement('div');
                postContent.className = 'sneed-featured-post-content';
                postContent.appendChild(post.element);
                postWrapper.appendChild(postContent);

                postsContainer.appendChild(postWrapper);
            });
        }

        overlay.appendChild(postsContainer);
        document.body.appendChild(overlay);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Close button handler
        document.getElementById('sneed-close-featured').addEventListener('click', () => {
            overlay.remove();
            document.body.style.overflow = '';
        });

        // Escape key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        // Only run on thread pages
        if (!window.location.pathname.includes('/threads/')) {
            return;
        }

        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addConsolidationButton);
        } else {
            addConsolidationButton();
        }

        console.log('[SNEED] Featured posts consolidation initialized');
    }

    // Export
    SNEED.features = SNEED.features || {};
    SNEED.features.featuredPosts = {
        init,
        addConsolidationButton,
        showConsolidationDialog
    };

    // Auto-init
    init();

})();
