/**
 * features/input.js - Input handling
 * Input auto-resize, Shift+Enter for newlines, send failure handling, WYSIWYG conversion.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const state = SNEED.state;
    const { addManagedEventListener, addManagedObserver, ensureSendWatcher, setResizeCache, getResizeCache } = SNEED.core.events;

    // ============================================
    // @EVERYONE EXPANSION
    // ============================================

    /**
     * Replace @everyone in input with individual @mentions
     * @param {HTMLElement} inputElement - The input element
     */
    function expandEveryone(inputElement) {
        const list = SNEED.state.getEveryoneList();
        if (!list || list.length === 0) return;

        const text = inputElement.textContent || '';
        if (!text.includes('@everyone')) return;

        const mentions = list.map(u => '@' + u).join(' ');
        // Walk text nodes and replace @everyone
        const walker = document.createTreeWalker(inputElement, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            if (node.textContent.includes('@everyone')) {
                node.textContent = node.textContent.replace(/@everyone/g, mentions);
            }
        }
    }

    // ============================================
    // WYSIWYG TO BBCODE CONVERSION
    // ============================================

    /**
     * Convert input HTML content to BBCode before submission
     * @param {HTMLElement} inputElement - The input element
     * @param {Document} doc - Document context
     */
    function convertInputToBBCode(inputElement, doc) {
        if (!SNEED.core.bbcode) {
            return;
        }

        // Check if there's any HTML formatting to convert
        const hasFormatting = inputElement.querySelector('strong, b, em, i, u, s, strike, del, code, div[data-bbcode-center], span[data-bbcode-size], span[data-bbcode-color], img[data-bbcode-img]');
        if (!hasFormatting) {
            return;
        }

        // Convert HTML to BBCode
        const bbcode = SNEED.core.bbcode.convertToBBCode(inputElement);

        // Replace content with plain text BBCode
        inputElement.textContent = bbcode;

        // Position cursor at end
        SNEED.util.positionCursorAtEnd(doc, inputElement);
    }

    /**
     * Attach pre-submit conversion handlers
     * @param {HTMLElement} inputElement - The input element
     * @param {Document} doc - Document context
     */
    function attachPreSubmitHandlers(inputElement, doc) {
        if (inputElement.hasAttribute('data-bbcode-convert-handler')) {
            return;
        }
        inputElement.setAttribute('data-bbcode-convert-handler', 'true');

        // Capture-phase Enter key handler (runs before chat.js handler)
        addManagedEventListener(inputElement, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // Expand @everyone before conversion
                expandEveryone(inputElement);
                // Convert HTML to BBCode before the form submits
                convertInputToBBCode(inputElement, doc);
            }
        }, true); // capture phase

        // Capture-phase form submit handler
        const messageForm = doc.getElementById('new-message-form');
        if (messageForm && !messageForm.hasAttribute('data-bbcode-submit-handler')) {
            messageForm.setAttribute('data-bbcode-submit-handler', 'true');

            addManagedEventListener(messageForm, 'submit', (e) => {
                // Expand @everyone before conversion
                expandEveryone(inputElement);
                // Convert HTML to BBCode before submission
                convertInputToBBCode(inputElement, doc);
            }, true); // capture phase
        }
    }

    // ============================================
    // OPTIMIZED INPUT RESIZER
    // ============================================

    function createOptimizedResizer(inputElement, doc) {
        let raf = 0;
        let baseHeight = 0;

        function resizeInput() {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                raf = 0;

                const txt = (inputElement.textContent || '').trim();
                const hasImages = inputElement.querySelector('img');

                if (!txt && !hasImages) {
                    inputElement.style.height = '';
                    baseHeight = 0;
                    return;
                }

                if (!baseHeight) {
                    baseHeight = inputElement.offsetHeight;
                }

                inputElement.style.height = 'auto';
                const scrollH = inputElement.scrollHeight;

                if (scrollH > baseHeight) {
                    const newH = Math.min(state.CONFIG.MAX_INPUT_HEIGHT, scrollH);
                    inputElement.style.height = newH + 'px';
                } else {
                    inputElement.style.height = '';
                }
            });
        }

        function cleanup() {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            baseHeight = 0;
        }

        setResizeCache(inputElement, { resizeInput, cleanup });
        return { resizeInput, cleanup };
    }

    // ============================================
    // SHIFT+ENTER HANDLER
    // ============================================

    function createShiftEnterHandler(doc) {
        return function(e) {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();

                const win = doc.defaultView || window;
                const selection = win.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const textNode = doc.createTextNode('\n');
                    range.deleteContents();
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    const inputElement = e.target;
                    const event = new Event('input', { bubbles: true, cancelable: true });
                    inputElement.dispatchEvent(event);
                }
                return false;
            }
        };
    }

    function attachShiftEnterHandler(inputElement, doc) {
        if (!inputElement || inputElement.hasAttribute('data-shift-enter-handler')) {
            return;
        }

        inputElement.setAttribute('data-shift-enter-handler', 'true');
        const handler = createShiftEnterHandler(doc);
        addManagedEventListener(inputElement, 'keydown', handler, true);
    }

    // ============================================
    // CHARACTER LIMIT WARNING
    // ============================================

    const CHAR_LIMIT = 1023;

    function updateCharacterWarning(inputElement, doc) {
        const messageForm = doc.getElementById('new-message-form');
        if (!messageForm) return;

        const charCount = (inputElement.textContent || '').length;
        let warning = doc.getElementById('sneed-char-warning');

        if (charCount > CHAR_LIMIT) {
            if (!warning) {
                warning = doc.createElement('div');
                warning.id = 'sneed-char-warning';
                warning.style.cssText = `
                    color: #ff4444;
                    font-size: 11px;
                    text-align: right;
                    padding: 2px 4px 0 0;
                    margin-top: 2px;
                `;
                messageForm.appendChild(warning);
            }
            warning.textContent = `${charCount}/${CHAR_LIMIT} characters (${charCount - CHAR_LIMIT} over limit)`;
            warning.style.display = 'block';
        } else if (warning) {
            warning.style.display = 'none';
        }
    }

    // ============================================
    // SEND FAILURE INDICATOR
    // ============================================

    function showSendFailureIndicator(doc) {
        if (doc.getElementById('send-failure-indicator')) return;

        const indicator = doc.createElement('div');
        indicator.id = 'send-failure-indicator';
        indicator.textContent = 'Message failed to send - content restored';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInOut 3s ease-in-out;
        `;

        if (!doc.getElementById('send-failure-animation')) {
            const style = doc.createElement('style');
            style.id = 'send-failure-animation';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(20px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(20px); }
                }
            `;
            doc.head.appendChild(style);
        }

        doc.body.appendChild(indicator);
        setTimeout(() => { indicator.remove(); }, 3000);
    }

    // ============================================
    // ADD EMOTE TOGGLE BUTTON
    // ============================================

    function addEmoteToggleButton(doc) {
        const buttonsContainer = doc.querySelector('.chat-form-buttons');
        const submitButton = doc.getElementById('new-message-submit');
        const inputElement = doc.getElementById('new-message-input');

        if (!buttonsContainer || !submitButton || !inputElement || doc.getElementById('emote-toggle-button')) {
            return;
        }

        // Hide original send button
        submitButton.style.display = 'none';

        // Auto-resize setup
        inputElement.style.maxHeight = state.CONFIG.MAX_INPUT_HEIGHT + 'px';
        inputElement.style.overflowY = 'auto';
        inputElement.style.resize = 'none';

        const { resizeInput } = createOptimizedResizer(inputElement, doc);

        addManagedEventListener(inputElement, 'input', () => {
            resizeInput();
            updateCharacterWarning(inputElement, doc);
        });
        addManagedEventListener(inputElement, 'paste', () => setTimeout(() => {
            resizeInput();
            updateCharacterWarning(inputElement, doc);
        }, 0));

        // Watch for input clear
        if (!inputElement.hasAttribute('data-observer-attached')) {
            const observer = new MutationObserver(() => {
                if (!inputElement.textContent || inputElement.textContent.trim() === '') {
                    setTimeout(() => {
                        inputElement.style.height = 'auto';
                        resizeInput();
                        updateCharacterWarning(inputElement, doc);
                    }, 50);
                }
            });
            observer.observe(inputElement, { childList: true, characterData: true, subtree: true });
            addManagedObserver(inputElement, observer);
            inputElement.setAttribute('data-observer-attached', 'true');
            inputElement._resizeObserver = observer;
        }

        // Form submission handler
        const messageForm = doc.getElementById('new-message-form');
        if (messageForm && !messageForm.__sneed_submit_handler) {
            messageForm.__sneed_submit_handler = true;
            const watcher = ensureSendWatcher(doc);

            addManagedEventListener(messageForm, 'submit', (e) => {
                const lastMessageContent = inputElement.innerHTML || '';
                const lastMessageText = inputElement.textContent || '';

                // Block send if over character limit
                if (lastMessageText.length > CHAR_LIMIT) {
                    e.preventDefault();
                    e.stopPropagation();
                    SNEED.log.warn(`Message blocked: ${lastMessageText.length} characters exceeds ${CHAR_LIMIT} limit`);
                    return false;
                }

                watcher.arm({
                    text: lastMessageText,
                    html: lastMessageContent,
                    time: Date.now(),
                    onConfirm: () => {
                        SNEED.log.info('Message confirmed in chat');
                        inputElement.style.height = 'auto';
                        resizeInput();
                    },
                    onFail: () => {
                        const connectionLost = doc.querySelector('.connection-lost, .connecting, [class*="connecting"], [class*="reconnect"]');
                        const inputCleared = inputElement.textContent.trim() === '';

                        if (inputCleared && connectionLost) {
                            SNEED.log.info('Message did not appear in chat - restoring content');

                            if (inputElement.contentEditable === 'true') {
                                inputElement.innerHTML = lastMessageContent;
                            } else {
                                inputElement.textContent = lastMessageText;
                            }

                            inputElement.focus();
                            SNEED.util.positionCursorAtEnd(doc, inputElement);
                            resizeInput();
                            showSendFailureIndicator(doc);
                        } else if (!inputCleared) {
                            SNEED.log.info('Message still in input - send may have been blocked');
                        }
                    }
                });
            });
        }

        // Shift+Enter handler
        attachShiftEnterHandler(inputElement, doc);

        // WYSIWYG to BBCode conversion handlers
        attachPreSubmitHandlers(inputElement, doc);

        // Enter key handler - block send if over limit, resize after send
        if (!inputElement.hasAttribute('data-enter-resize-handler')) {
            inputElement.setAttribute('data-enter-resize-handler', 'true');
            addManagedEventListener(inputElement, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    // Block send if over character limit
                    const charCount = (inputElement.textContent || '').length;
                    if (charCount > CHAR_LIMIT) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        SNEED.log.warn(`Message blocked: ${charCount} characters exceeds ${CHAR_LIMIT} limit`);
                        return false;
                    }
                    setTimeout(resizeInput, 0);
                }
            }, true);
        }

        // Initial resize
        resizeInput();

        // Create and position toggle button
        const emoteToggleBtn = SNEED.ui.createEmoteToggleButton(doc);
        emoteToggleBtn.style.position = 'absolute';
        emoteToggleBtn.style.right = '8px';
        emoteToggleBtn.style.top = '50%';
        emoteToggleBtn.style.transform = 'translateY(-50%)';
        emoteToggleBtn.style.zIndex = '10';

        const inputContainer = inputElement.parentElement;
        if (inputContainer) {
            inputContainer.style.position = 'relative';
            inputContainer.appendChild(emoteToggleBtn);
            inputElement.style.paddingRight = '50px';
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.createOptimizedResizer = createOptimizedResizer;
    SNEED.features.createShiftEnterHandler = createShiftEnterHandler;
    SNEED.features.attachShiftEnterHandler = attachShiftEnterHandler;
    SNEED.features.showSendFailureIndicator = showSendFailureIndicator;
    SNEED.features.addEmoteToggleButton = addEmoteToggleButton;
    SNEED.features.convertInputToBBCode = convertInputToBBCode;
    SNEED.features.attachPreSubmitHandlers = attachPreSubmitHandlers;

})();
