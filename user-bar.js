// ==UserScript==
// @name         Sneedchat User Bar
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Adds a toggleable custom emote and format bar to chat.
// @author       
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

        // Define emotes with their codes and image URLs or emoji/text
        // #REQUIRED# code: is the text being entered into the text box as if you were typing it
        // url: is the URL of the thumbnail in the emote picker. You need to specify this or a title:
        // emoji: you can put emotes in code: and probably should. This makes the emoji look bigger in the picker. 
    const emotes = [
        {
            code: ':lossmanjack:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_loss.png',
            title: 'Loss Man Jack'
        },
        {
            code: ':juice:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_juicy.gif',
            title: 'Juice!'
        },
        {
            code: ':ross:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            title: 'Ross',
        },
        {
            code: ':gunt:',
            url: 'https://kiwifarms.st/styles/custom/emotes/gunt.gif',
            title: 'Gunt',
        },        
        // Example using a text entry in the bar instead of a thumbnail        
        {
            code: '[img]https://files.catbox.moe/0v5vvb.png[/img]',
            text: 'test',
            title: 'Retard Avelloon'
        },
        // Example emoji/text entries (you can add more)
        {
            code: '🤡',
            emoji: '🤡',
            title: 'What are you laughing at?'
        },
        {
            code: '5',
            text: '5',
            title: 'Type a 5 in the chat if you think hes weird.'
        },
        {
            code: '🚨[color=#ff0000]ALERT[/color]🚨 BOSSMAN IS [color=#80ff00]CLIMBING[/color]',
            text: 'Alert Bossman is climbing',
            title: 'Climbing'
        }
    ];

    // Image for the emote toggle button
    const toggleButtonConfig = {
        image: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
        title: 'Toggle emote bar'
    };

    // Text formatting tools configuration
    // You can add your own by following the examples
    const formatTools = [
        {
            name: 'Bold',
            symbol: 'B',
            startTag: '[b]',
            endTag: '[/b]',
            title: 'Bold text'
        },
        {
            name: 'Italic',
            symbol: 'I',
            startTag: '[i]',
            endTag: '[/i]',
            title: 'Italic text'
        },
        {
            name: 'Bullet',
            symbol: '•',
            customAction: 'bulletLines',
            title: 'Add bullets to lines'
        },
        {
            name: 'Image',
            symbol: '🖼',
            startTag: '[img]',
            endTag: '[/img]',
            title: 'Insert image'
        },
        {
            name: 'Color',
            symbol: '🎨',
            customAction: 'colorPicker',
            title: 'Text color'
        },
        {
            name: 'Newline',
            symbol: '↵',
            insertText: '[br]',
            title: 'Insert line break'
        }
    ];

    let emoteBarVisible = false;

    // Event listener management for cleanup
    const eventListeners = new WeakMap();
    const globalListeners = [];

    // Observer management for cleanup
    const observers = new WeakMap();
    const globalObservers = [];

    function addManagedEventListener(element, event, handler, options) {
        if (!element) return;

        element.addEventListener(event, handler, options);

        // Store listener info for cleanup
        if (!eventListeners.has(element)) {
            eventListeners.set(element, []);
        }
        eventListeners.get(element).push({ event, handler, options });
    }

    function removeElementListeners(element) {
        const listeners = eventListeners.get(element);
        if (listeners) {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            eventListeners.delete(element);
        }
    }

    function addGlobalEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        globalListeners.push({ element, event, handler, options });
    }

    function cleanupAllListeners() {
        // Cleanup global listeners
        globalListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        globalListeners.length = 0;
    }

    // Observer management functions
    function addManagedObserver(element, observer, isGlobal = false) {
        if (isGlobal) {
            globalObservers.push({ observer, element });
        } else if (element) {
            if (!observers.has(element)) {
                observers.set(element, []);
            }
            observers.get(element).push(observer);
        }
        return observer;
    }

    function removeElementObservers(element) {
        const elementObservers = observers.get(element);
        if (elementObservers) {
            elementObservers.forEach(observer => {
                observer.disconnect();
            });
            observers.delete(element);
        }
    }

    function cleanupAllObservers() {
        // Cleanup global observers
        globalObservers.forEach(({ observer }) => {
            observer.disconnect();
        });
        globalObservers.length = 0;

        // Cleanup any stored resize observers and resizers
        document.querySelectorAll('[data-observer-attached]').forEach(element => {
            if (element._resizeObserver) {
                element._resizeObserver.disconnect();
                delete element._resizeObserver;
            }
            removeElementObservers(element);

            // Cleanup optimized resizers
            const cached = resizeCache.get(element);
            if (cached) {
                cached.cleanup();
                resizeCache.delete(element);
            }
        });
    }

    // Configuration constants
    const CONFIG = {
        MAX_INPUT_HEIGHT: 200,
        RESIZE_DEBOUNCE_DELAY: 16, // ~60fps
        AUTO_SEND_DELAY: 50,
        INIT_DELAY: 500,
        POLLING_CHECK_DELAY: 1000
    };

    // Styles configuration
    const STYLES = {
        emoteBar: {
            display: 'none',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.1)',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            marginBottom: '0px',
            gap: '8px',
            flexWrap: 'wrap',
            transition: 'all 0.3s ease'
        },
        formatBar: {
            display: 'none',
            alignItems: 'center',
            padding: '6px 12px',
            background: 'rgba(0, 0, 0, 0.15)',
            border: 'none',
            borderRadius: '0 0 4px 4px',
            marginBottom: '8px',
            gap: '6px',
            flexWrap: 'wrap',
            transition: 'all 0.3s ease'
        },
        label: {
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '13px',
            fontWeight: '500',
            marginRight: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        formatLabel: {
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            fontWeight: '500',
            marginRight: '6px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        emoteButton: {
            background: 'transparent',
            border: '1px solid transparent',
            padding: '4px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
        },
        formatButton: {
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '3px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.9)',
            minWidth: '28px',
            height: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        emoteToggleButton: {
            background: 'transparent',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            marginRight: '4px'
        },
        toggleImg: {
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            display: 'block',
            filter: 'brightness(0.9)',
            transition: 'filter 0.2s ease'
        },
        emoteImage: {
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            display: 'block'
        },
        emoteEmoji: {
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px'
        },
        emoteText: {
            fontSize: '10px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            textAlign: 'center',
            lineHeight: '1'
        },
        colorPicker: {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: '1000',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
        },
        colorButton: {
            width: '32px',
            height: '32px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
        },
        colorPickerCloseButton: {
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
        },
        measureElement: {
            position: 'absolute',
            visibility: 'hidden',
            height: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            pointerEvents: 'none',
            zIndex: '-1000'
        }
    };

    // Helper function to convert style object to CSS string
    function stylesToString(styles) {
        return Object.entries(styles)
            .map(([key, value]) => {
                const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${cssKey}: ${value}`;
            })
            .join('; ');
    }

    // Optimized input resize system
    const resizeCache = new WeakMap();

    function createOptimizedResizer(inputElement, doc) {
        let measureElement = null;
        let debounceTimer = null;
        let computedStyles = null;

        // Create reusable measurement element
        function createMeasurementElement() {
            if (measureElement) return measureElement;

            measureElement = (doc || document).createElement('div');
            measureElement.style.cssText = stylesToString(STYLES.measureElement);
            (doc || document).body.appendChild(measureElement);
            return measureElement;
        }

        // Cache computed styles
        function getComputedStyles() {
            if (computedStyles) return computedStyles;

            const styles = (doc ? doc.defaultView : window).getComputedStyle(inputElement);
            computedStyles = {
                fontFamily: styles.fontFamily,
                fontSize: styles.fontSize,
                lineHeight: styles.lineHeight,
                padding: styles.padding,
                border: styles.border,
                width: inputElement.offsetWidth
            };
            return computedStyles;
        }

        // Optimized resize function
        function resizeInput() {
            // Clear any pending resize
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
                const currentHeight = parseInt(inputElement.style.height) || inputElement.offsetHeight;
                const content = inputElement.textContent || '\u00A0';

                // Early return for empty content
                if (!inputElement.textContent || inputElement.textContent.trim() === '') {
                    const originalHeight = inputElement.offsetHeight;
                    if (Math.abs(originalHeight - currentHeight) > 1) {
                        inputElement.style.height = 'auto';
                    }
                    return;
                }

                // Use cached measurement element
                const measurer = createMeasurementElement();
                const styles = getComputedStyles();

                // Apply styles to measurement element
                Object.assign(measurer.style, {
                    width: styles.width + 'px',
                    fontFamily: styles.fontFamily,
                    fontSize: styles.fontSize,
                    lineHeight: styles.lineHeight,
                    padding: styles.padding,
                    border: styles.border
                });

                measurer.textContent = content;
                const contentHeight = measurer.offsetHeight;

                // Calculate new height within bounds
                const newHeight = Math.min(CONFIG.MAX_INPUT_HEIGHT, contentHeight);

                // Only update if significantly different
                if (Math.abs(newHeight - currentHeight) > 1) {
                    inputElement.style.height = newHeight + 'px';
                }
            }, CONFIG.RESIZE_DEBOUNCE_DELAY);
        }

        // Cleanup function
        function cleanup() {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            if (measureElement) {
                measureElement.remove();
                measureElement = null;
            }
            computedStyles = null;
        }

        // Store cleanup function for later use
        resizeCache.set(inputElement, { resizeInput, cleanup });

        return { resizeInput, cleanup };
    }

    // Enhanced cleanup for when bars are removed
    function cleanupBars() {
        const emoteBar = document.getElementById('custom-emote-bar');
        const formatBar = document.getElementById('custom-format-bar');

        if (emoteBar) {
            removeElementListeners(emoteBar);
            removeElementObservers(emoteBar);
        }
        if (formatBar) {
            removeElementListeners(formatBar);
            removeElementObservers(formatBar);
        }

        // Cleanup color picker if exists
        const colorPicker = document.getElementById('color-picker-popup');
        if (colorPicker) {
            removeElementListeners(colorPicker);
            removeElementObservers(colorPicker);
            colorPicker.remove();
        }

        // Cleanup input observers and resizers
        const inputs = document.querySelectorAll('[data-observer-attached]');
        inputs.forEach(input => {
            removeElementObservers(input);

            // Cleanup optimized resizers
            const cached = resizeCache.get(input);
            if (cached) {
                cached.cleanup();
                resizeCache.delete(input);
            }
        });
    }

    // Reusable Shift+Enter handler for multiline input
    function createShiftEnterHandler(doc) {
        return function(e) {
            if (e.key === 'Enter' && e.shiftKey) {
                // Shift+Enter: Insert newline instead of sending
                e.preventDefault();
                e.stopPropagation();

                // Insert newline at cursor position
                const win = doc ? doc.defaultView : window;
                const selection = win.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const textNode = (doc || document).createTextNode('\n');
                    range.deleteContents();
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Trigger input event
                    const inputElement = e.target;
                    const event = new Event('input', {
                        bubbles: true,
                        cancelable: true,
                    });
                    inputElement.dispatchEvent(event);
                }
                return false;
            }
        };
    }

    // Helper function to attach Shift+Enter handler
    function attachShiftEnterHandler(inputElement, doc) {
        if (!inputElement || inputElement.hasAttribute('data-shift-enter-handler')) {
            return;
        }

        inputElement.setAttribute('data-shift-enter-handler', 'true');
        const handler = createShiftEnterHandler(doc);
        addManagedEventListener(inputElement, 'keydown', handler, true);
    }


    function createEmoteBar(doc) {
        // Create the emote bar container
        const emoteBar = doc.createElement('div');
        emoteBar.id = 'custom-emote-bar';
        emoteBar.style.cssText = stylesToString(STYLES.emoteBar);

        // Add label
        const label = doc.createElement('div');
        label.textContent = 'Quick Emotes:';
        label.style.cssText = stylesToString(STYLES.label);
        emoteBar.appendChild(label);

        // Create emote buttons
        emotes.forEach(emote => {
            const emoteButton = doc.createElement('button');
            emoteButton.type = 'button';
            emoteButton.style.cssText = stylesToString(STYLES.emoteButton);

            // Create content element (image, emoji, or text)
            let contentElement;

            if (emote.url) {
                // Image emote
                contentElement = doc.createElement('img');
                contentElement.src = emote.url;
                contentElement.alt = emote.code;
                contentElement.style.cssText = stylesToString(STYLES.emoteImage);
            } else if (emote.emoji) {
                // Emoji emote
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.emoji;
                contentElement.style.cssText = stylesToString(STYLES.emoteEmoji);
            } else if (emote.text) {
                // Text emote
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.text;
                contentElement.style.cssText = stylesToString(STYLES.emoteText);
            }

            contentElement.title = emote.title ?
                `${emote.title} - Click to insert ${emote.code}, Shift+Click to insert without auto-send` :
                `Click to insert ${emote.code}, Shift+Click to insert without auto-send`;
            emoteButton.appendChild(contentElement);

            // Add hover effect
            addManagedEventListener(emoteButton, 'mouseenter', () => {
                emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
                emoteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            addManagedEventListener(emoteButton, 'mouseleave', () => {
                emoteButton.style.background = 'transparent';
                emoteButton.style.borderColor = 'transparent';
            });

            // Add click handler
            addManagedEventListener(emoteButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                insertEmote(emote.code, doc);

                // Auto-send the emote only if the input box is empty AND autoSend is not false AND shift wasn't held
                setTimeout(() => {
                    const input = (doc || document).getElementById('new-message-input');
                    if (emote.autoSend !== false && !e.shiftKey && input && input.textContent.trim() === emote.code.trim()) {
                        // Input only contains the emote we just added, so auto-send
                        const submitBtn = (doc || document).getElementById('new-message-submit');
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    }
                }, CONFIG.AUTO_SEND_DELAY);
            });

            emoteBar.appendChild(emoteButton);
        });

        return emoteBar;
    }

    function createFormatBar(doc) {
        // Create the format bar container
        const formatBar = doc.createElement('div');
        formatBar.id = 'custom-format-bar';
        formatBar.style.cssText = stylesToString(STYLES.formatBar);

        // Add label
        const label = doc.createElement('div');
        label.textContent = 'Format:';
        label.style.cssText = stylesToString(STYLES.formatLabel);
        formatBar.appendChild(label);

        // Create format tool buttons
        formatTools.forEach(tool => {
            const toolButton = doc.createElement('button');
            toolButton.type = 'button';
            toolButton.style.cssText = stylesToString(STYLES.formatButton);

            toolButton.textContent = tool.symbol;
            toolButton.title = tool.title;

            // Add hover effect
            addManagedEventListener(toolButton, 'mouseenter', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.2)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });

            addManagedEventListener(toolButton, 'mouseleave', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.1)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            // Add click handler
            addManagedEventListener(toolButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applyFormatting(tool, doc);
            });

            formatBar.appendChild(toolButton);
        });

        return formatBar;
    }

    function applyFormatting(tool, doc) {
        const input = (doc || document).getElementById('new-message-input');
        if (!input) return;

        input.focus();

        const selection = (doc ? doc.defaultView : window).getSelection();
        let range;

        if (selection.rangeCount === 0) {
            range = (doc || document).createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            selection.addRange(range);
        } else {
            range = selection.getRangeAt(0);
        }

        let textToInsert;

        if (tool.customAction === 'bulletLines') {
            // Handle bullet lines custom action
            const selectedText = selection.toString();
            if (selectedText) {
                // Split by lines and add bullets to each line
                const lines = selectedText.split('\n');
                textToInsert = lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('•')) {
                        return '• ' + trimmed;
                    }
                    return line;
                }).join('\n');
            } else {
                // No selection, just insert a bullet
                textToInsert = '• ';
            }
        } else if (tool.customAction === 'colorPicker') {
            // Handle color picker custom action
            showColorPicker(input, selection, range, doc);
            return; // Exit early since color picker handles its own insertion
        } else if (tool.insertText) {
            // Simple text insertion (like newline)
            textToInsert = tool.insertText;
        } else if (tool.startTag || tool.endTag) {
            // BBCode tag insertion with toggle functionality
            const selectedText = selection.toString();

            // Safely handle both paired and single-sided tags
            const hasStartTag = !!tool.startTag;
            const hasEndTag = !!tool.endTag;
            const isPairedTag = hasStartTag && hasEndTag;

            if (selectedText) {
                // Check if the selected text already has the tags (safely)
                const startsWithTag = hasStartTag && selectedText.startsWith(tool.startTag);
                const endsWithTag = hasEndTag && selectedText.endsWith(tool.endTag);

                if (isPairedTag && startsWithTag && endsWithTag) {
                    // Remove existing paired tags
                    textToInsert = selectedText.slice(tool.startTag.length, -tool.endTag.length);
                } else if (!isPairedTag && hasStartTag && startsWithTag) {
                    // Remove existing start-only tag
                    textToInsert = selectedText.slice(tool.startTag.length);
                } else if (!isPairedTag && hasEndTag && endsWithTag) {
                    // Remove existing end-only tag
                    textToInsert = selectedText.slice(0, -tool.endTag.length);
                } else {
                    // Add tags (safely handle undefined tags)
                    const prefix = tool.startTag || '';
                    const suffix = tool.endTag || '';
                    textToInsert = prefix + selectedText + suffix;
                }
            } else {
                // Insert tags with cursor positioning
                const prefix = tool.startTag || '';
                const suffix = tool.endTag || '';
                textToInsert = prefix + suffix;
            }
        }

        if (textToInsert !== undefined) {
            const textNode = (doc || document).createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);

            // Position cursor appropriately based on tag type
            if (tool.startTag && tool.endTag && !selection.toString()) {
                // Position cursor between paired tags
                const position = tool.startTag.length;
                range.setStart(textNode, position);
                range.setEnd(textNode, position);
            } else if (tool.startTag && !tool.endTag) {
                // Position cursor after start-only tag
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
            } else {
                // Position cursor after inserted text
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
            }

            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            const event = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(event);
        }

        input.focus();
    }

    function showColorPicker(input, selection, range, doc) {
        // Color palette
        const colors = [
            { name: 'Red', hex: '#ff0000' },
            { name: 'Greentext', hex: '#789922' },
            { name: 'Blue', hex: '#0080ff' },
            { name: 'Purple', hex: '#8000ff' },
            { name: 'Orange', hex: '#ff8000' },
            { name: 'Pink', hex: '#ff0080' },
            { name: 'Yellow', hex: '#ffff00' },
            { name: 'Cyan', hex: '#00ffff' },
            { name: 'Lime', hex: '#80ff00' },
            { name: 'Magenta', hex: '#ff00ff' },
            { name: 'Brown', hex: '#8b4513' },
            { name: 'Gray', hex: '#808080' }
        ];

        // Create color picker popup
        const colorPicker = doc.createElement('div');
        colorPicker.id = 'color-picker-popup';
        colorPicker.style.cssText = stylesToString(STYLES.colorPicker);

        // Position near the input
        const inputRect = input.getBoundingClientRect();
        colorPicker.style.left = (inputRect.left + 20) + 'px';
        colorPicker.style.top = (inputRect.top - 120) + 'px';

        // Create color buttons
        colors.forEach(color => {
            const colorButton = doc.createElement('button');
            colorButton.type = 'button';
            colorButton.style.cssText = stylesToString({
                ...STYLES.colorButton,
                background: color.hex
            });
            colorButton.title = color.name;

            // Hover effect
            addManagedEventListener(colorButton, 'mouseenter', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.8)';
                colorButton.style.transform = 'scale(1.1)';
            });

            addManagedEventListener(colorButton, 'mouseleave', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                colorButton.style.transform = 'scale(1)';
            });

            // Click handler
            addManagedEventListener(colorButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const selectedText = selection.toString();
                let textToInsert;

                if (selectedText) {
                    // Check if text already has color tags
                    const colorRegex = /^\[color=#[0-9a-fA-F]{6}\](.*)\[\/color\]$/;
                    const match = selectedText.match(colorRegex);

                    if (match) {
                        // Remove existing color tags
                        textToInsert = match[1];
                    } else {
                        // Add color tags
                        textToInsert = `[color=${color.hex}]${selectedText}[/color]`;
                    }
                } else {
                    // Insert empty color tags
                    textToInsert = `[color=${color.hex}][/color]`;
                }

                // Insert the text
                const textNode = doc.createTextNode(textToInsert);
                range.deleteContents();
                range.insertNode(textNode);

                // Position cursor appropriately
                if (!selectedText) {
                    // Position cursor between tags
                    const position = `[color=${color.hex}]`.length;
                    range.setStart(textNode, position);
                    range.setEnd(textNode, position);
                } else {
                    // Position cursor after inserted text
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                }

                selection.removeAllRanges();
                selection.addRange(range);

                // Trigger input event
                const event = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                input.dispatchEvent(event);

                // Remove color picker and refocus input
                colorPicker.remove();
                input.focus();
            });

            colorPicker.appendChild(colorButton);
        });

        // Add close button
        const closeButton = doc.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.style.cssText = stylesToString(STYLES.colorPickerCloseButton);

        addManagedEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            colorPicker.remove();
            removeElementListeners(colorPicker);
            input.focus();
        });

        colorPicker.appendChild(closeButton);

        // Click outside to close
        const clickOutside = (e) => {
            if (!colorPicker.contains(e.target)) {
                colorPicker.remove();
                removeElementListeners(colorPicker);
                doc.removeEventListener('click', clickOutside);
                input.focus();
            }
        };

        // Add to page and set up outside click handler
        doc.body.appendChild(colorPicker);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    function insertEmote(emoteCode, doc) {
        // Find the input element
        const input = (doc || document).getElementById('new-message-input');

        if (input && input.contentEditable === 'true') {
            // Focus the input first
            input.focus();

            // Get or create a selection
            const win = doc ? doc.defaultView : window;
            const selection = win.getSelection();
            let range;

            // If there's no selection, create one at the end
            if (selection.rangeCount === 0) {
                range = (doc || document).createRange();
                range.selectNodeContents(input);
                range.collapse(false);
                selection.addRange(range);
            } else {
                range = selection.getRangeAt(0);
            }

            // Create text node with emote code (no space for auto-send)
            const textNode = (doc || document).createTextNode(emoteCode);

            // Insert the text node
            range.deleteContents();
            range.insertNode(textNode);

            // Move cursor after the inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event for any listeners
            const event = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(event);

            // Keep focus on input
            input.focus();
        }
    }

    function createEmoteToggleButton(doc) {
        // Create emote toggle button
        const emoteButton = doc.createElement('button');
        emoteButton.id = 'emote-toggle-button';
        emoteButton.type = 'button';
        emoteButton.style.cssText = stylesToString(STYLES.emoteToggleButton);

        // Create toggle button image content
        const toggleImg = doc.createElement('img');
        toggleImg.src = toggleButtonConfig.image;
        toggleImg.style.cssText = stylesToString(STYLES.toggleImg);

        emoteButton.appendChild(toggleImg);

        // Add hover effect
        addManagedEventListener(emoteButton, 'mouseenter', () => {
            emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
            toggleImg.style.filter = 'brightness(1.2)';
        });

        addManagedEventListener(emoteButton, 'mouseleave', () => {
            emoteButton.style.background = 'transparent';
            toggleImg.style.filter = 'brightness(0.9)';
        });

        // Add click handler
        addManagedEventListener(emoteButton, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Toggle both emote bar and format bar
            const emoteBar = doc.getElementById('custom-emote-bar');
            const formatBar = doc.getElementById('custom-format-bar');
            const inputElement = doc.getElementById('new-message-input');

            if (emoteBar && formatBar) {
                emoteBarVisible = !emoteBarVisible;
                emoteBar.style.display = emoteBarVisible ? 'flex' : 'none';
                formatBar.style.display = emoteBarVisible ? 'flex' : 'none';
            }
        });

        emoteButton.title = toggleButtonConfig.title;
        return emoteButton;
    }

    function addEmoteToggleButton(doc) {
        const buttonsContainer = doc.querySelector('.chat-form-buttons');
        const submitButton = doc.getElementById('new-message-submit');
        const inputElement = doc.getElementById('new-message-input');

        if (buttonsContainer && submitButton && inputElement && !doc.getElementById('emote-toggle-button')) {
            // Hide the original send button
            submitButton.style.display = 'none';

            // Add auto-resize functionality with optimized resizer
            inputElement.style.maxHeight = CONFIG.MAX_INPUT_HEIGHT + 'px';
            inputElement.style.overflowY = 'auto';
            inputElement.style.resize = 'none';

            // Create optimized resizer
            const { resizeInput, cleanup } = createOptimizedResizer(inputElement, doc);

            // Listen for input changes to trigger resize
            addManagedEventListener(inputElement, 'input', resizeInput);
            addManagedEventListener(inputElement, 'paste', () => setTimeout(resizeInput, 0));

            // Watch for when input gets cleared (message sent)
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

                // Store observer for cleanup using managed system
                addManagedObserver(inputElement, observer);
                inputElement.setAttribute('data-observer-attached', 'true');
                inputElement._resizeObserver = observer;  // Keep for backward compatibility
            }

            // Also watch for form submission to immediately reset
            const messageForm = doc.getElementById('new-message-form');
            if (messageForm) {
                addManagedEventListener(messageForm, 'submit', () => {
                    setTimeout(() => {
                        inputElement.style.height = 'auto';
                        resizeInput();
                    }, 100);
                });
            }

            // Add Shift+Enter handler for multiline input
            attachShiftEnterHandler(inputElement, doc);

            // Also handle regular Enter for resize
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

            // Create emote toggle button
            const emoteToggleBtn = createEmoteToggleButton(doc);

            // Position the toggle button at the right edge of the input box
            emoteToggleBtn.style.position = 'absolute';
            emoteToggleBtn.style.right = '8px';
            emoteToggleBtn.style.top = '50%';
            emoteToggleBtn.style.transform = 'translateY(-50%)';
            emoteToggleBtn.style.zIndex = '10';

            // Make the input container relative positioned
            const inputContainer = inputElement.parentElement;
            if (inputContainer) {
                inputContainer.style.position = 'relative';
                inputContainer.appendChild(emoteToggleBtn);
            }
        }
    }

    function injectEmoteBar() {
        // Check if we're in the iframe or main page
        const isIframe = window.location.pathname.includes('test-chat');

        if (isIframe) {
            // We're in the test-chat iframe
            const messageForm = document.getElementById('new-message-form');

            if (messageForm && !document.getElementById('custom-emote-bar')) {
                const emoteBar = createEmoteBar(document);
                const formatBar = createFormatBar(document);

                // Insert both bars before the form
                messageForm.parentNode.insertBefore(emoteBar, messageForm);
                messageForm.parentNode.insertBefore(formatBar, messageForm);

                // Add emote toggle button next to send button
                addEmoteToggleButton(document);

                // Add Shift+Enter handler for direct iframe context
                const directInput = document.getElementById('new-message-input');
                attachShiftEnterHandler(directInput, document);

                console.log('Emote and format bars injected into test-chat');
            }
        } else {
            // We're in the parent page, need to wait for iframe
            const iframe = document.getElementById('rust-shim');

            if (iframe) {
                // Try to access iframe content
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const iframeWindow = iframe.contentWindow;

                    if (iframeDoc && iframeDoc.readyState === 'complete') {
                        const messageForm = iframeDoc.getElementById('new-message-form');

                        if (messageForm && !iframeDoc.getElementById('custom-emote-bar')) {
                            // Create emote bar and format bar using the shared functions
                            const emoteBar = createEmoteBar(iframeDoc);
                            const formatBar = createFormatBar(iframeDoc);

                            // Re-attach event listeners for iframe context
                            const buttons = emoteBar.querySelectorAll('button');
                            buttons.forEach((button, index) => {
                                if (index < emotes.length) {
                                    const emote = emotes[index];

                                    // Replace click handler for iframe context
                                    button.replaceWith(button.cloneNode(true));
                                    const newButton = emoteBar.querySelectorAll('button')[index];

                                    addManagedEventListener(newButton, 'mouseenter', () => {
                                        newButton.style.background = 'rgba(255, 255, 255, 0.1)';
                                        newButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    });

                                    addManagedEventListener(newButton, 'mouseleave', () => {
                                        newButton.style.background = 'transparent';
                                        newButton.style.borderColor = 'transparent';
                                    });

                                    addManagedEventListener(newButton, 'click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        insertEmote(emote.code, iframeDoc);

                                        // Auto-send the emote only if the input box is empty AND autoSend is not false AND shift wasn't held
                                        setTimeout(() => {
                                            const input = iframeDoc.getElementById('new-message-input');
                                            if (emote.autoSend !== false && !e.shiftKey && input && input.textContent.trim() === emote.code.trim()) {
                                                // Input only contains the emote we just added, so auto-send
                                                const submitBtn = iframeDoc.getElementById('new-message-submit');
                                                if (submitBtn) {
                                                    submitBtn.click();
                                                }
                                            }
                                        }, CONFIG.AUTO_SEND_DELAY);
                                    });
                                }
                            });

                            messageForm.parentNode.insertBefore(emoteBar, messageForm);
                            messageForm.parentNode.insertBefore(formatBar, messageForm);

                            // Add emote toggle button next to send button
                            addEmoteToggleButton(iframeDoc);

                            // Add Shift+Enter handler for iframe context
                            const iframeInput = iframeDoc.getElementById('new-message-input');
                            attachShiftEnterHandler(iframeInput, iframeDoc);

                            console.log('Emote and format bars injected into iframe');
                        }
                    }
                } catch (e) {
                    console.log('Cannot access iframe content (cross-origin):', e);
                }
            }
        }
    }

    // Wait for DOM to be ready
    function waitForReady() {
        if (document.readyState === 'loading') {
            addGlobalEventListener(document, 'DOMContentLoaded', () => {
                setTimeout(injectEmoteBar, CONFIG.INIT_DELAY);
            });
        } else {
            setTimeout(injectEmoteBar, CONFIG.INIT_DELAY);
        }
    }

    waitForReady();

    // Smart detection using MutationObserver instead of setInterval
    let reinjectAttempts = 0;
    const MAX_REINJECT_ATTEMPTS = 10;

    function checkAndReinject() {
        if (reinjectAttempts >= MAX_REINJECT_ATTEMPTS) return;

        const isIframe = window.location.pathname.includes('test-chat');

        if (isIframe) {
            if (!document.getElementById('custom-emote-bar') || !document.getElementById('custom-format-bar')) {
                injectEmoteBar();
                reinjectAttempts++;
            }
        } else {
            // Check iframe
            const iframe = document.getElementById('rust-shim');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && (!iframeDoc.getElementById('custom-emote-bar') || !iframeDoc.getElementById('custom-format-bar'))) {
                        injectEmoteBar();
                        reinjectAttempts++;
                    }
                } catch (e) {
                    // Silent fail for cross-origin
                }
            }
        }
    }

    // Use MutationObserver to detect when chat UI might have been replaced
    const mainObserver = new MutationObserver((mutations) => {
        // Check if our elements were removed
        const needsReinject = mutations.some(mutation => {
            return Array.from(mutation.removedNodes).some(node => {
                if (node.nodeType === 1) { // Element node
                    // Also cleanup if our elements are removed
                    if (node.id === 'custom-emote-bar' || node.id === 'custom-format-bar') {
                        cleanupBars();
                    }
                    return node.id === 'custom-emote-bar' ||
                           node.id === 'custom-format-bar' ||
                           node.querySelector?.('#custom-emote-bar') ||
                           node.querySelector?.('#custom-format-bar');
                }
                return false;
            });
        });

        if (needsReinject) {
            checkAndReinject();
        }
    });

    // Observe the body for changes using managed observer
    if (document.body) {
        mainObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        addManagedObserver(document.body, mainObserver, true);
    }

    // Also check when page becomes visible (user switches tabs back)
    addGlobalEventListener(document, 'visibilitychange', () => {
        if (!document.hidden) {
            checkAndReinject();
        }
    });

    // Check on focus as backup
    addGlobalEventListener(window, 'focus', () => {
        checkAndReinject();
    });

    // Initial check after a short delay for dynamic content
    setTimeout(checkAndReinject, CONFIG.POLLING_CHECK_DELAY);

    // Cleanup on page unload
    addGlobalEventListener(window, 'unload', () => {
        // Cleanup all observers using the managed system
        cleanupAllObservers();

        // Cleanup all event listeners
        cleanupAllListeners();

        // Final cleanup of bars
        cleanupBars();
    });
})();
