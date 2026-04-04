// features/gambling-filter.js - Hide gambling commands and bot responses from chat
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const STORAGE_KEY = 'kees-mute-gambling';

    let enabled = false;

    // User command prefixes that trigger gambling
    const GAMBLING_COMMANDS = [
        '!slots', '!sluts',
        '!roulette', '!rl',
        '!dice',
        '!coinflip',
        '!blackjack', '!bj',
        '!limbo',
        '!keno',
        '!mines',
        '!plinko',
        '!planes',
        '!wheel',
        '!lambchop',
        '!guess',
        '!8ball',
        '!pocketwatch', '!balance', '!abandoned',
        '!juice',
        '!daily', '!juiceme',
        '!rakeback', '!rapeback', '!lossback',
        '!legitimatecheck', '!legitcheck',
        '!abandon',
        '!bal',
        '!withdraw', '!deposit',
        '!rain',
        '!rainbet',
        '!howl'
    ];

    // Bot response patterns (case-insensitive partial matches on rendered text)
    const GAMBLING_RESPONSE_PATTERNS = [
        /you (?:won|lost|rolled|spun)/i,
        /your balance (?:is|of)/i,
        /current balance:/i,
        /isn't enough for this wager/i,
        /is currently disabled/i,
        /valid bets:/i,
        /net:.*current balance/i,
        /from \d+ spins? worth/i,
        /dealer bust/i,
        /dealer blackjack/i,
        /you redeemed \d/i,
        /your rakeback/i,
        /your lossback/i,
        /the hostess has given you/i,
        /\d+\.?\d*\s*KKK/,
        /kasino/i,
        /\brainbet\b/i,
        /\bhowl(?:gg)?\b.*(?:stats|recent|bets)/i
    ];

    // Image URL patterns for gambling animations
    const GAMBLING_IMAGE_PATTERNS = [
        /bossmancoin/i,
        /i\.ddos\.lgbt\/u\/Nq3JXD/i,
        /i\.ddos\.lgbt\/raw\/baV63V/i
    ];

    // Emoji sequences characteristic of gambling game boards/animations
    const GAMBLING_EMOJI_PATTERNS = [
        /[⚫⚪🟠🔻🟢🍀💲]{3,}/,      // plinko board
        /[🟢⚪⚫🟡🟣🔴]{3,}/,         // wheel
        /[🐑🟡🟣🟢🔴🌳🏜️🐺🛸⚡☠🏅💰🏯]{3,}/, // lambchop
        /[⬜🔶💠⬛]{3,}/,              // keno board
        /[💨🛫🛬🔥❌⛴🌊⬜]{3,}/,      // planes
        /🎲.*[─┃]{3,}/,               // dice meter
        /[♠♥♦♣🃏]{2,}/                // blackjack cards
    ];

    function getMessageText(msgEl) {
        const body = msgEl.querySelector('.message-body') || msgEl;
        return (body.textContent || '').trim();
    }

    function getMessageHtml(msgEl) {
        const body = msgEl.querySelector('.message-body') || msgEl;
        return body.innerHTML || '';
    }

    function isGamblingCommand(text) {
        const lower = text.toLowerCase();
        for (const cmd of GAMBLING_COMMANDS) {
            if (lower === cmd || lower.startsWith(cmd + ' ')) {
                return true;
            }
        }
        return false;
    }

    function isGamblingResponse(text) {
        for (const pattern of GAMBLING_RESPONSE_PATTERNS) {
            if (pattern.test(text)) {
                return true;
            }
        }
        return false;
    }

    function hasGamblingImages(html) {
        for (const pattern of GAMBLING_IMAGE_PATTERNS) {
            if (pattern.test(html)) {
                return true;
            }
        }
        return false;
    }

    function hasGamblingEmoji(text) {
        for (const pattern of GAMBLING_EMOJI_PATTERNS) {
            if (pattern.test(text)) {
                return true;
            }
        }
        return false;
    }

    function isGamblingMessage(msgEl) {
        const text = getMessageText(msgEl);
        if (!text) return false;

        if (isGamblingCommand(text)) return true;
        if (isGamblingResponse(text)) return true;
        if (hasGamblingEmoji(text)) return true;
        if (hasGamblingImages(getMessageHtml(msgEl))) return true;

        return false;
    }

    function resolveMessageEl(node) {
        if (node.classList && node.classList.contains('chat-message')) return node;
        return node.closest ? node.closest('.chat-message') : null;
    }

    function hideIfGambling(node) {
        if (!enabled) return;

        const msgEl = resolveMessageEl(node);
        if (!msgEl) return;
        // Don't re-check messages already hidden by this filter
        if (msgEl.dataset.keesGamblingMuted) return;

        if (isGamblingMessage(msgEl)) {
            msgEl.style.display = 'none';
            msgEl.dataset.keesGamblingMuted = 'true';
        }
    }

    function rescanAll(doc) {
        const container = SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const messages = container.querySelectorAll('.chat-message');
        for (const msg of messages) {
            if (enabled && isGamblingMessage(msg)) {
                msg.style.display = 'none';
                msg.dataset.keesGamblingMuted = 'true';
            } else if (msg.dataset.keesGamblingMuted) {
                msg.style.display = '';
                delete msg.dataset.keesGamblingMuted;
            }
        }
    }

    function start(doc) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            enabled = result[STORAGE_KEY] === true;

            rescanAll(doc);

            SNEED.core.events.addMessageHandler(doc, (addedElements) => {
                if (!enabled) return;
                for (const node of addedElements) {
                    hideIfGambling(node);
                }
            });
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[STORAGE_KEY]) {
                enabled = changes[STORAGE_KEY].newValue === true;
                rescanAll(doc);
            }
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.gamblingFilter = { start };

})();
