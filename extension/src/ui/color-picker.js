// ui/color-picker.js - Color picker popup for text formatting
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES, COLOR_PALETTE } = SNEED.ui;

    function showColorPicker(input, selection, range, doc) {
        const existing = doc.getElementById('color-picker-popup');
        if (existing) {
            existing.remove();
            return;
        }

        const colorPicker = doc.createElement('div');
        colorPicker.id = 'color-picker-popup';
        colorPicker.style.cssText = stylesToString(STYLES.colorPicker);

        const inputRect = input.getBoundingClientRect();
        colorPicker.style.left = (inputRect.left + 20) + 'px';
        colorPicker.style.top = (inputRect.top - 120) + 'px';

        COLOR_PALETTE.forEach(color => {
            const colorButton = doc.createElement('button');
            colorButton.type = 'button';
            colorButton.style.cssText = stylesToString({
                ...STYLES.colorButton,
                background: color.hex
            });
            colorButton.title = color.name;

            addManagedEventListener(colorButton, 'mouseenter', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.8)';
                colorButton.style.transform = 'scale(1.1)';
            });

            addManagedEventListener(colorButton, 'mouseleave', () => {
                colorButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                colorButton.style.transform = 'scale(1)';
            });

            addManagedEventListener(colorButton, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const selectedText = selection.toString();
                const isWysiwyg = SNEED.state.isWysiwygMode();

                if (!isWysiwyg) {
                    let textToInsert;
                    if (selectedText) {
                        textToInsert = `[color=${color.hex}]${selectedText}[/color]`;
                    } else {
                        textToInsert = `[color=${color.hex}][/color]`;
                    }

                    const textNode = doc.createTextNode(textToInsert);
                    range.deleteContents();
                    range.insertNode(textNode);

                    if (!selectedText) {
                        const position = `[color=${color.hex}]`.length;
                        range.setStart(textNode, position);
                        range.setEnd(textNode, position);
                    } else {
                        range.setStartAfter(textNode);
                        range.setEndAfter(textNode);
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else if (selectedText) {
                    const parentSpan = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                        ? range.commonAncestorContainer.parentElement
                        : range.commonAncestorContainer;

                    if (parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.hasAttribute('data-bbcode-color')) {
                        // Remove color - unwrap the span
                        const parent = parentSpan.parentNode;
                        while (parentSpan.firstChild) {
                            parent.insertBefore(parentSpan.firstChild, parentSpan);
                        }
                        parent.removeChild(parentSpan);
                        selection.removeAllRanges();
                    } else {
                        const colorSpan = doc.createElement('span');
                        colorSpan.style.color = color.hex;
                        colorSpan.setAttribute('data-bbcode-color', color.hex);

                        const fragment = range.extractContents();
                        colorSpan.appendChild(fragment);
                        range.insertNode(colorSpan);

                        range.setStartAfter(colorSpan);
                        range.setEndAfter(colorSpan);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } else {
                    // No selection - create colored span with zero-width space for cursor positioning
                    const colorSpan = doc.createElement('span');
                    colorSpan.style.color = color.hex;
                    colorSpan.setAttribute('data-bbcode-color', color.hex);
                    colorSpan.textContent = '\u200B';
                    range.insertNode(colorSpan);

                    const newRange = doc.createRange();
                    newRange.setStart(colorSpan.firstChild, 1);
                    newRange.setEnd(colorSpan.firstChild, 1);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }

                const event = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                input.dispatchEvent(event);

                colorPicker.remove();
                removeElementListeners(colorPicker);
                input.focus();
            });

            colorPicker.appendChild(colorButton);
        });

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

        const clickOutside = (e) => {
            if (!colorPicker.contains(e.target)) {
                colorPicker.remove();
                removeElementListeners(colorPicker);
                doc.removeEventListener('click', clickOutside);
                input.focus();
            }
        };

        doc.body.appendChild(colorPicker);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    SNEED.ui.showColorPicker = showColorPicker;

})();
