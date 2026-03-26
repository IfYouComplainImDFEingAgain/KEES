// features/reaction-filter.js - Auto-hide posts with high negative reaction ratio
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-reaction-filter-enabled';
    const STORAGE_KEY_MIN_REACTS = 'kees-reaction-filter-min-reacts';
    const STORAGE_KEY_BAD_THRESHOLD = 'kees-reaction-filter-bad-threshold';

    const NEGATIVE_REACTIONS = new Set([16, 17, 29, 14, 3]);
    const POSITIVE_REACTIONS = new Set([1, 2, 5, 26, 6, 7, 31, 22]);
    // All others are neutral and don't count

    const POST_SELECTOR = 'article.message';
    const REACTIONS_SELECTOR = 'ul.reactPlusSummary';
    const REACTION_ITEM_SELECTOR = 'span.reaction[data-reaction-id]';

    const DEFAULT_MIN_REACTS = 5;
    const DEFAULT_BAD_THRESHOLD = 50;

    let filterEnabled = false;
    let minReactsThreshold = DEFAULT_MIN_REACTS;
    let badReactThreshold = DEFAULT_BAD_THRESHOLD;

    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                STORAGE_KEY_ENABLED,
                STORAGE_KEY_MIN_REACTS,
                STORAGE_KEY_BAD_THRESHOLD
            ], (result) => {
                filterEnabled = result[STORAGE_KEY_ENABLED] === true;
                minReactsThreshold = result[STORAGE_KEY_MIN_REACTS] ?? DEFAULT_MIN_REACTS;
                badReactThreshold = result[STORAGE_KEY_BAD_THRESHOLD] ?? DEFAULT_BAD_THRESHOLD;
                resolve();
            });
        });
    }

    function analyzePostReactions(post) {
        const reactionsContainer = post.querySelector(REACTIONS_SELECTOR);
        if (!reactionsContainer) {
            return { positive: 0, negative: 0, total: 0, badPercentage: 0 };
        }

        let positive = 0;
        let negative = 0;

        const reactionLinks = reactionsContainer.querySelectorAll('a.reactionsBar-link');

        reactionLinks.forEach(link => {
            const reactionSpan = link.querySelector(REACTION_ITEM_SELECTOR);
            if (!reactionSpan) return;

            const reactionId = parseInt(reactionSpan.dataset.reactionId, 10);

            const linkText = link.textContent.trim();
            const countMatch = linkText.match(/(\d+)\s*$/);
            const count = countMatch ? parseInt(countMatch[1], 10) : 1;

            if (NEGATIVE_REACTIONS.has(reactionId)) {
                negative += count;
            } else if (POSITIVE_REACTIONS.has(reactionId)) {
                positive += count;
            }
        });

        const total = positive + negative;
        const badPercentage = total > 0 ? (negative / total) * 100 : 0;

        return { positive, negative, total, badPercentage };
    }

    function shouldHidePost(post) {
        if (!filterEnabled) return false;

        const stats = analyzePostReactions(post);
        if (stats.total < minReactsThreshold) return false;

        return stats.badPercentage >= badReactThreshold;
    }

    function processPost(post) {
        if (post.dataset.sneedMuted) return;

        const shouldHide = shouldHidePost(post);
        const isHidden = post.dataset.keesReactionHidden === 'true';

        if (shouldHide && !isHidden) {
            hidePost(post);
        } else if (!shouldHide && isHidden) {
            showPost(post);
        }
    }

    function hidePost(post) {
        const stats = analyzePostReactions(post);
        const author = post.dataset.author || 'Unknown';

        post.dataset.keesReactionHidden = 'true';
        post.dataset.keesOriginalDisplay = post.style.display || '';

        const placeholder = document.createElement('div');
        placeholder.className = 'kees-reaction-placeholder';
        placeholder.style.cssText = `
            padding: 12px 16px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2a1a1a 100%);
            border: 1px solid #442222;
            border-radius: 4px;
            margin-bottom: 8px;
            color: #666;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const badPct = stats.badPercentage.toFixed(0);
        placeholder.innerHTML = `
            <i class="fa--xf fal fa-thumbs-down" style="color: #884444;"></i>
            <span>Post by <strong style="color: #888;">${author}</strong></span>
            <span style="color: #884444; font-size: 11px;">(${badPct}% negative, ${stats.negative}/${stats.total} reacts)</span>
            <span style="margin-left: auto; color: #555; font-size: 11px;">Click to reveal</span>
        `;

        placeholder.addEventListener('click', () => {
            post.style.display = post.dataset.keesOriginalDisplay;
            placeholder.style.display = 'none';
        });

        post.parentNode.insertBefore(placeholder, post);
        post.style.display = 'none';
    }

    function showPost(post) {
        if (post.dataset.keesReactionHidden !== 'true') return;

        delete post.dataset.keesReactionHidden;
        post.style.display = post.dataset.keesOriginalDisplay || '';
        delete post.dataset.keesOriginalDisplay;

        const placeholder = post.previousElementSibling;
        if (placeholder && placeholder.classList.contains('kees-reaction-placeholder')) {
            placeholder.remove();
        }
    }

    function processAllPosts() {
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(processPost);
    }

    function refreshAllPosts() {
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(post => {
            if (post.dataset.keesReactionHidden === 'true') {
                showPost(post);
            }
            processPost(post);
        });
    }

    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(POST_SELECTOR)) {
                            processPost(node);
                        }
                        const posts = node.querySelectorAll ? node.querySelectorAll(POST_SELECTOR) : [];
                        posts.forEach(processPost);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    async function init() {
        if (!window.location.pathname.includes('/threads/')) {
            return;
        }

        await loadSettings();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                processAllPosts();
                setupObserver();
            });
        } else {
            processAllPosts();
            setupObserver();
        }

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local') {
                let needsRefresh = false;

                if (changes[STORAGE_KEY_ENABLED] !== undefined) {
                    filterEnabled = changes[STORAGE_KEY_ENABLED].newValue === true;
                    needsRefresh = true;
                }
                if (changes[STORAGE_KEY_MIN_REACTS] !== undefined) {
                    minReactsThreshold = changes[STORAGE_KEY_MIN_REACTS].newValue ?? DEFAULT_MIN_REACTS;
                    needsRefresh = true;
                }
                if (changes[STORAGE_KEY_BAD_THRESHOLD] !== undefined) {
                    badReactThreshold = changes[STORAGE_KEY_BAD_THRESHOLD].newValue ?? DEFAULT_BAD_THRESHOLD;
                    needsRefresh = true;
                }

                if (needsRefresh) {
                    refreshAllPosts();
                }
            }
        });

        console.log('[KEES] Reaction filter initialized');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.reactionFilter = {
        init,
        analyzePostReactions,
        processAllPosts,
        refreshAllPosts
    };

    init();

})();
