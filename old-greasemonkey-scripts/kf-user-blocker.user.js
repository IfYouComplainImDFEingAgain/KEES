// ==UserScript==
// @name         Kiwifarms User Post Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide posts from specific users on Kiwifarms forums
// @author
// @match        https://kiwifarms.st/*
// @match        https://kiwifarms.tw/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'kf_blocked_users';
    const DEBUG = false;

    // CSS styles
    GM_addStyle(`
        .kf-content-hidden .message-content,
        .kf-content-hidden .message-footer,
        .kf-content-hidden .message-cell--user,
        .kf-content-hidden .message-attribution-main,
        .kf-content-hidden .reactionsBar,
        .kf-content-hidden .js-reactionsList,
        .kf-content-hidden .hbReact-message-postmark,
        .kf-content-hidden .bookmarkLink,
        .kf-content-hidden [data-xf-init="share-tooltip"] {
            display: none !important;
        }

        .kf-content-hidden {
            background: #1a1a1a;
            border: 1px solid #333;
        }

        .kf-hidden-notice {
            color: #888;
            font-size: 12px;
            font-style: italic;
        }

        .kf-block-user-btn {
            color: #888;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }

        .kf-block-user-btn:hover {
            color: #c00;
        }

        .kf-block-user-btn.kf-user-blocked {
            color: #c00;
        }

        .kf-block-user-btn.kf-user-blocked:hover {
            color: #0a6;
        }

        .kf-block-user-btn i {
            font-size: 14px;
        }

        .kf-blocker-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2a2a2a;
            border: 2px solid #444;
            border-radius: 6px;
            padding: 15px;
            z-index: 10000;
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        .kf-blocker-panel h3 {
            margin: 0 0 10px 0;
            color: #fff;
            font-size: 16px;
        }

        .kf-blocker-panel input {
            width: 100%;
            padding: 6px;
            margin-bottom: 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            color: #fff;
            border-radius: 3px;
        }

        .kf-blocker-panel button {
            padding: 6px 12px;
            margin-right: 5px;
            background: #444;
            color: #fff;
            border: 1px solid #666;
            border-radius: 3px;
            cursor: pointer;
        }

        .kf-blocker-panel button:hover {
            background: #555;
        }

        .kf-blocked-list {
            max-height: 200px;
            overflow-y: auto;
            margin-top: 10px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 3px;
            padding: 8px;
        }

        .kf-blocked-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            color: #ccc;
            font-size: 13px;
        }

        .kf-unblock-btn {
            background: #0a6;
            padding: 2px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            border: none;
            color: #fff;
        }

        .kf-unblock-btn:hover {
            background: #0c8;
        }

        .kf-toggle-panel-btn {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2a2a2a;
            color: #fff;
            border: 2px solid #444;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 9999;
            font-size: 13px;
        }

        .kf-toggle-panel-btn:hover {
            background: #333;
        }

        .kf-close-panel {
            float: right;
            background: #8b0000;
            border: none;
            color: #fff;
            cursor: pointer;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
        }

        .kf-close-panel:hover {
            background: #a00;
        }
    `);

    // Blocked users management
    class BlockedUsers {
        constructor() {
            this.users = this.load();
        }

        load() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.error('[KF Blocker] Error loading blocked users:', e);
                return [];
            }
        }

        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
            } catch (e) {
                console.error('[KF Blocker] Error saving blocked users:', e);
            }
        }

        add(username) {
            if (!username || this.users.includes(username)) return false;
            this.users.push(username);
            this.save();
            return true;
        }

        remove(username) {
            const index = this.users.indexOf(username);
            if (index === -1) return false;
            this.users.splice(index, 1);
            this.save();
            return true;
        }

        isBlocked(username) {
            return this.users.includes(username);
        }

        getAll() {
            return [...this.users];
        }
    }

    const blockedUsers = new BlockedUsers();

    // Hide a post
    function hidePost(postElement) {
        const author = postElement.getAttribute('data-author');
        if (!author || postElement.classList.contains('kf-content-hidden')) return;

        if (DEBUG) console.log('[KF Blocker] Hiding post from:', author);

        // Add class to hide content but keep header visible
        postElement.classList.add('kf-content-hidden');

        // Add notice if not already present
        if (!postElement.querySelector('.kf-hidden-notice')) {
            const header = postElement.querySelector('.message-attribution');
            if (header) {
                const actionsList = header.querySelector('.message-attribution-opposite');
                if (actionsList) {
                    const noticeLi = document.createElement('li');
                    const notice = document.createElement('span');
                    notice.className = 'kf-hidden-notice';
                    notice.textContent = `Post from ${author} hidden`;
                    noticeLi.appendChild(notice);
                    // Insert at the beginning of the list
                    actionsList.insertBefore(noticeLi, actionsList.firstChild);
                }
            }
        }
    }

    // Add block button to posts
    function addBlockButton(postElement) {
        const author = postElement.getAttribute('data-author');
        if (!author) return;

        const header = postElement.querySelector('.message-attribution');
        if (!header) return;

        // Check if button already exists and update it
        let blockBtn = postElement.querySelector('.kf-block-user-btn');
        const isBlocked = blockedUsers.isBlocked(author);

        if (blockBtn) {
            // Update existing button
            if (isBlocked) {
                blockBtn.classList.add('kf-user-blocked');
                blockBtn.setAttribute('aria-label', `Unblock ${author}`);
                blockBtn.title = `Unblock ${author}`;
            } else {
                blockBtn.classList.remove('kf-user-blocked');
                blockBtn.setAttribute('aria-label', `Block ${author}`);
                blockBtn.title = `Block all posts from ${author}`;
            }
            return;
        }

        // Create new button
        blockBtn = document.createElement('a');
        blockBtn.className = 'kf-block-user-btn message-attribution-gadget';
        blockBtn.href = '#';
        blockBtn.innerHTML = '<i class="fa--xf fal fa-ban"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><use href="/data/local/icons/light.svg#ban"></use></svg></i>';

        if (isBlocked) {
            blockBtn.classList.add('kf-user-blocked');
            blockBtn.setAttribute('aria-label', `Unblock ${author}`);
            blockBtn.title = `Unblock ${author}`;
        } else {
            blockBtn.setAttribute('aria-label', `Block ${author}`);
            blockBtn.title = `Block all posts from ${author}`;
        }

        blockBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentlyBlocked = blockedUsers.isBlocked(author);

            if (currentlyBlocked) {
                if (confirm(`Unblock "${author}"?`)) {
                    blockedUsers.remove(author);
                    processAllPosts();
                    updatePanel();
                }
            } else {
                if (confirm(`Block all posts from "${author}"?`)) {
                    blockedUsers.add(author);
                    processAllPosts();
                    updatePanel();
                }
            }
        });

        // Add to the message attribution area, between bookmark and post number
        const actionsList = header.querySelector('.message-attribution-opposite');
        if (actionsList) {
            const li = document.createElement('li');
            li.appendChild(blockBtn);

            // Find the post number li (contains link with rel="nofollow" and starts with #)
            const listItems = actionsList.querySelectorAll('li');
            let postNumberLi = null;

            for (let i = 0; i < listItems.length; i++) {
                const link = listItems[i].querySelector('a[rel="nofollow"]');
                if (link && link.textContent.trim().startsWith('#')) {
                    postNumberLi = listItems[i];
                    break;
                }
            }

            if (postNumberLi) {
                actionsList.insertBefore(li, postNumberLi);
            } else {
                actionsList.appendChild(li);
            }
        }
    }

    // Process all posts on the page
    function processAllPosts() {
        const posts = document.querySelectorAll('article.message--post[data-author]');
        if (DEBUG) console.log('[KF Blocker] Processing', posts.length, 'posts');

        posts.forEach(post => {
            const author = post.getAttribute('data-author');

            if (blockedUsers.isBlocked(author)) {
                hidePost(post);
            } else {
                // Unhide if they were unblocked
                if (post.classList.contains('kf-content-hidden')) {
                    post.classList.remove('kf-content-hidden');
                    const notice = post.querySelector('.kf-hidden-notice');
                    if (notice && notice.parentElement) {
                        notice.parentElement.remove(); // Remove the <li> element
                    }
                }
            }

            // Always add/update block button
            addBlockButton(post);
        });
    }

    // Create control panel
    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'kf-blocker-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <h3>
                User Blocker
                <button class="kf-close-panel">Close</button>
            </h3>
            <input type="text" id="kf-block-input" placeholder="Enter username to block">
            <div>
                <button id="kf-add-block">Block User</button>
            </div>
            <div class="kf-blocked-list" id="kf-blocked-list"></div>
        `;

        document.body.appendChild(panel);

        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'kf-toggle-panel-btn';
        toggleBtn.textContent = 'User Blocker';
        document.body.appendChild(toggleBtn);

        // Event listeners
        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') {
                updatePanel();
            }
        });

        panel.querySelector('.kf-close-panel').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        panel.querySelector('#kf-add-block').addEventListener('click', () => {
            const input = panel.querySelector('#kf-block-input');
            const username = input.value.trim();
            if (username && blockedUsers.add(username)) {
                input.value = '';
                processAllPosts();
                updatePanel();
            }
        });

        panel.querySelector('#kf-block-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                panel.querySelector('#kf-add-block').click();
            }
        });

        return panel;
    }

    // Update panel with current blocked users
    function updatePanel() {
        const listEl = document.getElementById('kf-blocked-list');
        if (!listEl) return;

        const users = blockedUsers.getAll();
        if (users.length === 0) {
            listEl.innerHTML = '<div style="color: #666; font-style: italic;">No blocked users</div>';
            return;
        }

        listEl.innerHTML = users.map(user => `
            <div class="kf-blocked-item">
                <span>${user}</span>
                <button class="kf-unblock-btn" data-user="${user}">Unblock</button>
            </div>
        `).join('');

        // Add unblock handlers
        listEl.querySelectorAll('.kf-unblock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = btn.getAttribute('data-user');
                if (blockedUsers.remove(user)) {
                    processAllPosts();
                    updatePanel();
                }
            });
        });
    }

    // Initialize when DOM is ready
    function init() {
        if (DEBUG) console.log('[KF Blocker] Initializing...');

        createPanel();
        processAllPosts();

        // Watch for new posts (infinite scroll, etc.)
        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (
                        node.matches('article.message--post[data-author]') ||
                        node.querySelector('article.message--post[data-author]')
                    )) {
                        shouldProcess = true;
                    }
                });
            });
            if (shouldProcess) {
                if (DEBUG) console.log('[KF Blocker] New posts detected, reprocessing...');
                processAllPosts();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[KF Blocker] Initialized. Blocked users:', blockedUsers.getAll().length);
    }

    // Wait for page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
