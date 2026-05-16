// features/native-video-player.js - Replace site's Ephyra video player with native browser player
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY = 'kees-native-video-player';
    const PLAYER_SELECTOR = '.ephyra-player--video, .ephyra-player--audio';
    const REPLACED_ATTR = 'keesNativeReplaced';
    const REPLACEMENT_CLASS = 'kees-native-media';

    let enabled = false;
    let contextValid = true;
    let observer = null;

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
                    enabled = result[STORAGE_KEY] === true;
                    resolve(enabled);
                });
            } catch (e) {
                contextValid = false;
                resolve(false);
            }
        });
    }

    function normalizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('//')) return window.location.protocol + url;
        return url;
    }

    function guessMimeType(url, filename) {
        const target = (filename || url || '').toLowerCase();
        if (/\.mp4($|\?)/.test(target)) return 'video/mp4';
        if (/\.webm($|\?)/.test(target)) return 'video/webm';
        if (/\.ogv($|\?)/.test(target)) return 'video/ogg';
        if (/\.mov($|\?)/.test(target)) return 'video/quicktime';
        if (/\.mp3($|\?)/.test(target)) return 'audio/mpeg';
        if (/\.m4a($|\?)/.test(target)) return 'audio/mp4';
        if (/\.ogg($|\?)/.test(target)) return 'audio/ogg';
        if (/\.wav($|\?)/.test(target)) return 'audio/wav';
        return '';
    }

    function replacePlayer(player) {
        if (!player || !player.dataset) return;
        if (player.dataset[REPLACED_ATTR] === 'true') return;

        const fallbackSrc = player.dataset.sourceFallback;
        if (!fallbackSrc) return;

        const isAudio = player.classList.contains('ephyra-player--audio');
        const poster = player.dataset.poster || player.dataset.posterFallback;
        const width = player.dataset.width;
        const height = player.dataset.height;
        const filename = player.dataset.filename || '';
        const src = normalizeUrl(fallbackSrc);

        const media = document.createElement(isAudio ? 'audio' : 'video');
        media.controls = true;
        media.preload = 'metadata';
        media.className = REPLACEMENT_CLASS;
        if (filename) media.setAttribute('aria-label', filename);

        if (!isAudio) {
            if (poster) media.poster = normalizeUrl(poster);
            media.playsInline = true;
            media.style.maxWidth = '100%';
            media.style.display = 'block';
            if (width && height) {
                media.style.aspectRatio = `${width} / ${height}`;
            }
        } else {
            media.style.width = '100%';
            media.style.display = 'block';
        }

        const source = document.createElement('source');
        source.src = src;
        const mime = guessMimeType(src, filename);
        if (mime) source.type = mime;
        media.appendChild(source);

        const fallbackLink = document.createElement('a');
        fallbackLink.href = src;
        fallbackLink.textContent = filename || 'Download media';
        fallbackLink.rel = 'noopener noreferrer';
        media.appendChild(fallbackLink);

        player.dataset[REPLACED_ATTR] = 'true';

        const container = player.closest('.ephyra-media');
        if (container) {
            if (!('keesContainerOriginalStyle' in container.dataset)) {
                container.dataset.keesContainerOriginalStyle = container.getAttribute('style') || '';
            }
            container.style.aspectRatio = '';
            container.style.maxHeight = '';
            container.style.width = '100%';
            if (width && height) {
                container.style.aspectRatio = `${width} / ${height}`;
            }
        }

        player.style.display = 'none';
        if (player.parentNode) {
            player.parentNode.insertBefore(media, player);
        }
    }

    function restorePlayer(player) {
        if (!player || player.dataset[REPLACED_ATTR] !== 'true') return;

        const prev = player.previousElementSibling;
        if (prev && prev.classList.contains(REPLACEMENT_CLASS)) {
            prev.remove();
        }
        player.style.display = '';
        delete player.dataset[REPLACED_ATTR];

        const container = player.closest('.ephyra-media');
        if (container && 'keesContainerOriginalStyle' in container.dataset) {
            const original = container.dataset.keesContainerOriginalStyle;
            if (original) {
                container.setAttribute('style', original);
            } else {
                container.removeAttribute('style');
            }
            delete container.dataset.keesContainerOriginalStyle;
        }
    }

    function replaceAll() {
        document.querySelectorAll(PLAYER_SELECTOR).forEach(replacePlayer);
    }

    function restoreAll() {
        document.querySelectorAll(`[data-kees-native-replaced="true"]`).forEach(restorePlayer);
    }

    function setupObserver() {
        if (observer) return;
        observer = new MutationObserver((mutations) => {
            if (!enabled) return;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.matches && node.matches(PLAYER_SELECTOR)) {
                        replacePlayer(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll(PLAYER_SELECTOR).forEach(replacePlayer);
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function init() {
        if (!isExtensionContextValid()) return;
        await loadSetting();

        const start = () => {
            if (enabled) replaceAll();
            setupObserver();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }

        try {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (!isExtensionContextValid()) return;
                if (areaName === 'local' && changes[STORAGE_KEY]) {
                    enabled = changes[STORAGE_KEY].newValue === true;
                    if (enabled) replaceAll();
                    else restoreAll();
                }
            });
        } catch (e) {
            contextValid = false;
        }
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.nativeVideoPlayer = { init, replaceAll, restoreAll };

    init();
})();
