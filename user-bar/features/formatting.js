/**
 * features/formatting.js - Text formatting and emote insertion
 * Handles BBCode formatting, bullet lists, and emote insertion.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const { getSelectionAndRange } = SNEED.util;

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

        // Handle custom actions
        if (tool.customAction === 'bulletLines') {
            const selectedText = selection.toString();
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
        } else if (tool.customAction === 'colorPicker') {
            SNEED.ui.showColorPicker(input, selection, range, doc);
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
            if (tool.startTag && tool.endTag && !selection.toString()) {
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
