// ==UserScript==
// @name         Sneedchat User Bar
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds a toggleable custom emote bar to chat.
// @author       Claudette
// @match        https://kiwifarms.st/chat/*
// @match        https://kiwifarms.st/test-chat*
// @match        https://kiwifarms.tw/chat/*
// @match        https://kiwifarms.tw/test-chat*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Define emotes with their codes and image URLs or emoji/text
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
        // Example emoji/text entries (you can add more)
        {
            code: '👍',
            emoji: '👍',
            title: 'Thumbs Up'
        },
        {
            code: '😂',
            emoji: '😂',
            title: 'Laughing'
        },
        {
            code: 'kek',
            text: 'KEK',
            title: 'Kek'
        }
    ];

    let emoteBarVisible = false;

    // Configuration for the emote toggle button
    const toggleButtonConfig = {
        image: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
        title: 'Toggle emote bar'
    };

    // Text formatting tools configuration
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

    function createEmoteBar(doc) {
        // Create the emote bar container
        const emoteBar = doc.createElement('div');
        emoteBar.id = 'custom-emote-bar';
        emoteBar.style.cssText = `
            display: none;
            align-items: center;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.1);
            border: none;
            border-radius: 4px 4px 0 0;
            margin-bottom: 0px;
            gap: 8px;
            flex-wrap: wrap;
            transition: all 0.3s ease;
        `;

        // Add label
        const label = doc.createElement('div');
        label.textContent = 'Quick Emotes:';
        label.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 500;
            margin-right: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        emoteBar.appendChild(label);

        // Create emote buttons
        emotes.forEach(emote => {
            const emoteButton = doc.createElement('button');
            emoteButton.type = 'button';
            emoteButton.style.cssText = `
                background: transparent;
                border: 1px solid transparent;
                padding: 4px;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                outline: none;
            `;

            // Create content element (image, emoji, or text)
            let contentElement;

            if (emote.url) {
                // Image emote
                contentElement = doc.createElement('img');
                contentElement.src = emote.url;
                contentElement.alt = emote.code;
                contentElement.style.cssText = `
                    width: 24px;
                    height: 24px;
                    object-fit: contain;
                    display: block;
                `;
            } else if (emote.emoji) {
                // Emoji emote
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.emoji;
                contentElement.style.cssText = `
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                `;
            } else if (emote.text) {
                // Text emote
                contentElement = doc.createElement('span');
                contentElement.textContent = emote.text;
                contentElement.style.cssText = `
                    font-size: 10px;
                    font-weight: bold;
                    color: rgba(255, 255, 255, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    text-align: center;
                    line-height: 1;
                `;
            }

            contentElement.title = emote.title ? `${emote.title} - Click to insert ${emote.code}` : `Click to insert ${emote.code}`;
            emoteButton.appendChild(contentElement);

            // Add hover effect
            emoteButton.addEventListener('mouseenter', () => {
                emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
                emoteButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            emoteButton.addEventListener('mouseleave', () => {
                emoteButton.style.background = 'transparent';
                emoteButton.style.borderColor = 'transparent';
            });

            // Add click handler
            emoteButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                insertEmote(emote.code, doc);

                // Auto-send the emote only if the input box is empty AND autoSend is not false
                setTimeout(() => {
                    const input = (doc || document).getElementById('new-message-input');
                    if (emote.autoSend !== false && input && input.textContent.trim() === emote.code.trim()) {
                        // Input only contains the emote we just added, so auto-send
                        const submitBtn = (doc || document).getElementById('new-message-submit');
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    }
                }, 50);
            });

            emoteBar.appendChild(emoteButton);
        });

        return emoteBar;
    }

    function createFormatBar(doc) {
        // Create the format bar container
        const formatBar = doc.createElement('div');
        formatBar.id = 'custom-format-bar';
        formatBar.style.cssText = `
            display: none;
            align-items: center;
            padding: 6px 12px;
            background: rgba(0, 0, 0, 0.15);
            border: none;
            border-radius: 0 0 4px 4px;
            margin-bottom: 8px;
            gap: 6px;
            flex-wrap: wrap;
            transition: all 0.3s ease;
        `;

        // Add label
        const label = doc.createElement('div');
        label.textContent = 'Format:';
        label.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-weight: 500;
            margin-right: 6px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        formatBar.appendChild(label);

        // Create format tool buttons
        formatTools.forEach(tool => {
            const toolButton = doc.createElement('button');
            toolButton.type = 'button';
            toolButton.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 4px 8px;
                cursor: pointer;
                border-radius: 3px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                outline: none;
                font-size: 11px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.9);
                min-width: 28px;
                height: 24px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;

            toolButton.textContent = tool.symbol;
            toolButton.title = tool.title;

            // Add hover effect
            toolButton.addEventListener('mouseenter', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.2)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });

            toolButton.addEventListener('mouseleave', () => {
                toolButton.style.background = 'rgba(255, 255, 255, 0.1)';
                toolButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            // Add click handler
            toolButton.addEventListener('click', (e) => {
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
        } else if (tool.startTag && tool.endTag) {
            // BBCode tag insertion with toggle functionality
            const selectedText = selection.toString();
            if (selectedText) {
                // Check if the selected text already has the tags
                const startsWithTag = selectedText.startsWith(tool.startTag);
                const endsWithTag = selectedText.endsWith(tool.endTag);

                if (startsWithTag && endsWithTag) {
                    // Remove existing tags
                    textToInsert = selectedText.slice(tool.startTag.length, -tool.endTag.length);
                } else {
                    // Add tags
                    textToInsert = tool.startTag + selectedText + tool.endTag;
                }
            } else {
                // Insert empty tags with cursor between
                textToInsert = tool.startTag + tool.endTag;
            }
        }

        if (textToInsert) {
            const textNode = (doc || document).createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);

            // Position cursor appropriately
            if (tool.startTag && tool.endTag && !selection.toString()) {
                // Position cursor between tags
                const position = tool.startTag.length;
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
        colorPicker.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 12px;
            z-index: 1000;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        // Position near the input
        const inputRect = input.getBoundingClientRect();
        colorPicker.style.left = (inputRect.left + 20) + 'px';
        colorPicker.style.top = (inputRect.top - 120) + 'px';

        // Create color buttons
        colors.forEach(color => {
            const colorButton = doc.createElement('button');
            colorButton.type = 'button';
            colorButton.style.cssText = `
                width: 32px;
                height: 32px;
                background: ${color.hex};
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
            `;
            colorButton.title = color.name;

            // Hover effect
            colorButton.addEventListener('mouseenter', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.8)';
                colorButton.style.transform = 'scale(1.1)';
            });

            colorButton.addEventListener('mouseleave', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                colorButton.style.transform = 'scale(1)';
            });

            // Click handler
            colorButton.addEventListener('click', (e) => {
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
        closeButton.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            color: white;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
        `;

        closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            colorPicker.remove();
            input.focus();
        });

        colorPicker.appendChild(closeButton);

        // Click outside to close
        const clickOutside = (e) => {
            if (!colorPicker.contains(e.target)) {
                colorPicker.remove();
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
        emoteButton.style.cssText = `
            background: transparent;
            border: none;
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
            margin-right: 4px;
        `;

        // Create toggle button image content
        const toggleImg = doc.createElement('img');
        toggleImg.src = toggleButtonConfig.image;
        toggleImg.style.cssText = `
            width: 24px;
            height: 24px;
            object-fit: contain;
            display: block;
            filter: brightness(0.9);
            transition: filter 0.2s ease;
        `;

        emoteButton.appendChild(toggleImg);

        // Add hover effect
        emoteButton.addEventListener('mouseenter', () => {
            emoteButton.style.background = 'rgba(255, 255, 255, 0.1)';
            toggleImg.style.filter = 'brightness(1.2)';
        });

        emoteButton.addEventListener('mouseleave', () => {
            emoteButton.style.background = 'transparent';
            toggleImg.style.filter = 'brightness(0.9)';
        });

        // Add click handler
        emoteButton.addEventListener('click', (e) => {
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

            // Add auto-resize functionality without changing original styling
            inputElement.style.maxHeight = '200px';
            inputElement.style.overflowY = 'auto';
            inputElement.style.resize = 'none';

            // Add auto-resize functionality
            function resizeInput() {
                // Store current height to avoid unnecessary changes
                const currentHeight = parseInt(inputElement.style.height) || inputElement.offsetHeight;

                // Create a temporary element to measure content height
                const tempDiv = doc.createElement('div');
                tempDiv.style.cssText = `
                    position: absolute;
                    visibility: hidden;
                    height: auto;
                    width: ${inputElement.offsetWidth}px;
                    font-family: ${window.getComputedStyle(inputElement).fontFamily};
                    font-size: ${window.getComputedStyle(inputElement).fontSize};
                    line-height: ${window.getComputedStyle(inputElement).lineHeight};
                    padding: ${window.getComputedStyle(inputElement).padding};
                    border: ${window.getComputedStyle(inputElement).border};
                    white-space: pre-wrap;
                    word-wrap: break-word;
                `;
                tempDiv.textContent = inputElement.textContent || '\u00A0'; // Use non-breaking space if empty
                doc.body.appendChild(tempDiv);

                const contentHeight = tempDiv.offsetHeight;
                doc.body.removeChild(tempDiv);

                // Set height to content height (within bounds), but preserve original when empty
                const originalHeight = inputElement.offsetHeight;
                const maxHeight = 200;
                let newHeight;

                if (!inputElement.textContent || inputElement.textContent.trim() === '') {
                    // When empty, use original height
                    newHeight = originalHeight;
                } else {
                    // When content exists, use content height with max limit
                    newHeight = Math.min(maxHeight, contentHeight);
                }

                // Only change height if it's actually different to prevent unnecessary reflows
                if (Math.abs(newHeight - currentHeight) > 1) {
                    inputElement.style.height = newHeight + 'px';
                }
            }

            // Listen for input changes to trigger resize
            inputElement.addEventListener('input', resizeInput);
            inputElement.addEventListener('paste', () => setTimeout(resizeInput, 0));

            // Watch for when input gets cleared (message sent)
            const observer = new MutationObserver(() => {
                if (!inputElement.textContent || inputElement.textContent.trim() === '') {
                    setTimeout(() => {
                        inputElement.style.height = 'auto';
                        resizeInput();
                    }, 50);
                }
            });
            observer.observe(inputElement, { childList: true, characterData: true, subtree: true });

            // Also watch for form submission to immediately reset
            const messageForm = doc.getElementById('new-message-form');
            if (messageForm) {
                messageForm.addEventListener('submit', () => {
                    setTimeout(() => {
                        inputElement.style.height = 'auto';
                        resizeInput();
                    }, 100);
                });
            }

            // Only add keydown handler if not already added
            if (!inputElement.hasAttribute('data-shift-enter-handler')) {
                inputElement.setAttribute('data-shift-enter-handler', 'true');
                inputElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        if (e.shiftKey) {
                            // Shift+Enter: Insert newline instead of sending
                            e.preventDefault();
                            e.stopPropagation();

                            // Insert newline at cursor position
                            const selection = (doc ? doc.defaultView : window).getSelection();
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
                                const event = new Event('input', {
                                    bubbles: true,
                                    cancelable: true,
                                });
                                inputElement.dispatchEvent(event);
                            }
                            return false;
                        }
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
                if (directInput && !directInput.hasAttribute('data-shift-enter-handler')) {
                    directInput.setAttribute('data-shift-enter-handler', 'true');
                    directInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && e.shiftKey) {
                            // Shift+Enter: Insert newline instead of sending
                            e.preventDefault();
                            e.stopPropagation();

                            // Insert newline at cursor position
                            const selection = window.getSelection();
                            if (selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                const textNode = document.createTextNode('\n');
                                range.deleteContents();
                                range.insertNode(textNode);
                                range.setStartAfter(textNode);
                                range.setEndAfter(textNode);
                                selection.removeAllRanges();
                                selection.addRange(range);

                                // Trigger input event
                                const event = new Event('input', {
                                    bubbles: true,
                                    cancelable: true,
                                });
                                directInput.dispatchEvent(event);
                            }
                            return false;
                        }
                    }, true);
                }

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

                                    newButton.addEventListener('mouseenter', () => {
                                        newButton.style.background = 'rgba(255, 255, 255, 0.1)';
                                        newButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    });

                                    newButton.addEventListener('mouseleave', () => {
                                        newButton.style.background = 'transparent';
                                        newButton.style.borderColor = 'transparent';
                                    });

                                    newButton.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        insertEmote(emote.code, iframeDoc);

                                        // Auto-send the emote only if the input box is empty AND autoSend is not false
                                        setTimeout(() => {
                                            const input = iframeDoc.getElementById('new-message-input');
                                            if (emote.autoSend !== false && input && input.textContent.trim() === emote.code.trim()) {
                                                // Input only contains the emote we just added, so auto-send
                                                const submitBtn = iframeDoc.getElementById('new-message-submit');
                                                if (submitBtn) {
                                                    submitBtn.click();
                                                }
                                            }
                                        }, 50);
                                    });
                                }
                            });

                            messageForm.parentNode.insertBefore(emoteBar, messageForm);
                            messageForm.parentNode.insertBefore(formatBar, messageForm);

                            // Add emote toggle button next to send button
                            addEmoteToggleButton(iframeDoc);

                            // Add Shift+Enter handler for iframe context
                            const iframeInput = iframeDoc.getElementById('new-message-input');
                            if (iframeInput && !iframeInput.hasAttribute('data-shift-enter-handler')) {
                                iframeInput.setAttribute('data-shift-enter-handler', 'true');
                                iframeInput.addEventListener('keydown', (e) => {
                                    if (e.key === 'Enter' && e.shiftKey) {
                                        // Shift+Enter: Insert newline instead of sending
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Insert newline at cursor position
                                        const selection = iframeDoc.defaultView.getSelection();
                                        if (selection.rangeCount > 0) {
                                            const range = selection.getRangeAt(0);
                                            const textNode = iframeDoc.createTextNode('\n');
                                            range.deleteContents();
                                            range.insertNode(textNode);
                                            range.setStartAfter(textNode);
                                            range.setEndAfter(textNode);
                                            selection.removeAllRanges();
                                            selection.addRange(range);

                                            // Trigger input event
                                            const event = new Event('input', {
                                                bubbles: true,
                                                cancelable: true,
                                            });
                                            iframeInput.dispatchEvent(event);
                                        }
                                        return false;
                                    }
                                }, true);
                            }

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
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(injectEmoteBar, 500);
            });
        } else {
            setTimeout(injectEmoteBar, 500);
        }
    }

    waitForReady();

    // Re-check periodically in case of dynamic loading
    setInterval(() => {
        const isIframe = window.location.pathname.includes('test-chat');

        if (isIframe) {
            if (!document.getElementById('custom-emote-bar') || !document.getElementById('custom-format-bar')) {
                injectEmoteBar();
            }
        } else {
            // Check iframe
            const iframe = document.getElementById('rust-shim');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && (!iframeDoc.getElementById('custom-emote-bar') || !iframeDoc.getElementById('custom-format-bar'))) {
                        injectEmoteBar();
                    }
                } catch (e) {
                    // Silent fail for cross-origin
                }
            }
        }
    }, 2000);
})();
