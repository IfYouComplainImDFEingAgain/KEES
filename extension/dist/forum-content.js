(() => {
  // src/features/featured-posts.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const DEFAULT_PAGES_FORWARD = 10;
    const DEFAULT_PAGES_BACKWARD = 10;
    const FEATURED_POST_SELECTOR = 'a.hbReact-message-postmark[aria-label="Feature"]';
    const POST_SELECTOR = "article.message";
    function getCurrentPageInfo() {
      const url = window.location.href;
      const pageMatch = url.match(/\/page-(\d+)/);
      const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const baseUrl = url.replace(/\/page-\d+/, "").replace(/#.*$/, "");
      const lastPageLink = document.querySelector(".pageNav-page:last-child a");
      const maxPage = lastPageLink ? parseInt(lastPageLink.textContent, 10) : currentPage;
      return { currentPage, baseUrl, maxPage };
    }
    function getPageUrl(baseUrl, pageNum) {
      if (pageNum === 1) {
        return baseUrl;
      }
      const urlParts = baseUrl.split("?");
      const basePart = urlParts[0].replace(/\/$/, "");
      const queryPart = urlParts[1] ? "?" + urlParts[1] : "";
      return `${basePart}/page-${pageNum}${queryPart}`;
    }
    async function fetchPage(url) {
      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          headers: {
            "Accept": "text/html"
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        const parser = new DOMParser();
        return parser.parseFromString(html, "text/html");
      } catch (e) {
        console.error(`[SNEED] Failed to fetch ${url}:`, e);
        return null;
      }
    }
    function extractFeaturedPosts(doc, pageNum, pageUrl) {
      const posts = [];
      const postElements = doc.querySelectorAll(POST_SELECTOR);
      postElements.forEach((post) => {
        const featuredBadge = post.querySelector(FEATURED_POST_SELECTOR);
        if (featuredBadge) {
          const postClone = post.cloneNode(true);
          postClone.dataset.sourcePage = pageNum;
          postClone.dataset.sourceUrl = pageUrl;
          posts.push({
            element: postClone,
            pageNum,
            pageUrl,
            postId: post.dataset.content || post.id
          });
        }
      });
      return posts;
    }
    function addConsolidationButton() {
      const nextButton = document.querySelector(".pageNav-jump--next");
      if (!nextButton || document.getElementById("sneed-featured-btn")) {
        return;
      }
      const btn = document.createElement("a");
      btn.id = "sneed-featured-btn";
      btn.className = "pageNav-jump";
      btn.href = "#";
      btn.innerHTML = '<i class="fa--xf fal fa-award" style="margin-right: 4px;"></i> Featured';
      btn.title = "Consolidate featured posts from nearby pages";
      btn.style.cssText = `
            background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
            color: #000;
            font-weight: 600;
            margin-left: 8px;
            padding: 6px 12px;
            border-radius: 4px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        `;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showConsolidationDialog();
      });
      nextButton.parentNode.insertBefore(btn, nextButton.nextSibling);
    }
    function showConsolidationDialog() {
      const existing = document.getElementById("sneed-featured-dialog");
      if (existing) existing.remove();
      const { currentPage, maxPage } = getCurrentPageInfo();
      const dialog = document.createElement("div");
      dialog.id = "sneed-featured-dialog";
      dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            min-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #e0e0e0;
        `;
      dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #ffd700; font-size: 18px;">
                <i class="fa--xf fal fa-award" style="margin-right: 8px;"></i>
                Consolidate Featured Posts
            </h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #999;">
                Current page: ${currentPage} of ${maxPage}
            </p>
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">Pages backward</label>
                    <input type="number" id="sneed-pages-back" value="${Math.min(DEFAULT_PAGES_BACKWARD, currentPage - 1)}" min="0" max="${currentPage - 1}"
                        style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 14px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">Pages forward</label>
                    <input type="number" id="sneed-pages-fwd" value="${Math.min(DEFAULT_PAGES_FORWARD, maxPage - currentPage)}" min="0" max="${maxPage - currentPage}"
                        style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 14px;">
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="sneed-featured-start" style="
                    flex: 1;
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
                    border: none;
                    border-radius: 4px;
                    color: #000;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                ">Collect Featured Posts</button>
                <button id="sneed-featured-cancel" style="
                    padding: 10px 16px;
                    background: #333;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
            </div>
            <div id="sneed-featured-progress" style="display: none; margin-top: 16px;">
                <div style="background: #333; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div id="sneed-progress-bar" style="background: linear-gradient(90deg, #ffd700, #ff8c00); height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <p id="sneed-progress-text" style="margin: 8px 0 0 0; font-size: 12px; color: #999; text-align: center;"></p>
            </div>
        `;
      const backdrop = document.createElement("div");
      backdrop.id = "sneed-featured-backdrop";
      backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;
      backdrop.addEventListener("click", () => closeDialog());
      document.body.appendChild(backdrop);
      document.body.appendChild(dialog);
      document.getElementById("sneed-featured-cancel").addEventListener("click", closeDialog);
      document.getElementById("sneed-featured-start").addEventListener("click", () => {
        const pagesBack = parseInt(document.getElementById("sneed-pages-back").value, 10) || 0;
        const pagesFwd = parseInt(document.getElementById("sneed-pages-fwd").value, 10) || 0;
        startConsolidation(pagesBack, pagesFwd);
      });
    }
    function closeDialog() {
      const dialog = document.getElementById("sneed-featured-dialog");
      const backdrop = document.getElementById("sneed-featured-backdrop");
      if (dialog) dialog.remove();
      if (backdrop) backdrop.remove();
    }
    function updateProgress(current, total, text) {
      const progressDiv = document.getElementById("sneed-featured-progress");
      const progressBar = document.getElementById("sneed-progress-bar");
      const progressText = document.getElementById("sneed-progress-text");
      if (progressDiv) progressDiv.style.display = "block";
      if (progressBar) progressBar.style.width = `${current / total * 100}%`;
      if (progressText) progressText.textContent = text;
    }
    async function startConsolidation(pagesBack, pagesFwd) {
      const { currentPage, baseUrl, maxPage } = getCurrentPageInfo();
      const startBtn = document.getElementById("sneed-featured-start");
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = "Collecting...";
      }
      const startPage = Math.max(1, currentPage - pagesBack);
      const endPage = Math.min(maxPage, currentPage + pagesFwd);
      const totalPages = endPage - startPage + 1;
      const allFeaturedPosts = [];
      let pagesProcessed = 0;
      for (let page = startPage; page <= endPage; page++) {
        const pageUrl = getPageUrl(baseUrl, page);
        updateProgress(pagesProcessed, totalPages, `Fetching page ${page}...`);
        let doc;
        if (page === currentPage) {
          doc = document;
        } else {
          doc = await fetchPage(pageUrl);
        }
        if (doc) {
          const posts = extractFeaturedPosts(doc, page, pageUrl);
          allFeaturedPosts.push(...posts);
          updateProgress(pagesProcessed + 0.5, totalPages, `Found ${posts.length} featured on page ${page}`);
        }
        pagesProcessed++;
        updateProgress(pagesProcessed, totalPages, `Processed ${pagesProcessed}/${totalPages} pages`);
        if (page !== endPage && page !== currentPage) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      closeDialog();
      showFeaturedPostsView(allFeaturedPosts, startPage, endPage);
    }
    function showFeaturedPostsView(posts, startPage, endPage) {
      const overlay = document.createElement("div");
      overlay.id = "sneed-featured-overlay";
      overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0f0f0f;
            z-index: 10000;
            overflow-y: auto;
            padding: 20px;
        `;
      const header = document.createElement("div");
      header.style.cssText = `
            max-width: 1200px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #333;
        `;
      header.innerHTML = `
            <div>
                <h2 style="margin: 0; color: #ffd700; font-size: 20px;">
                    <i class="fa--xf fal fa-award" style="margin-right: 8px;"></i>
                    Featured Posts
                </h2>
                <p style="margin: 8px 0 0 0; color: #888; font-size: 13px;">
                    Found ${posts.length} featured posts from pages ${startPage} to ${endPage}
                </p>
            </div>
            <button id="sneed-close-featured" style="
                padding: 10px 20px;
                background: #333;
                border: 1px solid #444;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
            ">Close</button>
        `;
      overlay.appendChild(header);
      const postsContainer = document.createElement("div");
      postsContainer.style.cssText = `
            max-width: 1200px;
            margin: 0 auto;
        `;
      if (posts.length === 0) {
        postsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <i class="fa--xf fal fa-search" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                    <p style="font-size: 16px;">No featured posts found in the selected page range.</p>
                </div>
            `;
      } else {
        posts.forEach((post, index) => {
          const postWrapper = document.createElement("div");
          postWrapper.style.cssText = `
                    margin-bottom: 16px;
                    background: #1a1a1a;
                    border-radius: 8px;
                    border: 1px solid #333;
                    overflow: hidden;
                `;
          const pageIndicator = document.createElement("div");
          pageIndicator.style.cssText = `
                    padding: 8px 16px;
                    background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.1) 100%);
                    border-bottom: 1px solid #333;
                    font-size: 12px;
                    color: #ffd700;
                `;
          pageIndicator.innerHTML = `
                    <a href="${post.pageUrl}" target="_blank" style="color: #ffd700; text-decoration: none;">
                        Page ${post.pageNum}
                    </a>
                    <span style="color: #666; margin-left: 8px;">\u2022 Post #${index + 1}</span>
                `;
          postWrapper.appendChild(pageIndicator);
          const postContent = document.createElement("div");
          postContent.className = "sneed-featured-post-content";
          postContent.appendChild(post.element);
          postWrapper.appendChild(postContent);
          postsContainer.appendChild(postWrapper);
        });
      }
      overlay.appendChild(postsContainer);
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      document.getElementById("sneed-close-featured").addEventListener("click", () => {
        overlay.remove();
        document.body.style.overflow = "";
      });
      const escHandler = (e) => {
        if (e.key === "Escape") {
          overlay.remove();
          document.body.style.overflow = "";
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    }
    function init() {
      if (!window.location.pathname.includes("/threads/")) {
        return;
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addConsolidationButton);
      } else {
        addConsolidationButton();
      }
      console.log("[SNEED] Featured posts consolidation initialized");
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.featuredPosts = {
      init,
      addConsolidationButton,
      showConsolidationDialog
    };
    init();
  })();

  // src/features/user-muting.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const STORAGE_KEY = "sneedchat-muted-users";
    const POST_SELECTOR = "article.message[data-author]";
    const POSTMARK_BUTTON_SELECTOR = ".message-attribution-gadget.hbReact-message-postmark";
    let mutedUsersCache = /* @__PURE__ */ new Set();
    async function getMutedUsers() {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          const users = result[STORAGE_KEY] || [];
          resolve(users);
        });
      });
    }
    async function addMutedUser(username) {
      const users = await getMutedUsers();
      if (!users.includes(username)) {
        users.push(username);
        await saveMutedUsers(users);
      }
      return users;
    }
    async function removeMutedUser(username) {
      let users = await getMutedUsers();
      users = users.filter((u) => u !== username);
      await saveMutedUsers(users);
      return users;
    }
    async function saveMutedUsers(users) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: users }, () => {
          mutedUsersCache = new Set(users);
          resolve();
        });
      });
    }
    function isUserMuted(username) {
      return mutedUsersCache.has(username);
    }
    function createMuteButton(username, isMuted) {
      const btn = document.createElement("a");
      btn.className = "message-attribution-gadget sneed-mute-btn";
      btn.href = "#";
      btn.dataset.username = username;
      btn.style.cssText = `
            margin-right: 4px;
            padding: 2px 6px;
            font-size: 11px;
            border-radius: 3px;
            text-decoration: none;
            transition: all 0.15s ease;
        `;
      updateMuteButtonState(btn, isMuted);
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentlyMuted = isUserMuted(username);
        if (currentlyMuted) {
          await removeMutedUser(username);
          showToast(`Unmuted ${username}`);
        } else {
          await addMutedUser(username);
          showToast(`Muted ${username}`);
        }
        refreshAllPosts();
      });
      return btn;
    }
    function updateMuteButtonState(btn, isMuted) {
      if (isMuted) {
        btn.innerHTML = '<i class="fa--xf fal fa-volume-up" style="margin-right: 3px;"></i>Unmute';
        btn.style.background = "#4a4a4a";
        btn.style.color = "#fff";
        btn.title = "Unmute this user";
      } else {
        btn.innerHTML = '<i class="fa--xf fal fa-volume-mute" style="margin-right: 3px;"></i>Mute';
        btn.style.background = "#2a2a2a";
        btn.style.color = "#888";
        btn.title = "Mute this user";
      }
    }
    function showToast(message) {
      const existing = document.getElementById("sneed-mute-toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.id = "sneed-mute-toast";
      toast.textContent = message;
      toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: #fff;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: sneed-toast-in 0.3s ease;
        `;
      if (!document.getElementById("sneed-mute-toast-styles")) {
        const style = document.createElement("style");
        style.id = "sneed-mute-toast-styles";
        style.textContent = `
                @keyframes sneed-toast-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes sneed-toast-out {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(20px); }
                }
            `;
        document.head.appendChild(style);
      }
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "sneed-toast-out 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }, 2e3);
    }
    function processPost(post) {
      const username = post.dataset.author;
      if (!username) return;
      const isMuted = isUserMuted(username);
      let muteBtn = post.querySelector(".sneed-mute-btn");
      if (!muteBtn) {
        const postmarkBtn = post.querySelector(POSTMARK_BUTTON_SELECTOR);
        if (postmarkBtn) {
          muteBtn = createMuteButton(username, isMuted);
          postmarkBtn.parentNode.insertBefore(muteBtn, postmarkBtn);
        }
      } else {
        updateMuteButtonState(muteBtn, isMuted);
      }
      if (isMuted) {
        if (!post.dataset.sneedMuted) {
          post.dataset.sneedMuted = "true";
          post.dataset.sneedOriginalDisplay = post.style.display || "";
          const placeholder = document.createElement("div");
          placeholder.className = "sneed-muted-placeholder";
          placeholder.style.cssText = `
                    padding: 12px 16px;
                    background: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    color: #666;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;
          placeholder.innerHTML = `
                    <i class="fa--xf fal fa-volume-mute"></i>
                    <span>Post by <strong style="color: #888;">${username}</strong> (muted)</span>
                    <span style="margin-left: auto; color: #555; font-size: 11px;">Click to reveal</span>
                `;
          placeholder.addEventListener("click", () => {
            post.style.display = post.dataset.sneedOriginalDisplay;
            placeholder.style.display = "none";
          });
          post.parentNode.insertBefore(placeholder, post);
          post.style.display = "none";
        }
      } else {
        if (post.dataset.sneedMuted) {
          delete post.dataset.sneedMuted;
          post.style.display = post.dataset.sneedOriginalDisplay || "";
          delete post.dataset.sneedOriginalDisplay;
          const placeholder = post.previousElementSibling;
          if (placeholder && placeholder.classList.contains("sneed-muted-placeholder")) {
            placeholder.remove();
          }
        }
      }
    }
    function processAllPosts() {
      const posts = document.querySelectorAll(POST_SELECTOR);
      posts.forEach(processPost);
    }
    function refreshAllPosts() {
      const posts = document.querySelectorAll(POST_SELECTOR);
      posts.forEach((post) => {
        const username = post.dataset.author;
        if (!username) return;
        const isMuted = isUserMuted(username);
        const muteBtn = post.querySelector(".sneed-mute-btn");
        if (muteBtn) {
          updateMuteButtonState(muteBtn, isMuted);
        }
        if (isMuted && !post.dataset.sneedMuted) {
          processPost(post);
        } else if (!isMuted && post.dataset.sneedMuted) {
          processPost(post);
        }
      });
    }
    function setupObserver() {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches(POST_SELECTOR)) {
                processPost(node);
              }
              const posts = node.querySelectorAll ? node.querySelectorAll(POST_SELECTOR) : [];
              posts.forEach(processPost);
            }
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      return observer;
    }
    async function init() {
      if (!window.location.pathname.includes("/threads/")) {
        return;
      }
      const users = await getMutedUsers();
      mutedUsersCache = new Set(users);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          processAllPosts();
          setupObserver();
        });
      } else {
        processAllPosts();
        setupObserver();
      }
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEY]) {
          mutedUsersCache = new Set(changes[STORAGE_KEY].newValue || []);
          refreshAllPosts();
        }
      });
      console.log("[SNEED] User muting initialized");
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.userMuting = {
      init,
      getMutedUsers,
      addMutedUser,
      removeMutedUser,
      isUserMuted
    };
    init();
  })();

  // src/forum-content.js
  console.log("[SNEED] Forum content script loaded");
})();
