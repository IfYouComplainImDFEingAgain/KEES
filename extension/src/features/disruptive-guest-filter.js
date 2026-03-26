// features/disruptive-guest-filter.js - Hide posts from users marked as "Disruptive Guest"
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY = 'kees-mute-disruptive-guests';
    const POST_SELECTOR = 'article.message';
    const DISRUPTIVE_ICON_SELECTOR = 'i.disruptive-user';

    let muteDisruptiveGuests = false;

    let contextValid = true;

    function isExtensionContextValid() {
        try {
            return contextValid && chrome.runtime && !!chrome.runtime.id;
        } catch (e) {
            contextValid = false;
            return false;
        }
    }

    async function loadSetting() {
        if (!isExtensionContextValid()) return false;

        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        contextValid = false;
                        resolve(false);
                        return;
                    }
                    muteDisruptiveGuests = result[STORAGE_KEY] === true;
                    resolve(muteDisruptiveGuests);
                });
            } catch (e) {
                contextValid = false;
                resolve(false);
            }
        });
    }

    function isDisruptiveGuest(post) {
        return post.querySelector(DISRUPTIVE_ICON_SELECTOR) !== null;
    }

    function processPost(post) {
        if (!isDisruptiveGuest(post)) return;

        if (muteDisruptiveGuests) {
            if (!post.dataset.keesDisruptiveHidden) {
                post.dataset.keesDisruptiveHidden = 'true';
                post.dataset.keesOriginalDisplay = post.style.display || '';

                const placeholder = document.createElement('div');
                placeholder.className = 'kees-disruptive-placeholder';
                placeholder.style.cssText = `
                    padding: 12px 16px;
                    background: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    color: #666;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;
                placeholder.innerHTML = `
                    <i class="fa fa-triangle fa-rotate-180" style="color: #f39c12;"></i>
                    <span>Post by <strong style="color: #888;">Disruptive Guest</strong> (hidden)</span>
                    <span style="margin-left: auto; color: #555; font-size: 11px;">Click to reveal</span>
                `;

                placeholder.addEventListener('click', () => {
                    post.style.display = post.dataset.keesOriginalDisplay;
                    placeholder.style.display = 'none';
                });

                post.parentNode.insertBefore(placeholder, post);
                post.style.display = 'none';
            }
        } else {
            if (post.dataset.keesDisruptiveHidden) {
                delete post.dataset.keesDisruptiveHidden;
                post.style.display = post.dataset.keesOriginalDisplay || '';
                delete post.dataset.keesOriginalDisplay;

                const placeholder = post.previousElementSibling;
                if (placeholder && placeholder.classList.contains('kees-disruptive-placeholder')) {
                    placeholder.remove();
                }
            }
        }
    }

    function processAllPosts() {
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(processPost);
    }

    function refreshAllPosts() {
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(post => {
            if (isDisruptiveGuest(post)) {
                if (muteDisruptiveGuests && !post.dataset.keesDisruptiveHidden) {
                    processPost(post);
                } else if (!muteDisruptiveGuests && post.dataset.keesDisruptiveHidden) {
                    processPost(post);
                }
            }
        });
    }

    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            if (!muteDisruptiveGuests) return;

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

        if (!isExtensionContextValid()) return;

        await loadSetting();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                processAllPosts();
                setupObserver();
            });
        } else {
            processAllPosts();
            setupObserver();
        }

        try {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (!isExtensionContextValid()) return;
                if (areaName === 'local' && changes[STORAGE_KEY]) {
                    muteDisruptiveGuests = changes[STORAGE_KEY].newValue === true;
                    refreshAllPosts();
                }
            });
        } catch (e) {
            contextValid = false;
        }

        console.log('[KEES] Disruptive guest filter initialized');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.disruptiveGuestFilter = {
        init,
        processAllPosts,
        refreshAllPosts
    };

    init();

})();
