// features/user-muting.js - Allows hiding posts from specific users on forum thread pages
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY = 'sneedchat-muted-users';
    const POST_SELECTOR = 'article.message[data-author]';
    const POSTMARK_BUTTON_SELECTOR = '.message-attribution-gadget.hbReact-message-postmark';
    // The postmark gadget is a Kiwi Farms addon element, not stock XenForo, and is
    // not guaranteed to be present - it is absent from some post types and hidden
    // at narrow viewports. Fall back to XenForo's own attribution rows so the
    // button never silently goes missing and leaves no way to mute from a thread.
    const ATTRIBUTION_FALLBACK_SELECTORS = [
        '.message-attribution-opposite',
        '.message-attribution-main'
    ];

    let mutedUsersCache = new Set();

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

    function createMuteButton(username, isMuted) {
        const btn = document.createElement('a');
        btn.className = 'message-attribution-gadget sneed-mute-btn';
        btn.href = '#';
        btn.dataset.username = username;

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

            refreshAllPosts();
        });

        return btn;
    }

    function updateMuteButtonState(btn, isMuted) {
        btn.classList.toggle('sneed-mute-btn--muted', isMuted);
        btn.title = isMuted ? 'Unmute this user' : 'Mute this user';

        const icon = document.createElement('i');
        icon.className = `fa--xf fal ${isMuted ? 'fa-volume-up' : 'fa-volume-mute'} sneed-mute-btn__icon`;

        btn.textContent = '';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(isMuted ? 'Unmute' : 'Mute'));
    }

    // Returns true if the button found a home in this post.
    function insertMuteButton(post, btn) {
        const postmarkBtn = post.querySelector(POSTMARK_BUTTON_SELECTOR);
        if (postmarkBtn && postmarkBtn.parentNode) {
            postmarkBtn.parentNode.insertBefore(btn, postmarkBtn);
            return true;
        }

        for (const selector of ATTRIBUTION_FALLBACK_SELECTORS) {
            const row = post.querySelector(selector);
            if (!row) continue;

            // XenForo's attribution rows are <ul>s, so a bare <a> would be
            // invalid markup there.
            if (row.tagName === 'UL') {
                const item = document.createElement('li');
                item.className = 'sneed-mute-btn-item';
                item.appendChild(btn);
                row.appendChild(item);
            } else {
                row.appendChild(btn);
            }
            return true;
        }

        return false;
    }

    function showToast(message) {
        const existing = document.getElementById('sneed-mute-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'sneed-mute-toast';
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('sneed-mute-toast--out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function processPost(post) {
        const username = post.dataset.author;
        if (!username) return;

        const isMuted = isUserMuted(username);

        let muteBtn = post.querySelector('.sneed-mute-btn');
        if (!muteBtn) {
            muteBtn = createMuteButton(username, isMuted);
            if (!insertMuteButton(post, muteBtn)) {
                muteBtn = null;
            }
        } else {
            updateMuteButtonState(muteBtn, isMuted);
        }

        if (isMuted) {
            if (!post.dataset.sneedMuted) {
                post.dataset.sneedMuted = 'true';
                post.dataset.sneedOriginalDisplay = post.style.display || '';

                const placeholder = document.createElement('div');
                placeholder.className = 'sneed-muted-placeholder';

                const icon = document.createElement('i');
                icon.className = 'fa--xf fal fa-volume-mute';

                // Built node-by-node rather than with innerHTML: `username` comes
                // straight off the post's data-author attribute.
                const label = document.createElement('span');
                const name = document.createElement('strong');
                name.className = 'sneed-muted-placeholder__name';
                name.textContent = username;
                label.appendChild(document.createTextNode('Post by '));
                label.appendChild(name);
                label.appendChild(document.createTextNode(' (muted)'));

                const reveal = document.createElement('span');
                reveal.className = 'sneed-muted-placeholder__reveal';
                reveal.textContent = 'Click to reveal';

                placeholder.appendChild(icon);
                placeholder.appendChild(label);
                placeholder.appendChild(reveal);

                placeholder.addEventListener('click', () => {
                    post.style.display = post.dataset.sneedOriginalDisplay;
                    placeholder.style.display = 'none';
                });

                post.parentNode.insertBefore(placeholder, post);
                post.style.display = 'none';
            }
        } else {
            if (post.dataset.sneedMuted) {
                delete post.dataset.sneedMuted;
                post.style.display = post.dataset.sneedOriginalDisplay || '';
                delete post.dataset.sneedOriginalDisplay;

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
        const posts = document.querySelectorAll(POST_SELECTOR);
        posts.forEach(post => {
            const username = post.dataset.author;
            if (!username) return;

            const isMuted = isUserMuted(username);
            const muteBtn = post.querySelector('.sneed-mute-btn');

            if (muteBtn) {
                updateMuteButtonState(muteBtn, isMuted);
            }

            if (isMuted && !post.dataset.sneedMuted) {
                processPost(post);
            } else if (!isMuted && post.dataset.sneedMuted) {
                processPost(post);
            }
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

        const users = await getMutedUsers();
        mutedUsersCache = new Set(users);

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
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                mutedUsersCache = new Set(changes[STORAGE_KEY].newValue || []);
                refreshAllPosts();
            }
        });

        console.log('[SNEED] User muting initialized');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.userMuting = {
        init,
        getMutedUsers,
        addMutedUser,
        removeMutedUser,
        isUserMuted
    };

    init();

})();
