/**
 * features/youtube-titles.js - YouTube video title display in chat
 * Fetches and displays video titles for YouTube links via background script.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    // ============================================
    // CONFIGURATION
    // ============================================

    const YOUTUBE_PATTERNS = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];

    // Cache for video titles
    const titleCache = new Map();

    // Track initialized documents
    const initializedDocs = new WeakSet();

    // ============================================
    // VIDEO ID EXTRACTION
    // ============================================

    function extractVideoId(url) {
        for (const pattern of YOUTUBE_PATTERNS) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    function getVideoUrl(videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // ============================================
    // TITLE FETCHING
    // ============================================

    // Track if extension context is still valid
    let contextValid = true;

    function isExtensionContextValid() {
        try {
            return contextValid && chrome.runtime && !!chrome.runtime.id;
        } catch (e) {
            contextValid = false;
            return false;
        }
    }

    async function fetchVideoTitle(videoUrl) {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            return null;
        }

        // Check cache first
        if (titleCache.has(videoUrl)) {
            return titleCache.get(videoUrl);
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'fetchYouTubeInfo',
                videoUrl: videoUrl
            });

            if (response && response.success) {
                const info = {
                    title: response.title,
                    author: response.author
                };
                titleCache.set(videoUrl, info);
                return info;
            }
        } catch (e) {
            // Check for extension context invalidated error
            if (e.message && e.message.includes('Extension context invalidated')) {
                contextValid = false;
                console.log('[KEES] Extension was reloaded, YouTube titles disabled for this page');
            } else {
                console.error('[KEES] Failed to fetch YouTube title:', e);
            }
        }

        return null;
    }

    // ============================================
    // TITLE DISPLAY CREATION
    // ============================================

    function createTitleDisplay(doc, title, author, videoUrl) {
        const container = doc.createElement('div');
        container.className = 'kees-youtube-title';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
            border: 1px solid #333;
            border-left: 3px solid #ff0000;
            border-radius: 4px;
            margin: 4px 0;
            max-width: 450px;
            text-decoration: none;
            transition: all 0.15s ease;
        `;

        const link = doc.createElement('a');
        link.href = videoUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: inherit;
            width: 100%;
        `;

        // YouTube icon
        const icon = doc.createElement('div');
        icon.style.cssText = `
            width: 36px;
            height: 26px;
            background: #ff0000;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;
        icon.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;

        // Text content
        const textContent = doc.createElement('div');
        textContent.style.cssText = 'overflow: hidden; flex: 1; min-width: 0;';

        const titleEl = doc.createElement('div');
        titleEl.style.cssText = `
            font-weight: 500;
            font-size: 13px;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        titleEl.textContent = title;
        titleEl.title = title;

        const authorEl = doc.createElement('div');
        authorEl.style.cssText = 'font-size: 11px; color: #888; margin-top: 1px;';
        authorEl.textContent = author;

        textContent.appendChild(titleEl);
        textContent.appendChild(authorEl);

        link.appendChild(icon);
        link.appendChild(textContent);
        container.appendChild(link);

        // Hover effects
        container.addEventListener('mouseenter', () => {
            container.style.background = 'linear-gradient(135deg, #252525 0%, #303030 100%)';
            container.style.borderLeftColor = '#ff3333';
        });

        container.addEventListener('mouseleave', () => {
            container.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)';
            container.style.borderLeftColor = '#ff0000';
        });

        return container;
    }

    // ============================================
    // LINK PROCESSING
    // ============================================

    async function processLink(doc, link) {
        // Skip if already processed
        if (link.dataset.keesYoutubeProcessed) return;

        // Skip if inside our own title display
        if (link.closest('.kees-youtube-title')) return;

        link.dataset.keesYoutubeProcessed = 'true';

        const videoId = extractVideoId(link.href);
        if (!videoId) return;

        const videoUrl = getVideoUrl(videoId);

        // Fetch the title
        const info = await fetchVideoTitle(videoUrl);
        if (!info) return;

        console.log('[KEES] YouTube title:', info.title);

        // Create and insert title display
        const titleDisplay = createTitleDisplay(doc, info.title, info.author, link.href);

        // Insert after the link
        const wrapper = doc.createElement('div');
        wrapper.style.cssText = 'display: block;';
        wrapper.appendChild(titleDisplay);

        if (link.nextSibling) {
            link.parentNode.insertBefore(wrapper, link.nextSibling);
        } else {
            link.parentNode.appendChild(wrapper);
        }
    }

    function processAllLinks(doc) {
        const links = doc.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
        console.log('[KEES] Found', links.length, 'YouTube links');
        links.forEach(link => processLink(doc, link));
    }

    // ============================================
    // MUTATION OBSERVER
    // ============================================

    function setupObserver(doc) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if node is a YouTube link
                        if (node.matches && node.matches('a[href*="youtube.com"], a[href*="youtu.be"]')) {
                            processLink(doc, node);
                        }

                        // Check children for YouTube links
                        const links = node.querySelectorAll ?
                            node.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]') : [];
                        links.forEach(link => processLink(doc, link));
                    }
                }
            }
        });

        observer.observe(doc.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;
        initializedDocs.add(doc);

        processAllLinks(doc);
        setupObserver(doc);

        console.log('[KEES] YouTube titles started');
    }

    function init() {
        console.log('[KEES] YouTube titles module loaded');
    }

    // Export
    SNEED.features = SNEED.features || {};
    SNEED.features.youtubeTitles = {
        init,
        start,
        processLink,
        fetchVideoTitle
    };

    // Auto-init
    init();

})();
