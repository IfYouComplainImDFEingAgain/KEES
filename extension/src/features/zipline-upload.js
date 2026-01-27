/**
 * features/zipline-upload.js - Zipline file upload integration
 * Adds an upload button to the chat input that uploads to Zipline.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const STORAGE_KEY_ENABLED = 'kees-zipline-enabled';

    // Track initialized documents
    const initializedDocs = new WeakSet();

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
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #888;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        `;

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
    // UPLOAD LOGIC
    // ============================================

    async function handleFileSelect(file, doc) {
        if (!file) return;

        const inputElement = doc.getElementById('new-message-input');
        if (!inputElement) return;

        // Show uploading indicator
        const uploadBtn = doc.getElementById('zipline-upload-button');
        const originalHTML = uploadBtn.innerHTML;
        uploadBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #888; animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="30 60"/>
            </svg>
        `;
        uploadBtn.disabled = true;

        // Add spin animation if not exists
        if (!doc.getElementById('kees-spin-style')) {
            const style = doc.createElement('style');
            style.id = 'kees-spin-style';
            style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            doc.head.appendChild(style);
        }

        try {
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
                reader.readAsDataURL(file);
            });

            // Send to background script for upload
            const response = await chrome.runtime.sendMessage({
                type: 'uploadToZipline',
                fileData: base64,
                fileName: file.name,
                mimeType: file.type
            });

            if (response.success) {
                // Insert URL into chat input
                const url = response.url;

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

                    const textNode = doc.createTextNode(url + ' ');
                    range.deleteContents();
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Trigger input event
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    inputElement.value += url + ' ';
                }

                console.log('[KEES] Zipline upload successful:', url);
            } else {
                console.error('[KEES] Zipline upload failed:', response.error);
                alert('Upload failed: ' + response.error);
            }
        } catch (e) {
            console.error('[KEES] Zipline upload error:', e);
            alert('Upload failed: ' + e.message);
        } finally {
            // Restore button
            uploadBtn.innerHTML = originalHTML;
            uploadBtn.disabled = false;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;

        // Check if Zipline is enabled
        const settings = await new Promise(resolve => {
            chrome.storage.local.get([STORAGE_KEY_ENABLED], resolve);
        });

        if (!settings[STORAGE_KEY_ENABLED]) {
            console.log('[KEES] Zipline upload disabled');
            return;
        }

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
