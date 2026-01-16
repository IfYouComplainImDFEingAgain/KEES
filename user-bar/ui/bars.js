/**
 * ui/bars.js - Emote bar and Format bar components
 * Creates the main UI bars for emotes and formatting tools.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners, removeElementObservers } = SNEED.core.events;
    const storage = SNEED.core.storage;
    const state = SNEED.state;
    const { STYLES } = SNEED.ui;

    // ============================================
    // EMOTE BAR
    // ============================================

    function createEmoteBar(doc) {
        const emoteBar = doc.createElement('div');
        emoteBar.id = 'custom-emote-bar';
        emoteBar.style.cssText = stylesToString(STYLES.emoteBar);

        // Label
        const label = doc.createElement('div');
        label.textContent = 'Quick Emotes:';
        label.style.cssText = stylesToString(STYLES.label);
        emoteBar.appendChild(label);

        // Create emote buttons
        const emotes = storage.getEmotes();
        emotes.forEach(emote => {
            const emoteButton = doc.createElement('button');
            emoteButton.type = 'button';
            emoteButton.style.cssText = stylesToString(STYLES.emoteButton);

            // Create content element
            let contentElement;
            if (emote.url) {
                contentElement = doc.createElement('img');
                contentElement.src = emote.url;
                contentElement.alt = emote.code;
                contentElement.style.cssText = stylesToString(STYLES.emoteImage);
            } else if (emote.emoji) {
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.emoji;
                contentElement.style.cssText = stylesToString(STYLES.emoteEmoji);
            } else if (emote.text) {
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.text;
                contentElement.style.cssText = stylesToString(STYLES.emoteText);
            }

            contentElement.title = emote.title ?
                `${emote.title} - Click to insert ${emote.code}, Shift+Click to insert without auto-send` :
                `Click to insert ${emote.code}, Shift+Click to insert without auto-send`;
            emoteButton.appendChild(contentElement);

            // Hover effects
            addManagedEventListener(emoteButton, 'mouseenter', () => {
                emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
                emoteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            addManagedEventListener(emoteButton, 'mouseleave', () => {
                emoteButton.style.background = 'transparent';
                emoteButton.style.borderColor = 'transparent';
            });

            // Click handler
            addManagedEventListener(emoteButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Insert emote
                if (SNEED.features.insertEmote) {
                    SNEED.features.insertEmote(emote.code, doc);
                }

                // Auto-send logic
                setTimeout(() => {
                    const input = doc.getElementById('new-message-input');
                    if (emote.autoSend !== false && !e.shiftKey && input && input.textContent.trim() === emote.code.trim()) {
                        const submitBtn = doc.getElementById('new-message-submit');
                        if (submitBtn) {
                            const messageContent = input.innerHTML || '';
                            const messageText = input.textContent || '';

                            const watcher = SNEED.core.events.ensureSendWatcher(doc);
                            watcher.arm({
                                text: messageText,
                                html: messageContent,
                                time: Date.now(),
                                onConfirm: () => {
                                    SNEED.log.info('Auto-send emote confirmed');
                                },
                                onFail: () => {
                                    const connectionLost = doc.querySelector('.connection-lost, .connecting, [class*="connecting"]');
                                    const inputCleared = input.textContent.trim() === '';

                                    if (inputCleared && connectionLost) {
                                        if (input.contentEditable === 'true') {
                                            input.innerHTML = messageContent;
                                        } else {
                                            input.textContent = messageText;
                                        }
                                        SNEED.log.info('Auto-send failed (disconnected) - content restored');
                                        input.focus();
                                        SNEED.util.positionCursorAtEnd(doc, input);
                                    }
                                }
                            });

                            submitBtn.click();
                        }
                    }
                }, state.CONFIG.AUTO_SEND_DELAY);
            });

            emoteBar.appendChild(emoteButton);
        });

        return emoteBar;
    }

    // ============================================
    // FORMAT BAR
    // ============================================

    function createFormatBar(doc) {
        const formatBar = doc.createElement('div');
        formatBar.id = 'custom-format-bar';
        formatBar.style.cssText = stylesToString(STYLES.formatBar);

        // Label
        const label = doc.createElement('div');
        label.textContent = 'Format:';
        label.style.cssText = stylesToString(STYLES.formatLabel);
        formatBar.appendChild(label);

        // Tool containers
        const leftTools = doc.createElement('div');
        leftTools.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1;';

        const rightTools = doc.createElement('div');
        rightTools.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-left: auto;';

        // Create format tool buttons
        state.formatTools.forEach(tool => {
            const toolButton = doc.createElement('button');
            toolButton.type = 'button';
            toolButton.style.cssText = stylesToString(STYLES.formatButton);
            toolButton.textContent = tool.symbol;
            toolButton.title = tool.title;

            // Hover effects
            addManagedEventListener(toolButton, 'mouseenter', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.2)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });

            addManagedEventListener(toolButton, 'mouseleave', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.1)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            // Click handler
            addManagedEventListener(toolButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (SNEED.features.applyFormatting) {
                    SNEED.features.applyFormatting(tool, doc);
                }
            });

            // Right-align blacklist and emote manager buttons
            if (tool.name === 'Blacklist' || tool.name === 'Emotes') {
                rightTools.appendChild(toolButton);
            } else {
                leftTools.appendChild(toolButton);
            }
        });

        formatBar.appendChild(leftTools);
        formatBar.appendChild(rightTools);

        return formatBar;
    }

    // ============================================
    // EMOTE TOGGLE BUTTON
    // ============================================

    function createEmoteToggleButton(doc) {
        const emoteButton = doc.createElement('button');
        emoteButton.id = 'emote-toggle-button';
        emoteButton.type = 'button';
        emoteButton.style.cssText = stylesToString(STYLES.emoteToggleButton);

        const toggleImg = doc.createElement('img');
        toggleImg.src = state.toggleButtonConfig.image;
        toggleImg.style.cssText = stylesToString(STYLES.toggleImg);

        emoteButton.appendChild(toggleImg);

        // Hover effects
        addManagedEventListener(emoteButton, 'mouseenter', () => {
            emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
            toggleImg.style.filter = 'brightness(1.2)';
        });

        addManagedEventListener(emoteButton, 'mouseleave', () => {
            emoteButton.style.background = 'transparent';
            toggleImg.style.filter = 'brightness(0.9)';
        });

        // Click handler
        addManagedEventListener(emoteButton, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const emoteBar = doc.getElementById('custom-emote-bar');
            const formatBar = doc.getElementById('custom-format-bar');

            if (emoteBar && formatBar) {
                const visible = state.toggleEmoteBarVisible();
                emoteBar.style.display = visible ? 'flex' : 'none';
                formatBar.style.display = visible ? 'flex' : 'none';
            }
        });

        emoteButton.title = state.toggleButtonConfig.title;
        return emoteButton;
    }

    // ============================================
    // RELOAD EMOTE BAR
    // ============================================

    function reloadEmoteBar(doc) {
        const emoteBar = doc.getElementById('custom-emote-bar');
        if (emoteBar) {
            const wasVisible = emoteBar.style.display !== 'none';
            emoteBar.replaceWith(createEmoteBar(doc));
            if (wasVisible) {
                doc.getElementById('custom-emote-bar').style.display = 'flex';
            }
        }
    }

    // ============================================
    // CLEANUP
    // ============================================

    function cleanupBars(doc) {
        const emoteBar = doc.getElementById('custom-emote-bar');
        const formatBar = doc.getElementById('custom-format-bar');

        if (emoteBar) {
            removeElementListeners(emoteBar);
            removeElementObservers(emoteBar);
        }
        if (formatBar) {
            removeElementListeners(formatBar);
            removeElementObservers(formatBar);
        }

        // Cleanup color picker if exists
        const colorPicker = doc.getElementById('color-picker-popup');
        if (colorPicker) {
            removeElementListeners(colorPicker);
            removeElementObservers(colorPicker);
            colorPicker.remove();
        }

        // Cleanup input observers and resizers
        const inputs = doc.querySelectorAll('[data-observer-attached]');
        inputs.forEach(input => {
            removeElementObservers(input);
            const cached = SNEED.core.events.getResizeCache(input);
            if (cached) {
                cached.cleanup();
                SNEED.core.events.deleteResizeCache(input);
            }
        });
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.ui.createEmoteBar = createEmoteBar;
    SNEED.ui.createFormatBar = createFormatBar;
    SNEED.ui.createEmoteToggleButton = createEmoteToggleButton;
    SNEED.ui.reloadEmoteBar = reloadEmoteBar;
    SNEED.ui.cleanupBars = cleanupBars;

})();
