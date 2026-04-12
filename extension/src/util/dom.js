// util/dom.js - DOM utilities and helpers
(function() {
    'use strict';

    const SNEED = window.SNEED;

    function stylesToString(styles) {
        return Object.entries(styles)
            .map(([key, value]) => {
                const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${cssKey}: ${value}`;
            })
            .join('; ');
    }

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

    function getTargetDocument() {
        const isIframe = window.location.pathname.includes('test-chat');
        if (isIframe) {
            return document;
        }

        const iframe = document.getElementById('rust-shim');
        if (iframe) {
            try {
                return iframe.contentDocument || iframe.contentWindow.document;
            } catch (e) {
                return document;
            }
        }
        return document;
    }

    function isInIframe() {
        return window.location.pathname.includes('test-chat');
    }

    function createElement(doc, tag, options = {}) {
        const element = doc.createElement(tag);

        if (options.id) element.id = options.id;
        if (options.className) element.className = options.className;
        if (options.text) element.textContent = options.text;
        if (options.html) element.innerHTML = options.html;
        if (options.styles) element.style.cssText = stylesToString(options.styles);
        if (options.cssText) element.style.cssText = options.cssText;
        if (options.attrs) {
            Object.entries(options.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }

        return element;
    }

    function createButton(doc, options = {}) {
        const button = doc.createElement('button');
        button.type = 'button';

        if (options.text) button.textContent = options.text;
        if (options.title) button.title = options.title;
        if (options.styles) button.style.cssText = stylesToString(options.styles);
        if (options.cssText) button.style.cssText = options.cssText;

        return button;
    }

    function getSelectionAndRange(doc, input) {
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

        return { selection, range };
    }

    function insertTextAtCursor(doc, input, text, options = {}) {
        input.focus();

        const { selection, range } = getSelectionAndRange(doc, input);
        const textNode = doc.createTextNode(text);

        range.deleteContents();
        range.insertNode(textNode);

        if (options.cursorPosition !== undefined) {
            range.setStart(textNode, options.cursorPosition);
            range.setEnd(textNode, options.cursorPosition);
        } else {
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        const event = new Event('input', { bubbles: true, cancelable: true });
        input.dispatchEvent(event);

        input.focus();
    }

    function positionCursorAtEnd(doc, element) {
        element.focus();
        const range = doc.createRange();
        const win = doc.defaultView || window;
        const selection = win.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Cached author lookup. Every feature that filters by sender used to run
    // its own `querySelector('.author')` + textContent.trim() per message.
    // Memoize on the element so the second-through-Nth feature is free.
    function getMessageAuthor(msgEl) {
        if (!msgEl) return null;
        if (msgEl.__sneedAuthor !== undefined) return msgEl.__sneedAuthor;
        const authorEl = msgEl.querySelector && msgEl.querySelector('.author');
        const author = authorEl ? (authorEl.textContent || '').trim() : null;
        msgEl.__sneedAuthor = author;
        return author;
    }

    SNEED.util = SNEED.util || {};
    Object.assign(SNEED.util, {
        stylesToString,
        findMessageContainer,
        getTargetDocument,
        isInIframe,
        createElement,
        createButton,
        getSelectionAndRange,
        insertTextAtCursor,
        positionCursorAtEnd,
        getMessageAuthor
    });

})();
