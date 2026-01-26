(() => {
  // src/homepage-content.js
  (function() {
    "use strict";
    const STORAGE_KEY_CHAT = "sneedchat-disable-homepage-chat";
    const STORAGE_KEY_SPONSORED = "kees-disable-sponsored";
    let removedChat = false;
    let removedSponsored = false;
    function removeChatWidget() {
      if (removedChat) return true;
      const chatBlock = document.querySelector(".hb-chat--block-container");
      if (chatBlock) {
        chatBlock.remove();
        removedChat = true;
        console.log("[KEES] Homepage chat widget removed");
        return true;
      }
      return false;
    }
    function removeSponsoredContent() {
      if (removedSponsored) return true;
      const sponsoredBlocks = document.querySelectorAll(".hb-sponsored");
      if (sponsoredBlocks.length > 0) {
        sponsoredBlocks.forEach((block) => block.remove());
        removedSponsored = true;
        console.log(`[KEES] Removed ${sponsoredBlocks.length} sponsored block(s)`);
        return true;
      }
      return false;
    }
    function init() {
      chrome.storage.local.get([STORAGE_KEY_CHAT, STORAGE_KEY_SPONSORED], (result) => {
        const removeChat = result[STORAGE_KEY_CHAT] === true;
        const removeSponsored = result[STORAGE_KEY_SPONSORED] === true;
        if (!removeChat && !removeSponsored) return;
        function tryRemove() {
          let allDone = true;
          if (removeChat && !removeChatWidget()) {
            allDone = false;
          }
          if (removeSponsored && !removeSponsoredContent()) {
            allDone = false;
          }
          return allDone;
        }
        if (!tryRemove()) {
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", tryRemove);
          } else {
            const observer = new MutationObserver((mutations, obs) => {
              if (tryRemove()) {
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
      });
    }
    init();
  })();
})();
