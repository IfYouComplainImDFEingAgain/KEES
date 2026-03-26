// ui/bars.js - Emote bar and format bar components
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners, removeElementObservers } = SNEED.core.events;
    const storage = SNEED.core.storage;
    const state = SNEED.state;
    const { STYLES } = SNEED.ui;

    function createEmoteBar(doc) {
        const emoteBar = doc.createElement('div');
        emoteBar.id = 'custom-emote-bar';
        emoteBar.style.cssText = stylesToString(STYLES.emoteBar);

        const emotes = state.getEmotes() || state.defaultEmotes;
        emotes.forEach(emote => {
            const emoteButton = doc.createElement('button');
            emoteButton.type = 'button';
            emoteButton.style.cssText = stylesToString(STYLES.emoteButton);

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

            addManagedEventListener(emoteButton, 'mouseenter', () => {
                emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
                emoteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            addManagedEventListener(emoteButton, 'mouseleave', () => {
                emoteButton.style.background = 'transparent';
                emoteButton.style.borderColor = 'transparent';
            });

            addManagedEventListener(emoteButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (SNEED.features.insertEmote) {
                    SNEED.features.insertEmote(emote.code, doc);
                }

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

    function createFormatBar(doc) {
        const formatBar = doc.createElement('div');
        formatBar.id = 'custom-format-bar';
        formatBar.style.cssText = stylesToString(STYLES.formatBar);

        const leftTools = doc.createElement('div');
        leftTools.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1;';

        const rightTools = doc.createElement('div');
        rightTools.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-left: auto;';

        state.formatTools.forEach(tool => {
            const toolButton = doc.createElement('button');
            toolButton.type = 'button';
            toolButton.style.cssText = stylesToString(STYLES.formatButton);
            toolButton.textContent = tool.symbol;
            toolButton.title = tool.title;
            toolButton.setAttribute('data-tool', tool.name);

            if (tool.isToggle && tool.customAction === 'toggleWysiwyg') {
                const isWysiwyg = state.isWysiwygMode();
                toolButton.style.opacity = isWysiwyg ? '0.5' : '1';
                toolButton.title = isWysiwyg ? 'WYSIWYG mode (click for raw BBCode)' : 'Raw BBCode mode (click for WYSIWYG)';
            }

            addManagedEventListener(toolButton, 'mouseenter', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.2)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });

            addManagedEventListener(toolButton, 'mouseleave', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.1)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            addManagedEventListener(toolButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (SNEED.features.applyFormatting) {
                    SNEED.features.applyFormatting(tool, doc);
                }
            });

            if (tool.name === 'Blacklist' || tool.name === 'Emotes' || tool.name === 'WysiwygToggle') {
                rightTools.appendChild(toolButton);
            } else {
                leftTools.appendChild(toolButton);
            }
        });

        formatBar.appendChild(leftTools);
        formatBar.appendChild(rightTools);

        return formatBar;
    }

    function createEmoteToggleButton(doc) {
        const emoteButton = doc.createElement('button');
        emoteButton.id = 'emote-toggle-button';
        emoteButton.type = 'button';
        emoteButton.style.cssText = stylesToString(STYLES.emoteToggleButton);

        const toggleImg = doc.createElement('img');
        toggleImg.src = state.toggleButtonConfig.image;
        toggleImg.style.cssText = stylesToString(STYLES.toggleImg);

        emoteButton.appendChild(toggleImg);

        addManagedEventListener(emoteButton, 'mouseenter', () => {
            emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
            toggleImg.style.filter = 'brightness(1.2)';
        });

        addManagedEventListener(emoteButton, 'mouseleave', () => {
            emoteButton.style.background = 'transparent';
            toggleImg.style.filter = 'brightness(0.9)';
        });

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

        const colorPicker = doc.getElementById('color-picker-popup');
        if (colorPicker) {
            removeElementListeners(colorPicker);
            removeElementObservers(colorPicker);
            colorPicker.remove();
        }

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

    SNEED.ui.createEmoteBar = createEmoteBar;
    SNEED.ui.createFormatBar = createFormatBar;
    SNEED.ui.createEmoteToggleButton = createEmoteToggleButton;
    SNEED.ui.reloadEmoteBar = reloadEmoteBar;
    SNEED.ui.cleanupBars = cleanupBars;

})();
