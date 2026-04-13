// features/pii-guard.js - Block outgoing messages containing personal information
(function() {
    'use strict';

    const SNEED = window.SNEED;
    const STORAGE_KEY = 'kees-pii-patterns';
    const STORAGE_KEY_ENABLED = 'kees-pii-guard-enabled';
    const { addManagedEventListener } = SNEED.core.events;

    let patterns = [];
    let enabled = false;

    function checkForPII(text) {
        const lower = text.toLowerCase();
        for (const pattern of patterns) {
            if (lower.includes(pattern)) return true;
        }
        return false;
    }

    function showBlockedWarning(doc) {
        let overlay = doc.getElementById('kees-pii-warning');
        if (overlay) {
            overlay.remove();
        }

        overlay = doc.createElement('div');
        overlay.id = 'kees-pii-warning';
        overlay.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #cc0000;
            color: white;
            padding: 12px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            animation: keesPiiWarn 4s ease-in-out forwards;
        `;
        overlay.textContent = 'Message blocked — contains protected information';

        if (!doc.getElementById('kees-pii-warn-style')) {
            const style = doc.createElement('style');
            style.id = 'kees-pii-warn-style';
            style.textContent = `
                @keyframes keesPiiWarn {
                    0% { opacity: 0; transform: translateY(20px); }
                    15% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(20px); }
                }
            `;
            (doc.head || doc.documentElement).appendChild(style);
        }

        doc.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 4000);
    }

    function blockIfPII(e, inputElement, doc) {
        if (!enabled || patterns.length === 0) return;

        const text = (inputElement.textContent || '').trim();
        if (!text) return;

        if (checkForPII(text)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showBlockedWarning(doc);
            SNEED.log.warn('PII guard blocked outgoing message');
            return true;
        }
        return false;
    }

    function start(doc) {
        chrome.storage.local.get([STORAGE_KEY, STORAGE_KEY_ENABLED], (result) => {
            enabled = result[STORAGE_KEY_ENABLED] === true;
            const raw = result[STORAGE_KEY] || [];
            patterns = raw.map(p => p.toLowerCase());

            attachGuards(doc);
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes[STORAGE_KEY]) {
                const raw = changes[STORAGE_KEY].newValue || [];
                patterns = raw.map(p => p.toLowerCase());
            }
            if (changes[STORAGE_KEY_ENABLED]) {
                enabled = changes[STORAGE_KEY_ENABLED].newValue === true;
            }
        });
    }

    function attachGuards(doc) {
        const inputElement = doc.getElementById('new-message-input');
        const messageForm = doc.getElementById('new-message-form');
        if (!inputElement) return;

        // Capture-phase keydown — runs before everything else
        if (!inputElement.hasAttribute('data-pii-guard')) {
            inputElement.setAttribute('data-pii-guard', 'true');
            addManagedEventListener(inputElement, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    blockIfPII(e, inputElement, doc);
                }
            }, true);
        }

        // Capture-phase form submit as a backstop
        if (messageForm && !messageForm.hasAttribute('data-pii-guard')) {
            messageForm.setAttribute('data-pii-guard', 'true');
            addManagedEventListener(messageForm, 'submit', (e) => {
                blockIfPII(e, inputElement, doc);
            }, true);
        }
    }

    SNEED.features = SNEED.features || {};
    SNEED.features.piiGuard = { start };

})();
