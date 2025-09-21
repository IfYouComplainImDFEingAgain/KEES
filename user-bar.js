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
            title: 'Ross'
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

    function createEmoteBar(doc) {
        // Create the emote bar container
        const emoteBar = doc.createElement('div');
        emoteBar.id = 'custom-emote-bar';
        emoteBar.style.cssText = `
            display: none;
            align-items: center;
            padding: 8px 12px;
            background: transparent;
            border: none;
            border-radius: 4px;
            margin-bottom: 8px;
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
            margin-right: 4px;
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

            contentElement.title = `${emote.title} - Click to insert ${emote.code}`;
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

                // Auto-send the emote
                setTimeout(() => {
                    const submitBtn = (doc || document).getElementById('new-message-submit');
                    if (submitBtn) {
                        submitBtn.click();
                    }
                }, 50);
            });

            emoteBar.appendChild(emoteButton);
        });

        return emoteBar;
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

            // Create text node with emote code and a space
            const textNode = (doc || document).createTextNode(emoteCode + ' ');

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

    function modifySendButton(doc, win) {
        const submitButton = doc.getElementById('new-message-submit');
        const input = doc.getElementById('new-message-input');

        if (submitButton && !submitButton.hasAttribute('data-emote-modified')) {
            submitButton.setAttribute('data-emote-modified', 'true');

            // Store original click handler by cloning the button
            const originalButton = submitButton.cloneNode(true);

            // Create new click handler
            submitButton.addEventListener('click', (e) => {
                // If shift is held OR there's text in the input, send the message
                if (e.shiftKey || (input && input.textContent.trim().length > 0)) {
                    // Let the original handler run
                    return;
                } else {
                    // Toggle emote bar
                    e.preventDefault();
                    e.stopPropagation();

                    const emoteBar = doc.getElementById('custom-emote-bar');
                    if (emoteBar) {
                        emoteBarVisible = !emoteBarVisible;
                        emoteBar.style.display = emoteBarVisible ? 'flex' : 'none';
                    }
                }
            }, true);

            // Replace button content with Ross emote
            const svgContainer = submitButton.querySelector('.sprite');
            if (svgContainer) {
                // Create new Ross emote element with same class
                const rossEmote = doc.createElement('div');
                rossEmote.className = 'sprite';
                rossEmote.style.cssText = `
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                // Add the Ross image inside
                const rossImg = doc.createElement('img');
                rossImg.src = 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png';
                rossImg.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                    filter: brightness(0.9);
                    transition: filter 0.2s ease;
                `;

                rossEmote.appendChild(rossImg);

                // Replace the original sprite div
                svgContainer.replaceWith(rossEmote);

                // Add hover effect
                submitButton.addEventListener('mouseenter', () => {
                    rossImg.style.filter = 'brightness(1.2)';
                });

                submitButton.addEventListener('mouseleave', () => {
                    rossImg.style.filter = 'brightness(0.9)';
                });

                // Ensure button is properly styled
                submitButton.style.position = 'relative';
            }

            // Add tooltip
            submitButton.title = 'Click to toggle emotes | Shift+Click or type to send';
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
                // Insert before the form
                messageForm.parentNode.insertBefore(emoteBar, messageForm);

                // Modify the send button
                modifySendButton(document, window);

                console.log('Emote bar injected into test-chat');
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
                            // Create emote bar using the shared function
                            const emoteBar = createEmoteBar(iframeDoc);

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

                                        // Auto-send the emote
                                        setTimeout(() => {
                                            const submitBtn = iframeDoc.getElementById('new-message-submit');
                                            if (submitBtn) {
                                                submitBtn.click();
                                            }
                                        }, 50);
                                    });
                                }
                            });

                            messageForm.parentNode.insertBefore(emoteBar, messageForm);

                            // Modify the send button
                            modifySendButton(iframeDoc, iframeWindow);

                            console.log('Emote bar injected into iframe');
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
            if (!document.getElementById('custom-emote-bar')) {
                injectEmoteBar();
            }
        } else {
            // Check iframe
            const iframe = document.getElementById('rust-shim');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && !iframeDoc.getElementById('custom-emote-bar')) {
                        injectEmoteBar();
                    }
                } catch (e) {
                    // Silent fail for cross-origin
                }
            }
        }
    }, 2000);
})();
