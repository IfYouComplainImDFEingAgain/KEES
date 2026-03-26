// features/zipline-upload.js - Zipline file upload integration for chat
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-zipline-enabled';
    const STORAGE_KEY_STRIP_EXIF = 'kees-zipline-strip-exif';

    const initializedDocs = new WeakSet();

    let stripExifEnabled = true; // Default to true for privacy

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

        const svgNS = 'http://www.w3.org/2000/svg';
        function createUploadIcon() {
            const svg = doc.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.style.color = '#888';
            const path = doc.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
            const polyline = doc.createElementNS(svgNS, 'polyline');
            polyline.setAttribute('points', '17 8 12 3 7 8');
            const line = doc.createElementNS(svgNS, 'line');
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

    // Canvas export naturally strips all metadata
    async function stripExifData(file) {
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
            return file;
        }

        try {
            const img = await createImageBitmap(file);

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

            ctx.drawImage(img, 0, 0);

            let outputType = file.type;
            let quality = 0.92;

            if (file.type === 'image/png') {
                outputType = 'image/png';
                quality = undefined;
            } else if (file.type === 'image/webp') {
                outputType = 'image/webp';
                quality = 0.92;
            } else {
                outputType = 'image/jpeg';
                quality = 0.92;
            }

            let blob;
            if (canvas.convertToBlob) {
                blob = await canvas.convertToBlob({ type: outputType, quality });
            } else {
                blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, outputType, quality);
                });
            }

            const newFile = new File([blob], file.name, { type: outputType });
            console.log(`[KEES] Stripped EXIF: ${file.size} -> ${newFile.size} bytes`);
            return newFile;
        } catch (e) {
            console.warn('[KEES] Failed to strip EXIF, using original:', e);
            return file;
        }
    }

    async function handleFileSelect(file, doc) {
        if (!file) return;

        const inputElement = doc.getElementById('new-message-input');
        if (!inputElement) return;

        const uploadBtn = doc.getElementById('zipline-upload-button');
        const originalChildren = Array.from(uploadBtn.childNodes).map(n => n.cloneNode(true));
        const spinSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        spinSvg.setAttribute('width', '24');
        spinSvg.setAttribute('height', '24');
        spinSvg.setAttribute('viewBox', '0 0 24 24');
        spinSvg.setAttribute('fill', 'none');
        spinSvg.setAttribute('stroke', 'currentColor');
        spinSvg.setAttribute('stroke-width', '2');
        spinSvg.style.cssText = 'color: #888; animation: spin 1s linear infinite;';
        const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10'); circle.setAttribute('stroke-dasharray', '30 60');
        spinSvg.appendChild(circle);
        uploadBtn.replaceChildren(spinSvg);
        uploadBtn.disabled = true;

        if (!doc.getElementById('kees-spin-style')) {
            const style = doc.createElement('style');
            style.id = 'kees-spin-style';
            style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            doc.head.appendChild(style);
        }

        try {
            let processedFile = file;
            if (stripExifEnabled && file.type.startsWith('image/')) {
                processedFile = await stripExifData(file);
            }

            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(processedFile);
            });

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
                const url = response.url;
                const isImage = processedFile.type.startsWith('image/');
                const textToInsert = isImage ? `[img]${url}[/img] ` : `${url} `;

                if (inputElement.contentEditable === 'true') {
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
            uploadBtn.replaceChildren(...originalChildren);
            uploadBtn.disabled = false;
        }
    }

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

        const settings = await new Promise(resolve => {
            storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_STRIP_EXIF], resolve);
        });

        if (!settings[STORAGE_KEY_ENABLED]) {
            console.log('[KEES] Zipline upload disabled');
            return;
        }

        stripExifEnabled = settings[STORAGE_KEY_STRIP_EXIF] !== false;

        storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY_STRIP_EXIF]) {
                stripExifEnabled = changes[STORAGE_KEY_STRIP_EXIF].newValue !== false;
            }
        });

        initializedDocs.add(doc);

        const checkForInput = () => {
            const inputElement = doc.getElementById('new-message-input');
            const inputContainer = inputElement?.parentElement;

            if (!inputContainer || doc.getElementById('zipline-upload-button')) {
                return;
            }

            const uploadBtn = createUploadButton(doc);
            const fileInput = createFileInput(doc);

            uploadBtn.style.position = 'absolute';
            uploadBtn.style.right = '40px';
            uploadBtn.style.top = '50%';
            uploadBtn.style.transform = 'translateY(-50%)';
            uploadBtn.style.zIndex = '10';

            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleFileSelect(file, doc);
                    fileInput.value = '';
                }
            });

            inputContainer.appendChild(uploadBtn);
            inputContainer.appendChild(fileInput);

            inputElement.style.paddingRight = '80px';

            console.log('[KEES] Zipline upload button added');
        };

        checkForInput();
        setTimeout(checkForInput, 500);
        setTimeout(checkForInput, 1000);
    }

    function init() {
        console.log('[KEES] Zipline upload module loaded');
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.ziplineUpload = {
        init,
        start
    };

    init();
})();
