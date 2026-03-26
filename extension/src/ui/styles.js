// ui/styles.js - Centralized style definitions for all UI components
(function() {
    'use strict';

    const SNEED = window.SNEED;

    const STYLES = {
        emoteBar: {
            display: 'none',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.1)',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            marginBottom: '0px',
            gap: '8px',
            flexWrap: 'wrap',
            transition: 'all 0.3s ease'
        },
        formatBar: {
            display: 'none',
            alignItems: 'center',
            padding: '6px 12px',
            background: 'rgba(0, 0, 0, 0.15)',
            border: 'none',
            borderRadius: '0 0 4px 4px',
            marginBottom: '8px',
            gap: '6px',
            flexWrap: 'wrap',
            transition: 'all 0.3s ease'
        },
        label: {
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '13px',
            fontWeight: '500',
            marginRight: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        formatLabel: {
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            fontWeight: '500',
            marginRight: '6px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        emoteButton: {
            background: 'transparent',
            border: '1px solid transparent',
            padding: '4px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
        },
        formatButton: {
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '3px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.9)',
            minWidth: '28px',
            height: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        emoteToggleButton: {
            background: 'transparent',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            marginRight: '4px'
        },
        toggleImg: {
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            display: 'block',
            filter: 'brightness(0.9)',
            transition: 'filter 0.2s ease'
        },
        emoteImage: {
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            display: 'block'
        },
        emoteEmoji: {
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px'
        },
        emoteText: {
            fontSize: '10px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            textAlign: 'center',
            lineHeight: '1'
        },
        colorPicker: {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: '1000',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
        },
        colorButton: {
            width: '32px',
            height: '32px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
        },
        colorPickerCloseButton: {
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
        },
        measureElement: {
            position: 'absolute',
            visibility: 'hidden',
            height: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            pointerEvents: 'none',
            zIndex: '-1000'
        },
        popup: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            zIndex: '10000',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        popupTitle: {
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '0 0 12px 0',
            fontSize: '16px'
        },
        button: {
            base: {
                padding: '8px 16px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '12px',
                transition: 'background 0.2s ease'
            },
            primary: {
                background: 'rgba(0, 255, 0, 0.3)',
                border: '1px solid rgba(0, 255, 0, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)'
            },
            danger: {
                background: 'rgba(255, 0, 0, 0.3)',
                border: '1px solid rgba(255, 0, 0, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)'
            },
            secondary: {
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)'
            },
            info: {
                background: 'rgba(0, 128, 255, 0.3)',
                border: '1px solid rgba(0, 128, 255, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)'
            },
            warning: {
                background: 'rgba(255, 128, 0, 0.3)',
                border: '1px solid rgba(255, 128, 0, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)'
            },
            neutral: {
                background: 'rgba(128, 128, 128, 0.3)',
                border: '1px solid rgba(128, 128, 128, 0.5)',
                color: 'rgba(255, 255, 255, 0.9)'
            }
        },
        input: {
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.9)',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
        }
    };

    const COLOR_PALETTE = [
        { name: 'Red', hex: '#ff0000' },
        { name: 'Greentext', hex: '#789922' },
        { name: 'Blue', hex: '#0080ff' },
        { name: 'Purple', hex: '#8000ff' },
        { name: 'Orange', hex: '#ff8000' },
        { name: 'Pink', hex: '#ff0080' },
        { name: 'Yellow', hex: '#ffff00' },
        { name: 'Cyan', hex: '#00ffff' },
        { name: 'Lime', hex: '#80ff00' },
        { name: 'Magenta', hex: '#ff00ff' },
        { name: 'Brown', hex: '#8b4513' },
        { name: 'Gray', hex: '#808080' }
    ];

    SNEED.ui = SNEED.ui || {};
    SNEED.ui.STYLES = STYLES;
    SNEED.ui.COLOR_PALETTE = COLOR_PALETTE;

})();
