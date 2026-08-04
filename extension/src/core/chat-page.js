// core/chat-page.js - Injects the page-realm chat helper into a chat document.
//
// src/chat-messages-page.js patches Element.prototype and shadows a DOM accessor,
// which only works from the page's own realm. Undelete and scrollback both rely
// on it, so the injection is shared and injected once per document.
(function() {
    'use strict';

    const SNEED = window.SNEED;

    function inject(doc) {
        if (doc.__kees_chat_page_injected) return;
        doc.__kees_chat_page_injected = true;

        const script = doc.createElement('script');
        script.src = chrome.runtime.getURL('src/chat-messages-page.js');
        doc.documentElement.appendChild(script);
        script.addEventListener('load', () => script.remove());
    }

    SNEED.core = SNEED.core || {};
    SNEED.core.chatPage = { inject };

})();
