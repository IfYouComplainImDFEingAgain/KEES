// wave-edit-page.js - Page-level script for sending edits via WebSocket
// Injected as a web-accessible resource to bypass CSP.
(function() {
    let wsRef = null;
    const origWS = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        wsRef = this;
        return origWS.call(this, data);
    };

    window.addEventListener('__kees_edit_message', function(e) {
        if (!wsRef || wsRef.readyState !== WebSocket.OPEN) return;
        const { uuid, message } = e.detail;
        wsRef.send('/edit ' + JSON.stringify({ uuid, message }));
    });
})();
