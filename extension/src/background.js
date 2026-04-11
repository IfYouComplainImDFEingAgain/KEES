/**
 * background.js - Service worker for KEES
 * Handles tasks that need to bypass page CSP (like fetching YouTube titles)
 * and Zipline uploads.
 */

// ============================================
// ZIPLINE UPLOAD
// ============================================

async function uploadToZipline(fileData, fileName, mimeType) {
    try {
        // Get Zipline settings from storage
        const settings = await chrome.storage.local.get([
            'kees-zipline-url',
            'kees-zipline-api-key'
        ]);

        const ziplineUrl = settings['kees-zipline-url'];
        const apiKey = settings['kees-zipline-api-key'];

        if (!ziplineUrl || !apiKey) {
            return { success: false, error: 'Zipline URL or API key not configured' };
        }

        // Convert base64 to blob
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Create form data
        const formData = new FormData();
        formData.append('file', blob, fileName);

        // Upload to Zipline
        const uploadUrl = ziplineUrl.replace(/\/$/, '') + '/api/upload';
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': apiKey
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Zipline returns files array with objects containing url property
        if (data.files && data.files.length > 0) {
            return { success: true, url: data.files[0].url };
        }

        return { success: false, error: 'No URL returned from Zipline' };
    } catch (e) {
        console.error('[KEES Background] Zipline upload failed:', e);
        return { success: false, error: e.message };
    }
}

// ============================================
// YOUTUBE INFO
// ============================================

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

    if (message.type === 'uploadToZipline') {
        uploadToZipline(message.fileData, message.fileName, message.mimeType).then(sendResponse);
        return true; // Keep channel open for async response
    }

    if (message.type === 'editMessage') {
        // Relay message edit to chat tab
        chrome.tabs.query({ url: ['*://kiwifarms.st/chat/*', '*://kiwifarms.st/test-chat*'] }, (tabs) => {
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'relayEditMessage',
                    uuid: message.uuid,
                    message: message.message
                });
                break;
            }
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'sendWhisper') {
        // Relay whisper send to all chat tabs
        chrome.tabs.query({ url: ['*://kiwifarms.st/chat/*', '*://kiwifarms.st/test-chat*'] }, (tabs) => {
            let sent = false;
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'relaySendWhisper',
                    partner: message.partner,
                    text: message.text
                });
                sent = true;
                break; // Only need one chat tab
            }
            sendResponse({ success: sent, error: sent ? null : 'No chat tab open' });
        });
        return true;
    }
});

console.log('[KEES] Background service worker initialized');
