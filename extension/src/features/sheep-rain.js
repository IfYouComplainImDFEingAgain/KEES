// features/sheep-rain.js - Easter egg: tumbling sheep rain every N clicks for a specific user
// Standalone content script — runs on any kiwifarms.st page, in every frame.
(function() {
    'use strict';

    const STORAGE_KEY_CHAT_USER = 'kees-chat-user';
    const TARGET_USERNAMES = ['I Hate Sheeps'];
    const CLICKS_PER_RAIN = 100;
    const SHEEP_COUNT = 40;
    const SHEEP_SIZE = 64;
    const STYLE_ID = 'sneed-sheep-rain-styles';

    let armed = false;

    function injectStyles(doc) {
        if (doc.getElementById(STYLE_ID)) return;
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .sneed-sheep-rain-container {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 2147483647;
                overflow: hidden;
            }
            .sneed-sheep {
                position: absolute;
                top: -${SHEEP_SIZE + 20}px;
                width: ${SHEEP_SIZE}px;
                height: ${SHEEP_SIZE}px;
                will-change: transform;
                animation-name: sneed-sheep-fall;
                animation-timing-function: linear;
                animation-fill-mode: forwards;
                user-select: none;
            }
            @keyframes sneed-sheep-fall {
                from { transform: translate3d(0, 0, 0) rotate(0deg); }
                to   { transform: translate3d(var(--sheep-drift), calc(100vh + ${SHEEP_SIZE * 2}px), 0) rotate(var(--sheep-spin)); }
            }
        `;
        (doc.head || doc.documentElement).appendChild(style);
    }

    function rain(doc) {
        if (!doc.body) return;
        injectStyles(doc);

        const container = doc.createElement('div');
        container.className = 'sneed-sheep-rain-container';
        doc.body.appendChild(container);

        const sheepUrl = chrome.runtime.getURL('src/img/sheep.png');
        const view = doc.defaultView || window;
        const vw = view.innerWidth || 1200;

        let remaining = SHEEP_COUNT;
        for (let i = 0; i < SHEEP_COUNT; i++) {
            const sheep = doc.createElement('img');
            sheep.className = 'sneed-sheep';
            sheep.src = sheepUrl;
            sheep.alt = '';
            sheep.draggable = false;

            const startX = Math.random() * Math.max(vw - SHEEP_SIZE, 0);
            const drift = (Math.random() - 0.5) * 400;
            const spin = (Math.random() * 6 - 3) * 360;
            const duration = 2 + Math.random() * 2;
            const delay = Math.random() * 0.8;

            sheep.style.left = startX + 'px';
            sheep.style.setProperty('--sheep-drift', drift + 'px');
            sheep.style.setProperty('--sheep-spin', spin + 'deg');
            sheep.style.animationDuration = duration + 's';
            sheep.style.animationDelay = delay + 's';

            sheep.addEventListener('animationend', () => {
                sheep.remove();
                if (--remaining === 0) container.remove();
            }, { once: true });

            container.appendChild(sheep);
        }
    }

    function install(reason) {
        if (armed) return;
        armed = true;
        console.log('[KEES] Sheep rain armed:', reason);
        let clicks = 0;
        document.addEventListener('click', () => {
            clicks++;
            if (clicks % CLICKS_PER_RAIN === 0) {
                rain(document);
            }
        }, { capture: true, passive: true });
    }

    function getVisitorUsernameFromDom() {
        // XenForo logged-in nav link: <a class="p-navgroup-link p-navgroup-link--user" ...>Kendall Motor Oil</a>
        const selectors = [
            'a.p-navgroup-link--user',
            '.p-navgroup--member a.p-navgroup-link',
            '[data-visitor-username]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const attr = el.getAttribute('data-visitor-username');
            if (attr && attr.trim()) return attr.trim();
            const txt = (el.textContent || '').trim();
            if (txt) return txt;
        }
        return null;
    }

    function tryArmFromDom() {
        const name = getVisitorUsernameFromDom();
        if (name && TARGET_USERNAMES.includes(name)) {
            install('DOM visitor nav: ' + name);
            return true;
        }
        return false;
    }

    function tryArmFromStorage() {
        chrome.storage.local.get([STORAGE_KEY_CHAT_USER], (result) => {
            const user = result[STORAGE_KEY_CHAT_USER];
            if (user && TARGET_USERNAMES.includes(user.username)) {
                install('stored chat user: ' + user.username);
            }
        });
    }

    function main() {
        // Force enable via URL for testing: https://kiwifarms.st/<any>#sheeprain
        if (/[?#]sheeprain\b/.test(location.href)) {
            install('URL debug flag');
            return;
        }

        if (tryArmFromDom()) return;

        // The visitor nav may not be in the DOM yet at document_idle on slower
        // themes. Watch for it briefly, then give up and try storage.
        const observer = new MutationObserver(() => {
            if (tryArmFromDom()) observer.disconnect();
        });
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => observer.disconnect(), 5000);
        }

        tryArmFromStorage();
    }

    main();
})();
