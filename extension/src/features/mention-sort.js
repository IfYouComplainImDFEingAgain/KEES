// features/mention-sort.js - Sort mention autocomplete by recent activity
(function() {
    'use strict';

    const SNEED = window.SNEED;

    let sorting = false;
    let pendingSort = false;

    // Build activity map from visible chat messages (bottom = most recent)
    function buildActivityMap(doc) {
        const activity = {};
        const messages = doc.querySelectorAll('.chat-message');
        messages.forEach((msg, i) => {
            const authorEl = msg.querySelector('.author');
            if (authorEl) {
                const username = (authorEl.textContent || '').trim().toLowerCase();
                if (username) {
                    activity[username] = i;
                }
            }
        });
        return activity;
    }

    function resortDropdown(dropdown, activity) {
        if (sorting) return;
        sorting = true;

        try {
            const items = Array.from(dropdown.querySelectorAll('.mention-item'));
            if (items.length <= 1) return;

            items.sort((a, b) => {
                const userA = (a.dataset.username || '').toLowerCase();
                const userB = (b.dataset.username || '').toLowerCase();
                const timeA = activity[userA] ?? -1;
                const timeB = activity[userB] ?? -1;

                if (timeA !== timeB) return timeB - timeA;
                return userA.localeCompare(userB);
            });

            items.forEach(item => dropdown.appendChild(item));
            items.forEach((item, i) => {
                item.classList.toggle('active', i === 0);
            });
        } finally {
            sorting = false;
        }
    }

    function sortWhenReady(doc, activity, attempts) {
        const dropdown = doc.querySelector('.mention-dropdown');
        if (dropdown && dropdown.children.length > 1) {
            resortDropdown(dropdown, activity);
            pendingSort = false;
        } else if (attempts < 5) {
            setTimeout(() => sortWhenReady(doc, activity, attempts + 1), 30);
        } else {
            pendingSort = false;
        }
    }

    function start(doc) {
        const input = doc.getElementById('new-message-input');
        if (!input) return;

        SNEED.core.events.addManagedEventListener(input, 'input', () => {
            if (pendingSort) return;

            const text = input.textContent || '';
            const atIdx = text.lastIndexOf('@');
            if (atIdx === -1) return;

            const afterAt = text.slice(atIdx + 1);
            // Only trigger when actively in a mention (no spaces after @)
            if (afterAt.includes(' ')) return;

            pendingSort = true;
            const activity = buildActivityMap(doc);
            sortWhenReady(doc, activity, 0);
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.mentionSort = { start };

})();
