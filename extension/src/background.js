/**
 * background.js - Service worker for KEES
 * Handles tasks that need to bypass page CSP (like fetching YouTube titles)
 */

// Fetch YouTube video info via oembed API
async function fetchYouTubeInfo(videoUrl) {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            title: data.title,
            author: data.author_name,
            thumbnailUrl: data.thumbnail_url
        };
    } catch (e) {
        console.error('[KEES Background] Failed to fetch YouTube info:', e);
        return {
            success: false,
            error: e.message
        };
    }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fetchYouTubeInfo') {
        fetchYouTubeInfo(message.videoUrl).then(sendResponse);
        return true; // Keep channel open for async response
    }
});

console.log('[KEES] Background service worker initialized');
