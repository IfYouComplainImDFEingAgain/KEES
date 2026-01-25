/**
 * core/state.js - Application state and configuration
 * Holds default configuration, runtime state, and constants.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;

    // ============================================
    // DEFAULT EMOTES
    // ============================================

    const defaultEmotes = [
        {
            code: ':lossmanjack:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_loss.png',
            title: 'Loss Man Jack'
        },
        {
            code: ':juice:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_juicy.gif',
            title: 'Juice!'
        },
        {
            code: ':ross:',
            url: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
            title: 'Ross',
        },
        {
            code: ':gunt:',
            url: 'https://kiwifarms.st/styles/custom/emotes/gunt.gif',
            title: 'Gunt',
        },
        {
            code: '[img]https://files.catbox.moe/0v5vvb.png[/img]',
            text: 'test',
            title: 'Retard Avelloon'
        },
        {
            code: '🤡',
            emoji: '🤡',
            title: 'What are you laughing at?'
        },
        {
            code: '5',
            text: '5',
            title: 'Type a 5 in the chat if you think hes weird.'
        },
        {
            code: '🚨[color=#ff0000]ALERT[/color]🚨 BOSSMAN IS [color=#80ff00]CLIMBING[/color]',
            text: 'Alert Bossman is climbing',
            title: 'Climbing'
        }
    ];

    // ============================================
    // TOGGLE BUTTON CONFIG
    // ============================================

    const toggleButtonConfig = {
        image: 'https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png',
        title: 'Toggle emote bar'
    };

    // ============================================
    // FORMAT TOOLS
    // ============================================

    const formatTools = [
        {
            name: 'Bold',
            symbol: 'B',
            wysiwygCommand: 'bold',
            title: 'Bold text'
        },
        {
            name: 'Italic',
            symbol: 'I',
            wysiwygCommand: 'italic',
            title: 'Italic text'
        },
        {
            name: 'Bullet',
            symbol: '•',
            customAction: 'bulletLines',
            title: 'Add bullets to lines'
        },
        {
            name: 'Image',
            symbol: '🖼',
            customAction: 'insertImage',
            title: 'Insert image'
        },
        {
            name: 'Color',
            symbol: '🎨',
            customAction: 'colorPicker',
            title: 'Text color'
        },
        {
            name: 'Newline',
            symbol: '↵',
            insertText: '[br]',
            title: 'Insert line break'
        },
        {
            name: 'Blacklist',
            symbol: '🚫',
            customAction: 'blacklistManager',
            title: 'Manage blacklisted images'
        },
        {
            name: 'Emotes',
            symbol: '⚙️',
            customAction: 'emoteManager',
            title: 'Manage custom emotes'
        }
    ];

    // ============================================
    // CONFIGURATION CONSTANTS
    // ============================================

    const CONFIG = {
        MAX_INPUT_HEIGHT: 200,
        RESIZE_DEBOUNCE_DELAY: 16, // ~60fps
        AUTO_SEND_DELAY: 50,
        INIT_DELAY: 500,
        POLLING_CHECK_DELAY: 1000,
        MAX_REINJECT_ATTEMPTS: 10,
        SEND_TIMEOUT: 3000
    };

    // ============================================
    // STORAGE KEYS
    // ============================================

    const STORAGE_KEYS = {
        EMOTES: 'sneedchat-custom-emotes',
        BLACKLIST: 'sneedchat-image-blacklist'
    };

    // ============================================
    // RUNTIME STATE
    // ============================================

    const runtimeState = {
        emoteBarVisible: false,
        reinjectAttempts: 0,
        emotes: null, // Will be loaded from storage
        initialized: false,
        pendingTimers: new Set()
    };

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.state = SNEED.state || {};
    Object.assign(SNEED.state, {
        defaultEmotes,
        toggleButtonConfig,
        formatTools,
        CONFIG,
        STORAGE_KEYS,
        runtime: runtimeState,

        // Getters/setters for runtime state
        isEmoteBarVisible() {
            return runtimeState.emoteBarVisible;
        },

        setEmoteBarVisible(visible) {
            runtimeState.emoteBarVisible = visible;
        },

        toggleEmoteBarVisible() {
            runtimeState.emoteBarVisible = !runtimeState.emoteBarVisible;
            return runtimeState.emoteBarVisible;
        },

        getEmotes() {
            return runtimeState.emotes;
        },

        setEmotes(emotes) {
            runtimeState.emotes = emotes;
        },

        incrementReinjectAttempts() {
            return ++runtimeState.reinjectAttempts;
        },

        canReinject() {
            return runtimeState.reinjectAttempts < CONFIG.MAX_REINJECT_ATTEMPTS;
        },

        setInitialized(value) {
            runtimeState.initialized = value;
        },

        isInitialized() {
            return runtimeState.initialized;
        },

        // Timer management
        addTimer(id) {
            runtimeState.pendingTimers.add(id);
            return id;
        },

        removeTimer(id) {
            runtimeState.pendingTimers.delete(id);
        },

        clearAllTimers() {
            runtimeState.pendingTimers.forEach(id => clearTimeout(id));
            runtimeState.pendingTimers.clear();
        }
    });

})();
