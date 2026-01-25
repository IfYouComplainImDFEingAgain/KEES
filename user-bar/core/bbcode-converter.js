/**
 * core/bbcode-converter.js - HTML to BBCode converter
 * Converts WYSIWYG HTML formatting to BBCode for submission.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;

    // ============================================
    // COLOR NORMALIZATION
    // ============================================

    const NAMED_COLORS = {
        'red': '#ff0000',
        'green': '#008000',
        'blue': '#0000ff',
        'yellow': '#ffff00',
        'orange': '#ffa500',
        'purple': '#800080',
        'pink': '#ffc0cb',
        'white': '#ffffff',
        'black': '#000000',
        'gray': '#808080',
        'grey': '#808080',
        'cyan': '#00ffff',
        'magenta': '#ff00ff'
    };

    /**
     * Normalize color to hex format
     * @param {string} color - Color in any format (hex, rgb, named)
     * @returns {string|null} - Hex color or null if invalid
     */
    function normalizeColor(color) {
        if (!color) return null;

        color = color.trim().toLowerCase();

        // Already hex
        if (/^#[0-9a-f]{6}$/i.test(color)) {
            return color.toLowerCase();
        }

        // Short hex (#fff -> #ffffff)
        if (/^#[0-9a-f]{3}$/i.test(color)) {
            return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }

        // Named color
        if (NAMED_COLORS[color]) {
            return NAMED_COLORS[color];
        }

        // RGB format: rgb(r, g, b)
        const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgbMatch) {
            const r = Math.min(255, parseInt(rgbMatch[1], 10)).toString(16).padStart(2, '0');
            const g = Math.min(255, parseInt(rgbMatch[2], 10)).toString(16).padStart(2, '0');
            const b = Math.min(255, parseInt(rgbMatch[3], 10)).toString(16).padStart(2, '0');
            return '#' + r + g + b;
        }

        // RGBA format (ignore alpha)
        const rgbaMatch = color.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i);
        if (rgbaMatch) {
            const r = Math.min(255, parseInt(rgbaMatch[1], 10)).toString(16).padStart(2, '0');
            const g = Math.min(255, parseInt(rgbaMatch[2], 10)).toString(16).padStart(2, '0');
            const b = Math.min(255, parseInt(rgbaMatch[3], 10)).toString(16).padStart(2, '0');
            return '#' + r + g + b;
        }

        return null;
    }

    // ============================================
    // DOM PROCESSING
    // ============================================

    /**
     * Process a DOM node and convert to BBCode
     * @param {Node} node - DOM node to process
     * @returns {string} - BBCode string
     */
    function processNode(node) {
        // Text node - return text content
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        // Not an element node - skip
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tagName = node.tagName.toLowerCase();

        // Process children first
        let childContent = '';
        for (const child of node.childNodes) {
            childContent += processNode(child);
        }

        // Handle specific tags
        switch (tagName) {
            case 'strong':
            case 'b':
                return '[b]' + childContent + '[/b]';

            case 'em':
            case 'i':
                return '[i]' + childContent + '[/i]';

            case 'span': {
                // Check for color styling
                const style = node.getAttribute('style') || '';
                const dataColor = node.getAttribute('data-bbcode-color');

                let color = null;

                // Prefer data attribute
                if (dataColor) {
                    color = normalizeColor(dataColor);
                }

                // Fall back to inline style
                if (!color) {
                    const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
                    if (colorMatch) {
                        color = normalizeColor(colorMatch[1]);
                    }
                }

                if (color) {
                    return '[color=' + color + ']' + childContent + '[/color]';
                }

                // No special handling, just return children
                return childContent;
            }

            case 'img': {
                // Convert inline image back to BBCode
                const src = node.getAttribute('src');
                if (src) {
                    return '[img]' + src + '[/img]';
                }
                return '';
            }

            case 'br':
                return '\n';

            case 'div':
            case 'p':
                // Block elements get newlines
                if (childContent) {
                    return childContent + '\n';
                }
                return '\n';

            default:
                // Unknown tag - just process children
                return childContent;
        }
    }

    /**
     * Convert HTML content to BBCode
     * @param {HTMLElement} element - Element containing HTML content
     * @returns {string} - BBCode string
     */
    function convertToBBCode(element) {
        let result = '';

        for (const child of element.childNodes) {
            result += processNode(child);
        }

        // Remove zero-width spaces (used for cursor positioning)
        result = result.replace(/\u200B/g, '');

        // Clean up multiple consecutive newlines
        result = result.replace(/\n{3,}/g, '\n\n');

        // Trim trailing newlines
        result = result.replace(/\n+$/, '');

        return result;
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.core = SNEED.core || {};
    SNEED.core.bbcode = {
        convertToBBCode,
        normalizeColor,
        processNode
    };

})();
