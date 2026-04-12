// ui/size-picker.js - Text size selection popup
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES } = SNEED.ui;

    const SIZES = [
        { label: 'Tiny', value: 1 },
        { label: 'Small', value: 3 },
        { label: 'Normal', value: 5 },
        { label: 'Large', value: 7 },
        { label: 'Huge', value: 170 },
        { label: 'Max', value: 190 }
    ];

    function showSizePicker(input, selection, range, doc) {
        const existing = doc.getElementById('size-picker-popup');
        if (existing) {
            existing.remove();
            return;
        }

        const picker = doc.createElement('div');
        picker.id = 'size-picker-popup';
        picker.style.cssText = stylesToString({
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: '1000',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
        });

        const inputRect = input.getBoundingClientRect();
        picker.style.left = (inputRect.left + 20) + 'px';
        picker.style.top = (inputRect.top - 160) + 'px';

        SIZES.forEach(size => {
            const btn = doc.createElement('button');
            btn.type = 'button';
            btn.textContent = size.label;
            btn.style.cssText = stylesToString({
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '6px 16px',
                cursor: 'pointer',
                borderRadius: '3px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '12px',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                outline: 'none'
            });

            addManagedEventListener(btn, 'mouseenter', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.2)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            });

            addManagedEventListener(btn, 'mouseleave', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });

            addManagedEventListener(btn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const selectedText = selection.toString();
                const isWysiwyg = SNEED.state.isWysiwygMode();

                if (isWysiwyg) {
                    if (selectedText) {
                        const span = doc.createElement('span');
                        span.style.fontSize = size.value + 'px';
                        span.setAttribute('data-bbcode-size', String(size.value));
                        const fragment = range.extractContents();
                        span.appendChild(fragment);
                        range.insertNode(span);
                        range.setStartAfter(span);
                        range.setEndAfter(span);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else {
                        const span = doc.createElement('span');
                        span.style.fontSize = size.value + 'px';
                        span.setAttribute('data-bbcode-size', String(size.value));
                        span.textContent = '\u200B';
                        range.insertNode(span);
                        const newRange = doc.createRange();
                        newRange.setStart(span.firstChild, 1);
                        newRange.setEnd(span.firstChild, 1);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                } else {
                    let textToInsert;
                    if (selectedText) {
                        textToInsert = `[size=${size.value}]${selectedText}[/size]`;
                    } else {
                        textToInsert = `[size=${size.value}][/size]`;
                    }

                    const textNode = doc.createTextNode(textToInsert);
                    range.deleteContents();
                    range.insertNode(textNode);

                    if (!selectedText) {
                        const position = `[size=${size.value}]`.length;
                        range.setStart(textNode, position);
                        range.setEnd(textNode, position);
                    } else {
                        range.setStartAfter(textNode);
                        range.setEndAfter(textNode);
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const event = new Event('input', { bubbles: true, cancelable: true });
                input.dispatchEvent(event);

                picker.remove();
                removeElementListeners(picker);
                input.focus();
            });

            picker.appendChild(btn);
        });

        const closeButton = doc.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '\u00d7';
        closeButton.style.cssText = stylesToString(STYLES.colorPickerCloseButton);

        addManagedEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            picker.remove();
            removeElementListeners(picker);
            input.focus();
        });

        picker.appendChild(closeButton);

        const clickOutside = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                removeElementListeners(picker);
                doc.removeEventListener('click', clickOutside);
                input.focus();
            }
        };

        doc.body.appendChild(picker);
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
    }

    SNEED.ui.showSizePicker = showSizePicker;

})();
