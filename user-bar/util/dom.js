/**
 * util/dom.js - DOM utilities and helpers
 * Provides common DOM manipulation functions used across modules.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;

    // ============================================
    // STYLE HELPERS
    // ============================================

    /**
     * Convert a style object to a CSS string
     * @param {Object} styles - Object with camelCase CSS properties
     * @returns {string} - CSS string
     */
    function stylesToString(styles) {
        return Object.entries(styles)
            .map(([key, value]) => {
                const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${cssKey}: ${value}`;
            })
            .join('; ');
    }

    // ============================================
    // DOM QUERY HELPERS
    // ============================================

    /**
     * Find the message container element
     * @param {Document} doc - Document to search in
     * @returns {Element|null}
     */
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

    /**
     * Get the target document (handles iframe context)
     * @returns {Document}
     */
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

    /**
     * Check if we're in the iframe context
     * @returns {boolean}
     */
    function isInIframe() {
        return window.location.pathname.includes('test-chat');
    }

    // ============================================
    // ELEMENT CREATION HELPERS
    // ============================================

    /**
     * Create an element with styles and attributes
     * @param {Document} doc - Document to create element in
     * @param {string} tag - Element tag name
     * @param {Object} options - Options for the element
     * @returns {Element}
     */
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

    /**
     * Create a button element
     * @param {Document} doc - Document to create button in
     * @param {Object} options - Button options
     * @returns {HTMLButtonElement}
     */
    function createButton(doc, options = {}) {
        const button = doc.createElement('button');
        button.type = 'button';

        if (options.text) button.textContent = options.text;
        if (options.title) button.title = options.title;
        if (options.styles) button.style.cssText = stylesToString(options.styles);
        if (options.cssText) button.style.cssText = options.cssText;

        return button;
    }

    // ============================================
    // SELECTION/CURSOR HELPERS
    // ============================================

    /**
     * Get selection and range from a document
     * @param {Document} doc - Document to get selection from
     * @param {Element} input - Input element for fallback
     * @returns {Object} - { selection, range }
     */
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

    /**
     * Insert text at cursor position in a contenteditable element
     * @param {Document} doc - Document context
     * @param {Element} input - Input element
     * @param {string} text - Text to insert
     * @param {Object} options - Insertion options
     */
    function insertTextAtCursor(doc, input, text, options = {}) {
        input.focus();

        const { selection, range } = getSelectionAndRange(doc, input);
        const textNode = doc.createTextNode(text);

        range.deleteContents();
        range.insertNode(textNode);

        // Position cursor
        if (options.cursorPosition !== undefined) {
            range.setStart(textNode, options.cursorPosition);
            range.setEnd(textNode, options.cursorPosition);
        } else {
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        // Trigger input event
        const event = new Event('input', { bubbles: true, cancelable: true });
        input.dispatchEvent(event);

        input.focus();
    }

    /**
     * Position cursor at end of element
     * @param {Document} doc - Document context
     * @param {Element} element - Element to position cursor in
     */
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

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

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
        positionCursorAtEnd
    });

})();
