/**
 * features/user-muting.js - User muting functionality
 * Allows hiding posts from specific users on forum thread pages.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    // ============================================
    // CONFIGURATION
    // ============================================

    const STORAGE_KEY = 'sneedchat-muted-users';
    const POST_SELECTOR = 'article.message[data-author]';
    const POSTMARK_BUTTON_SELECTOR = '.message-attribution-gadget.hbReact-message-postmark';

    // Cache of muted users for synchronous checks
    let mutedUsersCache = new Set();

    // ============================================
    // STORAGE
    // ============================================

    async function getMutedUsers() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const users = result[STORAGE_KEY] || [];
                resolve(users);
            });
        });
    }

    async function addMutedUser(username) {
        const users = await getMutedUsers();
        if (!users.includes(username)) {
            users.push(username);
            await saveMutedUsers(users);
        }
        return users;
    }

    async function removeMutedUser(username) {
        let users = await getMutedUsers();
        users = users.filter(u => u !== username);
        await saveMutedUsers(users);
        return users;
    }

    async function saveMutedUsers(users) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEY]: users }, () => {
                mutedUsersCache = new Set(users);
                resolve();
            });
        });
    }

    function isUserMuted(username) {
        return mutedUsersCache.has(username);
    }

    // ============================================
    // UI: MUTE BUTTON
    // ============================================

    function createMuteButton(username, isMuted) {
        const btn = document.createElement('a');
        btn.className = 'message-attribution-gadget sneed-mute-btn';
        btn.href = '#';
        btn.dataset.username = username;
        btn.style.cssText = `
            margin-right: 4px;
            padding: 2px 6px;
            font-size: 11px;
            border-radius: 3px;
            text-decoration: none;
            transition: all 0.15s ease;
        `;

        updateMuteButtonState(btn, isMuted);

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const currentlyMuted = isUserMuted(username);

            if (currentlyMuted) {
                await removeMutedUser(username);
                showToast(`Unmuted ${username}`);
            } else {
                await addMutedUser(username);
                showToast(`Muted ${username}`);
            }

            // Update all mute buttons and post visibility
            refreshAllPosts();
        });

        return btn;
    }

    function updateMuteButtonState(btn, isMuted) {
        if (isMuted) {
            btn.innerHTML = '<i class="fa--xf fal fa-volume-up" style="margin-right: 3px;"></i>Unmute';
            btn.style.background = '#4a4a4a';
            btn.style.color = '#fff';
            btn.title = 'Unmute this user';
        } else {
            btn.innerHTML = '<i class="fa--xf fal fa-volume-mute" style="margin-right: 3px;"></i>Mute';
            btn.style.background = '#2a2a2a';
            btn.style.color = '#888';
            btn.title = 'Mute this user';
        }
    }

    // ============================================
    // UI: TOAST NOTIFICATION
    // ============================================

    function showToast(message) {
        // Remove existing toast
        const existing = document.getElementById('sneed-mute-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'sneed-mute-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: #fff;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: sneed-toast-in 0.3s ease;
        `;

        // Add animation keyframes if not already present
        if (!document.getElementById('sneed-mute-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'sneed-mute-toast-styles';
            style.textContent = `
                @keyframes sneed-toast-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes sneed-toast-out {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(20px); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'sneed-toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // ============================================
    // POST PROCESSING
    // ============================================

    function processPost(post) {
        const username = post.dataset.author;
        if (!username) return;

        const isMuted = isUserMuted(username);

        // Add/update mute button
        let muteBtn = post.querySelector('.sneed-mute-btn');
        if (!muteBtn) {
            // Find the postmark button to insert before
            const postmarkBtn = post.querySelector(POSTMARK_BUTTON_SELECTOR);
            if (postmarkBtn) {
                muteBtn = createMuteButton(username, isMuted);
                postmarkBtn.parentNode.insertBefore(muteBtn, postmarkBtn);
            }
        } else {
            updateMuteButtonState(muteBtn, isMuted);
        }

        // Hide/show the post based on mute status
        if (isMuted) {
            if (!post.dataset.sneedMuted) {
                post.dataset.sneedMuted = 'true';
                post.dataset.sneedOriginalDisplay = post.style.display || '';

                // Create collapsed placeholder
                const placeholder = document.createElement('div');
                placeholder.className = 'sneed-muted-placeholder';
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
                    <i class="fa--xf fal fa-volume-mute"></i>
                    <span>Post by <strong style="color: #888;">${username}</strong> (muted)</span>
                    <span style="margin-left: auto; color: #555; font-size: 11px;">Click to reveal</span>
                `;

                placeholder.addEventListener('click', () => {
                    post.style.display = post.dataset.sneedOriginalDisplay;
                    placeholder.style.display = 'none';
                });

                post.parentNode.insertBefore(placeholder, post);
                post.style.display = 'none';
            }
        } else {
            // Unmuted - restore post visibility
            if (post.dataset.sneedMuted) {
                delete post.dataset.sneedMuted;
                post.style.display = post.dataset.sneedOriginalDisplay || '';
                delete post.dataset.sneedOriginalDisplay;

                // Remove placeholder
                const placeholder = post.previousElementSibling;
                if (placeholder && placeholder.classList.contains('sneed-muted-placeholder')) {
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
        // Update all mute buttons and post visibility
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(post => {
            const username = post.dataset.author;
            if (!username) return;

            const isMuted = isUserMuted(username);
            const muteBtn = post.querySelector('.sneed-mute-btn');

            if (muteBtn) {
                updateMuteButtonState(muteBtn, isMuted);
            }

            // Update visibility
            if (isMuted && !post.dataset.sneedMuted) {
                processPost(post);
            } else if (!isMuted && post.dataset.sneedMuted) {
                processPost(post);
            }
        });
    }

    // ============================================
    // MUTATION OBSERVER
    // ============================================

    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(POST_SELECTOR)) {
                            processPost(node);
                        }
                        // Check children
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

    // ============================================
    // INITIALIZATION
    // ============================================

    async function init() {
        // Only run on thread pages
        if (!window.location.pathname.includes('/threads/')) {
            return;
        }

        // Load muted users into cache
        const users = await getMutedUsers();
        mutedUsersCache = new Set(users);

        // Process existing posts
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                processAllPosts();
                setupObserver();
            });
        } else {
            processAllPosts();
            setupObserver();
        }

        // Listen for storage changes (from popup or other tabs)
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                mutedUsersCache = new Set(changes[STORAGE_KEY].newValue || []);
                refreshAllPosts();
            }
        });

        console.log('[SNEED] User muting initialized');
    }

    // Export
    SNEED.features = SNEED.features || {};
    SNEED.features.userMuting = {
        init,
        getMutedUsers,
        addMutedUser,
        removeMutedUser,
        isUserMuted
    };

    // Auto-init
    init();

})();
