/**
 * features/zipline-upload.js - Zipline file upload integration
 * Adds an upload button to the chat input that uploads to Zipline.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-zipline-enabled';
    const STORAGE_KEY_STRIP_EXIF = 'kees-zipline-strip-exif';

    // Track initialized documents
    const initializedDocs = new WeakSet();

    // Cache settings
    let stripExifEnabled = true; // Default to true for privacy

    // ============================================
    // UPLOAD BUTTON
    // ============================================

    function createUploadButton(doc) {
        const btn = doc.createElement('button');
        btn.id = 'zipline-upload-button';
        btn.type = 'button';
        btn.title = 'Upload media to Zipline';
        btn.style.cssText = `
            background: transparent;
            border: none;
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
            margin-right: 4px;
        `;

        // Upload icon (SVG)
        const svgNS = 'http://www.w3.org/2000/svg';
        function createUploadIcon() {
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.style.color = '#888';
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
            const polyline = document.createElementNS(svgNS, 'polyline');
            polyline.setAttribute('points', '17 8 12 3 7 8');
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', '12'); line.setAttribute('y1', '3');
            line.setAttribute('x2', '12'); line.setAttribute('y2', '15');
            svg.appendChild(path);
            svg.appendChild(polyline);
            svg.appendChild(line);
            return svg;
        }
        btn.appendChild(createUploadIcon());

        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255,255,255,0.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
        });

        return btn;
    }

    function createFileInput(doc) {
        const input = doc.createElement('input');
        input.type = 'file';
        input.id = 'zipline-file-input';
        input.accept = 'image/*,video/*,audio/*';
        input.style.display = 'none';
        return input;
    }

    // ============================================
    // EXIF STRIPPING
    // ============================================

    /**
     * Strip EXIF data from an image using Canvas API
     * Canvas export naturally strips all metadata
     * @param {File} file - Image file to process
     * @returns {Promise<File>} - Processed file without EXIF
     */
    async function stripExifData(file) {
        // Only process images, skip GIFs (preserve animation)
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
            return file;
        }

        try {
            // Create image bitmap from file
            const img = await createImageBitmap(file);

            // Use OffscreenCanvas if available, fallback to regular canvas
            let canvas, ctx;
            if (typeof OffscreenCanvas !== 'undefined') {
                canvas = new OffscreenCanvas(img.width, img.height);
                ctx = canvas.getContext('2d');
            } else {
                canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx = canvas.getContext('2d');
            }

            // Draw image to canvas (this strips EXIF)
            ctx.drawImage(img, 0, 0);

            // Determine output format and quality
            let outputType = file.type;
            let quality = 0.92;

            // Keep PNG as PNG, convert others to JPEG for smaller size
            if (file.type === 'image/png') {
                outputType = 'image/png';
                quality = undefined; // PNG doesn't use quality
            } else if (file.type === 'image/webp') {
                outputType = 'image/webp';
                quality = 0.92;
            } else {
                outputType = 'image/jpeg';
                quality = 0.92;
            }

            // Convert canvas to blob
            let blob;
            if (canvas.convertToBlob) {
                blob = await canvas.convertToBlob({ type: outputType, quality });
            } else {
                // Fallback for regular canvas
                blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, outputType, quality);
                });
            }

            // Create new file with same name
            const newFile = new File([blob], file.name, { type: outputType });
            console.log(`[KEES] Stripped EXIF: ${file.size} -> ${newFile.size} bytes`);
            return newFile;
        } catch (e) {
            console.warn('[KEES] Failed to strip EXIF, using original:', e);
            return file;
        }
    }

    // ============================================
    // UPLOAD LOGIC
    // ============================================

    async function handleFileSelect(file, doc) {
        if (!file) return;

        const inputElement = doc.getElementById('new-message-input');
        if (!inputElement) return;

        // Show uploading indicator
        const uploadBtn = doc.getElementById('zipline-upload-button');
        const originalChildren = Array.from(uploadBtn.childNodes).map(n => n.cloneNode(true));
        const spinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        spinSvg.setAttribute('width', '24');
        spinSvg.setAttribute('height', '24');
        spinSvg.setAttribute('viewBox', '0 0 24 24');
        spinSvg.setAttribute('fill', 'none');
        spinSvg.setAttribute('stroke', 'currentColor');
        spinSvg.setAttribute('stroke-width', '2');
        spinSvg.style.cssText = 'color: #888; animation: spin 1s linear infinite;';
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10'); circle.setAttribute('stroke-dasharray', '30 60');
        spinSvg.appendChild(circle);
        uploadBtn.replaceChildren(spinSvg);
        uploadBtn.disabled = true;

        // Add spin animation if not exists
        if (!doc.getElementById('kees-spin-style')) {
            const style = doc.createElement('style');
            style.id = 'kees-spin-style';
            style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            doc.head.appendChild(style);
        }

        try {
            // Strip EXIF data if enabled
            let processedFile = file;
            if (stripExifEnabled && file.type.startsWith('image/')) {
                processedFile = await stripExifData(file);
            }

            // Read file as base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    // Remove data URL prefix to get just the base64
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(processedFile);
            });

            // Send to background script for upload
            const runtime = getRuntime();
            if (!runtime || !runtime.sendMessage) {
                throw new Error('Extension runtime not available. Try refreshing the page.');
            }

            const response = await runtime.sendMessage({
                type: 'uploadToZipline',
                fileData: base64,
                fileName: processedFile.name,
                mimeType: processedFile.type
            });

            if (response.success) {
                // Insert URL into chat input, wrap images in [img] tags
                const url = response.url;
                const isImage = processedFile.type.startsWith('image/');
                const textToInsert = isImage ? `[img]${url}[/img] ` : `${url} `;

                if (inputElement.contentEditable === 'true') {
                    // Focus and insert at cursor or end
                    inputElement.focus();
                    const win = doc.defaultView || window;
                    const selection = win.getSelection();

                    let range;
                    if (selection.rangeCount === 0) {
                        range = doc.createRange();
                        range.selectNodeContents(inputElement);
                        range.collapse(false);
                        selection.addRange(range);
                    } else {
                        range = selection.getRangeAt(0);
                    }

                    const textNode = doc.createTextNode(textToInsert);
                    range.deleteContents();
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Trigger input event
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    inputElement.value += textToInsert;
                }

                console.log('[KEES] Zipline upload successful:', url, isImage ? '(image)' : '');
            } else {
                console.error('[KEES] Zipline upload failed:', response.error);
                alert('Upload failed: ' + response.error);
            }
        } catch (e) {
            console.error('[KEES] Zipline upload error:', e);
            alert('Upload failed: ' + e.message);
        } finally {
            // Restore button
            uploadBtn.replaceChildren(...originalChildren);
            uploadBtn.disabled = false;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    // Get the chrome/browser runtime safely
    function getRuntime() {
        if (typeof chrome !== 'undefined' && chrome.runtime) return chrome.runtime;
        if (typeof browser !== 'undefined' && browser.runtime) return browser.runtime;
        return null;
    }

    function getStorage() {
        if (typeof chrome !== 'undefined' && chrome.storage) return chrome.storage;
        if (typeof browser !== 'undefined' && browser.storage) return browser.storage;
        return null;
    }

    async function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;

        const storage = getStorage();
        if (!storage) {
            console.log('[KEES] Storage API not available');
            return;
        }

        // Check if Zipline is enabled and load settings
        const settings = await new Promise(resolve => {
            storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_STRIP_EXIF], resolve);
        });

        if (!settings[STORAGE_KEY_ENABLED]) {
            console.log('[KEES] Zipline upload disabled');
            return;
        }

        // Load EXIF stripping setting (default to true for privacy)
        stripExifEnabled = settings[STORAGE_KEY_STRIP_EXIF] !== false;

        // Listen for setting changes
        storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY_STRIP_EXIF]) {
                stripExifEnabled = changes[STORAGE_KEY_STRIP_EXIF].newValue !== false;
            }
        });

        initializedDocs.add(doc);

        // Wait for the input container to be ready
        const checkForInput = () => {
            const inputElement = doc.getElementById('new-message-input');
            const inputContainer = inputElement?.parentElement;

            if (!inputContainer || doc.getElementById('zipline-upload-button')) {
                return;
            }

            // Create upload button and file input
            const uploadBtn = createUploadButton(doc);
            const fileInput = createFileInput(doc);

            // Position the upload button
            uploadBtn.style.position = 'absolute';
            uploadBtn.style.right = '40px'; // Left of emote toggle
            uploadBtn.style.top = '50%';
            uploadBtn.style.transform = 'translateY(-50%)';
            uploadBtn.style.zIndex = '10';

            // Add click handler
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            // Handle file selection
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleFileSelect(file, doc);
                    fileInput.value = ''; // Reset for next selection
                }
            });

            inputContainer.appendChild(uploadBtn);
            inputContainer.appendChild(fileInput);

            // Adjust input padding to make room
            inputElement.style.paddingRight = '80px';

            console.log('[KEES] Zipline upload button added');
        };

        // Try immediately and also observe for changes
        checkForInput();

        // Also try after a delay in case elements aren't ready
        setTimeout(checkForInput, 500);
        setTimeout(checkForInput, 1000);
    }

    function init() {
        console.log('[KEES] Zipline upload module loaded');
    }

    // Export
    SNEED.features = SNEED.features || {};
    SNEED.features.ziplineUpload = {
        init,
        start
    };

    init();
})();
