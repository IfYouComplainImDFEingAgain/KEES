/**
 * features/wave-animation.js - Animated text effects via message editing
 * Commands: /sizewave, /colorwave, /rainbowwave, /stopwave
 * Runs one pass through the characters then restores original text.
 */
(function() {
    'use strict';

    const SNEED = window.SNEED;

    const WAVE_INTERVAL = 200; // ms between frames
    const SIZE_NORMAL = 5;
    const SIZE_HIGHLIGHT = 7;
    const RAINBOW_COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];

    let activeWave = null;
    let pageScriptInjected = false;

    // ============================================
    // PAGE SCRIPT INJECTION
    // ============================================

    function injectPageScript(doc) {
        if (pageScriptInjected) return;
        pageScriptInjected = true;

        const script = doc.createElement('script');
        script.src = chrome.runtime.getURL('src/wave-edit-page.js');
        doc.documentElement.appendChild(script);
        script.addEventListener('load', () => script.remove());
    }

    function sendEdit(doc, uuid, message) {
        const win = doc.defaultView || window;
        win.dispatchEvent(new CustomEvent('__kees_edit_message', {
            detail: { uuid, message }
        }));
    }

    // ============================================
    // WAVE FRAME GENERATORS
    // ============================================

    function buildSizeWaveFrame(chars, pos) {
        let result = '';
        for (let i = 0; i < chars.length; i++) {
            if (chars[i].trim() === '') {
                result += chars[i];
                continue;
            }
            if (i === pos) {
                result += `[size=${SIZE_HIGHLIGHT}]${chars[i]}[/size]`;
            } else {
                result += chars[i];
            }
        }
        return result;
    }

    function buildColorWaveFrame(chars, pos) {
        let result = '';
        for (let i = 0; i < chars.length; i++) {
            if (chars[i].trim() === '') {
                result += chars[i];
                continue;
            }
            if (i === pos) {
                result += `[color=#ff0000]${chars[i]}[/color]`;
            } else {
                result += chars[i];
            }
        }
        return result;
    }

    function buildRainbowWaveFrame(chars, pos) {
        let result = '';
        for (let i = 0; i < chars.length; i++) {
            if (chars[i].trim() === '') {
                result += chars[i];
                continue;
            }
            const colorIdx = (i + pos) % RAINBOW_COLORS.length;
            result += `[color=${RAINBOW_COLORS[colorIdx]}]${chars[i]}[/color]`;
        }
        return result;
    }

    const WAVE_TYPES = {
        sizewave: buildSizeWaveFrame,
        colorwave: buildColorWaveFrame,
        rainbowwave: buildRainbowWaveFrame
    };

    // ============================================
    // WAVE CONTROL
    // ============================================

    function startWave(type, uuid, originalText, doc) {
        stopWave(doc);
        injectPageScript(doc);

        const cleanText = originalText.replace(/\[[^\]]+\]/g, '');
        const chars = [...cleanText];
        if (!cleanText.trim() || chars.length === 0) return;

        const builder = WAVE_TYPES[type];
        if (!builder) return;

        let frame = 0;

        activeWave = {
            type,
            uuid,
            originalText: cleanText,
            timer: setInterval(() => {
                const message = builder(chars, frame);
                sendEdit(doc, uuid, message);

                frame++;

                // Stop after one full pass
                if (frame >= chars.length) {
                    clearInterval(activeWave.timer);
                    // Restore original text after a brief pause
                    setTimeout(() => {
                        sendEdit(doc, uuid, cleanText);
                        activeWave = null;
                    }, WAVE_INTERVAL);
                }
            }, WAVE_INTERVAL)
        };
    }

    function stopWave(doc) {
        if (activeWave) {
            clearInterval(activeWave.timer);
            if (activeWave.uuid && activeWave.originalText && doc) {
                sendEdit(doc, activeWave.uuid, activeWave.originalText);
            }
            activeWave = null;
        }
    }

    // ============================================
    // COMMAND HANDLING
    // ============================================

    function getLastOwnMessage(doc) {
        const messages = doc.querySelectorAll('#chat-messages .chat-message');
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.classList.contains('chat-message--whisper')) continue;
            if (msg.classList.contains('chat-message--systemMsg')) continue;

            const id = msg.id || msg.dataset.id;
            if (!id) continue;

            // Own messages have edit/delete buttons
            const editBtn = msg.querySelector('.button.edit');
            const deleteBtn = msg.querySelector('.button.delete');
            if (editBtn || deleteBtn) {
                const uuid = id.replace('chat-message-', '');
                const raw = msg.dataset.raw;
                const text = raw || msg.querySelector('.message')?.textContent?.trim() || '';
                return { uuid, text };
            }
        }
        return null;
    }

    function handleCommand(command, doc) {
        const trimmed = command.trim();
        const parts = trimmed.split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === '/stopwave') {
            stopWave(doc);
            return true;
        }

        const type = cmd.substring(1); // remove /
        if (WAVE_TYPES[type]) {
            const argText = parts.slice(1).join(' ');

            if (argText) {
                // Send the text as a message first, then wave it once it appears
                waitForOwnMessage(doc, argText, (uuid, text) => {
                    startWave(type, uuid, text, doc);
                });
                // Don't prevent default - let the message send normally
                // But we need to replace the input with just the arg text (strip the command)
                const inputElement = doc.getElementById('new-message-input');
                if (inputElement) {
                    inputElement.textContent = argText;
                    SNEED.util.positionCursorAtEnd(doc, inputElement);
                }
                return false; // let the form submit with the cleaned text
            } else {
                // No argument - wave the last sent message
                const lastMsg = getLastOwnMessage(doc);
                if (!lastMsg) return true;
                startWave(type, lastMsg.uuid, lastMsg.text, doc);
                return true;
            }
        }

        return false;
    }

    function waitForOwnMessage(doc, expectedText, callback) {
        const chatMessages = doc.getElementById('chat-messages');
        if (!chatMessages) return;

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (!node.classList || !node.classList.contains('chat-message')) continue;
                    if (node.classList.contains('chat-message--whisper')) continue;
                    if (node.classList.contains('chat-message--systemMsg')) continue;

                    const editBtn = node.querySelector('.button.edit');
                    const deleteBtn = node.querySelector('.button.delete');
                    if (!editBtn && !deleteBtn) continue;

                    const id = node.id || node.dataset.id;
                    if (!id) continue;

                    const uuid = id.replace('chat-message-', '');
                    const raw = node.dataset.raw;
                    const text = raw || node.querySelector('.message')?.textContent?.trim() || '';

                    observer.disconnect();
                    // Small delay to let the message fully render
                    setTimeout(() => callback(uuid, text), 100);
                    return;
                }
            }
        });

        observer.observe(chatMessages, { childList: true });

        // Timeout after 5 seconds
        setTimeout(() => observer.disconnect(), 5000);
    }

    // ============================================
    // START
    // ============================================

    function start(doc) {
        const inputElement = doc.getElementById('new-message-input');
        const messageForm = doc.getElementById('new-message-form');
        if (!inputElement || !messageForm) return;

        // Intercept Enter key for wave commands (capture phase, before other handlers)
        SNEED.core.events.addManagedEventListener(inputElement, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const text = (inputElement.textContent || '').trim();
                if (handleCommand(text, doc)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    inputElement.textContent = '';
                    const event = new Event('input', { bubbles: true });
                    inputElement.dispatchEvent(event);
                    return false;
                }
            }
        }, true);

        window.addEventListener('beforeunload', () => stopWave(doc));
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.waveAnimation = { start, stopWave };

})();
