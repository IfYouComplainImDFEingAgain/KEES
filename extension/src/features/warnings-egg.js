// features/warnings-egg.js - Easter egg: a line of centered text on member
// profiles that carry a "Warnings" section.
(function() {
    'use strict';

    const EGG_ID = 'kees-warnings-egg';
    const EGG_MESSAGE = '-( ͡° ͜ʖ ͡°)╯╲___卐卐卐卐 Don\'t mind me just taking my mods for a walk';

    // The tab/link only exists on profiles where the viewer can see warnings,
    // so its presence is the whole trigger for the egg.
    function hasWarnings(root) {
        if (root.querySelector('a[href*="/warnings"]')) {
            return true;
        }
        const labels = root.querySelectorAll('.tabs-tab, .block-tabHeader a, .memberHeader-blurb, .block-header');
        for (const el of labels) {
            if (el.textContent.trim() === 'Warnings') {
                return true;
            }
        }
        return false;
    }

    function insertEgg() {
        const main = document.querySelector('div.p-body-main');
        if (!main) {
            return false;
        }
        if (document.getElementById(EGG_ID)) {
            return true;
        }
        if (!hasWarnings(main)) {
            return false;
        }

        const egg = document.createElement('div');
        egg.id = EGG_ID;
        egg.textContent = EGG_MESSAGE;
        egg.style.textAlign = 'center';
        egg.style.margin = '16px 0';
        egg.style.opacity = '0.75';
        egg.style.fontStyle = 'italic';
        main.appendChild(egg);

        return true;
    }

    function init() {
        if (!window.location.pathname.includes('/members/')) {
            return;
        }

        if (insertEgg()) {
            return;
        }

        // Tabs and their panes can arrive after document_idle, so keep looking
        // for a short while before giving up.
        const observer = new MutationObserver(() => {
            if (insertEgg()) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
