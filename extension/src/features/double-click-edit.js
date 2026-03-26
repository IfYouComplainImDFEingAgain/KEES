// features/double-click-edit.js - Double-click to edit chat messages
(function() {
    'use strict';

    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;

    const MESSAGE_SELECTOR = '.chat-message';
    const EDIT_BUTTON_SELECTOR = '.button.edit';

    const initializedDocs = new WeakSet();

    function handleDoubleClick(doc, e) {
        const message = e.target.closest(MESSAGE_SELECTOR);
        if (!message) return;

        if (e.target.closest('a, button, .button')) return;

        const editButton = message.querySelector(EDIT_BUTTON_SELECTOR);
        if (!editButton) return;

        editButton.click();
    }

    function start(doc) {
        if (!doc || initializedDocs.has(doc)) return;
        initializedDocs.add(doc);

        doc.body.addEventListener('dblclick', (e) => handleDoubleClick(doc, e));
    }

    function init() {}

    SNEED.features = SNEED.features || {};
    SNEED.features.doubleClickEdit = { init, start };

    init();
})();
