// Page-level script to capture APP.chat_ws_url and dispatch it to the content script
(function() {
    if (typeof APP !== 'undefined' && APP.chat_ws_url) {
        window.dispatchEvent(new CustomEvent('__kees_chat_config', {
            detail: {
                wsUrl: APP.chat_ws_url,
                user: APP.user ? { id: APP.user.id, username: APP.user.username } : null
            }
        }));
    }
})();
