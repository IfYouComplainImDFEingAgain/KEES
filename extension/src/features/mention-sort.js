// features/mention-sort.js - Sort mention autocomplete by recent activity
(function() {
    'use strict';

    const SNEED = window.SNEED;

    let sorting = false;
    let pendingSort = false;

    // Persistent activity map updated incrementally via shared observer
    let activityMap = {};
    let activityIndex = 0;
    let mapInitialized = false;

    function initActivityMap(doc) {
        if (mapInitialized) return;
        mapInitialized = true;

        // Build initial map once
        const messages = doc.querySelectorAll('.chat-message');
        messages.forEach((msg) => {
            const authorEl = msg.querySelector('.author');
            if (authorEl) {
                const username = (authorEl.textContent || '').trim().toLowerCase();
                if (username) {
                    activityMap[username] = activityIndex++;
                }
            }
        });

        // Update incrementally as new messages arrive
        SNEED.core.events.addMessageHandler(doc, (addedElements) => {
            for (const node of addedElements) {
                if (node.classList && node.classList.contains('chat-message')) {
                    const authorEl = node.querySelector('.author');
                    if (authorEl) {
                        const username = (authorEl.textContent || '').trim().toLowerCase();
                        if (username) {
                            activityMap[username] = activityIndex++;
                        }
                    }
                }
            }
        });
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

        initActivityMap(doc);

        SNEED.core.events.addManagedEventListener(input, 'input', () => {
            if (pendingSort) return;

            const text = input.textContent || '';
            const atIdx = text.lastIndexOf('@');
            if (atIdx === -1) return;

            const afterAt = text.slice(atIdx + 1);
            // Only trigger when actively in a mention (no spaces after @)
            if (afterAt.includes(' ')) return;

            pendingSort = true;
            sortWhenReady(doc, activityMap, 0);
        });
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.mentionSort = { start };

})();
