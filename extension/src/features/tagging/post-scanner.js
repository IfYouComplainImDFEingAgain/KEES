// features/tagging/post-scanner.js - Passive activity collection.
//
// Always-on, zero extra network requests: as the user browses thread pages, every
// post they load is recorded against the thread's forum in the activity index.
// This is the safe backbone for building the user->forum table without crawling.
//
// Thread pages are accurate (every post belongs to the one forum the thread is in,
// read once from the breadcrumb). Forum index pages only register the forum name
// for the alias editor; they are not counted, since "last poster"/"starter" rows
// would skew real post counts.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    const tagging = SNEED.tagging;
    if (!tagging) return; // tag-store loads first; bail defensively if missing

    const FLUSH_DELAY = 1000;

    function parseForumFromHref(href) {
        const m = href && href.match(/\/forums\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function parseUserFromHref(href) {
        const m = href && href.match(/\/members\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function parseThreadId(path) {
        const m = path.match(/\/threads\/(?:[^.\/]+\.)?(\d+)/);
        return m ? m[1] : null;
    }

    function parsePageNum(path) {
        const m = path.match(/\/page-(\d+)/);
        return m ? parseInt(m[1], 10) : 1;
    }

    // The thread's direct parent forum = the last /forums/ link in the breadcrumb.
    function getThreadForum() {
        const links = document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"]');
        if (!links.length) return null;
        const link = links[links.length - 1];
        const forumId = parseForumFromHref(link.getAttribute('href'));
        if (!forumId) return null;
        return { forumId, name: link.textContent.trim() };
    }

    function getPostId(article) {
        return article.getAttribute('data-content')
            || article.id
            || null;
    }

    // Extract { userId, username } from a post's author block.
    function getPostAuthor(article) {
        const link = article.querySelector('.message-userDetails .username, .message-name .username, a.username[data-user-id]');
        if (link) {
            const userId = link.getAttribute('data-user-id') || parseUserFromHref(link.getAttribute('href'));
            const username = link.textContent.trim() || article.getAttribute('data-author') || '';
            if (userId) return { userId, username };
        }
        // Fallback: guest/legacy posts expose only data-author with no profile link.
        return null;
    }

    const seenPosts = new Set();
    let pending = {};       // userId -> { username, count }
    let flushTimer = null;

    // Persistent dedup: the thread + page we're on, and whether we've already
    // marked this page as counted so we never tally it twice across reloads/visits.
    let currentThreadId = null;
    let currentPage = 1;
    let pageMarked = false;

    function queueFlush(forum) {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flush(forum);
        }, FLUSH_DELAY);
    }

    async function flush(forum) {
        const ids = Object.keys(pending);
        if (!ids.length) return;
        const batch = {};
        for (const userId of ids) {
            const p = pending[userId];
            batch[userId] = {
                username: p.username,
                forums: { [forum.forumId]: { name: forum.name, add: p.count } }
            };
        }
        pending = {};
        try {
            await tagging.applyActivityBatch(batch);
            // Record this page as counted so a reload/revisit won't tally it again.
            if (currentThreadId && !pageMarked) {
                pageMarked = true;
                await tagging.addSeenPage(currentThreadId, currentPage);
            }
        } catch (e) {
            console.error('[KEES] tag activity flush failed:', e);
        }
    }

    function scanThread(forum) {
        const articles = document.querySelectorAll('article.message[data-content], article.message[id^="js-post-"]');
        let added = 0;
        articles.forEach(article => {
            const postId = getPostId(article);
            if (!postId || seenPosts.has(postId)) return;
            seenPosts.add(postId);
            const author = getPostAuthor(article);
            if (!author) return;
            const slot = pending[author.userId] || { username: author.username, count: 0 };
            if (author.username) slot.username = author.username;
            slot.count += 1;
            pending[author.userId] = slot;
            added++;
        });
        if (added) queueFlush(forum);
    }

    async function initThreadPage() {
        const forum = getThreadForum();
        if (!forum) return;
        tagging.ensureForumKnown(forum.forumId, forum.name);

        // Skip counting if this exact thread page was already tallied before.
        currentThreadId = parseThreadId(window.location.pathname);
        currentPage = parsePageNum(window.location.pathname);
        pageMarked = false;
        if (currentThreadId) {
            const seen = await tagging.getSeenPages(currentThreadId);
            if (seen.includes(currentPage)) return;
        }

        scanThread(forum);
        // Posts can load lazily (inline navigation, "show more"); keep scanning.
        const observer = new MutationObserver(() => scanThread(forum));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function initForumPage() {
        // Only register the forum so it appears in the alias editor.
        const links = document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"]');
        const last = links[links.length - 1];
        const here = document.querySelector('.p-title-value');
        const forumId = parseForumFromHref(window.location.pathname);
        if (forumId && here) {
            tagging.ensureForumKnown(forumId, here.textContent.trim());
        } else if (last) {
            const id = parseForumFromHref(last.getAttribute('href'));
            if (id) tagging.ensureForumKnown(id, last.textContent.trim());
        }
    }

    function init() {
        const path = window.location.pathname;
        if (path.includes('/threads/')) {
            initThreadPage();
        } else if (path.includes('/forums/')) {
            initForumPage();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
