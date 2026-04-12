// features/gambling-filter.js - Hide gambling commands and bot responses from chat
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const STORAGE_KEY = 'kees-mute-gambling';
    const STORAGE_KEY_SCORCHED = 'kees-scorched-earth';

    let enabled = false;
    let scorched = false;

    // Scorched-earth mode hides every message authored by the KenoGPT bot —
    // that's where all the gambling spam, dice meters, slot animations, and
    // betting relays come from. Normal chat stays visible.
    const SCORCHED_TARGET_AUTHOR = 'kenogpt';

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
        /\brainbet\b.*(?:stats|recent|bets|value|payout|multiplier)/i,
        /\bhowl(?:gg)?\b.*(?:stats|recent|bets)/i,
        /please wait \d+ seconds?.*before attempting to run \w+command again/i
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
        /(?=.*🎲)(?=.*[─┃]{5,})/,     // dice meter (🎲 may appear before or after the meter line)
        /[♠♥♦♣🃏]{2,}/                // blackjack cards
    ];

    function getMessageBody(msgEl) {
        return msgEl.querySelector('.message') || msgEl.querySelector('.chat-message-content') || msgEl.querySelector('.message-body') || msgEl;
    }

    function getMessageText(msgEl) {
        const raw = msgEl.getAttribute && msgEl.getAttribute('data-raw');
        if (raw) return raw.trim();
        return (getMessageBody(msgEl).textContent || '').trim();
    }

    function getMessageHtml(msgEl) {
        return getMessageBody(msgEl).innerHTML || '';
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

    // KenoGPT messages to keep visible in scorched-earth mode.
    const RELAY_ICON_PATTERNS = [
        /discord16/i,
        /twitch16/i,
        /kick16/i
    ];

    function isExemptKenoGPTMessage(msgEl) {
        const raw = (msgEl.getAttribute && msgEl.getAttribute('data-raw')) || '';

        // Nora bot-in-bot: data-raw starts with [b]Nora to or plain Nora to
        if (/^(?:\[b\])?Nora to /i.test(raw)) return true;

        // Bossman Discord/Twitch/Kick relays: data-raw contains the relay icon
        for (const pattern of RELAY_ICON_PATTERNS) {
            if (pattern.test(raw)) return true;
        }

        // Fallback to rendered text for Nora (in case data-raw isn't set)
        const body = getMessageBody(msgEl);
        const rendered = body ? (body.textContent || '').replace(/^\s+/, '') : '';
        if (rendered.startsWith('Nora to ')) return true;

        return false;
    }

    function isScorchedTarget(msgEl) {
        const author = SNEED.util.getMessageAuthor(msgEl);
        const isKenoGPT = !!(author && author.toLowerCase() === SCORCHED_TARGET_AUTHOR);

        if (isKenoGPT) {
            if (isExemptKenoGPTMessage(msgEl)) return false;
            return true;
        }

        // Human messages: hide gambling commands (!bal, !lambchop, !dice...).
        // Only the command check, not the full isGamblingMessage suite, so
        // normal chat containing "you won" or an emoji sequence doesn't get
        // swept up.
        const text = getMessageText(msgEl);
        if (text && isGamblingCommand(text)) return true;

        return false;
    }

    function shouldHide(msgEl) {
        if (scorched) return isScorchedTarget(msgEl);
        if (enabled) return isGamblingMessage(msgEl);
        return false;
    }

    function resolveMessageEl(node) {
        if (node.classList && node.classList.contains('chat-message')) return node;
        return node.closest ? node.closest('.chat-message') : null;
    }

    function hideIfGambling(node) {
        if (!enabled && !scorched) return;

        const msgEl = resolveMessageEl(node);
        if (!msgEl) return;
        if (msgEl.dataset.keesGamblingMuted) return;

        if (shouldHide(msgEl)) {
            msgEl.style.display = 'none';
            msgEl.dataset.keesGamblingMuted = 'true';
        }
    }

    function rescanAll(doc) {
        const container = SNEED.util.findMessageContainer(doc);
        if (!container) return;

        const messages = container.querySelectorAll('.chat-message');
        for (const msg of messages) {
            if (shouldHide(msg)) {
                msg.style.display = 'none';
                msg.dataset.keesGamblingMuted = 'true';
            } else if (msg.dataset.keesGamblingMuted) {
                msg.style.display = '';
                delete msg.dataset.keesGamblingMuted;
            }
        }
    }

    function start(doc) {
        chrome.storage.local.get([STORAGE_KEY, STORAGE_KEY_SCORCHED], (result) => {
            enabled = result[STORAGE_KEY] === true;
            scorched = result[STORAGE_KEY_SCORCHED] === true;

            rescanAll(doc);

            SNEED.core.events.addMessageHandler(doc, (addedElements) => {
                if (!enabled && !scorched) return;
                for (const node of addedElements) {
                    hideIfGambling(node);
                }
            });
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            let changed = false;
            if (changes[STORAGE_KEY]) {
                enabled = changes[STORAGE_KEY].newValue === true;
                changed = true;
            }
            if (changes[STORAGE_KEY_SCORCHED]) {
                scorched = changes[STORAGE_KEY_SCORCHED].newValue === true;
                changed = true;
            }
            if (changed) rescanAll(doc);
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.gamblingFilter = { start };

})();
