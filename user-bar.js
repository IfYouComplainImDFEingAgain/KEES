// ==UserScript==
// @name         Sneedchat User Bar
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Adds a toggleable custom emote and format bar with image blacklist and emote management.
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
    const defaultEmotes = [
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
        },
        {
            name: 'Blacklist',
            symbol: '🚫',
            customAction: 'blacklistManager',
            title: 'Manage blacklisted images'
        },
        {
            name: 'Emotes',
            symbol: '⚙️',
            customAction: 'emoteManager',
            title: 'Manage custom emotes'
        }
    ];

    let emoteBarVisible = false;

    // Emotes storage management
    const EMOTES_KEY = 'sneedchat-custom-emotes';

    function getEmotes() {
        try {
            const stored = localStorage.getItem(EMOTES_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultEmotes;
            }
            return defaultEmotes;
        } catch (e) {
            console.error('Failed to load emotes:', e);
            return defaultEmotes;
        }
    }

    function saveEmotes(emotesList) {
        try {
            localStorage.setItem(EMOTES_KEY, JSON.stringify(emotesList));
            return true;
        } catch (e) {
            console.error('Failed to save emotes:', e);
            return false;
        }
    }

    function resetEmotesToDefault() {
        return saveEmotes(defaultEmotes);
    }

    // Get emotes (will use stored or default)
    let emotes = getEmotes();

    // Image blacklist management
    const BLACKLIST_KEY = 'sneedchat-image-blacklist';

    function getBlacklist() {
        try {
            const stored = localStorage.getItem(BLACKLIST_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to load blacklist:', e);
            return [];
        }
    }

    function saveBlacklist(blacklist) {
        try {
            localStorage.setItem(BLACKLIST_KEY, JSON.stringify(blacklist));
            return true;
        } catch (e) {
            console.error('Failed to save blacklist:', e);
            return false;
        }
    }

    function isBlacklisted(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        return blacklist.includes(url);
    }

    function addToBlacklist(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        if (!blacklist.includes(url)) {
            blacklist.push(url);
            return saveBlacklist(blacklist);
        }
        return false;
    }

    function removeFromBlacklist(url) {
        if (!url) return false;
        const blacklist = getBlacklist();
        const index = blacklist.indexOf(url);
        if (index > -1) {
            blacklist.splice(index, 1);
            return saveBlacklist(blacklist);
        }
        return false;
    }

    function clearBlacklist() {
        return saveBlacklist([]);
    }

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

                // Capture base height on first content
                if (!baseHeight) {
                    baseHeight = inputElement.offsetHeight;
                }

                // Temporarily set to auto to measure true content height
                inputElement.style.height = 'auto';
                const scrollH = inputElement.scrollHeight;

                // Only set explicit height if content exceeds base height
                if (scrollH > baseHeight) {
                    const newH = Math.min(CONFIG.MAX_INPUT_HEIGHT, scrollH);
                    inputElement.style.height = newH + 'px';
                } else {
                    // Restore to natural height
                    inputElement.style.height = '';
                }
            });
        }

        function cleanup() {
            if (raf) cancelAnimationFrame(raf), (raf = 0);
            baseHeight = 0;
        }

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

    // Helper functions for performance-optimized observers
    function findMessageContainer(doc) {
        return (
            doc.querySelector('.messages') ||
            doc.querySelector('#messages') ||
            doc.querySelector('[class*="messages"]') ||
            doc.querySelector('[class*="chat-messages"]') ||
            doc.querySelector('.chat-log') ||
            doc.querySelector('[role="log"]') ||
            doc.body
        );
    }

    function ensureSendWatcher(doc) {
        if (doc.__sneed_sendWatcher) return doc.__sneed_sendWatcher;

        const state = { pending: null, timer: null };
        const container = findMessageContainer(doc);

        const obs = new MutationObserver((mutations) => {
            if (!state.pending) return;
            const want = (state.pending.text || '').trim();
            if (!want) return;

            for (const m of mutations) {
                for (const n of m.addedNodes) {
                    if (!n || n.nodeType !== 1) continue;
                    const t = n.textContent || '';
                    if (t.includes(want)) {
                        const done = state.pending;
                        state.pending = null;
                        if (state.timer) { clearTimeout(state.timer); state.timer = null; }
                        done.onConfirm && done.onConfirm();
                        return;
                    }
                }
            }
        });

        obs.observe(container, { childList: true, subtree: true });
        addManagedObserver(container, obs);

        doc.__sneed_sendWatcher = {
            arm(pending) {
                state.pending = pending;
                if (state.timer) clearTimeout(state.timer);
                state.timer = setTimeout(() => {
                    const still = state.pending;
                    state.pending = null;
                    if (still && still.onFail) still.onFail();
                }, 3000);
            },
            clear() {
                state.pending = null;
                if (state.timer) { clearTimeout(state.timer); state.timer = null; }
            }
        };
        return doc.__sneed_sendWatcher;
    }

    function observeForIframe(doc) {
        if (doc.__sneed_iframe_observed) return;
        doc.__sneed_iframe_observed = true;

        const obs = new MutationObserver(() => {
            const iframe = doc.getElementById('rust-shim');
            if (iframe && !iframe.__sneed_observed) {
                iframe.__sneed_observed = true;
                iframe.addEventListener('load', () => checkAndReinject(), { passive: true });
                setTimeout(checkAndReinject, 50);
            }
        });
        obs.observe(doc.documentElement, { childList: true, subtree: true });
        addManagedObserver(doc.documentElement, obs, true);
    }

    function observeForBarsRemoval(chatRoot, doc) {
        if (chatRoot.__sneed_bar_observed) return;
        chatRoot.__sneed_bar_observed = true;

        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const n of m.removedNodes) {
                    if (!n || n.nodeType !== 1) continue;
                    if (
                        n.id === 'custom-emote-bar' || n.id === 'custom-format-bar' ||
                        n.querySelector?.('#custom-emote-bar') || n.querySelector?.('#custom-format-bar')
                    ) {
                        cleanupBars();
                        checkAndReinject();
                        return;
                    }
                }
            }
        });
        obs.observe(chatRoot, { childList: true, subtree: true });
        addManagedObserver(chatRoot, obs);
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
            // Skip blacklisted images
            if (emote.url && isBlacklisted(emote.url)) {
                return;
            }

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
                            // Store message content before clicking submit
                            const messageContent = input.innerHTML || '';
                            const messageText = input.textContent || '';

                            // Use the send watcher for verification
                            const watcher = ensureSendWatcher(doc || document);
                            watcher.arm({
                                text: messageText,
                                html: messageContent,
                                time: Date.now(),
                                onConfirm: () => {
                                    console.log('Auto-send emote confirmed');
                                },
                                onFail: () => {
                                    // Check for connection indicators
                                    const connectionLost = (doc || document).querySelector('.connection-lost, .connecting, [class*="connecting"]');
                                    const inputCleared = input.textContent.trim() === '';

                                    if (inputCleared && connectionLost) {
                                        // Restore the content
                                        if (input.contentEditable === 'true') {
                                            input.innerHTML = messageContent;
                                        } else {
                                            input.textContent = messageText;
                                        }
                                        console.log('Auto-send failed (disconnected) - content restored');

                                        // Focus and position cursor
                                        input.focus();
                                        const range = (doc || document).createRange();
                                        const selection = ((doc || document).defaultView || window).getSelection();
                                        range.selectNodeContents(input);
                                        range.collapse(false);
                                        selection.removeAllRanges();
                                        selection.addRange(range);
                                    }
                                }
                            });

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

        // Container for left-aligned tools
        const leftTools = doc.createElement('div');
        leftTools.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            flex: 1;
        `;

        // Container for right-aligned tools
        const rightTools = doc.createElement('div');
        rightTools.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: auto;
        `;

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
        } else if (tool.customAction === 'blacklistManager') {
            // Handle blacklist manager custom action
            showBlacklistManager(doc);
            return; // Exit early since blacklist manager is a separate UI
        } else if (tool.customAction === 'emoteManager') {
            // Handle emote manager custom action
            showEmoteManager(doc);
            return; // Exit early since emote manager is a separate UI
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

    function showBlacklistManager(doc) {
        // Remove any existing manager
        const existing = doc.getElementById('blacklist-manager');
        if (existing) {
            existing.remove();
            return;
        }

        const blacklist = getBlacklist();

        // Create manager popup
        const manager = doc.createElement('div');
        manager.id = 'blacklist-manager';
        manager.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // Title
        const title = doc.createElement('h3');
        title.textContent = 'Blacklisted Images';
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            margin: 0 0 12px 0;
            font-size: 16px;
        `;
        manager.appendChild(title);

        // Add URL input section
        const addSection = doc.createElement('div');
        addSection.style.cssText = `
            margin-bottom: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        `;

        const addLabel = doc.createElement('label');
        addLabel.textContent = 'Paste image URL to blacklist:';
        addLabel.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            display: block;
            margin-bottom: 8px;
        `;
        addSection.appendChild(addLabel);

        const inputContainer = doc.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        const urlInput = doc.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://example.com/image.png';
        urlInput.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            flex: 1;
        `;

        const addUrlBtn = doc.createElement('button');
        addUrlBtn.type = 'button';
        addUrlBtn.textContent = 'Blacklist';
        addUrlBtn.style.cssText = `
            background: rgba(255, 0, 0, 0.3);
            border: 1px solid rgba(255, 0, 0, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: background 0.2s ease;
            white-space: nowrap;
        `;

        addManagedEventListener(addUrlBtn, 'mouseenter', () => {
            addUrlBtn.style.background = 'rgba(255, 0, 0, 0.5)';
        });

        addManagedEventListener(addUrlBtn, 'mouseleave', () => {
            addUrlBtn.style.background = 'rgba(255, 0, 0, 0.3)';
        });

        const doAddUrl = () => {
            const url = urlInput.value.trim();
            if (url) {
                if (addToBlacklist(url)) {
                    urlInput.value = '';
                    manager.remove();
                    showBlacklistManager(doc);
                    reloadEmoteBar(doc);
                } else {
                    alert('URL is already blacklisted or invalid');
                }
            }
        };

        addManagedEventListener(addUrlBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doAddUrl();
        });

        addManagedEventListener(urlInput, 'keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doAddUrl();
            }
        });

        inputContainer.appendChild(urlInput);
        inputContainer.appendChild(addUrlBtn);
        addSection.appendChild(inputContainer);
        manager.appendChild(addSection);

        if (blacklist.length === 0) {
            const empty = doc.createElement('p');
            empty.textContent = 'No images blacklisted';
            empty.style.cssText = `
                color: rgba(255, 255, 255, 0.6);
                font-size: 13px;
                margin: 0;
            `;
            manager.appendChild(empty);
        } else {
            const list = doc.createElement('div');
            list.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;

            blacklist.forEach(url => {
                const item = doc.createElement('div');
                item.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                `;

                const img = doc.createElement('img');
                img.src = url;
                img.style.cssText = `
                    width: 32px;
                    height: 32px;
                    object-fit: contain;
                `;

                const urlText = doc.createElement('span');
                urlText.textContent = url;
                urlText.style.cssText = `
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 11px;
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                `;

                const removeBtn = doc.createElement('button');
                removeBtn.type = 'button';
                removeBtn.textContent = 'Remove';
                removeBtn.style.cssText = `
                    background: rgba(255, 0, 0, 0.3);
                    border: 1px solid rgba(255, 0, 0, 0.5);
                    color: rgba(255, 255, 255, 0.9);
                    padding: 4px 12px;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 11px;
                    transition: background 0.2s ease;
                `;

                addManagedEventListener(removeBtn, 'mouseenter', () => {
                    removeBtn.style.background = 'rgba(255, 0, 0, 0.5)';
                });

                addManagedEventListener(removeBtn, 'mouseleave', () => {
                    removeBtn.style.background = 'rgba(255, 0, 0, 0.3)';
                });

                addManagedEventListener(removeBtn, 'click', () => {
                    if (removeFromBlacklist(url)) {
                        // Refresh the manager
                        manager.remove();
                        showBlacklistManager(doc);
                        // Reload the emote bar
                        const emoteBar = doc.getElementById('custom-emote-bar');
                        if (emoteBar) {
                            const wasVisible = emoteBar.style.display !== 'none';
                            emoteBar.replaceWith(createEmoteBar(doc));
                            if (wasVisible) {
                                doc.getElementById('custom-emote-bar').style.display = 'flex';
                            }
                        }
                    }
                });

                item.appendChild(img);
                item.appendChild(urlText);
                item.appendChild(removeBtn);
                list.appendChild(item);
            });

            manager.appendChild(list);

            // Clear all button
            const clearBtn = doc.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = 'Clear All';
            clearBtn.style.cssText = `
                background: rgba(255, 0, 0, 0.3);
                border: 1px solid rgba(255, 0, 0, 0.5);
                color: rgba(255, 255, 255, 0.9);
                padding: 8px 16px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
                margin-top: 12px;
                width: 100%;
                transition: background 0.2s ease;
            `;

            addManagedEventListener(clearBtn, 'mouseenter', () => {
                clearBtn.style.background = 'rgba(255, 0, 0, 0.5)';
            });

            addManagedEventListener(clearBtn, 'mouseleave', () => {
                clearBtn.style.background = 'rgba(255, 0, 0, 0.3)';
            });

            addManagedEventListener(clearBtn, 'click', () => {
                if (confirm('Clear all blacklisted images?')) {
                    clearBlacklist();
                    manager.remove();
                    showBlacklistManager(doc);
                    // Reload the emote bar
                    const emoteBar = doc.getElementById('custom-emote-bar');
                    if (emoteBar) {
                        const wasVisible = emoteBar.style.display !== 'none';
                        emoteBar.replaceWith(createEmoteBar(doc));
                        if (wasVisible) {
                            doc.getElementById('custom-emote-bar').style.display = 'flex';
                        }
                    }
                }
            });

            manager.appendChild(clearBtn);
        }

        // Close button
        const closeBtn = doc.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 8px;
            width: 100%;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(closeBtn, 'mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        addManagedEventListener(closeBtn, 'mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        addManagedEventListener(closeBtn, 'click', () => {
            manager.remove();
            removeElementListeners(manager);
        });

        manager.appendChild(closeBtn);

        // Click outside to close
        const clickOutside = (e) => {
            if (!manager.contains(e.target)) {
                manager.remove();
                removeElementListeners(manager);
                doc.removeEventListener('click', clickOutside);
            }
        };

        // Add to page and set up outside click handler
        doc.body.appendChild(manager);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    function showExportDialog(doc, emotesToExport) {
        // Create export dialog
        const dialog = doc.createElement('div');
        dialog.id = 'export-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            z-index: 10002;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            min-width: 500px;
            max-width: 700px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // Title
        const title = doc.createElement('h3');
        title.textContent = 'Export Emotes';
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            margin: 0 0 12px 0;
            font-size: 16px;
        `;
        dialog.appendChild(title);

        // Instructions
        const instructions = doc.createElement('p');
        instructions.textContent = 'Copy the JSON below and save it to a .json file:';
        instructions.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            margin: 0 0 8px 0;
        `;
        dialog.appendChild(instructions);

        // Textarea with JSON
        const textarea = doc.createElement('textarea');
        textarea.value = JSON.stringify(emotesToExport, null, 2);
        textarea.readOnly = true;
        textarea.style.cssText = `
            width: 100%;
            height: 300px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.9);
            padding: 8px;
            font-family: monospace;
            font-size: 11px;
            resize: vertical;
            margin-bottom: 12px;
        `;
        dialog.appendChild(textarea);

        // Button container
        const buttonContainer = doc.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        // Copy button
        const copyBtn = doc.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy to Clipboard';
        copyBtn.style.cssText = `
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid rgba(0, 255, 0, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(copyBtn, 'mouseenter', () => {
            copyBtn.style.background = 'rgba(0, 255, 0, 0.5)';
        });

        addManagedEventListener(copyBtn, 'mouseleave', () => {
            copyBtn.style.background = 'rgba(0, 255, 0, 0.3)';
        });

        addManagedEventListener(copyBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            textarea.select();
            try {
                doc.execCommand('copy');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                }, 2000);
            } catch (err) {
                alert('Failed to copy. Please manually select and copy the text.');
            }
        });

        // Close button
        const closeBtn = doc.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(closeBtn, 'mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        addManagedEventListener(closeBtn, 'mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        addManagedEventListener(closeBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dialog.remove();
            removeElementListeners(dialog);
        });

        buttonContainer.appendChild(copyBtn);
        buttonContainer.appendChild(closeBtn);
        dialog.appendChild(buttonContainer);

        // Add to page
        doc.body.appendChild(dialog);

        // Auto-select text for easy copying
        textarea.select();
        textarea.focus();
    }

    function showEmoteManager(doc) {
        // Remove any existing manager
        const existing = doc.getElementById('emote-manager');
        if (existing) {
            existing.remove();
            return;
        }

        const currentEmotes = getEmotes();

        // Create manager popup
        const manager = doc.createElement('div');
        manager.id = 'emote-manager';
        manager.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            max-width: 600px;
            max-height: 500px;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // Title
        const title = doc.createElement('h3');
        title.textContent = 'Manage Emotes';
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            margin: 0 0 12px 0;
            font-size: 16px;
        `;
        manager.appendChild(title);

        // Add emote button
        const addBtn = doc.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Add New Emote';
        addBtn.style.cssText = `
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid rgba(0, 255, 0, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 12px;
            width: 100%;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(addBtn, 'mouseenter', () => {
            addBtn.style.background = 'rgba(0, 255, 0, 0.5)';
        });

        addManagedEventListener(addBtn, 'mouseleave', () => {
            addBtn.style.background = 'rgba(0, 255, 0, 0.3)';
        });

        addManagedEventListener(addBtn, 'click', () => {
            manager.remove();
            showEmoteEditor(doc, null, -1);
        });

        manager.appendChild(addBtn);

        // Emotes list
        const list = doc.createElement('div');
        list.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        `;

        currentEmotes.forEach((emote, index) => {
            const item = doc.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
            `;

            // Preview
            let preview;
            if (emote.url) {
                preview = doc.createElement('img');
                preview.src = emote.url;
                preview.style.cssText = `
                    width: 32px;
                    height: 32px;
                    object-fit: contain;
                `;
            } else if (emote.emoji) {
                preview = doc.createElement('span');
                preview.textContent = emote.emoji;
                preview.style.cssText = `
                    font-size: 24px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
            } else if (emote.text) {
                preview = doc.createElement('span');
                preview.textContent = emote.text;
                preview.style.cssText = `
                    font-size: 10px;
                    font-weight: bold;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.9);
                `;
            }

            const info = doc.createElement('div');
            info.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            `;

            const code = doc.createElement('span');
            code.textContent = emote.code;
            code.style.cssText = `
                color: rgba(255, 255, 255, 0.9);
                font-size: 12px;
                font-family: monospace;
            `;

            const titleText = doc.createElement('span');
            titleText.textContent = emote.title || '(no title)';
            titleText.style.cssText = `
                color: rgba(255, 255, 255, 0.6);
                font-size: 11px;
            `;

            info.appendChild(code);
            info.appendChild(titleText);

            const editBtn = doc.createElement('button');
            editBtn.type = 'button';
            editBtn.textContent = 'Edit';
            editBtn.style.cssText = `
                background: rgba(0, 128, 255, 0.3);
                border: 1px solid rgba(0, 128, 255, 0.5);
                color: rgba(255, 255, 255, 0.9);
                padding: 4px 12px;
                cursor: pointer;
                border-radius: 3px;
                font-size: 11px;
                transition: background 0.2s ease;
            `;

            addManagedEventListener(editBtn, 'mouseenter', () => {
                editBtn.style.background = 'rgba(0, 128, 255, 0.5)';
            });

            addManagedEventListener(editBtn, 'mouseleave', () => {
                editBtn.style.background = 'rgba(0, 128, 255, 0.3)';
            });

            addManagedEventListener(editBtn, 'click', () => {
                manager.remove();
                showEmoteEditor(doc, emote, index);
            });

            const deleteBtn = doc.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.cssText = `
                background: rgba(255, 0, 0, 0.3);
                border: 1px solid rgba(255, 0, 0, 0.5);
                color: rgba(255, 255, 255, 0.9);
                padding: 4px 12px;
                cursor: pointer;
                border-radius: 3px;
                font-size: 11px;
                transition: background 0.2s ease;
            `;

            addManagedEventListener(deleteBtn, 'mouseenter', () => {
                deleteBtn.style.background = 'rgba(255, 0, 0, 0.5)';
            });

            addManagedEventListener(deleteBtn, 'mouseleave', () => {
                deleteBtn.style.background = 'rgba(255, 0, 0, 0.3)';
            });

            addManagedEventListener(deleteBtn, 'click', () => {
                if (confirm(`Delete emote "${emote.code}"?`)) {
                    const updatedEmotes = currentEmotes.filter((_, i) => i !== index);
                    emotes = updatedEmotes;
                    saveEmotes(updatedEmotes);
                    manager.remove();
                    showEmoteManager(doc);
                    reloadEmoteBar(doc);
                }
            });

            if (preview) item.appendChild(preview);
            item.appendChild(info);
            item.appendChild(editBtn);
            item.appendChild(deleteBtn);
            list.appendChild(item);
        });

        manager.appendChild(list);

        // Utility buttons
        const utilityContainer = doc.createElement('div');
        utilityContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        `;

        // Export button
        const exportBtn = doc.createElement('button');
        exportBtn.type = 'button';
        exportBtn.textContent = 'Export';
        exportBtn.style.cssText = `
            background: rgba(128, 128, 128, 0.3);
            border: 1px solid rgba(128, 128, 128, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(exportBtn, 'mouseenter', () => {
            exportBtn.style.background = 'rgba(128, 128, 128, 0.5)';
        });

        addManagedEventListener(exportBtn, 'mouseleave', () => {
            exportBtn.style.background = 'rgba(128, 128, 128, 0.3)';
        });

        addManagedEventListener(exportBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showExportDialog(doc, currentEmotes);
        });

        // Import button
        const importBtn = doc.createElement('button');
        importBtn.type = 'button';
        importBtn.textContent = 'Import';
        importBtn.style.cssText = `
            background: rgba(128, 128, 128, 0.3);
            border: 1px solid rgba(128, 128, 128, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(importBtn, 'mouseenter', () => {
            importBtn.style.background = 'rgba(128, 128, 128, 0.5)';
        });

        addManagedEventListener(importBtn, 'mouseleave', () => {
            importBtn.style.background = 'rgba(128, 128, 128, 0.3)';
        });

        addManagedEventListener(importBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = doc.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            addManagedEventListener(input, 'change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const imported = JSON.parse(e.target.result);
                            if (Array.isArray(imported)) {
                                emotes = imported;
                                saveEmotes(imported);
                                manager.remove();
                                showEmoteManager(doc);
                                reloadEmoteBar(doc);
                            } else {
                                alert('Invalid emotes file format');
                            }
                        } catch (err) {
                            alert('Error parsing emotes file: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });
            input.click();
        });

        // Reset button
        const resetBtn = doc.createElement('button');
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reset to Default';
        resetBtn.style.cssText = `
            background: rgba(255, 128, 0, 0.3);
            border: 1px solid rgba(255, 128, 0, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(resetBtn, 'mouseenter', () => {
            resetBtn.style.background = 'rgba(255, 128, 0, 0.5)';
        });

        addManagedEventListener(resetBtn, 'mouseleave', () => {
            resetBtn.style.background = 'rgba(255, 128, 0, 0.3)';
        });

        addManagedEventListener(resetBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Reset all emotes to default? This will delete your custom emotes.')) {
                emotes = defaultEmotes;
                resetEmotesToDefault();
                manager.remove();
                showEmoteManager(doc);
                reloadEmoteBar(doc);
            }
        });

        utilityContainer.appendChild(exportBtn);
        utilityContainer.appendChild(importBtn);
        utilityContainer.appendChild(resetBtn);
        manager.appendChild(utilityContainer);

        // Close button
        const closeBtn = doc.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            width: 100%;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(closeBtn, 'mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        addManagedEventListener(closeBtn, 'mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        addManagedEventListener(closeBtn, 'click', () => {
            manager.remove();
            removeElementListeners(manager);
        });

        manager.appendChild(closeBtn);

        // Click outside to close
        const clickOutside = (e) => {
            if (!manager.contains(e.target)) {
                manager.remove();
                removeElementListeners(manager);
                doc.removeEventListener('click', clickOutside);
            }
        };

        // Add to page and set up outside click handler
        doc.body.appendChild(manager);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    function showEmoteEditor(doc, emote, index) {
        // Remove any existing editor
        const existing = doc.getElementById('emote-editor');
        if (existing) {
            existing.remove();
        }

        const isNew = index === -1;
        const currentEmotes = getEmotes();

        // Create editor popup
        const editor = doc.createElement('div');
        editor.id = 'emote-editor';
        editor.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            z-index: 10001;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            min-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // Title
        const title = doc.createElement('h3');
        title.textContent = isNew ? 'Add New Emote' : 'Edit Emote';
        title.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            margin: 0 0 16px 0;
            font-size: 16px;
        `;
        editor.appendChild(title);

        // Form fields
        const fieldStyle = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 12px;
        `;

        const labelStyle = `
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            font-weight: 500;
        `;

        const inputStyle = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
        `;

        // Code field
        const codeField = doc.createElement('div');
        codeField.style.cssText = fieldStyle;
        const codeLabel = doc.createElement('label');
        codeLabel.textContent = 'Code (required):';
        codeLabel.style.cssText = labelStyle;
        const codeInput = doc.createElement('input');
        codeInput.type = 'text';
        codeInput.value = emote?.code || '';
        codeInput.placeholder = ':example:';
        codeInput.style.cssText = inputStyle;
        codeField.appendChild(codeLabel);
        codeField.appendChild(codeInput);

        // Title field
        const titleField = doc.createElement('div');
        titleField.style.cssText = fieldStyle;
        const titleLabel = doc.createElement('label');
        titleLabel.textContent = 'Title:';
        titleLabel.style.cssText = labelStyle;
        const titleInput = doc.createElement('input');
        titleInput.type = 'text';
        titleInput.value = emote?.title || '';
        titleInput.placeholder = 'Emote description';
        titleInput.style.cssText = inputStyle;
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);

        // Type selector
        const typeField = doc.createElement('div');
        typeField.style.cssText = fieldStyle;
        const typeLabel = doc.createElement('label');
        typeLabel.textContent = 'Type:';
        typeLabel.style.cssText = labelStyle;
        const typeSelect = doc.createElement('select');
        typeSelect.style.cssText = inputStyle;

        const types = [
            { value: 'url', label: 'Image URL' },
            { value: 'emoji', label: 'Emoji' },
            { value: 'text', label: 'Text' }
        ];

        types.forEach(type => {
            const option = doc.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            typeSelect.appendChild(option);
        });

        // Set initial type
        if (emote?.url) typeSelect.value = 'url';
        else if (emote?.emoji) typeSelect.value = 'emoji';
        else if (emote?.text) typeSelect.value = 'text';
        else typeSelect.value = 'url';

        typeField.appendChild(typeLabel);
        typeField.appendChild(typeSelect);

        // Value field (changes based on type)
        const valueField = doc.createElement('div');
        valueField.style.cssText = fieldStyle;
        const valueLabel = doc.createElement('label');
        valueLabel.style.cssText = labelStyle;
        const valueInput = doc.createElement('input');
        valueInput.type = 'text';
        valueInput.style.cssText = inputStyle;
        valueField.appendChild(valueLabel);
        valueField.appendChild(valueInput);

        const updateValueField = () => {
            const type = typeSelect.value;
            if (type === 'url') {
                valueLabel.textContent = 'Image URL:';
                valueInput.placeholder = 'https://example.com/image.png';
                valueInput.value = emote?.url || '';
            } else if (type === 'emoji') {
                valueLabel.textContent = 'Emoji:';
                valueInput.placeholder = '😀';
                valueInput.value = emote?.emoji || '';
            } else if (type === 'text') {
                valueLabel.textContent = 'Text:';
                valueInput.placeholder = 'ABC';
                valueInput.value = emote?.text || '';
            }
        };

        updateValueField();
        addManagedEventListener(typeSelect, 'change', updateValueField);

        // Auto-send checkbox
        const autoSendField = doc.createElement('div');
        autoSendField.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
        `;
        const autoSendCheckbox = doc.createElement('input');
        autoSendCheckbox.type = 'checkbox';
        autoSendCheckbox.id = 'auto-send-checkbox';
        autoSendCheckbox.checked = emote?.autoSend !== false;
        const autoSendLabel = doc.createElement('label');
        autoSendLabel.htmlFor = 'auto-send-checkbox';
        autoSendLabel.textContent = 'Auto-send when input is empty';
        autoSendLabel.style.cssText = `
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            cursor: pointer;
        `;
        autoSendField.appendChild(autoSendCheckbox);
        autoSendField.appendChild(autoSendLabel);

        editor.appendChild(codeField);
        editor.appendChild(titleField);
        editor.appendChild(typeField);
        editor.appendChild(valueField);
        editor.appendChild(autoSendField);

        // Buttons
        const buttonContainer = doc.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        const saveBtn = doc.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid rgba(0, 255, 0, 0.5);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(saveBtn, 'mouseenter', () => {
            saveBtn.style.background = 'rgba(0, 255, 0, 0.5)';
        });

        addManagedEventListener(saveBtn, 'mouseleave', () => {
            saveBtn.style.background = 'rgba(0, 255, 0, 0.3)';
        });

        addManagedEventListener(saveBtn, 'click', () => {
            const code = codeInput.value.trim();
            if (!code) {
                alert('Code is required');
                return;
            }

            const type = typeSelect.value;
            const value = valueInput.value.trim();
            if (!value) {
                alert(`${type === 'url' ? 'URL' : type === 'emoji' ? 'Emoji' : 'Text'} is required`);
                return;
            }

            const newEmote = {
                code: code,
                title: titleInput.value.trim() || undefined
            };

            if (type === 'url') newEmote.url = value;
            else if (type === 'emoji') newEmote.emoji = value;
            else if (type === 'text') newEmote.text = value;

            if (!autoSendCheckbox.checked) {
                newEmote.autoSend = false;
            }

            let updatedEmotes;
            if (isNew) {
                updatedEmotes = [...currentEmotes, newEmote];
            } else {
                updatedEmotes = [...currentEmotes];
                updatedEmotes[index] = newEmote;
            }

            emotes = updatedEmotes;
            saveEmotes(updatedEmotes);
            editor.remove();
            showEmoteManager(doc);
            reloadEmoteBar(doc);
        });

        const cancelBtn = doc.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            flex: 1;
            transition: background 0.2s ease;
        `;

        addManagedEventListener(cancelBtn, 'mouseenter', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        addManagedEventListener(cancelBtn, 'mouseleave', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        addManagedEventListener(cancelBtn, 'click', () => {
            editor.remove();
            showEmoteManager(doc);
        });

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        editor.appendChild(buttonContainer);

        // Add to page
        doc.body.appendChild(editor);
    }

    function reloadEmoteBar(doc) {
        // Reload emotes from storage
        emotes = getEmotes();

        const emoteBar = doc.getElementById('custom-emote-bar');
        if (emoteBar) {
            const wasVisible = emoteBar.style.display !== 'none';
            emoteBar.replaceWith(createEmoteBar(doc));
            if (wasVisible) {
                doc.getElementById('custom-emote-bar').style.display = 'flex';
            }
        }
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

    // Helper function to show a temporary failure indicator
    function showSendFailureIndicator(doc) {
        // Check if we already have an indicator
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

        // Add animation
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
        setTimeout(() => {
            indicator.remove();
        }, 3000);
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
            if (messageForm && !messageForm.__sneed_submit_handler) {
                messageForm.__sneed_submit_handler = true;

                // Create the send watcher once
                const watcher = ensureSendWatcher(doc);

                addManagedEventListener(messageForm, 'submit', (e) => {
                    // Store the message content before it gets cleared
                    const lastMessageContent = inputElement.innerHTML || '';
                    const lastMessageText = inputElement.textContent || '';

                    // Arm the watcher with callbacks
                    watcher.arm({
                        text: lastMessageText,
                        html: lastMessageContent,
                        time: Date.now(),
                        onConfirm: () => {
                            // Message was sent successfully
                            console.log('Message confirmed in chat');
                            inputElement.style.height = 'auto';
                            resizeInput();
                        },
                        onFail: () => {
                            // Check for connection status indicators
                            const connectionLost = doc.querySelector('.connection-lost, .connecting, [class*="connecting"], [class*="reconnect"]');

                            // Check if input was cleared (normally happens on send)
                            const inputCleared = inputElement.textContent.trim() === '';

                            if (inputCleared && connectionLost) {
                                // Message was cleared but didn't appear in chat, likely failed
                                console.log('Message did not appear in chat - restoring content');

                                // Restore the message content
                                if (inputElement.contentEditable === 'true') {
                                    inputElement.innerHTML = lastMessageContent;
                                } else {
                                    inputElement.textContent = lastMessageText;
                                }

                                // Focus and place cursor at end
                                inputElement.focus();
                                const range = doc.createRange();
                                const selection = (doc ? doc.defaultView : window).getSelection();
                                range.selectNodeContents(inputElement);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);

                                // Resize to fit content
                                resizeInput();

                                // Show a visual indicator
                                showSendFailureIndicator(doc);
                            } else if (!inputCleared) {
                                // Input wasn't cleared, form submission may have been prevented
                                console.log('Message still in input - send may have been blocked');
                            }
                        }
                    });
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

                // Add padding to prevent text overlap with toggle button
                inputElement.style.paddingRight = '50px';
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

                // Install bar-removal observer
                const root = messageForm.parentElement || document.body;
                if (root && !root.__sneed_bar_observed) {
                    observeForBarsRemoval(root, document);
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

                            // Insert bars before the form
                            messageForm.parentNode.insertBefore(emoteBar, messageForm);
                            messageForm.parentNode.insertBefore(formatBar, messageForm);

                            // Add emote toggle button next to send button
                            addEmoteToggleButton(iframeDoc);

                            // Add Shift+Enter handler for iframe context
                            const iframeInput = iframeDoc.getElementById('new-message-input');
                            attachShiftEnterHandler(iframeInput, iframeDoc);

                            // Install bar-removal observer
                            const root = messageForm.parentElement || iframeDoc.body;
                            if (root && !root.__sneed_bar_observed) {
                                observeForBarsRemoval(root, iframeDoc);
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
            addGlobalEventListener(document, 'DOMContentLoaded', () => {
                setTimeout(injectEmoteBar, CONFIG.INIT_DELAY);
            });
        } else {
            setTimeout(injectEmoteBar, CONFIG.INIT_DELAY);
        }

        // Observe for iframe on parent page (harmless if we're in iframe)
        observeForIframe(document);
    }

    waitForReady();

    // Smart detection for reinject
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
