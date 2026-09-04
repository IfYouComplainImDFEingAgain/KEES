// util/member-tabs.js - Custom tabs on XenForo member profile pages.
//
// Several features want their own tab next to Postings/About. XenForo binds its
// tab handler before we exist, so it treats a click on one of our tabs as an
// unknown pane and leaves the previous pane showing. This module drives the
// switching itself in the capture phase, keeping XF out of it, and keeps one
// registry so custom tabs hide each other as well as the native panes.
//
// Injected by more than one content-script block on /members/*, so the whole
// module is guarded and idempotent.
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    if (SNEED.memberTabs) return;

    const entries = [];         // { tab, pane }
    let headerWired = null;

    function setActive(entry, on) {
        entry.tab.classList.toggle('is-active', on);
        entry.tab.setAttribute('aria-selected', on ? 'true' : 'false');
        entry.pane.classList.toggle('is-active', on);
        entry.pane.setAttribute('aria-expanded', on ? 'true' : 'false');
        // Toggled inline rather than by class alone: the theme's rule for
        // hiding inactive panes is not guaranteed to match this element.
        entry.pane.style.display = on ? '' : 'none';
    }

    // The pane a native or custom tab owns. XF labels each pane with its tab's
    // id; the positional lookup is only a fallback for themes that do not.
    function paneFor(paneList, tabEl, index) {
        const mine = entries.find(entry => entry.tab === tabEl);
        if (mine) return mine.pane;
        if (tabEl.id) {
            const escaped = window.CSS && CSS.escape ? CSS.escape(tabEl.id) : tabEl.id;
            const labelled = paneList.querySelector(':scope > li[aria-labelledby="' + escaped + '"]');
            if (labelled) return labelled;
        }
        return paneList.children[index] || null;
    }

    function wireHeader(tabHeader, tabStrip, paneList) {
        if (headerWired === tabHeader) return;
        headerWired = tabHeader;

        tabHeader.addEventListener('click', (e) => {
            const clicked = e.target.closest && e.target.closest('.tabs-tab');
            if (!clicked) return;

            const mine = entries.find(entry => entry.tab === clicked);
            if (!mine) {
                // XF activates its own tab but knows nothing about ours.
                entries.forEach(entry => setActive(entry, false));
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            tabStrip.querySelectorAll('.tabs-tab').forEach(t => {
                if (t === clicked) return;
                t.classList.remove('is-active');
                t.setAttribute('aria-selected', 'false');
            });
            paneList.querySelectorAll(':scope > li').forEach(p => {
                if (p === mine.pane) return;
                p.classList.remove('is-active');
                p.setAttribute('aria-expanded', 'false');
            });
            entries.forEach(entry => { if (entry !== mine) setActive(entry, false); });
            setActive(mine, true);
        }, true);
    }

    // Adds a tab + pane and returns the pane's content element, or null when the
    // profile has no member tabs yet (or at all - a restricted profile renders
    // none, and the caller is expected to fall back to its own placement).
    function add(options) {
        const tabHeader = document.querySelector('.block-tabHeader--memberTabs');
        const paneList = document.querySelector('.js-memberTabPanes');
        if (!tabHeader || !paneList) return null;

        const existing = document.getElementById(options.paneId);
        if (existing) return existing;

        const tabStrip = tabHeader.querySelector('.hScroller-scroll') || tabHeader;

        const tab = document.createElement('a');
        tab.href = 'javascript:';
        tab.id = options.tabId;
        tab.className = 'tabs-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', options.paneId);
        tab.setAttribute('aria-selected', 'false');
        tab.textContent = options.label;

        // Sit ahead of About, and behind any custom tab already placed there so
        // the tabs keep the order their features were registered in.
        const last = entries.length ? entries[entries.length - 1].tab : null;
        const aboutTab = tabStrip.querySelector('#about, a[href$="/about"]');
        if (last && last.parentNode === tabStrip) {
            last.insertAdjacentElement('afterend', tab);
        } else if (aboutTab) {
            tabStrip.insertBefore(tab, aboutTab);
        } else {
            tabStrip.appendChild(tab);
        }

        const pane = document.createElement('li');
        pane.id = options.paneId;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', options.tabId);
        pane.setAttribute('aria-expanded', 'false');
        pane.style.display = 'none';

        // XF pairs a tab with the pane at the *same position*, so the pane has
        // to go in immediately ahead of the pane belonging to the tab that
        // follows ours. Appending it instead shifts every later native tab onto
        // the wrong pane - About then resolves to our pane and renders nothing.
        // Which tabs a viewer gets varies (moderators also see Warnings), so
        // anchor on the neighbour's own pane rather than counting positions.
        const strip = Array.prototype.slice.call(tabStrip.querySelectorAll('.tabs-tab'));
        const nextTab = strip[strip.indexOf(tab) + 1] || null;
        paneList.insertBefore(pane, nextTab ? paneFor(paneList, nextTab, strip.indexOf(tab)) : null);

        entries.push({ tab, pane });
        wireHeader(tabHeader, tabStrip, paneList);

        return pane;
    }

    SNEED.memberTabs = { add };

})();
