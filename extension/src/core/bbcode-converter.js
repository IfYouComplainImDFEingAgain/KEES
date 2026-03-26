// core/bbcode-converter.js - HTML to BBCode converter
(function() {
    'use strict';

    const SNEED = window.SNEED;

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

    function normalizeColor(color) {
        if (!color) return null;

        color = color.trim().toLowerCase();

        if (/^#[0-9a-f]{6}$/i.test(color)) {
            return color.toLowerCase();
        }

        // Short hex (#fff -> #ffffff)
        if (/^#[0-9a-f]{3}$/i.test(color)) {
            return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }

        if (NAMED_COLORS[color]) {
            return NAMED_COLORS[color];
        }

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

    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tagName = node.tagName.toLowerCase();

        let childContent = '';
        for (const child of node.childNodes) {
            childContent += processNode(child);
        }

        switch (tagName) {
            case 'strong':
            case 'b':
                return '[b]' + childContent + '[/b]';

            case 'em':
            case 'i':
                return '[i]' + childContent + '[/i]';

            case 'u':
                return '[u]' + childContent + '[/u]';

            case 's':
            case 'strike':
            case 'del':
                return '[s]' + childContent + '[/s]';

            case 'code':
                return '[code]' + childContent + '[/code]';

            case 'span': {
                const dataSize = node.getAttribute('data-bbcode-size');
                if (dataSize) {
                    return '[size=' + dataSize + ']' + childContent + '[/size]';
                }

                const style = node.getAttribute('style') || '';
                const dataColor = node.getAttribute('data-bbcode-color');

                let color = null;

                if (dataColor) {
                    color = normalizeColor(dataColor);
                }

                if (!color) {
                    const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
                    if (colorMatch) {
                        color = normalizeColor(colorMatch[1]);
                    }
                }

                if (color) {
                    return '[color=' + color + ']' + childContent + '[/color]';
                }

                return childContent;
            }

            case 'img': {
                const src = node.getAttribute('src');
                if (src) {
                    return '[img]' + src + '[/img]';
                }
                return '';
            }

            case 'br':
                return '\n';

            case 'div':
                if (node.hasAttribute('data-bbcode-center')) {
                    return '[center]' + childContent + '[/center]';
                }
                if (childContent) {
                    return childContent + '\n';
                }
                return '\n';

            case 'p':
                if (childContent) {
                    return childContent + '\n';
                }
                return '\n';

            default:
                return childContent;
        }
    }

    function convertToBBCode(element) {
        let result = '';

        for (const child of element.childNodes) {
            result += processNode(child);
        }

        // Remove zero-width spaces (used for cursor positioning)
        result = result.replace(/\u200B/g, '');
        result = result.replace(/\n{3,}/g, '\n\n');
        result = result.replace(/\n+$/, '');

        return result;
    }

    function convertToHTML(text) {
        if (!text) return '';

        let html = text;

        html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
        html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
        html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
        html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');
        html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<code>$1</code>');
        html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi,
            '<div style="text-align:center" data-bbcode-center="true">$1</div>');
        html = html.replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi,
            '<span style="font-size:$1px" data-bbcode-size="$1">$2</span>');
        html = html.replace(/\[color=(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/color\]/gi,
            '<span style="color:$1" data-bbcode-color="$1">$2</span>');
        html = html.replace(/\[img\](https?:\/\/[^\[]+)\[\/img\]/gi,
            '<img src="$1" data-bbcode-img="true" style="max-height:150px;max-width:100%;vertical-align:middle">');

        return html;
    }

    SNEED.core = SNEED.core || {};
    SNEED.core.bbcode = {
        convertToBBCode,
        convertToHTML,
        normalizeColor,
        processNode
    };

})();
