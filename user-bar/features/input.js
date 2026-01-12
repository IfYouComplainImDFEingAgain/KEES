/**
 * features/input.js - Input handling
 * Input auto-resize, Shift+Enter for newlines, send failure handling.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const state = SNEED.state;
    const { addManagedEventListener, addManagedObserver, ensureSendWatcher, setResizeCache, getResizeCache } = SNEED.core.events;

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
                if (!txt) {
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

        addManagedEventListener(inputElement, 'input', resizeInput);
        addManagedEventListener(inputElement, 'paste', () => setTimeout(resizeInput, 0));

        // Watch for input clear
        if (!inputElement.hasAttribute('data-observer-attached')) {
            const observer = new MutationObserver(() => {
                if (!inputElement.textContent || inputElement.textContent.trim() === '') {
                    setTimeout(() => {
                        inputElement.style.height = 'auto';
                        resizeInput();
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

            addManagedEventListener(messageForm, 'submit', () => {
                const lastMessageContent = inputElement.innerHTML || '';
                const lastMessageText = inputElement.textContent || '';

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

        // Enter resize handler
        if (!inputElement.hasAttribute('data-enter-resize-handler')) {
            inputElement.setAttribute('data-enter-resize-handler', 'true');
            addManagedEventListener(inputElement, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
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

})();
