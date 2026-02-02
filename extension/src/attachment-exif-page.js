/**
 * attachment-exif-page.js - Page context script for EXIF stripping
 * This file is loaded via web_accessible_resources to bypass CSP.
 */
(function() {
    if (window.__keesExifStripperInstalled) return;
    window.__keesExifStripperInstalled = true;

    // Default enabled, will be updated by message
    let stripExifEnabled = true;

    // Listen for setting updates from content script
    window.addEventListener('kees-exif-setting', function(e) {
        stripExifEnabled = e.detail.enabled;
        console.log('[KEES] Attachment EXIF stripping:', stripExifEnabled ? 'enabled' : 'disabled');
    });

    async function stripExifData(file) {
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
            return file;
        }

        try {
            const img = await createImageBitmap(file);
            const canvas = new OffscreenCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            let outputType = file.type;
            let quality = 0.92;

            if (file.type === 'image/png') {
                outputType = 'image/png';
                quality = undefined;
            } else if (file.type === 'image/webp') {
                outputType = 'image/webp';
            } else {
                outputType = 'image/jpeg';
            }

            const blob = await canvas.convertToBlob({ type: outputType, quality: quality });

            if (file instanceof File) {
                const newFile = new File([blob], file.name, { type: outputType });
                console.log('[KEES] Attachment EXIF stripped: ' + file.name + ' (' + file.size + ' -> ' + newFile.size + ' bytes)');
                return newFile;
            }
            return blob;
        } catch (e) {
            console.warn('[KEES] Failed to strip EXIF:', e);
            return file;
        }
    }

    async function processFormData(formData) {
        const newFormData = new FormData();
        const entries = Array.from(formData.entries());

        for (const entry of entries) {
            const key = entry[0];
            const value = entry[1];

            if ((value instanceof File || value instanceof Blob) &&
                value.type.startsWith('image/') &&
                value.type !== 'image/gif') {
                const stripped = await stripExifData(value);
                newFormData.append(key, stripped, value.name || 'image');
            } else if (value instanceof File || value instanceof Blob) {
                newFormData.append(key, value, value.name);
            } else {
                newFormData.append(key, value);
            }
        }

        return newFormData;
    }

    // Intercept XHR
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._keesUrl = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;
        const url = this._keesUrl || '';

        if (stripExifEnabled && body instanceof FormData && url.includes('/attachments/upload')) {
            console.log('[KEES] Intercepted XHR attachment upload to:', url);

            processFormData(body).then(function(newFormData) {
                originalXHRSend.call(xhr, newFormData);
            }).catch(function(e) {
                console.error('[KEES] Error processing FormData:', e);
                originalXHRSend.call(xhr, body);
            });
            return;
        }

        return originalXHRSend.apply(this, arguments);
    };

    // Intercept fetch
    const originalFetch = window.fetch;

    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        if (stripExifEnabled && init && init.body instanceof FormData && url.includes('/attachments/upload')) {
            console.log('[KEES] Intercepted fetch attachment upload to:', url);

            return processFormData(init.body).then(function(newFormData) {
                var newInit = {};
                for (var k in init) newInit[k] = init[k];
                newInit.body = newFormData;
                return originalFetch.call(window, input, newInit);
            }).catch(function(e) {
                console.error('[KEES] Error processing FormData:', e);
                return originalFetch.call(window, input, init);
            });
        }

        return originalFetch.apply(window, arguments);
    };

    console.log('[KEES] Attachment EXIF stripper interceptors installed');
})();
