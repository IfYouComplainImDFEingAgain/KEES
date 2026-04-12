// ui/color-picker.js - Color picker popup for text formatting
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES, COLOR_PALETTE } = SNEED.ui;

    function applyColor(hex, input, selection, range, doc) {
        const selectedText = selection.toString();
        const isWysiwyg = SNEED.state.isWysiwygMode();

        if (!isWysiwyg) {
            let textToInsert;
            if (selectedText) {
                textToInsert = `[color=${hex}]${selectedText}[/color]`;
            } else {
                textToInsert = `[color=${hex}][/color]`;
            }

            const textNode = doc.createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);

            if (!selectedText) {
                const position = `[color=${hex}]`.length;
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
                colorSpan.style.color = hex;
                colorSpan.setAttribute('data-bbcode-color', hex);

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
            colorSpan.style.color = hex;
            colorSpan.setAttribute('data-bbcode-color', hex);
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
        input.focus();
    }

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

        function closePicker() {
            colorPicker.remove();
            removeElementListeners(colorPicker);
        }

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
                applyColor(color.hex, input, selection, range, doc);
                closePicker();
            });

            colorPicker.appendChild(colorButton);
        });

        // Custom color: a full-width label that looks like a rainbow button,
        // with a native <input type="color"> absolutely positioned on top at
        // opacity 0. Clicks physically land on the input, so the browser
        // opens the OS color dialog through normal user activation — no
        // programmatic .click() that browsers may block.
        const customWrapper = doc.createElement('label');
        customWrapper.title = 'Custom color';
        customWrapper.style.cssText = stylesToString({
            ...STYLES.colorButton,
            gridColumn: '1 / -1',
            width: '100%',
            height: '28px',
            background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0, 0, 0, 0.85)',
            fontSize: '11px',
            fontWeight: '700',
            textShadow: '0 0 2px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.9)',
            cursor: 'pointer',
            position: 'relative',
            boxSizing: 'border-box'
        });
        customWrapper.appendChild(doc.createTextNode('Custom'));

        const nativeInput = doc.createElement('input');
        nativeInput.type = 'color';
        nativeInput.value = '#ff0000';
        nativeInput.style.cssText = stylesToString({
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            opacity: '0',
            cursor: 'pointer',
            border: '0',
            padding: '0',
            margin: '0'
        });
        customWrapper.appendChild(nativeInput);

        addManagedEventListener(customWrapper, 'mouseenter', () => {
            customWrapper.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            customWrapper.style.transform = 'scale(1.02)';
        });

        addManagedEventListener(customWrapper, 'mouseleave', () => {
            customWrapper.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            customWrapper.style.transform = 'scale(1)';
        });

        // Clicks on the input bubble up — stop them so the outside-click
        // handler doesn't close the picker before `change` fires.
        addManagedEventListener(nativeInput, 'click', (e) => {
            e.stopPropagation();
        });

        addManagedEventListener(nativeInput, 'change', (e) => {
            e.stopPropagation();
            const hex = nativeInput.value;
            applyColor(hex, input, selection, range, doc);
            closePicker();
        });

        colorPicker.appendChild(customWrapper);

        const closeButton = doc.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.style.cssText = stylesToString(STYLES.colorPickerCloseButton);

        addManagedEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            closePicker();
            input.focus();
        });

        colorPicker.appendChild(closeButton);

        const clickOutside = (e) => {
            if (!colorPicker.contains(e.target)) {
                closePicker();
                doc.removeEventListener('click', clickOutside);
                input.focus();
            }
        };

        doc.body.appendChild(colorPicker);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    SNEED.ui.showColorPicker = showColorPicker;

})();
