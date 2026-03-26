/**
 * features/formatting.js - Text formatting and emote insertion
 * Handles WYSIWYG formatting, bullet lists, and emote insertion.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const { getSelectionAndRange } = SNEED.util;

    // ============================================
    // WYSIWYG FORMATTING HELPERS
    // ============================================

    /**
     * Apply WYSIWYG formatting using execCommand
     * @param {string} command - execCommand command (bold, italic)
     * @param {Document} doc - Document context
     */
    function applyWysiwygFormat(command, doc) {
        doc.execCommand(command, false, null);
    }

    /**
     * Convert HSL to hex color
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {string} - Hex color string
     */
    function hslToHex(h, s, l) {
        s /= 100;
        l /= 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;

        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    // ============================================
    // APPLY FORMATTING
    // ============================================

    function applyFormatting(tool, doc) {
        const input = doc.getElementById('new-message-input');
        if (!input) return;

        input.focus();

        const win = doc.defaultView || window;
        const selection = win.getSelection();
        let range;

        if (selection.rangeCount === 0) {
            range = doc.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            selection.addRange(range);
        } else {
            range = selection.getRangeAt(0);
        }

        let textToInsert;
        let hadSelectedText = false;

        // Handle WYSIWYG formatting for bold and italic
        if (tool.wysiwygCommand) {
            if (SNEED.state.isWysiwygMode()) {
                applyWysiwygFormat(tool.wysiwygCommand, doc);
                // Trigger input event
                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                // Raw mode - insert BBCode tags
                const tagMap = { 'bold': 'b', 'italic': 'i' };
                const tag = tagMap[tool.wysiwygCommand] || tool.wysiwygCommand;
                const selectedText = selection.toString();
                textToInsert = `[${tag}]${selectedText}[/${tag}]`;
                hadSelectedText = !!selectedText;
            }
        }

        // Handle custom actions
        if (tool.customAction === 'bulletLines') {
            const selectedText = selection.toString();
            hadSelectedText = !!selectedText;
            if (selectedText) {
                const lines = selectedText.split('\n');
                textToInsert = lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('•')) {
                        return '• ' + trimmed;
                    }
                    return line;
                }).join('\n');
            } else {
                textToInsert = '• ';
            }
        } else if (tool.customAction === 'insertImage') {
            const selectedText = selection.toString().trim();
            if (SNEED.state.isWysiwygMode() && selectedText && /^https?:\/\/.+/i.test(selectedText)) {
                // WYSIWYG mode with URL - insert inline image
                const img = doc.createElement('img');
                img.src = selectedText;
                img.setAttribute('data-bbcode-img', 'true');
                img.style.maxHeight = '150px';
                img.style.maxWidth = '100%';
                img.style.verticalAlign = 'middle';

                range.deleteContents();
                range.insertNode(img);
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);

                // Trigger input event for resize
                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                // Raw mode or no URL - insert BBCode tags
                textToInsert = selectedText ? `[img]${selectedText}[/img]` : '[img][/img]';
                hadSelectedText = !!selectedText;
            }
        } else if (tool.customAction === 'colorPicker') {
            SNEED.ui.showColorPicker(input, selection, range, doc);
            return;
        } else if (tool.customAction === 'rainbowText') {
            const selectedText = selection.toString();
            if (!selectedText) return;

            const chars = [...selectedText]; // Handle unicode properly
            const charCount = chars.filter(c => c.trim()).length; // Count non-whitespace

            if (SNEED.state.isWysiwygMode()) {
                // WYSIWYG mode - create colored spans
                const fragment = doc.createDocumentFragment();
                let colorIndex = 0;

                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];

                    if (char.trim() === '') {
                        // Preserve whitespace without coloring
                        fragment.appendChild(doc.createTextNode(char));
                    } else {
                        // Calculate hue (0-360) progressing through rainbow
                        const hue = Math.floor((colorIndex / charCount) * 360);
                        const hex = hslToHex(hue, 100, 50);

                        const span = doc.createElement('span');
                        span.style.color = hex;
                        span.setAttribute('data-bbcode-color', hex);
                        span.textContent = char;
                        fragment.appendChild(span);
                        colorIndex++;
                    }
                }

                range.deleteContents();
                range.insertNode(fragment);
                selection.removeAllRanges();

                // Trigger input event
                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                // Raw mode - insert BBCode color tags
                let result = '';
                let colorIndex = 0;

                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];

                    if (char.trim() === '') {
                        result += char;
                    } else {
                        const hue = Math.floor((colorIndex / charCount) * 360);
                        const hex = hslToHex(hue, 100, 50);
                        result += `[color=${hex}]${char}[/color]`;
                        colorIndex++;
                    }
                }

                textToInsert = result;
                hadSelectedText = true;
            }
        } else if (tool.customAction === 'toggleWysiwyg') {
            const wasWysiwyg = SNEED.state.isWysiwygMode();
            const isWysiwyg = SNEED.state.toggleWysiwygMode();

            // Save the new mode to storage
            if (SNEED.core.storage && SNEED.core.storage.saveWysiwygMode) {
                SNEED.core.storage.saveWysiwygMode(isWysiwyg);
            }

            // Convert editor content
            if (SNEED.core.bbcode) {
                if (wasWysiwyg && !isWysiwyg) {
                    // Was WYSIWYG, now Raw - convert HTML to BBCode
                    const hasFormatting = input.querySelector('strong, b, em, i, span[data-bbcode-color], img[data-bbcode-img]');
                    if (hasFormatting) {
                        const bbcode = SNEED.core.bbcode.convertToBBCode(input);
                        input.textContent = bbcode;
                    }
                } else if (!wasWysiwyg && isWysiwyg) {
                    // Was Raw, now WYSIWYG - convert BBCode to HTML
                    const text = input.textContent || '';
                    if (/\[(b|i|color|img)\b/i.test(text)) {
                        const html = SNEED.core.bbcode.convertToHTML(text);
                        input.innerHTML = html;
                    }
                }
            }

            // Update button appearance
            const toggleBtn = doc.querySelector('[data-tool="WysiwygToggle"]');
            if (toggleBtn) {
                toggleBtn.style.opacity = isWysiwyg ? '0.5' : '1';
                toggleBtn.title = isWysiwyg ? 'WYSIWYG mode (click for raw BBCode)' : 'Raw BBCode mode (click for WYSIWYG)';
            }

            // Trigger input event for resize
            const event = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(event);
            return;
        } else if (tool.customAction === 'blacklistManager') {
            SNEED.ui.showBlacklistManager(doc);
            return;
        } else if (tool.customAction === 'emoteManager') {
            SNEED.ui.showEmoteManager(doc);
            return;
        } else if (tool.insertText) {
            textToInsert = tool.insertText;
        } else if (tool.startTag || tool.endTag) {
            const selectedText = selection.toString();
            hadSelectedText = !!selectedText;
            const hasStartTag = !!tool.startTag;
            const hasEndTag = !!tool.endTag;
            const isPairedTag = hasStartTag && hasEndTag;

            if (selectedText) {
                const startsWithTag = hasStartTag && selectedText.startsWith(tool.startTag);
                const endsWithTag = hasEndTag && selectedText.endsWith(tool.endTag);

                if (isPairedTag && startsWithTag && endsWithTag) {
                    textToInsert = selectedText.slice(tool.startTag.length, -tool.endTag.length);
                } else if (!isPairedTag && hasStartTag && startsWithTag) {
                    textToInsert = selectedText.slice(tool.startTag.length);
                } else if (!isPairedTag && hasEndTag && endsWithTag) {
                    textToInsert = selectedText.slice(0, -tool.endTag.length);
                } else {
                    const prefix = tool.startTag || '';
                    const suffix = tool.endTag || '';
                    textToInsert = prefix + selectedText + suffix;
                }
            } else {
                const prefix = tool.startTag || '';
                const suffix = tool.endTag || '';
                textToInsert = prefix + suffix;
            }
        }

        if (textToInsert !== undefined) {
            const textNode = doc.createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);

            // Position cursor appropriately
            // If paired tags with no selection, place cursor between tags (before end tag)
            if (tool.startTag && tool.endTag && !hadSelectedText) {
                const position = tool.startTag.length;
                range.setStart(textNode, position);
                range.setEnd(textNode, position);
            } else if (tool.startTag && !tool.endTag) {
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
            } else {
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
            }

            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            const event = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(event);
        }

        input.focus();
    }

    // ============================================
    // INSERT EMOTE
    // ============================================

    function insertEmote(emoteCode, doc) {
        const input = doc.getElementById('new-message-input');

        if (input && input.contentEditable === 'true') {
            input.focus();

            const win = doc.defaultView || window;
            const selection = win.getSelection();
            let range;

            if (selection.rangeCount === 0) {
                range = doc.createRange();
                range.selectNodeContents(input);
                range.collapse(false);
                selection.addRange(range);
            } else {
                range = selection.getRangeAt(0);
            }

            const textNode = doc.createTextNode(emoteCode);

            range.deleteContents();
            range.insertNode(textNode);

            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            const event = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(event);

            input.focus();
        }
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.features = SNEED.features || {};
    SNEED.features.applyFormatting = applyFormatting;
    SNEED.features.insertEmote = insertEmote;

})();
