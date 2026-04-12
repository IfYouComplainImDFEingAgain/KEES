// features/formatting.js - Text formatting and emote insertion
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const { getSelectionAndRange } = SNEED.util;

    function applyWysiwygFormat(command, doc) {
        doc.execCommand(command, false, null);
    }

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

        if (tool.wysiwygCommand) {
            if (SNEED.state.isWysiwygMode()) {
                applyWysiwygFormat(tool.wysiwygCommand, doc);
                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                const tagMap = { 'bold': 'b', 'italic': 'i', 'underline': 'u', 'strikeThrough': 's' };
                const tag = tagMap[tool.wysiwygCommand] || tool.wysiwygCommand;
                const selectedText = selection.toString();
                textToInsert = `[${tag}]${selectedText}[/${tag}]`;
                hadSelectedText = !!selectedText;
            }
        }

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

                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                textToInsert = selectedText ? `[img]${selectedText}[/img]` : '[img][/img]';
                hadSelectedText = !!selectedText;
            }
        } else if (tool.customAction === 'insertUrl') {
            const selectedText = selection.toString().trim();
            hadSelectedText = !!selectedText;
            if (selectedText && /^https?:\/\/.+/i.test(selectedText)) {
                textToInsert = `[url]${selectedText}[/url]`;
            } else if (selectedText) {
                textToInsert = `[url=]${selectedText}[/url]`;
            } else {
                textToInsert = '[url][/url]';
            }
        } else if (tool.customAction === 'centerText') {
            const selectedText = selection.toString();
            if (SNEED.state.isWysiwygMode()) {
                if (selectedText) {
                    const div = doc.createElement('div');
                    div.style.textAlign = 'center';
                    div.style.display = 'block';
                    div.setAttribute('data-bbcode-center', 'true');
                    const fragment = range.extractContents();
                    div.appendChild(fragment);
                    range.insertNode(div);
                    range.setStartAfter(div);
                    range.setEndAfter(div);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    const div = doc.createElement('div');
                    div.style.textAlign = 'center';
                    div.style.display = 'block';
                    div.setAttribute('data-bbcode-center', 'true');
                    div.textContent = '\u200B';
                    range.insertNode(div);
                    const newRange = doc.createRange();
                    newRange.setStart(div.firstChild, 1);
                    newRange.setEnd(div.firstChild, 1);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
                hadSelectedText = !!selectedText;
                textToInsert = selectedText ? `[center]${selectedText}[/center]` : '[center][/center]';
            }
        } else if (tool.customAction === 'sizePicker') {
            SNEED.ui.showSizePicker(input, selection, range, doc);
            return;
        } else if (tool.customAction === 'colorPicker') {
            SNEED.ui.showColorPicker(input, selection, range, doc);
            return;
        } else if (tool.customAction === 'rainbowText') {
            const selectedText = selection.toString();
            if (!selectedText) return;

            const chars = [...selectedText];
            const charCount = chars.filter(c => c.trim()).length;

            if (SNEED.state.isWysiwygMode()) {
                const fragment = doc.createDocumentFragment();
                let colorIndex = 0;

                for (let i = 0; i < chars.length; i++) {
                    const char = chars[i];

                    if (char.trim() === '') {
                        fragment.appendChild(doc.createTextNode(char));
                    } else {
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

                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
                return;
            } else {
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

            if (SNEED.core.storage && SNEED.core.storage.saveWysiwygMode) {
                SNEED.core.storage.saveWysiwygMode(isWysiwyg);
            }

            if (SNEED.core.bbcode) {
                if (wasWysiwyg && !isWysiwyg) {
                    const hasFormatting = input.querySelector('strong, b, em, i, u, s, strike, del, code, div[data-bbcode-center], span[data-bbcode-size], span[data-bbcode-color], img[data-bbcode-img], a[data-bbcode-url]');
                    if (hasFormatting) {
                        const bbcode = SNEED.core.bbcode.convertToBBCode(input);
                        input.textContent = bbcode;
                    }
                } else if (!wasWysiwyg && isWysiwyg) {
                    const text = input.textContent || '';
                    if (/\[(b|i|u|s|code|center|size|color|img)\b/i.test(text)) {
                        const html = SNEED.core.bbcode.convertToHTML(text);
                        input.innerHTML = html;
                    }
                }
            }

            const toggleBtn = doc.querySelector('[data-tool="WysiwygToggle"]');
            if (toggleBtn) {
                toggleBtn.style.opacity = isWysiwyg ? '0.5' : '1';
                toggleBtn.title = isWysiwyg ? 'WYSIWYG mode (click for raw BBCode)' : 'Raw BBCode mode (click for WYSIWYG)';
            }

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

            const event = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(event);
        }

        input.focus();
    }

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

            const event = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(event);

            input.focus();
        }
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.applyFormatting = applyFormatting;
    SNEED.features.insertEmote = insertEmote;

})();
