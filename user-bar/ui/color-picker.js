/**
 * ui/color-picker.js - Color picker popup
 * Handles the color selection UI for text formatting.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES, COLOR_PALETTE } = SNEED.ui;

    /**
     * Show the color picker popup
     * @param {Element} input - Input element
     * @param {Selection} selection - Current selection
     * @param {Range} range - Current range
     * @param {Document} doc - Document context
     */
    function showColorPicker(input, selection, range, doc) {
        // Remove existing color picker
        const existing = doc.getElementById('color-picker-popup');
        if (existing) {
            existing.remove();
            return;
        }

        // Create color picker popup
        const colorPicker = doc.createElement('div');
        colorPicker.id = 'color-picker-popup';
        colorPicker.style.cssText = stylesToString(STYLES.colorPicker);

        // Position near the input
        const inputRect = input.getBoundingClientRect();
        colorPicker.style.left = (inputRect.left + 20) + 'px';
        colorPicker.style.top = (inputRect.top - 120) + 'px';

        // Create color buttons
        COLOR_PALETTE.forEach(color => {
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

                if (selectedText) {
                    // Check if selection is inside a color span
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
                        // Clear selection after removing
                        selection.removeAllRanges();
                    } else {
                        // Wrap selection in colored span
                        const colorSpan = doc.createElement('span');
                        colorSpan.style.color = color.hex;
                        colorSpan.setAttribute('data-bbcode-color', color.hex);

                        // Extract and wrap selection
                        const fragment = range.extractContents();
                        colorSpan.appendChild(fragment);
                        range.insertNode(colorSpan);

                        // Position cursor after the span
                        range.setStartAfter(colorSpan);
                        range.setEndAfter(colorSpan);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } else {
                    // No selection - create colored span with zero-width space to hold cursor
                    const colorSpan = doc.createElement('span');
                    colorSpan.style.color = color.hex;
                    colorSpan.setAttribute('data-bbcode-color', color.hex);
                    // Use zero-width space to allow cursor positioning
                    colorSpan.textContent = '\u200B';
                    range.insertNode(colorSpan);

                    // Position cursor inside the span after the zero-width space
                    const newRange = doc.createRange();
                    newRange.setStart(colorSpan.firstChild, 1);
                    newRange.setEnd(colorSpan.firstChild, 1);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }

                // Trigger input event
                const event = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                input.dispatchEvent(event);

                // Remove color picker and refocus input
                colorPicker.remove();
                removeElementListeners(colorPicker);
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

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.ui.showColorPicker = showColorPicker;

})();
