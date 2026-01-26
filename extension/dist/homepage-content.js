(() => {
  // src/homepage-content.js
  (function() {
    "use strict";
    const STORAGE_KEY = "sneedchat-disable-homepage-chat";
    function removeChatWidget() {
      const chatBlock = document.querySelector(".hb-chat--block-container");
      if (chatBlock) {
        chatBlock.remove();
        console.log("[SNEED] Homepage chat widget removed");
        return true;
      }
      return false;
    }
    function init() {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] === true) {
          if (!removeChatWidget()) {
            if (document.readyState === "loading") {
              document.addEventListener("DOMContentLoaded", removeChatWidget);
            } else {
              const observer = new MutationObserver((mutations, obs) => {
                if (removeChatWidget()) {
                  obs.disconnect();
                }
              });
              observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
              });
              setTimeout(() => observer.disconnect(), 5e3);
            }
          }
        }
      });
    }
    init();
  })();
})();
