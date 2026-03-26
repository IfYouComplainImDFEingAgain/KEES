(() => {
  // src/core/namespace.js
  (function() {
    "use strict";
    window.SNEED = window.SNEED || {};
    window.SNEED.util = window.SNEED.util || {};
    window.SNEED.core = window.SNEED.core || {};
    window.SNEED.ui = window.SNEED.ui || {};
    window.SNEED.features = window.SNEED.features || {};
    window.SNEED.state = window.SNEED.state || {};
    window.SNEED.log = window.SNEED.log || {
      info: (...args) => console.log("[SNEED]", ...args),
      error: (...args) => console.error("[SNEED]", ...args),
      warn: (...args) => console.warn("[SNEED]", ...args)
    };
  })();

  // src/util/dom.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    function stylesToString(styles) {
      return Object.entries(styles).map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return `${cssKey}: ${value}`;
      }).join("; ");
    }
    function findMessageContainer(doc) {
      return doc.querySelector(".messages") || doc.querySelector("#messages") || doc.querySelector('[class*="messages"]') || doc.querySelector('[class*="chat-messages"]') || doc.querySelector(".chat-log") || doc.querySelector('[role="log"]') || doc.body;
    }
    function getTargetDocument() {
      const isIframe = window.location.pathname.includes("test-chat");
      if (isIframe) {
        return document;
      }
      const iframe = document.getElementById("rust-shim");
      if (iframe) {
        try {
          return iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
          return document;
        }
      }
      return document;
    }
    function isInIframe() {
      return window.location.pathname.includes("test-chat");
    }
    function createElement(doc, tag, options = {}) {
      const element = doc.createElement(tag);
      if (options.id) element.id = options.id;
      if (options.className) element.className = options.className;
      if (options.text) element.textContent = options.text;
      if (options.html) element.innerHTML = options.html;
      if (options.styles) element.style.cssText = stylesToString(options.styles);
      if (options.cssText) element.style.cssText = options.cssText;
      if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      return element;
    }
    function createButton(doc, options = {}) {
      const button = doc.createElement("button");
      button.type = "button";
      if (options.text) button.textContent = options.text;
      if (options.title) button.title = options.title;
      if (options.styles) button.style.cssText = stylesToString(options.styles);
      if (options.cssText) button.style.cssText = options.cssText;
      return button;
    }
    function getSelectionAndRange(doc, input) {
      const win = doc.defaultView || window;
      const selection = win.getSelection();
      let range;
      if (selection.rangeCount === 0) {
        range = doc.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.addRange(range);
      } else {
        range = selection.getRangeAt(0);
      }
      return { selection, range };
    }
    function insertTextAtCursor(doc, input, text, options = {}) {
      input.focus();
      const { selection, range } = getSelectionAndRange(doc, input);
      const textNode = doc.createTextNode(text);
      range.deleteContents();
      range.insertNode(textNode);
      if (options.cursorPosition !== void 0) {
        range.setStart(textNode, options.cursorPosition);
        range.setEnd(textNode, options.cursorPosition);
      } else {
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      const event = new Event("input", { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      input.focus();
    }
    function positionCursorAtEnd(doc, element) {
      element.focus();
      const range = doc.createRange();
      const win = doc.defaultView || window;
      const selection = win.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    SNEED.util = SNEED.util || {};
    Object.assign(SNEED.util, {
      stylesToString,
      findMessageContainer,
      getTargetDocument,
      isInIframe,
      createElement,
      createButton,
      getSelectionAndRange,
      insertTextAtCursor,
      positionCursorAtEnd
    });
  })();

  // src/core/state.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const defaultEmotes = [
      {
        code: ":lossmanjack:",
        url: "https://kiwifarms.st/styles/custom/emotes/bmj_loss.png",
        title: "Loss Man Jack"
      },
      {
        code: ":juice:",
        url: "https://kiwifarms.st/styles/custom/emotes/bmj_juicy.gif",
        title: "Juice!"
      },
      {
        code: ":ross:",
        url: "https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png",
        title: "Ross"
      },
      {
        code: ":gunt:",
        url: "https://kiwifarms.st/styles/custom/emotes/gunt.gif",
        title: "Gunt"
      },
      {
        code: "[img]https://files.catbox.moe/0v5vvb.png[/img]",
        text: "test",
        title: "Retard Avelloon"
      },
      {
        code: "\u{1F921}",
        emoji: "\u{1F921}",
        title: "What are you laughing at?"
      },
      {
        code: "5",
        text: "5",
        title: "Type a 5 in the chat if you think hes weird."
      },
      {
        code: "\u{1F6A8}[color=#ff0000]ALERT[/color]\u{1F6A8} BOSSMAN IS [color=#80ff00]CLIMBING[/color]",
        text: "Alert Bossman is climbing",
        title: "Climbing"
      }
    ];
    const toggleButtonConfig = {
      image: "https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png",
      title: "Toggle emote bar"
    };
    const formatTools = [
      {
        name: "Bold",
        symbol: "B",
        wysiwygCommand: "bold",
        title: "Bold text"
      },
      {
        name: "Italic",
        symbol: "I",
        wysiwygCommand: "italic",
        title: "Italic text"
      },
      {
        name: "Underline",
        symbol: "U",
        wysiwygCommand: "underline",
        title: "Underline text"
      },
      {
        name: "Strikethrough",
        symbol: "S",
        wysiwygCommand: "strikeThrough",
        title: "Strikethrough text"
      },
      {
        name: "Center",
        symbol: "Center",
        customAction: "centerText",
        title: "Center text"
      },
      {
        name: "Size",
        symbol: "Size",
        customAction: "sizePicker",
        title: "Text size"
      },
      {
        name: "Code",
        symbol: "{ }",
        startTag: "[code]",
        endTag: "[/code]",
        title: "Code block"
      },
      {
        name: "URL",
        symbol: "\u{1F517}",
        customAction: "insertUrl",
        title: "Insert link"
      },
      {
        name: "Bullet",
        symbol: "\u2022",
        customAction: "bulletLines",
        title: "Add bullets to lines"
      },
      {
        name: "Image",
        symbol: "\u{1F5BC}",
        customAction: "insertImage",
        title: "Insert image"
      },
      {
        name: "Color",
        symbol: "\u{1F3A8}",
        customAction: "colorPicker",
        title: "Text color"
      },
      {
        name: "Rainbow",
        symbol: "\u{1F308}",
        customAction: "rainbowText",
        title: "Rainbow text"
      },
      {
        name: "Newline",
        symbol: "\u21B5",
        insertText: "[br]",
        title: "Insert line break"
      },
      {
        name: "WysiwygToggle",
        symbol: "<>",
        customAction: "toggleWysiwyg",
        title: "Toggle WYSIWYG mode",
        isToggle: true
      },
      {
        name: "Blacklist",
        symbol: "\u{1F6AB}",
        customAction: "blacklistManager",
        title: "Manage blacklisted images"
      },
      {
        name: "Emotes",
        symbol: "\u2699\uFE0F",
        customAction: "emoteManager",
        title: "Manage custom emotes"
      }
    ];
    const CONFIG = {
      MAX_INPUT_HEIGHT: 200,
      RESIZE_DEBOUNCE_DELAY: 16,
      // ~60fps
      AUTO_SEND_DELAY: 50,
      INIT_DELAY: 500,
      POLLING_CHECK_DELAY: 1e3,
      MAX_REINJECT_ATTEMPTS: 10,
      SEND_TIMEOUT: 3e3
    };
    const STORAGE_KEYS = {
      EMOTES: "sneedchat-custom-emotes",
      BLACKLIST: "sneedchat-image-blacklist",
      WYSIWYG_MODE: "sneedchat-wysiwyg-mode",
      WATCHED_USERS: "sneedchat-watched-users",
      DISABLE_HOMEPAGE_CHAT: "sneedchat-disable-homepage-chat",
      EVERYONE_LIST: "sneedchat-everyone-list",
      WHISPER_HISTORY: "kees-whisper-history",
      WHISPER_POSITION: "kees-whisper-position",
      WHISPER_POSITION_GLOBAL: "kees-whisper-position-global",
      WHISPER_STATE: "kees-whisper-state",
      WHISPER_STATE_GLOBAL: "kees-whisper-state-global",
      WHISPER_RETENTION: "kees-whisper-retention",
      WHISPER_HIDE_MAIN: "kees-whisper-hide-main",
      WHISPER_GLOBAL: "kees-whisper-global",
      WHISPER_LATEST: "kees-whisper-latest",
      GLOBAL_CHAT: "kees-global-chat",
      CHAT_WS_URL: "kees-chat-ws-url",
      CHAT_LAST_ROOM: "kees-chat-last-room",
      CHAT_USER: "kees-chat-user",
      BOT_USERS: "kees-bot-users",
      BOT_COLUMN_ENABLED: "kees-bot-column-enabled",
      BOT_COLUMN_HIDE_MAIN: "kees-bot-column-hide-main"
    };
    const runtimeState = {
      emoteBarVisible: false,
      reinjectAttempts: 0,
      emotes: null,
      // Will be loaded from storage
      initialized: false,
      pendingTimers: /* @__PURE__ */ new Set(),
      wysiwygMode: true,
      // true = rich/WYSIWYG, false = raw BBCode
      disableHomepageChat: false,
      // true = hide chat on homepage
      everyoneList: []
      // usernames for @everyone expansion
    };
    SNEED.state = SNEED.state || {};
    Object.assign(SNEED.state, {
      defaultEmotes,
      toggleButtonConfig,
      formatTools,
      CONFIG,
      STORAGE_KEYS,
      runtime: runtimeState,
      // Getters/setters for runtime state
      isEmoteBarVisible() {
        return runtimeState.emoteBarVisible;
      },
      setEmoteBarVisible(visible) {
        runtimeState.emoteBarVisible = visible;
      },
      toggleEmoteBarVisible() {
        runtimeState.emoteBarVisible = !runtimeState.emoteBarVisible;
        return runtimeState.emoteBarVisible;
      },
      getEmotes() {
        return runtimeState.emotes;
      },
      setEmotes(emotes) {
        runtimeState.emotes = emotes;
      },
      incrementReinjectAttempts() {
        return ++runtimeState.reinjectAttempts;
      },
      canReinject() {
        return runtimeState.reinjectAttempts < CONFIG.MAX_REINJECT_ATTEMPTS;
      },
      setInitialized(value) {
        runtimeState.initialized = value;
      },
      isInitialized() {
        return runtimeState.initialized;
      },
      // Timer management
      addTimer(id) {
        runtimeState.pendingTimers.add(id);
        return id;
      },
      removeTimer(id) {
        runtimeState.pendingTimers.delete(id);
      },
      clearAllTimers() {
        runtimeState.pendingTimers.forEach((id) => clearTimeout(id));
        runtimeState.pendingTimers.clear();
      },
      // WYSIWYG mode
      isWysiwygMode() {
        return runtimeState.wysiwygMode;
      },
      setWysiwygMode(enabled) {
        runtimeState.wysiwygMode = enabled;
      },
      toggleWysiwygMode() {
        runtimeState.wysiwygMode = !runtimeState.wysiwygMode;
        return runtimeState.wysiwygMode;
      },
      // Disable homepage chat
      isHomepageChatDisabled() {
        return runtimeState.disableHomepageChat;
      },
      setDisableHomepageChat(disabled) {
        runtimeState.disableHomepageChat = disabled;
      },
      toggleDisableHomepageChat() {
        runtimeState.disableHomepageChat = !runtimeState.disableHomepageChat;
        return runtimeState.disableHomepageChat;
      },
      // @everyone list
      getEveryoneList() {
        return runtimeState.everyoneList;
      },
      setEveryoneList(list) {
        runtimeState.everyoneList = list;
      }
    });
  })();

  // src/core/storage.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const state = SNEED.state;
    const log = SNEED.log;
    function getStorageValue(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key]);
        });
      });
    }
    function setStorageValue(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            log.error("Storage error:", chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
    async function getEmotes() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.EMOTES);
        if (stored && Array.isArray(stored) && stored.length > 0) {
          return stored;
        }
        return state.defaultEmotes;
      } catch (e) {
        log.error("Failed to load emotes:", e);
        return state.defaultEmotes;
      }
    }
    async function saveEmotes(emotesList) {
      try {
        const success = await setStorageValue(state.STORAGE_KEYS.EMOTES, emotesList);
        if (success) {
          state.setEmotes(emotesList);
        }
        return success;
      } catch (e) {
        log.error("Failed to save emotes:", e);
        return false;
      }
    }
    async function resetEmotesToDefault() {
      return saveEmotes(state.defaultEmotes);
    }
    async function initEmotes() {
      const emotes = await getEmotes();
      state.setEmotes(emotes);
      return emotes;
    }
    async function getBlacklist() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.BLACKLIST);
        return stored || [];
      } catch (e) {
        log.error("Failed to load blacklist:", e);
        return [];
      }
    }
    async function saveBlacklist(blacklist) {
      try {
        return await setStorageValue(state.STORAGE_KEYS.BLACKLIST, blacklist);
      } catch (e) {
        log.error("Failed to save blacklist:", e);
        return false;
      }
    }
    async function isBlacklisted(url) {
      if (!url) return false;
      const blacklist = await getBlacklist();
      return blacklist.includes(url);
    }
    function isBlacklistedSync(url) {
      if (!url) return false;
      const cachedBlacklist = state.runtime.cachedBlacklist;
      if (cachedBlacklist) {
        return cachedBlacklist.includes(url);
      }
      return false;
    }
    async function addToBlacklist(url) {
      if (!url) return false;
      const blacklist = await getBlacklist();
      if (!blacklist.includes(url)) {
        blacklist.push(url);
        const success = await saveBlacklist(blacklist);
        if (success) {
          state.runtime.cachedBlacklist = blacklist;
        }
        return success;
      }
      return false;
    }
    async function removeFromBlacklist(url) {
      if (!url) return false;
      const blacklist = await getBlacklist();
      const index = blacklist.indexOf(url);
      if (index > -1) {
        blacklist.splice(index, 1);
        const success = await saveBlacklist(blacklist);
        if (success) {
          state.runtime.cachedBlacklist = blacklist;
        }
        return success;
      }
      return false;
    }
    async function clearBlacklist() {
      const success = await saveBlacklist([]);
      if (success) {
        state.runtime.cachedBlacklist = [];
      }
      return success;
    }
    async function initBlacklist() {
      const blacklist = await getBlacklist();
      state.runtime.cachedBlacklist = blacklist;
    }
    async function getWysiwygMode() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.WYSIWYG_MODE);
        if (stored !== void 0 && stored !== null) {
          return stored === true || stored === "true";
        }
        return true;
      } catch (e) {
        log.error("Failed to load WYSIWYG mode:", e);
        return true;
      }
    }
    async function saveWysiwygMode(enabled) {
      try {
        return await setStorageValue(state.STORAGE_KEYS.WYSIWYG_MODE, enabled);
      } catch (e) {
        log.error("Failed to save WYSIWYG mode:", e);
        return false;
      }
    }
    async function initWysiwygMode() {
      const mode = await getWysiwygMode();
      state.setWysiwygMode(mode);
      return mode;
    }
    async function getDisableHomepageChat() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT);
        if (stored !== void 0 && stored !== null) {
          return stored === true || stored === "true";
        }
        return false;
      } catch (e) {
        log.error("Failed to load disable homepage chat setting:", e);
        return false;
      }
    }
    async function saveDisableHomepageChat(disabled) {
      try {
        return await setStorageValue(state.STORAGE_KEYS.DISABLE_HOMEPAGE_CHAT, disabled);
      } catch (e) {
        log.error("Failed to save disable homepage chat setting:", e);
        return false;
      }
    }
    async function initDisableHomepageChat() {
      const disabled = await getDisableHomepageChat();
      state.setDisableHomepageChat(disabled);
      return disabled;
    }
    const DEFAULT_WATCHED_USERS = ["Null"];
    async function getWatchedUsers() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.WATCHED_USERS);
        return stored || [...DEFAULT_WATCHED_USERS];
      } catch (e) {
        log.error("Failed to load watched users:", e);
        return [...DEFAULT_WATCHED_USERS];
      }
    }
    async function saveWatchedUsers(users) {
      try {
        return await setStorageValue(state.STORAGE_KEYS.WATCHED_USERS, users);
      } catch (e) {
        log.error("Failed to save watched users:", e);
        return false;
      }
    }
    async function getEveryoneList() {
      try {
        const stored = await getStorageValue(state.STORAGE_KEYS.EVERYONE_LIST);
        return stored || [];
      } catch (e) {
        log.error("Failed to load @everyone list:", e);
        return [];
      }
    }
    async function saveEveryoneList(users) {
      try {
        const success = await setStorageValue(state.STORAGE_KEYS.EVERYONE_LIST, users);
        if (success) {
          state.setEveryoneList(users);
        }
        return success;
      } catch (e) {
        log.error("Failed to save @everyone list:", e);
        return false;
      }
    }
    async function initEveryoneList() {
      const list = await getEveryoneList();
      state.setEveryoneList(list);
      return list;
    }
    async function initAll() {
      await Promise.all([
        initEmotes(),
        initWysiwygMode(),
        initBlacklist(),
        initDisableHomepageChat(),
        initEveryoneList()
      ]);
      chrome.storage.onChanged.addListener((changes) => {
        if (changes[state.STORAGE_KEYS.EVERYONE_LIST]) {
          state.setEveryoneList(changes[state.STORAGE_KEYS.EVERYONE_LIST].newValue || []);
        }
      });
    }
    SNEED.core = SNEED.core || {};
    SNEED.core.storage = {
      // Helpers
      getStorageValue,
      setStorageValue,
      // Emotes
      getEmotes,
      saveEmotes,
      resetEmotesToDefault,
      initEmotes,
      // Blacklist
      getBlacklist,
      saveBlacklist,
      isBlacklisted,
      isBlacklistedSync,
      addToBlacklist,
      removeFromBlacklist,
      clearBlacklist,
      initBlacklist,
      // WYSIWYG Mode
      getWysiwygMode,
      saveWysiwygMode,
      initWysiwygMode,
      // Watched Users
      getWatchedUsers,
      saveWatchedUsers,
      // Disable Homepage Chat
      getDisableHomepageChat,
      saveDisableHomepageChat,
      initDisableHomepageChat,
      // Everyone List
      getEveryoneList,
      saveEveryoneList,
      initEveryoneList,
      // Init
      initAll
    };
  })();

  // src/core/events.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const eventListeners = /* @__PURE__ */ new WeakMap();
    const globalListeners = [];
    let listenerIdCounter = 0;
    function addManagedEventListener(element, event, handler, options) {
      if (!element) return;
      element.addEventListener(event, handler, options);
      if (!eventListeners.has(element)) {
        eventListeners.set(element, []);
      }
      eventListeners.get(element).push({ event, handler, options });
    }
    function removeElementListeners(element) {
      const listeners = eventListeners.get(element);
      if (listeners) {
        listeners.forEach(({ event, handler, options }) => {
          element.removeEventListener(event, handler, options);
        });
        eventListeners.delete(element);
      }
    }
    function addGlobalEventListener(element, event, handler, options) {
      const id = ++listenerIdCounter;
      element.addEventListener(event, handler, options);
      globalListeners.push({ id, element, event, handler, options });
      return id;
    }
    function removeGlobalEventListener(id) {
      const idx = globalListeners.findIndex((l) => l.id === id);
      if (idx !== -1) {
        const { element, event, handler, options } = globalListeners[idx];
        element.removeEventListener(event, handler, options);
        globalListeners.splice(idx, 1);
      }
    }
    function cleanupAllListeners() {
      globalListeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      globalListeners.length = 0;
    }
    const observers = /* @__PURE__ */ new WeakMap();
    const globalObservers = [];
    const resizeCache = /* @__PURE__ */ new WeakMap();
    const iframeObservers = /* @__PURE__ */ new WeakMap();
    function addManagedObserver(element, observer, isGlobal = false) {
      if (isGlobal) {
        globalObservers.push({ observer, element });
      } else if (element) {
        if (!observers.has(element)) {
          observers.set(element, []);
        }
        observers.get(element).push(observer);
      }
      return observer;
    }
    function removeElementObservers(element) {
      const elementObservers = observers.get(element);
      if (elementObservers) {
        elementObservers.forEach((observer) => {
          observer.disconnect();
        });
        observers.delete(element);
      }
    }
    function cleanupAllObservers() {
      globalObservers.forEach(({ observer }) => {
        observer.disconnect();
      });
      globalObservers.length = 0;
      document.querySelectorAll("[data-observer-attached]").forEach((element) => {
        if (element._resizeObserver) {
          element._resizeObserver.disconnect();
          delete element._resizeObserver;
        }
        removeElementObservers(element);
        const cached = resizeCache.get(element);
        if (cached) {
          cached.cleanup();
          resizeCache.delete(element);
        }
      });
    }
    function addIframeObserver(iframe, observer) {
      if (!iframeObservers.has(iframe)) {
        iframeObservers.set(iframe, []);
      }
      iframeObservers.get(iframe).push(observer);
    }
    function cleanupIframeObservers(iframe) {
      const obs = iframeObservers.get(iframe);
      if (obs) {
        obs.forEach((o) => o.disconnect());
        iframeObservers.delete(iframe);
      }
      if (iframe.__sneed_observed) {
        delete iframe.__sneed_observed;
      }
    }
    function getResizeCache(element) {
      return resizeCache.get(element);
    }
    function setResizeCache(element, cache) {
      resizeCache.set(element, cache);
    }
    function deleteResizeCache(element) {
      resizeCache.delete(element);
    }
    function ensureSendWatcher(doc) {
      if (doc.__sneed_sendWatcher) return doc.__sneed_sendWatcher;
      const state = { pending: null, timer: null };
      const container = SNEED.util.findMessageContainer(doc);
      const obs = new MutationObserver((mutations) => {
        if (!state.pending) return;
        const want = (state.pending.text || "").trim();
        if (!want) return;
        for (const m of mutations) {
          for (const n of m.addedNodes) {
            if (!n || n.nodeType !== 1) continue;
            const t = n.textContent || "";
            if (t.includes(want)) {
              const done = state.pending;
              state.pending = null;
              if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
              }
              done.onConfirm && done.onConfirm();
              return;
            }
          }
        }
      });
      obs.observe(container, { childList: true, subtree: true });
      addManagedObserver(container, obs);
      doc.__sneed_sendWatcher = {
        arm(pending) {
          state.pending = pending;
          if (state.timer) clearTimeout(state.timer);
          state.timer = setTimeout(() => {
            const still = state.pending;
            state.pending = null;
            if (still && still.onFail) still.onFail();
          }, SNEED.state.CONFIG.SEND_TIMEOUT);
        },
        clear() {
          state.pending = null;
          if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
          }
        },
        destroy() {
          this.clear();
          obs.disconnect();
          delete doc.__sneed_sendWatcher;
        }
      };
      return doc.__sneed_sendWatcher;
    }
    SNEED.core = SNEED.core || {};
    SNEED.core.events = {
      // Event listeners
      addManagedEventListener,
      removeElementListeners,
      addGlobalEventListener,
      removeGlobalEventListener,
      cleanupAllListeners,
      // Observers
      addManagedObserver,
      removeElementObservers,
      cleanupAllObservers,
      // Iframe observers
      addIframeObserver,
      cleanupIframeObservers,
      // Resize cache
      getResizeCache,
      setResizeCache,
      deleteResizeCache,
      // Send watcher
      ensureSendWatcher
    };
  })();

  // src/core/bbcode-converter.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const NAMED_COLORS = {
      "red": "#ff0000",
      "green": "#008000",
      "blue": "#0000ff",
      "yellow": "#ffff00",
      "orange": "#ffa500",
      "purple": "#800080",
      "pink": "#ffc0cb",
      "white": "#ffffff",
      "black": "#000000",
      "gray": "#808080",
      "grey": "#808080",
      "cyan": "#00ffff",
      "magenta": "#ff00ff"
    };
    function normalizeColor(color) {
      if (!color) return null;
      color = color.trim().toLowerCase();
      if (/^#[0-9a-f]{6}$/i.test(color)) {
        return color.toLowerCase();
      }
      if (/^#[0-9a-f]{3}$/i.test(color)) {
        return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      if (NAMED_COLORS[color]) {
        return NAMED_COLORS[color];
      }
      const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
      if (rgbMatch) {
        const r = Math.min(255, parseInt(rgbMatch[1], 10)).toString(16).padStart(2, "0");
        const g = Math.min(255, parseInt(rgbMatch[2], 10)).toString(16).padStart(2, "0");
        const b = Math.min(255, parseInt(rgbMatch[3], 10)).toString(16).padStart(2, "0");
        return "#" + r + g + b;
      }
      const rgbaMatch = color.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i);
      if (rgbaMatch) {
        const r = Math.min(255, parseInt(rgbaMatch[1], 10)).toString(16).padStart(2, "0");
        const g = Math.min(255, parseInt(rgbaMatch[2], 10)).toString(16).padStart(2, "0");
        const b = Math.min(255, parseInt(rgbaMatch[3], 10)).toString(16).padStart(2, "0");
        return "#" + r + g + b;
      }
      return null;
    }
    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }
      const tagName = node.tagName.toLowerCase();
      let childContent = "";
      for (const child of node.childNodes) {
        childContent += processNode(child);
      }
      switch (tagName) {
        case "strong":
        case "b":
          return "[b]" + childContent + "[/b]";
        case "em":
        case "i":
          return "[i]" + childContent + "[/i]";
        case "u":
          return "[u]" + childContent + "[/u]";
        case "s":
        case "strike":
        case "del":
          return "[s]" + childContent + "[/s]";
        case "code":
          return "[code]" + childContent + "[/code]";
        case "span": {
          const dataSize = node.getAttribute("data-bbcode-size");
          if (dataSize) {
            return "[size=" + dataSize + "]" + childContent + "[/size]";
          }
          const style = node.getAttribute("style") || "";
          const dataColor = node.getAttribute("data-bbcode-color");
          let color = null;
          if (dataColor) {
            color = normalizeColor(dataColor);
          }
          if (!color) {
            const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
            if (colorMatch) {
              color = normalizeColor(colorMatch[1]);
            }
          }
          if (color) {
            return "[color=" + color + "]" + childContent + "[/color]";
          }
          return childContent;
        }
        case "img": {
          const src = node.getAttribute("src");
          if (src) {
            return "[img]" + src + "[/img]";
          }
          return "";
        }
        case "br":
          return "\n";
        case "div":
          if (node.hasAttribute("data-bbcode-center")) {
            return "[center]" + childContent + "[/center]";
          }
          if (childContent) {
            return childContent + "\n";
          }
          return "\n";
        case "p":
          if (childContent) {
            return childContent + "\n";
          }
          return "\n";
        default:
          return childContent;
      }
    }
    function convertToBBCode(element) {
      let result = "";
      for (const child of element.childNodes) {
        result += processNode(child);
      }
      result = result.replace(/\u200B/g, "");
      result = result.replace(/\n{3,}/g, "\n\n");
      result = result.replace(/\n+$/, "");
      return result;
    }
    function convertToHTML(text) {
      if (!text) return "";
      let html = text;
      html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
      html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
      html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
      html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>");
      html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "<code>$1</code>");
      html = html.replace(
        /\[center\]([\s\S]*?)\[\/center\]/gi,
        '<div style="text-align:center" data-bbcode-center="true">$1</div>'
      );
      html = html.replace(
        /\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi,
        '<span style="font-size:$1px" data-bbcode-size="$1">$2</span>'
      );
      html = html.replace(
        /\[color=(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/color\]/gi,
        '<span style="color:$1" data-bbcode-color="$1">$2</span>'
      );
      html = html.replace(
        /\[img\](https?:\/\/[^\[]+)\[\/img\]/gi,
        '<img src="$1" data-bbcode-img="true" style="max-height:150px;max-width:100%;vertical-align:middle">'
      );
      return html;
    }
    SNEED.core = SNEED.core || {};
    SNEED.core.bbcode = {
      convertToBBCode,
      convertToHTML,
      normalizeColor,
      processNode
    };
  })();

  // src/ui/styles.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const STYLES = {
      emoteBar: {
        display: "none",
        alignItems: "center",
        padding: "8px 12px",
        background: "rgba(0, 0, 0, 0.1)",
        border: "none",
        borderRadius: "4px 4px 0 0",
        marginBottom: "0px",
        gap: "8px",
        flexWrap: "wrap",
        transition: "all 0.3s ease"
      },
      formatBar: {
        display: "none",
        alignItems: "center",
        padding: "6px 12px",
        background: "rgba(0, 0, 0, 0.15)",
        border: "none",
        borderRadius: "0 0 4px 4px",
        marginBottom: "8px",
        gap: "6px",
        flexWrap: "wrap",
        transition: "all 0.3s ease"
      },
      label: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: "13px",
        fontWeight: "500",
        marginRight: "8px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      formatLabel: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: "12px",
        fontWeight: "500",
        marginRight: "6px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      emoteButton: {
        background: "transparent",
        border: "1px solid transparent",
        padding: "4px",
        cursor: "pointer",
        borderRadius: "4px",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none"
      },
      formatButton: {
        background: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        padding: "4px 8px",
        cursor: "pointer",
        borderRadius: "3px",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        fontSize: "11px",
        fontWeight: "bold",
        color: "rgba(255, 255, 255, 0.9)",
        minWidth: "28px",
        height: "24px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      emoteToggleButton: {
        background: "transparent",
        border: "none",
        padding: "8px",
        cursor: "pointer",
        borderRadius: "4px",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        marginRight: "4px"
      },
      toggleImg: {
        width: "24px",
        height: "24px",
        objectFit: "contain",
        display: "block",
        filter: "brightness(0.9)",
        transition: "filter 0.2s ease"
      },
      emoteImage: {
        width: "24px",
        height: "24px",
        objectFit: "contain",
        display: "block"
      },
      emoteEmoji: {
        fontSize: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px"
      },
      emoteText: {
        fontSize: "10px",
        fontWeight: "bold",
        color: "rgba(255, 255, 255, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        textAlign: "center",
        lineHeight: "1"
      },
      colorPicker: {
        position: "absolute",
        background: "rgba(0, 0, 0, 0.9)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "8px",
        padding: "12px",
        zIndex: "1000",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "6px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
      },
      colorButton: {
        width: "32px",
        height: "32px",
        border: "2px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        outline: "none"
      },
      colorPickerCloseButton: {
        position: "absolute",
        top: "-8px",
        right: "-8px",
        width: "20px",
        height: "20px",
        background: "rgba(255, 255, 255, 0.2)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "50%",
        color: "white",
        cursor: "pointer",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none"
      },
      measureElement: {
        position: "absolute",
        visibility: "hidden",
        height: "auto",
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
        pointerEvents: "none",
        zIndex: "-1000"
      },
      // Dialog/popup styles
      popup: {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0, 0, 0, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "8px",
        padding: "16px",
        zIndex: "10000",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      popupTitle: {
        color: "rgba(255, 255, 255, 0.9)",
        margin: "0 0 12px 0",
        fontSize: "16px"
      },
      button: {
        base: {
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "4px",
          fontSize: "12px",
          transition: "background 0.2s ease"
        },
        primary: {
          background: "rgba(0, 255, 0, 0.3)",
          border: "1px solid rgba(0, 255, 0, 0.5)",
          color: "rgba(255, 255, 255, 0.9)"
        },
        danger: {
          background: "rgba(255, 0, 0, 0.3)",
          border: "1px solid rgba(255, 0, 0, 0.5)",
          color: "rgba(255, 255, 255, 0.9)"
        },
        secondary: {
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          color: "rgba(255, 255, 255, 0.9)"
        },
        info: {
          background: "rgba(0, 128, 255, 0.3)",
          border: "1px solid rgba(0, 128, 255, 0.5)",
          color: "rgba(255, 255, 255, 0.9)"
        },
        warning: {
          background: "rgba(255, 128, 0, 0.3)",
          border: "1px solid rgba(255, 128, 0, 0.5)",
          color: "rgba(255, 255, 255, 0.9)"
        },
        neutral: {
          background: "rgba(128, 128, 128, 0.3)",
          border: "1px solid rgba(128, 128, 128, 0.5)",
          color: "rgba(255, 255, 255, 0.9)"
        }
      },
      input: {
        background: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "rgba(255, 255, 255, 0.9)",
        padding: "8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontFamily: "monospace"
      }
    };
    const COLOR_PALETTE = [
      { name: "Red", hex: "#ff0000" },
      { name: "Greentext", hex: "#789922" },
      { name: "Blue", hex: "#0080ff" },
      { name: "Purple", hex: "#8000ff" },
      { name: "Orange", hex: "#ff8000" },
      { name: "Pink", hex: "#ff0080" },
      { name: "Yellow", hex: "#ffff00" },
      { name: "Cyan", hex: "#00ffff" },
      { name: "Lime", hex: "#80ff00" },
      { name: "Magenta", hex: "#ff00ff" },
      { name: "Brown", hex: "#8b4513" },
      { name: "Gray", hex: "#808080" }
    ];
    SNEED.ui = SNEED.ui || {};
    SNEED.ui.STYLES = STYLES;
    SNEED.ui.COLOR_PALETTE = COLOR_PALETTE;
  })();

  // src/ui/color-picker.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES, COLOR_PALETTE } = SNEED.ui;
    function showColorPicker(input, selection, range, doc) {
      const existing = doc.getElementById("color-picker-popup");
      if (existing) {
        existing.remove();
        return;
      }
      const colorPicker = doc.createElement("div");
      colorPicker.id = "color-picker-popup";
      colorPicker.style.cssText = stylesToString(STYLES.colorPicker);
      const inputRect = input.getBoundingClientRect();
      colorPicker.style.left = inputRect.left + 20 + "px";
      colorPicker.style.top = inputRect.top - 120 + "px";
      COLOR_PALETTE.forEach((color) => {
        const colorButton = doc.createElement("button");
        colorButton.type = "button";
        colorButton.style.cssText = stylesToString({
          ...STYLES.colorButton,
          background: color.hex
        });
        colorButton.title = color.name;
        addManagedEventListener(colorButton, "mouseenter", () => {
          colorButton.style.borderColor = "rgba(255, 255, 255, 0.8)";
          colorButton.style.transform = "scale(1.1)";
        });
        addManagedEventListener(colorButton, "mouseleave", () => {
          colorButton.style.borderColor = "rgba(255, 255, 255, 0.3)";
          colorButton.style.transform = "scale(1)";
        });
        addManagedEventListener(colorButton, "click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const selectedText = selection.toString();
          const isWysiwyg = SNEED.state.isWysiwygMode();
          if (!isWysiwyg) {
            let textToInsert;
            if (selectedText) {
              textToInsert = `[color=${color.hex}]${selectedText}[/color]`;
            } else {
              textToInsert = `[color=${color.hex}][/color]`;
            }
            const textNode = doc.createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);
            if (!selectedText) {
              const position = `[color=${color.hex}]`.length;
              range.setStart(textNode, position);
              range.setEnd(textNode, position);
            } else {
              range.setStartAfter(textNode);
              range.setEndAfter(textNode);
            }
            selection.removeAllRanges();
            selection.addRange(range);
          } else if (selectedText) {
            const parentSpan = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
            if (parentSpan && parentSpan.tagName === "SPAN" && parentSpan.hasAttribute("data-bbcode-color")) {
              const parent = parentSpan.parentNode;
              while (parentSpan.firstChild) {
                parent.insertBefore(parentSpan.firstChild, parentSpan);
              }
              parent.removeChild(parentSpan);
              selection.removeAllRanges();
            } else {
              const colorSpan = doc.createElement("span");
              colorSpan.style.color = color.hex;
              colorSpan.setAttribute("data-bbcode-color", color.hex);
              const fragment = range.extractContents();
              colorSpan.appendChild(fragment);
              range.insertNode(colorSpan);
              range.setStartAfter(colorSpan);
              range.setEndAfter(colorSpan);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else {
            const colorSpan = doc.createElement("span");
            colorSpan.style.color = color.hex;
            colorSpan.setAttribute("data-bbcode-color", color.hex);
            colorSpan.textContent = "\u200B";
            range.insertNode(colorSpan);
            const newRange = doc.createRange();
            newRange.setStart(colorSpan.firstChild, 1);
            newRange.setEnd(colorSpan.firstChild, 1);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          const event = new Event("input", {
            bubbles: true,
            cancelable: true
          });
          input.dispatchEvent(event);
          colorPicker.remove();
          removeElementListeners(colorPicker);
          input.focus();
        });
        colorPicker.appendChild(colorButton);
      });
      const closeButton = doc.createElement("button");
      closeButton.type = "button";
      closeButton.textContent = "\xD7";
      closeButton.style.cssText = stylesToString(STYLES.colorPickerCloseButton);
      addManagedEventListener(closeButton, "click", (e) => {
        e.preventDefault();
        colorPicker.remove();
        removeElementListeners(colorPicker);
        input.focus();
      });
      colorPicker.appendChild(closeButton);
      const clickOutside = (e) => {
        if (!colorPicker.contains(e.target)) {
          colorPicker.remove();
          removeElementListeners(colorPicker);
          doc.removeEventListener("click", clickOutside);
          input.focus();
        }
      };
      doc.body.appendChild(colorPicker);
      setTimeout(() => doc.addEventListener("click", clickOutside), 0);
    }
    SNEED.ui.showColorPicker = showColorPicker;
  })();

  // src/ui/size-picker.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const { STYLES } = SNEED.ui;
    const SIZES = [
      { label: "Tiny", value: 1 },
      { label: "Small", value: 3 },
      { label: "Normal", value: 5 },
      { label: "Large", value: 7 },
      { label: "Huge", value: 50 },
      { label: "Max", value: 190 }
    ];
    function showSizePicker(input, selection, range, doc) {
      const existing = doc.getElementById("size-picker-popup");
      if (existing) {
        existing.remove();
        return;
      }
      const picker = doc.createElement("div");
      picker.id = "size-picker-popup";
      picker.style.cssText = stylesToString({
        position: "absolute",
        background: "rgba(0, 0, 0, 0.9)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "8px",
        padding: "8px",
        zIndex: "1000",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)"
      });
      const inputRect = input.getBoundingClientRect();
      picker.style.left = inputRect.left + 20 + "px";
      picker.style.top = inputRect.top - 160 + "px";
      SIZES.forEach((size) => {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = size.label;
        btn.style.cssText = stylesToString({
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          padding: "6px 16px",
          cursor: "pointer",
          borderRadius: "3px",
          color: "rgba(255, 255, 255, 0.9)",
          fontSize: "12px",
          textAlign: "left",
          transition: "all 0.2s ease",
          outline: "none"
        });
        addManagedEventListener(btn, "mouseenter", () => {
          btn.style.background = "rgba(255, 255, 255, 0.2)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.4)";
        });
        addManagedEventListener(btn, "mouseleave", () => {
          btn.style.background = "rgba(255, 255, 255, 0.1)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        });
        addManagedEventListener(btn, "click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const selectedText = selection.toString();
          const isWysiwyg = SNEED.state.isWysiwygMode();
          if (isWysiwyg) {
            if (selectedText) {
              const span = doc.createElement("span");
              span.style.fontSize = size.value + "px";
              span.setAttribute("data-bbcode-size", String(size.value));
              const fragment = range.extractContents();
              span.appendChild(fragment);
              range.insertNode(span);
              range.setStartAfter(span);
              range.setEndAfter(span);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              const span = doc.createElement("span");
              span.style.fontSize = size.value + "px";
              span.setAttribute("data-bbcode-size", String(size.value));
              span.textContent = "\u200B";
              range.insertNode(span);
              const newRange = doc.createRange();
              newRange.setStart(span.firstChild, 1);
              newRange.setEnd(span.firstChild, 1);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          } else {
            let textToInsert;
            if (selectedText) {
              textToInsert = `[size=${size.value}]${selectedText}[/size]`;
            } else {
              textToInsert = `[size=${size.value}][/size]`;
            }
            const textNode = doc.createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);
            if (!selectedText) {
              const position = `[size=${size.value}]`.length;
              range.setStart(textNode, position);
              range.setEnd(textNode, position);
            } else {
              range.setStartAfter(textNode);
              range.setEndAfter(textNode);
            }
            selection.removeAllRanges();
            selection.addRange(range);
          }
          const event = new Event("input", { bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          picker.remove();
          removeElementListeners(picker);
          input.focus();
        });
        picker.appendChild(btn);
      });
      const closeButton = doc.createElement("button");
      closeButton.type = "button";
      closeButton.textContent = "\xD7";
      closeButton.style.cssText = stylesToString(STYLES.colorPickerCloseButton);
      addManagedEventListener(closeButton, "click", (e) => {
        e.preventDefault();
        picker.remove();
        removeElementListeners(picker);
        input.focus();
      });
      picker.appendChild(closeButton);
      const clickOutside = (e) => {
        if (!picker.contains(e.target)) {
          picker.remove();
          removeElementListeners(picker);
          doc.removeEventListener("click", clickOutside);
          input.focus();
        }
      };
      doc.body.appendChild(picker);
      setTimeout(() => doc.addEventListener("click", clickOutside), 0);
    }
    SNEED.ui.showSizePicker = showSizePicker;
  })();

  // src/ui/whisper-box.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const WHISPER_STYLES = `
        #sneed-whisper-box {
            position: fixed;
            bottom: 0;
            right: 16px;
            width: 340px;
            min-width: 250px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 -2px 16px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
        }
        #sneed-whisper-box.expanded {
            min-height: 80px;
            max-height: 70vh;
            resize: both;
            overflow: auto;
        }
        #sneed-whisper-box .whisper-header {
            display: flex;
            align-items: center;
            background: #1a1a2e;
            padding: 6px 8px;
            cursor: grab;
            user-select: none;
            border-bottom: 1px solid #333;
            min-height: 32px;
        }
        #sneed-whisper-box .whisper-header:active {
            cursor: grabbing;
        }
        #sneed-whisper-box .whisper-header-title {
            color: #ccc;
            font-size: 12px;
            font-weight: 600;
            margin-right: auto;
        }
        #sneed-whisper-box .whisper-toggle-arrow {
            color: #aaa;
            font-size: 14px;
            margin-right: 6px;
            transition: transform 0.3s ease;
            cursor: pointer;
        }
        #sneed-whisper-box .whisper-toggle-arrow.collapsed {
            transform: rotate(180deg);
        }
        #sneed-whisper-box .whisper-close-btn {
            background: none;
            border: none;
            color: #888;
            font-size: 16px;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
        }
        #sneed-whisper-box .whisper-close-btn:hover {
            color: #ff4444;
        }
        #sneed-whisper-box .whisper-body {
            display: flex;
            flex-direction: column;
            background: #0f0f1a;
            flex: 1;
            overflow: hidden;
            min-height: 0;
        }
        #sneed-whisper-box .whisper-body.collapsed {
            display: none;
        }
        #sneed-whisper-box .whisper-tab {
            padding: 5px 10px;
            color: #999;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
            border-bottom: 2px solid transparent;
            transition: all 0.15s;
            position: relative;
            flex-shrink: 0;
        }
        #sneed-whisper-box .whisper-tab:hover {
            color: #ddd;
            background: rgba(255,255,255,0.05);
        }
        #sneed-whisper-box .whisper-tab.active {
            color: #fff;
            border-bottom-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-tabs-row {
            display: flex;
            background: #16162a;
            border-bottom: 1px solid #333;
            min-height: 30px;
        }
        #sneed-whisper-box .whisper-tabs {
            display: flex;
            overflow-x: auto;
            flex: 1;
            min-height: 30px;
            scrollbar-width: thin;
        }
        #sneed-whisper-box .whisper-tabs::-webkit-scrollbar {
            height: 3px;
        }
        #sneed-whisper-box .whisper-tabs::-webkit-scrollbar-thumb {
            background: #444;
        }
        #sneed-whisper-box .whisper-add-tab {
            background: none;
            border: none;
            border-left: 1px solid #333;
            color: #666;
            font-size: 16px;
            cursor: pointer;
            padding: 0 10px;
            transition: color 0.15s;
            flex-shrink: 0;
        }
        #sneed-whisper-box .whisper-add-tab:hover {
            color: #4a9eff;
        }
        #sneed-whisper-box .whisper-new-user-row {
            display: flex;
            gap: 4px;
            padding: 6px;
            background: #16162a;
            border-bottom: 1px solid #333;
        }
        #sneed-whisper-box .whisper-new-user-input {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #eee;
            padding: 4px 8px;
            font-size: 11px;
            outline: none;
            font-family: inherit;
        }
        #sneed-whisper-box .whisper-new-user-input:focus {
            border-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-new-user-input::placeholder {
            color: #555;
        }
        #sneed-whisper-box .whisper-new-user-ok {
            background: #4a9eff;
            border: none;
            border-radius: 4px;
            color: #fff;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
        }
        #sneed-whisper-box .whisper-new-user-ok:hover {
            background: #3a8eef;
        }
        #sneed-whisper-box .whisper-autocomplete {
            position: absolute;
            bottom: 100%;
            left: 6px;
            right: 6px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px 4px 0 0;
            max-height: 150px;
            overflow-y: auto;
            z-index: 10;
            scrollbar-width: thin;
        }
        #sneed-whisper-box .whisper-autocomplete-item {
            padding: 5px 10px;
            color: #ccc;
            font-size: 12px;
            cursor: pointer;
        }
        #sneed-whisper-box .whisper-autocomplete-item:hover,
        #sneed-whisper-box .whisper-autocomplete-item.active {
            background: rgba(74, 158, 255, 0.2);
            color: #fff;
        }
        #sneed-whisper-box .whisper-tab .tab-close {
            margin-left: 4px;
            color: #666;
            font-size: 12px;
            cursor: pointer;
            line-height: 1;
        }
        #sneed-whisper-box .whisper-tab .tab-close:hover {
            color: #ff4444;
        }
        #sneed-whisper-box .whisper-tab .status-dot {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            margin-right: 4px;
            vertical-align: middle;
        }
        #sneed-whisper-box .whisper-tab .status-dot.online {
            background: #44cc44;
            box-shadow: 0 0 3px #44cc44;
        }
        #sneed-whisper-box .whisper-tab .status-dot.offline {
            background: #555;
        }
        #sneed-whisper-box .whisper-tab .unread-badge {
            display: inline-block;
            background: #ff4444;
            color: #fff;
            font-size: 9px;
            font-weight: bold;
            border-radius: 50%;
            min-width: 14px;
            height: 14px;
            line-height: 14px;
            text-align: center;
            margin-left: 4px;
            padding: 0 3px;
        }
        #sneed-whisper-box .whisper-messages {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            min-height: 0;
            scrollbar-width: thin;
            display: flex;
            flex-direction: column;
        }
        #sneed-whisper-box .whisper-messages::-webkit-scrollbar {
            width: 4px;
        }
        #sneed-whisper-box .whisper-messages::-webkit-scrollbar-thumb {
            background: #444;
        }
        #sneed-whisper-box .whisper-msg {
            margin-bottom: 6px;
            padding: 4px 8px;
            border-radius: 6px;
            max-width: 85%;
            word-wrap: break-word;
            font-size: 12px;
            line-height: 1.4;
        }
        #sneed-whisper-box .whisper-msg.incoming {
            background: #2a1a2a;
            color: #ddd;
            align-self: flex-start;
            border-bottom-left-radius: 2px;
        }
        #sneed-whisper-box .whisper-msg.outgoing {
            background: #1a2a3a;
            color: #eee;
            align-self: flex-end;
            border-bottom-right-radius: 2px;
        }
        #sneed-whisper-box .whisper-time-separator {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            color: #555;
            font-size: 10px;
        }
        #sneed-whisper-box .whisper-time-separator::before,
        #sneed-whisper-box .whisper-time-separator::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #333;
        }
        #sneed-whisper-box .whisper-msg .whisper-msg-time {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
        }
        #sneed-whisper-box .whisper-msg .whisper-msg-author {
            font-size: 10px;
            color: #4a9eff;
            font-weight: 600;
            margin-bottom: 1px;
        }
        #sneed-whisper-box .whisper-empty {
            color: #555;
            font-style: italic;
            text-align: center;
            padding: 40px 16px;
            font-size: 12px;
        }
        #sneed-whisper-box .whisper-input-row {
            display: flex;
            padding: 6px;
            background: #16162a;
            border-top: 1px solid #333;
            gap: 4px;
        }
        #sneed-whisper-box .whisper-input {
            flex: 1;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #eee;
            padding: 6px 8px;
            font-size: 12px;
            outline: none;
            font-family: inherit;
        }
        #sneed-whisper-box .whisper-input:focus {
            border-color: #4a9eff;
        }
        #sneed-whisper-box .whisper-input::placeholder {
            color: #555;
        }
        #sneed-whisper-box .whisper-send {
            background: #4a9eff;
            border: none;
            border-radius: 4px;
            color: #fff;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: background 0.15s;
        }
        #sneed-whisper-box .whisper-send:hover {
            background: #3a8eef;
        }
    `;
    const ALLOWED_TAGS = /* @__PURE__ */ new Set([
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "del",
      "strike",
      "code",
      "pre",
      "span",
      "div",
      "p",
      "br",
      "a",
      "img",
      "ul",
      "ol",
      "li",
      "blockquote"
    ]);
    const ALLOWED_ATTRS = {
      "a": ["href", "title", "target", "rel"],
      "img": ["src", "alt", "width", "height", "title"],
      "span": ["class", "style"],
      "div": ["class", "style"]
    };
    const SAFE_URL_RE = /^https?:\/\//i;
    function sanitizeHTML(html) {
      const template = document.createElement("template");
      template.innerHTML = html;
      sanitizeNode(template.content);
      return template.innerHTML;
    }
    function sanitizeNode(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          continue;
        }
        const tag = child.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          const text = document.createTextNode(child.textContent);
          child.replaceWith(text);
          continue;
        }
        const allowed = ALLOWED_ATTRS[tag] || [];
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (!allowed.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        }
        if (tag === "a") {
          const href = child.getAttribute("href");
          if (href && !SAFE_URL_RE.test(href)) {
            child.removeAttribute("href");
          }
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
        if (tag === "img") {
          const src = child.getAttribute("src");
          if (src && !SAFE_URL_RE.test(src)) {
            child.remove();
            continue;
          }
        }
        if (child.hasAttribute("style")) {
          const style = child.getAttribute("style");
          const safeStyle = style.replace(/[^;]+/g, (rule) => {
            const prop = rule.split(":")[0].trim().toLowerCase();
            if (["color", "font-size", "text-align", "text-decoration", "font-weight", "font-style"].includes(prop)) {
              return rule;
            }
            return "";
          }).replace(/;{2,}/g, ";").replace(/^;|;$/g, "");
          if (safeStyle) {
            child.setAttribute("style", safeStyle);
          } else {
            child.removeAttribute("style");
          }
        }
        sanitizeNode(child);
      }
    }
    function injectStyles(doc) {
      if (doc.getElementById("sneed-whisper-styles")) return;
      const style = doc.createElement("style");
      style.id = "sneed-whisper-styles";
      style.textContent = WHISPER_STYLES;
      (doc.head || doc.documentElement).appendChild(style);
    }
    function createWhisperBox(doc, callbacks) {
      injectStyles(doc);
      const box = doc.createElement("div");
      box.id = "sneed-whisper-box";
      box.classList.add("expanded");
      const header = doc.createElement("div");
      header.className = "whisper-header";
      const arrow = doc.createElement("span");
      arrow.className = "whisper-toggle-arrow";
      arrow.textContent = "\u25BC";
      const title = doc.createElement("span");
      title.className = "whisper-header-title";
      title.textContent = "Whispers";
      const closeBtn = doc.createElement("button");
      closeBtn.className = "whisper-close-btn";
      closeBtn.textContent = "\xD7";
      closeBtn.title = "Close whisper box";
      header.appendChild(arrow);
      header.appendChild(title);
      header.appendChild(closeBtn);
      const body = doc.createElement("div");
      body.className = "whisper-body";
      const tabsRow = doc.createElement("div");
      tabsRow.className = "whisper-tabs-row";
      const tabs = doc.createElement("div");
      tabs.className = "whisper-tabs";
      const addTabBtn = doc.createElement("button");
      addTabBtn.className = "whisper-add-tab";
      addTabBtn.textContent = "+";
      addTabBtn.title = "New whisper conversation";
      tabsRow.appendChild(tabs);
      tabsRow.appendChild(addTabBtn);
      const newUserRow = doc.createElement("div");
      newUserRow.className = "whisper-new-user-row";
      newUserRow.style.display = "none";
      newUserRow.style.position = "relative";
      const newUserInput = doc.createElement("input");
      newUserInput.className = "whisper-new-user-input";
      newUserInput.type = "text";
      newUserInput.placeholder = "Username...";
      const newUserOk = doc.createElement("button");
      newUserOk.className = "whisper-new-user-ok";
      newUserOk.textContent = "Start";
      newUserRow.appendChild(newUserInput);
      newUserRow.appendChild(newUserOk);
      let acDropdown = null;
      let acIndex = -1;
      function getChatUsers() {
        const users = [];
        const activities = doc.querySelectorAll("#chat-activity .activity");
        activities.forEach((el) => {
          const name = el.dataset.username;
          if (name) users.push(name);
        });
        return users;
      }
      function closeAutocomplete() {
        if (acDropdown) {
          acDropdown.remove();
          acDropdown = null;
        }
        acIndex = -1;
      }
      function showAutocomplete(filter) {
        closeAutocomplete();
        const query = filter.toLowerCase();
        const users = getChatUsers().filter((u) => u.toLowerCase().startsWith(query));
        if (users.length === 0 || !query) return;
        acDropdown = doc.createElement("div");
        acDropdown.className = "whisper-autocomplete";
        users.slice(0, 10).forEach((username, i) => {
          const item = doc.createElement("div");
          item.className = "whisper-autocomplete-item";
          item.textContent = username;
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            newUserInput.value = username;
            closeAutocomplete();
          });
          acDropdown.appendChild(item);
        });
        newUserRow.appendChild(acDropdown);
      }
      function highlightAcItem() {
        if (!acDropdown) return;
        const items = acDropdown.querySelectorAll(".whisper-autocomplete-item");
        items.forEach((item, i) => {
          item.classList.toggle("active", i === acIndex);
        });
      }
      function submitNewUser() {
        closeAutocomplete();
        const username = newUserInput.value.trim();
        if (username && callbacks.onNewConversation) {
          callbacks.onNewConversation(username);
          newUserInput.value = "";
          newUserRow.style.display = "none";
        }
      }
      addTabBtn.addEventListener("click", () => {
        const visible = newUserRow.style.display !== "none";
        newUserRow.style.display = visible ? "none" : "flex";
        if (visible) {
          closeAutocomplete();
        } else {
          newUserInput.focus();
        }
      });
      newUserOk.addEventListener("click", submitNewUser);
      newUserInput.addEventListener("input", () => {
        const val = newUserInput.value.trim();
        if (val) {
          showAutocomplete(val);
        } else {
          closeAutocomplete();
        }
      });
      newUserInput.addEventListener("keydown", (e) => {
        if (acDropdown) {
          const items = acDropdown.querySelectorAll(".whisper-autocomplete-item");
          if (e.key === "ArrowDown") {
            e.preventDefault();
            acIndex = Math.min(acIndex + 1, items.length - 1);
            highlightAcItem();
            return;
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            acIndex = Math.max(acIndex - 1, 0);
            highlightAcItem();
            return;
          } else if ((e.key === "Enter" || e.key === "Tab") && acIndex >= 0 && items[acIndex]) {
            e.preventDefault();
            newUserInput.value = items[acIndex].textContent;
            closeAutocomplete();
            return;
          }
        }
        if (e.key === "Enter") {
          e.preventDefault();
          submitNewUser();
        } else if (e.key === "Escape") {
          if (acDropdown) {
            closeAutocomplete();
          } else {
            newUserRow.style.display = "none";
          }
        }
      });
      newUserInput.addEventListener("blur", () => {
        setTimeout(closeAutocomplete, 150);
      });
      const messages = doc.createElement("div");
      messages.className = "whisper-messages";
      const empty = doc.createElement("div");
      empty.className = "whisper-empty";
      empty.textContent = "No whispers yet";
      messages.appendChild(empty);
      const inputRow = doc.createElement("div");
      inputRow.className = "whisper-input-row";
      const input = doc.createElement("input");
      input.className = "whisper-input";
      input.type = "text";
      input.placeholder = "Type a whisper...";
      const sendBtn = doc.createElement("button");
      sendBtn.className = "whisper-send";
      sendBtn.textContent = "Send";
      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      body.appendChild(tabsRow);
      body.appendChild(newUserRow);
      body.appendChild(messages);
      body.appendChild(inputRow);
      box.appendChild(header);
      box.appendChild(body);
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let boxStartX = 0;
      let boxStartY = 0;
      let hasDragged = false;
      let savePositionTimer = null;
      function onMouseDown(e) {
        if (e.target === closeBtn) return;
        isDragging = true;
        hasDragged = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = box.getBoundingClientRect();
        boxStartX = rect.left;
        boxStartY = rect.top;
        doc.addEventListener("mousemove", onMouseMove);
        doc.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
      }
      function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasDragged = true;
        }
        let newX = boxStartX + dx;
        let newY = boxStartY + dy;
        const win = doc.defaultView || window;
        newX = Math.max(0, Math.min(win.innerWidth - box.offsetWidth, newX));
        newY = Math.max(0, Math.min(win.innerHeight - 32, newY));
        box.style.bottom = "auto";
        box.style.right = "auto";
        box.style.left = newX + "px";
        box.style.top = newY + "px";
      }
      function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        doc.removeEventListener("mousemove", onMouseMove);
        doc.removeEventListener("mouseup", onMouseUp);
        if (hasDragged) {
          saveBoxLayout();
          adjustOrientation(box);
        }
      }
      function saveBoxLayout() {
        if (savePositionTimer) clearTimeout(savePositionTimer);
        savePositionTimer = setTimeout(() => {
          const rect = box.getBoundingClientRect();
          const win = doc.defaultView || window;
          if (callbacks.onPositionChange) {
            callbacks.onPositionChange({
              x: rect.left / win.innerWidth,
              y: rect.top / win.innerHeight,
              width: rect.width,
              height: rect.height
            });
          }
        }, 300);
      }
      const resizeObserver = new ResizeObserver(() => {
        if (!body.classList.contains("collapsed")) {
          saveBoxLayout();
        }
      });
      resizeObserver.observe(box);
      header.addEventListener("mousedown", onMouseDown);
      header.addEventListener("click", (e) => {
        if (e.target === closeBtn) return;
        if (hasDragged) return;
        const isCollapsing = !body.classList.contains("collapsed");
        body.classList.toggle("collapsed");
        arrow.classList.toggle("collapsed");
        if (isCollapsing) {
          const rect = box.getBoundingClientRect();
          box.dataset.prevHeight = box.style.height || "";
          box.dataset.prevBottom = String(rect.bottom);
          box.style.height = "";
          box.classList.remove("expanded");
          if (box.style.flexDirection === "column-reverse") {
            const headerHeight = header.offsetHeight || 32;
            box.style.top = rect.bottom - headerHeight + "px";
            box.style.bottom = "auto";
          }
        } else {
          box.classList.add("expanded");
          if (box.dataset.prevHeight) {
            box.style.height = box.dataset.prevHeight;
          }
          if (box.style.flexDirection === "column-reverse" && box.dataset.prevBottom) {
            const newHeight = box.offsetHeight;
            const prevBottom = parseFloat(box.dataset.prevBottom);
            box.style.top = prevBottom - newHeight + "px";
            box.style.bottom = "auto";
          }
          adjustOrientation(box);
        }
        if (callbacks.onToggle) callbacks.onToggle(!isCollapsing);
      });
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (callbacks.onClose) callbacks.onClose();
      });
      sendBtn.addEventListener("click", () => {
        const text = input.value.trim();
        if (text && callbacks.onSend) {
          callbacks.onSend(text);
          input.value = "";
          input.focus();
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const text = input.value.trim();
          if (text && callbacks.onSend) {
            callbacks.onSend(text);
            input.value = "";
            input.focus();
          }
        }
      });
      return box;
    }
    function renderTabs(box, partners, activePartner, onTabClick, onTabClose, isOnline) {
      const tabs = box.querySelector(".whisper-tabs");
      if (!tabs) return;
      tabs.replaceChildren();
      partners.forEach((p) => {
        const tab = document.createElement("div");
        tab.className = "whisper-tab" + (p.username === activePartner ? " active" : "");
        const dot = document.createElement("span");
        const online = isOnline ? isOnline(p.username) : false;
        dot.className = "status-dot " + (online ? "online" : "offline");
        tab.appendChild(dot);
        tab.appendChild(document.createTextNode(p.username));
        if (p.unread > 0) {
          const badge = document.createElement("span");
          badge.className = "unread-badge";
          badge.textContent = p.unread > 9 ? "9+" : String(p.unread);
          tab.appendChild(badge);
        }
        const closeBtn = document.createElement("span");
        closeBtn.className = "tab-close";
        closeBtn.textContent = "\xD7";
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onTabClose) onTabClose(p.username);
        });
        tab.appendChild(closeBtn);
        tab.addEventListener("click", () => {
          if (onTabClick) onTabClick(p.username);
        });
        tabs.appendChild(tab);
      });
    }
    function renderMessages(box, msgs) {
      const container = box.querySelector(".whisper-messages");
      if (!container) return;
      container.replaceChildren();
      if (!msgs || msgs.length === 0) {
        const empty = document.createElement("div");
        empty.className = "whisper-empty";
        empty.textContent = "No messages in this conversation";
        container.appendChild(empty);
        return;
      }
      const ONE_HOUR = 3600;
      let lastTimestamp = 0;
      msgs.forEach((msg) => {
        if (lastTimestamp > 0 && msg.timestamp - lastTimestamp > ONE_HOUR) {
          const sep = document.createElement("div");
          sep.className = "whisper-time-separator";
          const sepDate = new Date(msg.timestamp * 1e3);
          sep.textContent = sepDate.toLocaleString();
          container.appendChild(sep);
        }
        lastTimestamp = msg.timestamp;
        const el = document.createElement("div");
        el.className = "whisper-msg " + (msg.direction === "out" ? "outgoing" : "incoming");
        const author = document.createElement("div");
        author.className = "whisper-msg-author";
        author.textContent = msg.author;
        const content = document.createElement("div");
        content.innerHTML = sanitizeHTML(msg.html);
        const time = document.createElement("div");
        time.className = "whisper-msg-time";
        const d = new Date(msg.timestamp * 1e3);
        time.textContent = d.toLocaleTimeString();
        el.appendChild(author);
        el.appendChild(content);
        el.appendChild(time);
        container.appendChild(el);
      });
      container.scrollTop = container.scrollHeight;
    }
    function applyPosition(box, pos, doc, applySize) {
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
      const win = doc.defaultView || window;
      const x = Math.max(0, Math.min(win.innerWidth - box.offsetWidth, pos.x * win.innerWidth));
      const y = Math.max(0, Math.min(win.innerHeight - 32, pos.y * win.innerHeight));
      box.style.bottom = "auto";
      box.style.right = "auto";
      box.style.left = x + "px";
      box.style.top = y + "px";
      if (applySize !== false) {
        if (pos.width) box.style.width = pos.width + "px";
        if (pos.height) box.style.height = pos.height + "px";
      }
      adjustOrientation(box);
    }
    function expand(box) {
      const body = box.querySelector(".whisper-body");
      const arrow = box.querySelector(".whisper-toggle-arrow");
      if (body) body.classList.remove("collapsed");
      if (arrow) arrow.classList.remove("collapsed");
      box.classList.add("expanded");
      if (box.dataset.prevHeight) {
        box.style.height = box.dataset.prevHeight;
      }
      adjustOrientation(box);
    }
    function adjustOrientation(box) {
      requestAnimationFrame(() => {
        const win = box.ownerDocument.defaultView || window;
        const rect = box.getBoundingClientRect();
        const vh = win.innerHeight;
        const vw = win.innerWidth;
        const nearBottom = rect.top > vh * 0.5;
        if (nearBottom) {
          box.style.flexDirection = "column-reverse";
          box.style.borderRadius = "0 0 8px 8px";
        } else {
          box.style.flexDirection = "column";
          box.style.borderRadius = "8px 8px 0 0";
        }
        let changed = false;
        let top = rect.top;
        let left = rect.left;
        if (rect.bottom > vh) {
          top = vh - rect.height;
          changed = true;
        }
        if (top < 0) {
          top = 0;
          changed = true;
        }
        if (rect.right > vw) {
          left = vw - rect.width;
          changed = true;
        }
        if (left < 0) {
          left = 0;
          changed = true;
        }
        if (changed) {
          box.style.top = top + "px";
          box.style.left = left + "px";
          box.style.bottom = "auto";
          box.style.right = "auto";
        }
      });
    }
    SNEED.ui = SNEED.ui || {};
    SNEED.ui.whisperBox = {
      createWhisperBox,
      renderTabs,
      renderMessages,
      applyPosition,
      adjustOrientation,
      expand,
      sanitizeHTML
    };
  })();

  // src/ui/dialogs.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const storage = SNEED.core.storage;
    const { STYLES } = SNEED.ui;
    function createPopupBase(doc, id, options = {}) {
      const popup = doc.createElement("div");
      popup.id = id;
      popup.style.cssText = stylesToString({
        ...STYLES.popup,
        maxWidth: options.maxWidth || "500px",
        maxHeight: options.maxHeight || "400px",
        overflowY: "auto",
        zIndex: options.zIndex || "10000"
      });
      return popup;
    }
    function createTitle(doc, text) {
      const title = doc.createElement("h3");
      title.textContent = text;
      title.style.cssText = stylesToString(STYLES.popupTitle);
      return title;
    }
    function createStyledButton(doc, text, type = "secondary", options = {}) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      const baseStyle = STYLES.button.base;
      const typeStyle = STYLES.button[type] || STYLES.button.secondary;
      btn.style.cssText = stylesToString({
        ...baseStyle,
        ...typeStyle,
        ...options.fullWidth ? { width: "100%" } : {},
        ...options.flex ? { flex: "1" } : {},
        ...options.marginTop ? { marginTop: options.marginTop } : {},
        ...options.marginBottom ? { marginBottom: options.marginBottom } : {}
      });
      const hoverBg = typeStyle.background.replace("0.3", "0.5");
      addManagedEventListener(btn, "mouseenter", () => {
        btn.style.background = hoverBg;
      });
      addManagedEventListener(btn, "mouseleave", () => {
        btn.style.background = typeStyle.background;
      });
      return btn;
    }
    function setupClickOutside(doc, popup, onClose) {
      const clickOutside = (e) => {
        if (!popup.contains(e.target)) {
          cleanup();
          if (onClose) onClose();
        }
      };
      const cleanup = () => {
        doc.removeEventListener("click", clickOutside);
        removeElementListeners(popup);
        popup.remove();
      };
      setTimeout(() => doc.addEventListener("click", clickOutside), 0);
      popup.__sneed_cleanup = cleanup;
      return cleanup;
    }
    async function showBlacklistManager(doc) {
      const existing = doc.getElementById("blacklist-manager");
      if (existing) {
        existing.remove();
        return;
      }
      const blacklist = await storage.getBlacklist();
      const manager = createPopupBase(doc, "blacklist-manager");
      manager.appendChild(createTitle(doc, "Blacklisted Images"));
      const addSection = doc.createElement("div");
      addSection.style.cssText = "margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;";
      const addLabel = doc.createElement("label");
      addLabel.textContent = "Paste image URLs to blacklist (one per line):";
      addLabel.style.cssText = "color: rgba(255, 255, 255, 0.9); font-size: 12px; display: block; margin-bottom: 8px;";
      addSection.appendChild(addLabel);
      const urlInput = doc.createElement("textarea");
      urlInput.placeholder = "https://example.com/image1.png\nhttps://example.com/image2.png";
      urlInput.style.cssText = stylesToString({ ...STYLES.input, width: "100%", minHeight: "60px", resize: "vertical", marginBottom: "8px" });
      const addUrlBtn = createStyledButton(doc, "Blacklist", "danger", { fullWidth: true });
      const doAddUrls = async () => {
        const text = urlInput.value.trim();
        if (!text) return;
        const urls = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
        if (urls.length === 0) return;
        let addedCount = 0;
        let duplicateCount = 0;
        for (const url of urls) {
          if (await storage.addToBlacklist(url)) {
            addedCount++;
          } else {
            duplicateCount++;
          }
        }
        urlInput.value = "";
        manager.remove();
        showBlacklistManager(doc);
        if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
        if (SNEED.features.rescanMessages) SNEED.features.rescanMessages(doc);
        if (duplicateCount > 0 && addedCount === 0) {
          alert(`All ${duplicateCount} URL(s) were already blacklisted`);
        } else if (duplicateCount > 0) {
          alert(`Added ${addedCount} URL(s). ${duplicateCount} were already blacklisted.`);
        }
      };
      addManagedEventListener(addUrlBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        doAddUrls();
      });
      addSection.appendChild(urlInput);
      addSection.appendChild(addUrlBtn);
      manager.appendChild(addSection);
      if (blacklist.length === 0) {
        const empty = doc.createElement("p");
        empty.textContent = "No images blacklisted";
        empty.style.cssText = "color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 0;";
        manager.appendChild(empty);
      } else {
        const list = doc.createElement("div");
        list.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
        blacklist.forEach((url) => {
          const item = doc.createElement("div");
          item.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;";
          const img = doc.createElement("img");
          img.src = url;
          img.style.cssText = "width: 32px; height: 32px; object-fit: contain;";
          const urlText = doc.createElement("span");
          urlText.textContent = url;
          urlText.style.cssText = "color: rgba(255, 255, 255, 0.7); font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
          const removeBtn = createStyledButton(doc, "Remove", "danger");
          removeBtn.style.padding = "4px 12px";
          removeBtn.style.fontSize = "11px";
          addManagedEventListener(removeBtn, "click", async () => {
            if (await storage.removeFromBlacklist(url)) {
              manager.remove();
              showBlacklistManager(doc);
              if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
              if (SNEED.features.rescanMessages) SNEED.features.rescanMessages(doc);
            }
          });
          item.appendChild(img);
          item.appendChild(urlText);
          item.appendChild(removeBtn);
          list.appendChild(item);
        });
        manager.appendChild(list);
        const clearBtn = createStyledButton(doc, "Clear All", "danger", { fullWidth: true, marginTop: "12px" });
        addManagedEventListener(clearBtn, "click", async () => {
          if (confirm("Clear all blacklisted images?")) {
            await storage.clearBlacklist();
            manager.remove();
            showBlacklistManager(doc);
            if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
            if (SNEED.features.rescanMessages) SNEED.features.rescanMessages(doc);
          }
        });
        manager.appendChild(clearBtn);
      }
      const closeBtn = createStyledButton(doc, "Close", "secondary", { fullWidth: true, marginTop: "8px" });
      addManagedEventListener(closeBtn, "click", () => {
        if (manager.__sneed_cleanup) manager.__sneed_cleanup();
        else {
          manager.remove();
          removeElementListeners(manager);
        }
      });
      manager.appendChild(closeBtn);
      doc.body.appendChild(manager);
      setupClickOutside(doc, manager);
    }
    function showExportDialog(doc, emotesToExport) {
      const dialog = createPopupBase(doc, "export-dialog", { minWidth: "500px", maxWidth: "700px", zIndex: "10002" });
      dialog.appendChild(createTitle(doc, "Export Emotes"));
      const instructions = doc.createElement("p");
      instructions.textContent = "Copy the JSON below and save it to a .json file:";
      instructions.style.cssText = "color: rgba(255, 255, 255, 0.7); font-size: 12px; margin: 0 0 8px 0;";
      dialog.appendChild(instructions);
      const textarea = doc.createElement("textarea");
      textarea.value = JSON.stringify(emotesToExport, null, 2);
      textarea.readOnly = true;
      textarea.style.cssText = "width: 100%; height: 300px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: rgba(255, 255, 255, 0.9); padding: 8px; font-family: monospace; font-size: 11px; resize: vertical; margin-bottom: 12px;";
      dialog.appendChild(textarea);
      const buttonContainer = doc.createElement("div");
      buttonContainer.style.cssText = "display: flex; gap: 8px;";
      const copyBtn = createStyledButton(doc, "Copy to Clipboard", "primary", { flex: true });
      addManagedEventListener(copyBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        textarea.select();
        try {
          doc.execCommand("copy");
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy to Clipboard";
          }, 2e3);
        } catch (err) {
          alert("Failed to copy. Please manually select and copy the text.");
        }
      });
      const closeBtn = createStyledButton(doc, "Close", "secondary", { flex: true });
      addManagedEventListener(closeBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dialog.__sneed_cleanup) dialog.__sneed_cleanup();
        else {
          dialog.remove();
          removeElementListeners(dialog);
        }
      });
      buttonContainer.appendChild(copyBtn);
      buttonContainer.appendChild(closeBtn);
      dialog.appendChild(buttonContainer);
      doc.body.appendChild(dialog);
      dialog.__sneed_cleanup = () => {
        dialog.remove();
        removeElementListeners(dialog);
      };
      textarea.select();
      textarea.focus();
    }
    async function showEmoteEditor(doc, emote, index) {
      const existing = doc.getElementById("emote-editor");
      if (existing) existing.remove();
      const isNew = index === -1;
      const currentEmotes = await storage.getEmotes();
      const editor = createPopupBase(doc, "emote-editor", { minWidth: "400px", zIndex: "10001" });
      editor.appendChild(createTitle(doc, isNew ? "Add New Emote" : "Edit Emote"));
      const fieldStyle = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;";
      const labelStyle = "color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 500;";
      const codeField = doc.createElement("div");
      codeField.style.cssText = fieldStyle;
      const codeLabel = doc.createElement("label");
      codeLabel.textContent = "Code (required):";
      codeLabel.style.cssText = labelStyle;
      const codeInput = doc.createElement("input");
      codeInput.type = "text";
      codeInput.value = (emote == null ? void 0 : emote.code) || "";
      codeInput.placeholder = ":example:";
      codeInput.style.cssText = stylesToString(STYLES.input);
      codeField.appendChild(codeLabel);
      codeField.appendChild(codeInput);
      const titleField = doc.createElement("div");
      titleField.style.cssText = fieldStyle;
      const titleLabel = doc.createElement("label");
      titleLabel.textContent = "Title:";
      titleLabel.style.cssText = labelStyle;
      const titleInput = doc.createElement("input");
      titleInput.type = "text";
      titleInput.value = (emote == null ? void 0 : emote.title) || "";
      titleInput.placeholder = "Emote description";
      titleInput.style.cssText = stylesToString(STYLES.input);
      titleField.appendChild(titleLabel);
      titleField.appendChild(titleInput);
      const typeField = doc.createElement("div");
      typeField.style.cssText = fieldStyle;
      const typeLabel = doc.createElement("label");
      typeLabel.textContent = "Type:";
      typeLabel.style.cssText = labelStyle;
      const typeSelect = doc.createElement("select");
      typeSelect.style.cssText = stylesToString(STYLES.input);
      [{ value: "url", label: "Image URL" }, { value: "emoji", label: "Emoji" }, { value: "text", label: "Text" }].forEach((type) => {
        const option = doc.createElement("option");
        option.value = type.value;
        option.textContent = type.label;
        typeSelect.appendChild(option);
      });
      if (emote == null ? void 0 : emote.url) typeSelect.value = "url";
      else if (emote == null ? void 0 : emote.emoji) typeSelect.value = "emoji";
      else if (emote == null ? void 0 : emote.text) typeSelect.value = "text";
      else typeSelect.value = "url";
      typeField.appendChild(typeLabel);
      typeField.appendChild(typeSelect);
      const valueField = doc.createElement("div");
      valueField.style.cssText = fieldStyle;
      const valueLabel = doc.createElement("label");
      valueLabel.style.cssText = labelStyle;
      const valueInput = doc.createElement("input");
      valueInput.type = "text";
      valueInput.style.cssText = stylesToString(STYLES.input);
      valueField.appendChild(valueLabel);
      valueField.appendChild(valueInput);
      const updateValueField = () => {
        const type = typeSelect.value;
        if (type === "url") {
          valueLabel.textContent = "Image URL:";
          valueInput.placeholder = "https://example.com/image.png";
          valueInput.value = (emote == null ? void 0 : emote.url) || "";
        } else if (type === "emoji") {
          valueLabel.textContent = "Emoji:";
          valueInput.placeholder = "\u{1F600}";
          valueInput.value = (emote == null ? void 0 : emote.emoji) || "";
        } else if (type === "text") {
          valueLabel.textContent = "Text:";
          valueInput.placeholder = "ABC";
          valueInput.value = (emote == null ? void 0 : emote.text) || "";
        }
      };
      updateValueField();
      addManagedEventListener(typeSelect, "change", updateValueField);
      const autoSendField = doc.createElement("div");
      autoSendField.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 16px;";
      const autoSendCheckbox = doc.createElement("input");
      autoSendCheckbox.type = "checkbox";
      autoSendCheckbox.id = "auto-send-checkbox";
      autoSendCheckbox.checked = (emote == null ? void 0 : emote.autoSend) !== false;
      const autoSendLabel = doc.createElement("label");
      autoSendLabel.htmlFor = "auto-send-checkbox";
      autoSendLabel.textContent = "Auto-send when input is empty";
      autoSendLabel.style.cssText = "color: rgba(255, 255, 255, 0.9); font-size: 12px; cursor: pointer;";
      autoSendField.appendChild(autoSendCheckbox);
      autoSendField.appendChild(autoSendLabel);
      editor.appendChild(codeField);
      editor.appendChild(titleField);
      editor.appendChild(typeField);
      editor.appendChild(valueField);
      editor.appendChild(autoSendField);
      const buttonContainer = doc.createElement("div");
      buttonContainer.style.cssText = "display: flex; gap: 8px;";
      const saveBtn = createStyledButton(doc, "Save", "primary", { flex: true });
      addManagedEventListener(saveBtn, "click", async () => {
        const code = codeInput.value.trim();
        if (!code) {
          alert("Code is required");
          return;
        }
        const type = typeSelect.value;
        const value = valueInput.value.trim();
        if (!value) {
          alert(`${type === "url" ? "URL" : type === "emoji" ? "Emoji" : "Text"} is required`);
          return;
        }
        const newEmote = { code, title: titleInput.value.trim() || void 0 };
        if (type === "url") newEmote.url = value;
        else if (type === "emoji") newEmote.emoji = value;
        else if (type === "text") newEmote.text = value;
        if (!autoSendCheckbox.checked) newEmote.autoSend = false;
        let updatedEmotes;
        if (isNew) {
          updatedEmotes = [...currentEmotes, newEmote];
        } else {
          updatedEmotes = [...currentEmotes];
          updatedEmotes[index] = newEmote;
        }
        await storage.saveEmotes(updatedEmotes);
        editor.remove();
        showEmoteManager(doc);
        if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
      });
      const cancelBtn = createStyledButton(doc, "Cancel", "secondary", { flex: true });
      addManagedEventListener(cancelBtn, "click", () => {
        editor.remove();
        showEmoteManager(doc);
      });
      buttonContainer.appendChild(saveBtn);
      buttonContainer.appendChild(cancelBtn);
      editor.appendChild(buttonContainer);
      doc.body.appendChild(editor);
    }
    async function showEmoteManager(doc) {
      const existing = doc.getElementById("emote-manager");
      if (existing) {
        existing.remove();
        return;
      }
      const currentEmotes = await storage.getEmotes();
      const manager = createPopupBase(doc, "emote-manager", { maxWidth: "600px", maxHeight: "500px" });
      manager.appendChild(createTitle(doc, "Manage Emotes"));
      const addBtn = createStyledButton(doc, "+ Add New Emote", "primary", { fullWidth: true, marginBottom: "12px" });
      addManagedEventListener(addBtn, "click", () => {
        manager.remove();
        showEmoteEditor(doc, null, -1);
      });
      manager.appendChild(addBtn);
      const list = doc.createElement("div");
      list.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;";
      currentEmotes.forEach((emote, index) => {
        const item = doc.createElement("div");
        item.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;";
        let preview;
        if (emote.url) {
          preview = doc.createElement("img");
          preview.src = emote.url;
          preview.style.cssText = "width: 32px; height: 32px; object-fit: contain;";
        } else if (emote.emoji) {
          preview = doc.createElement("span");
          preview.textContent = emote.emoji;
          preview.style.cssText = "font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;";
        } else if (emote.text) {
          preview = doc.createElement("span");
          preview.textContent = emote.text;
          preview.style.cssText = "font-size: 10px; font-weight: bold; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.9);";
        }
        const info = doc.createElement("div");
        info.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 2px;";
        const code = doc.createElement("span");
        code.textContent = emote.code;
        code.style.cssText = "color: rgba(255, 255, 255, 0.9); font-size: 12px; font-family: monospace;";
        const titleText = doc.createElement("span");
        titleText.textContent = emote.title || "(no title)";
        titleText.style.cssText = "color: rgba(255, 255, 255, 0.6); font-size: 11px;";
        info.appendChild(code);
        info.appendChild(titleText);
        const editBtn = createStyledButton(doc, "Edit", "info");
        editBtn.style.padding = "4px 12px";
        editBtn.style.fontSize = "11px";
        addManagedEventListener(editBtn, "click", () => {
          manager.remove();
          showEmoteEditor(doc, emote, index);
        });
        const deleteBtn = createStyledButton(doc, "Delete", "danger");
        deleteBtn.style.padding = "4px 12px";
        deleteBtn.style.fontSize = "11px";
        addManagedEventListener(deleteBtn, "click", async () => {
          if (confirm(`Delete emote "${emote.code}"?`)) {
            const updatedEmotes = currentEmotes.filter((_, i) => i !== index);
            await storage.saveEmotes(updatedEmotes);
            manager.remove();
            showEmoteManager(doc);
            if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
          }
        });
        if (preview) item.appendChild(preview);
        item.appendChild(info);
        item.appendChild(editBtn);
        item.appendChild(deleteBtn);
        list.appendChild(item);
      });
      manager.appendChild(list);
      const utilityContainer = doc.createElement("div");
      utilityContainer.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";
      const exportBtn = createStyledButton(doc, "Export", "neutral", { flex: true });
      addManagedEventListener(exportBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showExportDialog(doc, currentEmotes);
      });
      const importBtn = createStyledButton(doc, "Import", "neutral", { flex: true });
      addManagedEventListener(importBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = doc.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        addManagedEventListener(input, "change", (ev) => {
          const file = ev.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (re) => {
              try {
                const imported = JSON.parse(re.target.result);
                if (Array.isArray(imported)) {
                  await storage.saveEmotes(imported);
                  manager.remove();
                  showEmoteManager(doc);
                  if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
                } else {
                  alert("Invalid emotes file format");
                }
              } catch (err) {
                alert("Error parsing emotes file: " + err.message);
              }
            };
            reader.readAsText(file);
          }
        });
        input.click();
      });
      const resetBtn = createStyledButton(doc, "Reset to Default", "warning", { flex: true });
      addManagedEventListener(resetBtn, "click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Reset all emotes to default? This will delete your custom emotes.")) {
          await storage.resetEmotesToDefault();
          manager.remove();
          showEmoteManager(doc);
          if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
        }
      });
      utilityContainer.appendChild(exportBtn);
      utilityContainer.appendChild(importBtn);
      utilityContainer.appendChild(resetBtn);
      manager.appendChild(utilityContainer);
      const closeBtn = createStyledButton(doc, "Close", "secondary", { fullWidth: true });
      addManagedEventListener(closeBtn, "click", () => {
        if (manager.__sneed_cleanup) manager.__sneed_cleanup();
        else {
          manager.remove();
          removeElementListeners(manager);
        }
      });
      manager.appendChild(closeBtn);
      doc.body.appendChild(manager);
      setupClickOutside(doc, manager);
    }
    SNEED.ui.showBlacklistManager = showBlacklistManager;
    SNEED.ui.showEmoteManager = showEmoteManager;
    SNEED.ui.showEmoteEditor = showEmoteEditor;
    SNEED.ui.showExportDialog = showExportDialog;
  })();

  // src/ui/bars.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners, removeElementObservers } = SNEED.core.events;
    const storage = SNEED.core.storage;
    const state = SNEED.state;
    const { STYLES } = SNEED.ui;
    function createEmoteBar(doc) {
      const emoteBar = doc.createElement("div");
      emoteBar.id = "custom-emote-bar";
      emoteBar.style.cssText = stylesToString(STYLES.emoteBar);
      const emotes = state.getEmotes() || state.defaultEmotes;
      emotes.forEach((emote) => {
        const emoteButton = doc.createElement("button");
        emoteButton.type = "button";
        emoteButton.style.cssText = stylesToString(STYLES.emoteButton);
        let contentElement;
        if (emote.url) {
          contentElement = doc.createElement("img");
          contentElement.src = emote.url;
          contentElement.alt = emote.code;
          contentElement.style.cssText = stylesToString(STYLES.emoteImage);
        } else if (emote.emoji) {
          contentElement = doc.createElement("span");
          contentElement.textContent = emote.emoji;
          contentElement.style.cssText = stylesToString(STYLES.emoteEmoji);
        } else if (emote.text) {
          contentElement = doc.createElement("span");
          contentElement.textContent = emote.text;
          contentElement.style.cssText = stylesToString(STYLES.emoteText);
        }
        contentElement.title = emote.title ? `${emote.title} - Click to insert ${emote.code}, Shift+Click to insert without auto-send` : `Click to insert ${emote.code}, Shift+Click to insert without auto-send`;
        emoteButton.appendChild(contentElement);
        addManagedEventListener(emoteButton, "mouseenter", () => {
          emoteButton.style.background = "rgba(255, 255, 255, 0.1)";
          emoteButton.style.borderColor = "rgba(255, 255, 255, 0.2)";
        });
        addManagedEventListener(emoteButton, "mouseleave", () => {
          emoteButton.style.background = "transparent";
          emoteButton.style.borderColor = "transparent";
        });
        addManagedEventListener(emoteButton, "click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (SNEED.features.insertEmote) {
            SNEED.features.insertEmote(emote.code, doc);
          }
          setTimeout(() => {
            const input = doc.getElementById("new-message-input");
            if (emote.autoSend !== false && !e.shiftKey && input && input.textContent.trim() === emote.code.trim()) {
              const submitBtn = doc.getElementById("new-message-submit");
              if (submitBtn) {
                const messageContent = input.innerHTML || "";
                const messageText = input.textContent || "";
                const watcher = SNEED.core.events.ensureSendWatcher(doc);
                watcher.arm({
                  text: messageText,
                  html: messageContent,
                  time: Date.now(),
                  onConfirm: () => {
                    SNEED.log.info("Auto-send emote confirmed");
                  },
                  onFail: () => {
                    const connectionLost = doc.querySelector('.connection-lost, .connecting, [class*="connecting"]');
                    const inputCleared = input.textContent.trim() === "";
                    if (inputCleared && connectionLost) {
                      if (input.contentEditable === "true") {
                        input.innerHTML = messageContent;
                      } else {
                        input.textContent = messageText;
                      }
                      SNEED.log.info("Auto-send failed (disconnected) - content restored");
                      input.focus();
                      SNEED.util.positionCursorAtEnd(doc, input);
                    }
                  }
                });
                submitBtn.click();
              }
            }
          }, state.CONFIG.AUTO_SEND_DELAY);
        });
        emoteBar.appendChild(emoteButton);
      });
      return emoteBar;
    }
    function createFormatBar(doc) {
      const formatBar = doc.createElement("div");
      formatBar.id = "custom-format-bar";
      formatBar.style.cssText = stylesToString(STYLES.formatBar);
      const leftTools = doc.createElement("div");
      leftTools.style.cssText = "display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1;";
      const rightTools = doc.createElement("div");
      rightTools.style.cssText = "display: flex; align-items: center; gap: 6px; margin-left: auto;";
      state.formatTools.forEach((tool) => {
        const toolButton = doc.createElement("button");
        toolButton.type = "button";
        toolButton.style.cssText = stylesToString(STYLES.formatButton);
        toolButton.textContent = tool.symbol;
        toolButton.title = tool.title;
        toolButton.setAttribute("data-tool", tool.name);
        if (tool.isToggle && tool.customAction === "toggleWysiwyg") {
          const isWysiwyg = state.isWysiwygMode();
          toolButton.style.opacity = isWysiwyg ? "0.5" : "1";
          toolButton.title = isWysiwyg ? "WYSIWYG mode (click for raw BBCode)" : "Raw BBCode mode (click for WYSIWYG)";
        }
        addManagedEventListener(toolButton, "mouseenter", () => {
          toolButton.style.background = "rgba(255, 255, 255, 0.2)";
          toolButton.style.borderColor = "rgba(255, 255, 255, 0.4)";
        });
        addManagedEventListener(toolButton, "mouseleave", () => {
          toolButton.style.background = "rgba(255, 255, 255, 0.1)";
          toolButton.style.borderColor = "rgba(255, 255, 255, 0.2)";
        });
        addManagedEventListener(toolButton, "click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (SNEED.features.applyFormatting) {
            SNEED.features.applyFormatting(tool, doc);
          }
        });
        if (tool.name === "Blacklist" || tool.name === "Emotes" || tool.name === "WysiwygToggle") {
          rightTools.appendChild(toolButton);
        } else {
          leftTools.appendChild(toolButton);
        }
      });
      formatBar.appendChild(leftTools);
      formatBar.appendChild(rightTools);
      return formatBar;
    }
    function createEmoteToggleButton(doc) {
      const emoteButton = doc.createElement("button");
      emoteButton.id = "emote-toggle-button";
      emoteButton.type = "button";
      emoteButton.style.cssText = stylesToString(STYLES.emoteToggleButton);
      const toggleImg = doc.createElement("img");
      toggleImg.src = state.toggleButtonConfig.image;
      toggleImg.style.cssText = stylesToString(STYLES.toggleImg);
      emoteButton.appendChild(toggleImg);
      addManagedEventListener(emoteButton, "mouseenter", () => {
        emoteButton.style.background = "rgba(255, 255, 255, 0.1)";
        toggleImg.style.filter = "brightness(1.2)";
      });
      addManagedEventListener(emoteButton, "mouseleave", () => {
        emoteButton.style.background = "transparent";
        toggleImg.style.filter = "brightness(0.9)";
      });
      addManagedEventListener(emoteButton, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emoteBar = doc.getElementById("custom-emote-bar");
        const formatBar = doc.getElementById("custom-format-bar");
        if (emoteBar && formatBar) {
          const visible = state.toggleEmoteBarVisible();
          emoteBar.style.display = visible ? "flex" : "none";
          formatBar.style.display = visible ? "flex" : "none";
        }
      });
      emoteButton.title = state.toggleButtonConfig.title;
      return emoteButton;
    }
    function reloadEmoteBar(doc) {
      const emoteBar = doc.getElementById("custom-emote-bar");
      if (emoteBar) {
        const wasVisible = emoteBar.style.display !== "none";
        emoteBar.replaceWith(createEmoteBar(doc));
        if (wasVisible) {
          doc.getElementById("custom-emote-bar").style.display = "flex";
        }
      }
    }
    function cleanupBars(doc) {
      const emoteBar = doc.getElementById("custom-emote-bar");
      const formatBar = doc.getElementById("custom-format-bar");
      if (emoteBar) {
        removeElementListeners(emoteBar);
        removeElementObservers(emoteBar);
      }
      if (formatBar) {
        removeElementListeners(formatBar);
        removeElementObservers(formatBar);
      }
      const colorPicker = doc.getElementById("color-picker-popup");
      if (colorPicker) {
        removeElementListeners(colorPicker);
        removeElementObservers(colorPicker);
        colorPicker.remove();
      }
      const inputs = doc.querySelectorAll("[data-observer-attached]");
      inputs.forEach((input) => {
        removeElementObservers(input);
        const cached = SNEED.core.events.getResizeCache(input);
        if (cached) {
          cached.cleanup();
          SNEED.core.events.deleteResizeCache(input);
        }
      });
    }
    SNEED.ui.createEmoteBar = createEmoteBar;
    SNEED.ui.createFormatBar = createFormatBar;
    SNEED.ui.createEmoteToggleButton = createEmoteToggleButton;
    SNEED.ui.reloadEmoteBar = reloadEmoteBar;
    SNEED.ui.cleanupBars = cleanupBars;
  })();

  // src/features/formatting.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const { getSelectionAndRange } = SNEED.util;
    function applyWysiwygFormat(command, doc) {
      doc.execCommand(command, false, null);
    }
    function hslToHex(h, s, l) {
      s /= 100;
      l /= 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(h / 60 % 2 - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
      return "#" + toHex(r) + toHex(g) + toHex(b);
    }
    function applyFormatting(tool, doc) {
      const input = doc.getElementById("new-message-input");
      if (!input) return;
      input.focus();
      const win = doc.defaultView || window;
      const selection = win.getSelection();
      let range;
      if (selection.rangeCount === 0) {
        range = doc.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.addRange(range);
      } else {
        range = selection.getRangeAt(0);
      }
      let textToInsert;
      let hadSelectedText = false;
      if (tool.wysiwygCommand) {
        if (SNEED.state.isWysiwygMode()) {
          applyWysiwygFormat(tool.wysiwygCommand, doc);
          const event = new Event("input", { bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          return;
        } else {
          const tagMap = { "bold": "b", "italic": "i", "underline": "u", "strikeThrough": "s" };
          const tag = tagMap[tool.wysiwygCommand] || tool.wysiwygCommand;
          const selectedText = selection.toString();
          textToInsert = `[${tag}]${selectedText}[/${tag}]`;
          hadSelectedText = !!selectedText;
        }
      }
      if (tool.customAction === "bulletLines") {
        const selectedText = selection.toString();
        hadSelectedText = !!selectedText;
        if (selectedText) {
          const lines = selectedText.split("\n");
          textToInsert = lines.map((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("\u2022")) {
              return "\u2022 " + trimmed;
            }
            return line;
          }).join("\n");
        } else {
          textToInsert = "\u2022 ";
        }
      } else if (tool.customAction === "insertImage") {
        const selectedText = selection.toString().trim();
        if (SNEED.state.isWysiwygMode() && selectedText && /^https?:\/\/.+/i.test(selectedText)) {
          const img = doc.createElement("img");
          img.src = selectedText;
          img.setAttribute("data-bbcode-img", "true");
          img.style.maxHeight = "150px";
          img.style.maxWidth = "100%";
          img.style.verticalAlign = "middle";
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.setEndAfter(img);
          selection.removeAllRanges();
          selection.addRange(range);
          const event = new Event("input", { bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          return;
        } else {
          textToInsert = selectedText ? `[img]${selectedText}[/img]` : "[img][/img]";
          hadSelectedText = !!selectedText;
        }
      } else if (tool.customAction === "insertUrl") {
        const selectedText = selection.toString().trim();
        hadSelectedText = !!selectedText;
        if (selectedText && /^https?:\/\/.+/i.test(selectedText)) {
          textToInsert = `[url]${selectedText}[/url]`;
        } else if (selectedText) {
          textToInsert = `[url=]${selectedText}[/url]`;
        } else {
          textToInsert = "[url][/url]";
        }
      } else if (tool.customAction === "centerText") {
        const selectedText = selection.toString();
        if (SNEED.state.isWysiwygMode()) {
          if (selectedText) {
            const div = doc.createElement("div");
            div.style.textAlign = "center";
            div.setAttribute("data-bbcode-center", "true");
            const fragment = range.extractContents();
            div.appendChild(fragment);
            range.insertNode(div);
            range.setStartAfter(div);
            range.setEndAfter(div);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            const div = doc.createElement("div");
            div.style.textAlign = "center";
            div.setAttribute("data-bbcode-center", "true");
            div.textContent = "\u200B";
            range.insertNode(div);
            const newRange = doc.createRange();
            newRange.setStart(div.firstChild, 1);
            newRange.setEnd(div.firstChild, 1);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          const event = new Event("input", { bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          return;
        } else {
          hadSelectedText = !!selectedText;
          textToInsert = selectedText ? `[center]${selectedText}[/center]` : "[center][/center]";
        }
      } else if (tool.customAction === "sizePicker") {
        SNEED.ui.showSizePicker(input, selection, range, doc);
        return;
      } else if (tool.customAction === "colorPicker") {
        SNEED.ui.showColorPicker(input, selection, range, doc);
        return;
      } else if (tool.customAction === "rainbowText") {
        const selectedText = selection.toString();
        if (!selectedText) return;
        const chars = [...selectedText];
        const charCount = chars.filter((c) => c.trim()).length;
        if (SNEED.state.isWysiwygMode()) {
          const fragment = doc.createDocumentFragment();
          let colorIndex = 0;
          for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (char.trim() === "") {
              fragment.appendChild(doc.createTextNode(char));
            } else {
              const hue = Math.floor(colorIndex / charCount * 360);
              const hex = hslToHex(hue, 100, 50);
              const span = doc.createElement("span");
              span.style.color = hex;
              span.setAttribute("data-bbcode-color", hex);
              span.textContent = char;
              fragment.appendChild(span);
              colorIndex++;
            }
          }
          range.deleteContents();
          range.insertNode(fragment);
          selection.removeAllRanges();
          const event = new Event("input", { bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          return;
        } else {
          let result = "";
          let colorIndex = 0;
          for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (char.trim() === "") {
              result += char;
            } else {
              const hue = Math.floor(colorIndex / charCount * 360);
              const hex = hslToHex(hue, 100, 50);
              result += `[color=${hex}]${char}[/color]`;
              colorIndex++;
            }
          }
          textToInsert = result;
          hadSelectedText = true;
        }
      } else if (tool.customAction === "toggleWysiwyg") {
        const wasWysiwyg = SNEED.state.isWysiwygMode();
        const isWysiwyg = SNEED.state.toggleWysiwygMode();
        if (SNEED.core.storage && SNEED.core.storage.saveWysiwygMode) {
          SNEED.core.storage.saveWysiwygMode(isWysiwyg);
        }
        if (SNEED.core.bbcode) {
          if (wasWysiwyg && !isWysiwyg) {
            const hasFormatting = input.querySelector("strong, b, em, i, u, s, strike, del, code, div[data-bbcode-center], span[data-bbcode-size], span[data-bbcode-color], img[data-bbcode-img]");
            if (hasFormatting) {
              const bbcode = SNEED.core.bbcode.convertToBBCode(input);
              input.textContent = bbcode;
            }
          } else if (!wasWysiwyg && isWysiwyg) {
            const text = input.textContent || "";
            if (/\[(b|i|u|s|code|center|size|color|img)\b/i.test(text)) {
              const html = SNEED.core.bbcode.convertToHTML(text);
              input.innerHTML = html;
            }
          }
        }
        const toggleBtn = doc.querySelector('[data-tool="WysiwygToggle"]');
        if (toggleBtn) {
          toggleBtn.style.opacity = isWysiwyg ? "0.5" : "1";
          toggleBtn.title = isWysiwyg ? "WYSIWYG mode (click for raw BBCode)" : "Raw BBCode mode (click for WYSIWYG)";
        }
        const event = new Event("input", { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        return;
      } else if (tool.customAction === "blacklistManager") {
        SNEED.ui.showBlacklistManager(doc);
        return;
      } else if (tool.customAction === "emoteManager") {
        SNEED.ui.showEmoteManager(doc);
        return;
      } else if (tool.insertText) {
        textToInsert = tool.insertText;
      } else if (tool.startTag || tool.endTag) {
        const selectedText = selection.toString();
        hadSelectedText = !!selectedText;
        const hasStartTag = !!tool.startTag;
        const hasEndTag = !!tool.endTag;
        const isPairedTag = hasStartTag && hasEndTag;
        if (selectedText) {
          const startsWithTag = hasStartTag && selectedText.startsWith(tool.startTag);
          const endsWithTag = hasEndTag && selectedText.endsWith(tool.endTag);
          if (isPairedTag && startsWithTag && endsWithTag) {
            textToInsert = selectedText.slice(tool.startTag.length, -tool.endTag.length);
          } else if (!isPairedTag && hasStartTag && startsWithTag) {
            textToInsert = selectedText.slice(tool.startTag.length);
          } else if (!isPairedTag && hasEndTag && endsWithTag) {
            textToInsert = selectedText.slice(0, -tool.endTag.length);
          } else {
            const prefix = tool.startTag || "";
            const suffix = tool.endTag || "";
            textToInsert = prefix + selectedText + suffix;
          }
        } else {
          const prefix = tool.startTag || "";
          const suffix = tool.endTag || "";
          textToInsert = prefix + suffix;
        }
      }
      if (textToInsert !== void 0) {
        const textNode = doc.createTextNode(textToInsert);
        range.deleteContents();
        range.insertNode(textNode);
        if (tool.startTag && tool.endTag && !hadSelectedText) {
          const position = tool.startTag.length;
          range.setStart(textNode, position);
          range.setEnd(textNode, position);
        } else if (tool.startTag && !tool.endTag) {
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
        } else {
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        const event = new Event("input", { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
      }
      input.focus();
    }
    function insertEmote(emoteCode, doc) {
      const input = doc.getElementById("new-message-input");
      if (input && input.contentEditable === "true") {
        input.focus();
        const win = doc.defaultView || window;
        const selection = win.getSelection();
        let range;
        if (selection.rangeCount === 0) {
          range = doc.createRange();
          range.selectNodeContents(input);
          range.collapse(false);
          selection.addRange(range);
        } else {
          range = selection.getRangeAt(0);
        }
        const textNode = doc.createTextNode(emoteCode);
        range.deleteContents();
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        const event = new Event("input", { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        input.focus();
      }
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.applyFormatting = applyFormatting;
    SNEED.features.insertEmote = insertEmote;
  })();

  // src/features/input.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const state = SNEED.state;
    const { addManagedEventListener, addManagedObserver, ensureSendWatcher, setResizeCache, getResizeCache } = SNEED.core.events;
    function expandEveryone(inputElement) {
      const list = SNEED.state.getEveryoneList();
      if (!list || list.length === 0) return;
      const text = inputElement.textContent || "";
      if (!text.includes("@everyone")) return;
      const mentions = list.map((u) => "@" + u).join(" ");
      const walker = document.createTreeWalker(inputElement, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes("@everyone")) {
          node.textContent = node.textContent.replace(/@everyone/g, mentions);
        }
      }
    }
    function convertInputToBBCode(inputElement, doc) {
      if (!SNEED.core.bbcode) {
        return;
      }
      const hasFormatting = inputElement.querySelector("strong, b, em, i, u, s, strike, del, code, div[data-bbcode-center], span[data-bbcode-size], span[data-bbcode-color], img[data-bbcode-img]");
      if (!hasFormatting) {
        return;
      }
      const bbcode = SNEED.core.bbcode.convertToBBCode(inputElement);
      inputElement.textContent = bbcode;
      SNEED.util.positionCursorAtEnd(doc, inputElement);
    }
    function attachPreSubmitHandlers(inputElement, doc) {
      if (inputElement.hasAttribute("data-bbcode-convert-handler")) {
        return;
      }
      inputElement.setAttribute("data-bbcode-convert-handler", "true");
      addManagedEventListener(inputElement, "keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          expandEveryone(inputElement);
          convertInputToBBCode(inputElement, doc);
        }
      }, true);
      const messageForm = doc.getElementById("new-message-form");
      if (messageForm && !messageForm.hasAttribute("data-bbcode-submit-handler")) {
        messageForm.setAttribute("data-bbcode-submit-handler", "true");
        addManagedEventListener(messageForm, "submit", (e) => {
          expandEveryone(inputElement);
          convertInputToBBCode(inputElement, doc);
        }, true);
      }
    }
    function createOptimizedResizer(inputElement, doc) {
      let raf = 0;
      let baseHeight = 0;
      function resizeInput() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          raf = 0;
          const txt = (inputElement.textContent || "").trim();
          const hasImages = inputElement.querySelector("img");
          if (!txt && !hasImages) {
            inputElement.style.height = "";
            baseHeight = 0;
            return;
          }
          if (!baseHeight) {
            baseHeight = inputElement.offsetHeight;
          }
          inputElement.style.height = "auto";
          const scrollH = inputElement.scrollHeight;
          if (scrollH > baseHeight) {
            const newH = Math.min(state.CONFIG.MAX_INPUT_HEIGHT, scrollH);
            inputElement.style.height = newH + "px";
          } else {
            inputElement.style.height = "";
          }
        });
      }
      function cleanup() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        baseHeight = 0;
      }
      setResizeCache(inputElement, { resizeInput, cleanup });
      return { resizeInput, cleanup };
    }
    function createShiftEnterHandler(doc) {
      return function(e) {
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const win = doc.defaultView || window;
          const selection = win.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textNode = doc.createTextNode("\n");
            range.deleteContents();
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            const inputElement = e.target;
            const event = new Event("input", { bubbles: true, cancelable: true });
            inputElement.dispatchEvent(event);
          }
          return false;
        }
      };
    }
    function attachShiftEnterHandler(inputElement, doc) {
      if (!inputElement || inputElement.hasAttribute("data-shift-enter-handler")) {
        return;
      }
      inputElement.setAttribute("data-shift-enter-handler", "true");
      const handler = createShiftEnterHandler(doc);
      addManagedEventListener(inputElement, "keydown", handler, true);
    }
    const CHAR_LIMIT = 1023;
    function updateCharacterWarning(inputElement, doc) {
      const messageForm = doc.getElementById("new-message-form");
      if (!messageForm) return;
      const charCount = (inputElement.textContent || "").length;
      let warning = doc.getElementById("sneed-char-warning");
      if (charCount > CHAR_LIMIT) {
        if (!warning) {
          warning = doc.createElement("div");
          warning.id = "sneed-char-warning";
          warning.style.cssText = `
                    color: #ff4444;
                    font-size: 11px;
                    text-align: right;
                    padding: 2px 4px 0 0;
                    margin-top: 2px;
                `;
          messageForm.appendChild(warning);
        }
        warning.textContent = `${charCount}/${CHAR_LIMIT} characters (${charCount - CHAR_LIMIT} over limit)`;
        warning.style.display = "block";
      } else if (warning) {
        warning.style.display = "none";
      }
    }
    function showSendFailureIndicator(doc) {
      if (doc.getElementById("send-failure-indicator")) return;
      const indicator = doc.createElement("div");
      indicator.id = "send-failure-indicator";
      indicator.textContent = "Message failed to send - content restored";
      indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInOut 3s ease-in-out;
        `;
      if (!doc.getElementById("send-failure-animation")) {
        const style = doc.createElement("style");
        style.id = "send-failure-animation";
        style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(20px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(20px); }
                }
            `;
        doc.head.appendChild(style);
      }
      doc.body.appendChild(indicator);
      setTimeout(() => {
        indicator.remove();
      }, 3e3);
    }
    function addEmoteToggleButton(doc) {
      const buttonsContainer = doc.querySelector(".chat-form-buttons");
      const submitButton = doc.getElementById("new-message-submit");
      const inputElement = doc.getElementById("new-message-input");
      if (!buttonsContainer || !submitButton || !inputElement || doc.getElementById("emote-toggle-button")) {
        return;
      }
      submitButton.style.display = "none";
      inputElement.style.maxHeight = state.CONFIG.MAX_INPUT_HEIGHT + "px";
      inputElement.style.overflowY = "auto";
      inputElement.style.resize = "none";
      const { resizeInput } = createOptimizedResizer(inputElement, doc);
      addManagedEventListener(inputElement, "input", () => {
        resizeInput();
        updateCharacterWarning(inputElement, doc);
      });
      addManagedEventListener(inputElement, "paste", () => setTimeout(() => {
        resizeInput();
        updateCharacterWarning(inputElement, doc);
      }, 0));
      if (!inputElement.hasAttribute("data-observer-attached")) {
        const observer = new MutationObserver(() => {
          if (!inputElement.textContent || inputElement.textContent.trim() === "") {
            setTimeout(() => {
              inputElement.style.height = "auto";
              resizeInput();
              updateCharacterWarning(inputElement, doc);
            }, 50);
          }
        });
        observer.observe(inputElement, { childList: true, characterData: true, subtree: true });
        addManagedObserver(inputElement, observer);
        inputElement.setAttribute("data-observer-attached", "true");
        inputElement._resizeObserver = observer;
      }
      const messageForm = doc.getElementById("new-message-form");
      if (messageForm && !messageForm.__sneed_submit_handler) {
        messageForm.__sneed_submit_handler = true;
        const watcher = ensureSendWatcher(doc);
        addManagedEventListener(messageForm, "submit", (e) => {
          const lastMessageContent = inputElement.innerHTML || "";
          const lastMessageText = inputElement.textContent || "";
          if (lastMessageText.length > CHAR_LIMIT) {
            e.preventDefault();
            e.stopPropagation();
            SNEED.log.warn(`Message blocked: ${lastMessageText.length} characters exceeds ${CHAR_LIMIT} limit`);
            return false;
          }
          watcher.arm({
            text: lastMessageText,
            html: lastMessageContent,
            time: Date.now(),
            onConfirm: () => {
              SNEED.log.info("Message confirmed in chat");
              inputElement.style.height = "auto";
              resizeInput();
            },
            onFail: () => {
              const connectionLost = doc.querySelector('.connection-lost, .connecting, [class*="connecting"], [class*="reconnect"]');
              const inputCleared = inputElement.textContent.trim() === "";
              if (inputCleared && connectionLost) {
                SNEED.log.info("Message did not appear in chat - restoring content");
                if (inputElement.contentEditable === "true") {
                  inputElement.innerHTML = lastMessageContent;
                } else {
                  inputElement.textContent = lastMessageText;
                }
                inputElement.focus();
                SNEED.util.positionCursorAtEnd(doc, inputElement);
                resizeInput();
                showSendFailureIndicator(doc);
              } else if (!inputCleared) {
                SNEED.log.info("Message still in input - send may have been blocked");
              }
            }
          });
        });
      }
      attachShiftEnterHandler(inputElement, doc);
      attachPreSubmitHandlers(inputElement, doc);
      if (!inputElement.hasAttribute("data-enter-resize-handler")) {
        inputElement.setAttribute("data-enter-resize-handler", "true");
        addManagedEventListener(inputElement, "keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            const charCount = (inputElement.textContent || "").length;
            if (charCount > CHAR_LIMIT) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              SNEED.log.warn(`Message blocked: ${charCount} characters exceeds ${CHAR_LIMIT} limit`);
              return false;
            }
            setTimeout(resizeInput, 0);
          }
        }, true);
      }
      resizeInput();
      const emoteToggleBtn = SNEED.ui.createEmoteToggleButton(doc);
      emoteToggleBtn.style.position = "absolute";
      emoteToggleBtn.style.right = "8px";
      emoteToggleBtn.style.top = "50%";
      emoteToggleBtn.style.transform = "translateY(-50%)";
      emoteToggleBtn.style.zIndex = "10";
      const inputContainer = inputElement.parentElement;
      if (inputContainer) {
        inputContainer.style.position = "relative";
        inputContainer.appendChild(emoteToggleBtn);
        inputElement.style.paddingRight = "50px";
      }
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.createOptimizedResizer = createOptimizedResizer;
    SNEED.features.createShiftEnterHandler = createShiftEnterHandler;
    SNEED.features.attachShiftEnterHandler = attachShiftEnterHandler;
    SNEED.features.showSendFailureIndicator = showSendFailureIndicator;
    SNEED.features.addEmoteToggleButton = addEmoteToggleButton;
    SNEED.features.convertInputToBBCode = convertInputToBBCode;
    SNEED.features.attachPreSubmitHandlers = attachPreSubmitHandlers;
  })();

  // src/features/blacklist-filter.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const storage = SNEED.core.storage;
    const events = SNEED.core.events;
    const util = SNEED.util;
    const log = SNEED.log;
    function filterBlacklistedImages(element) {
      if (!element || element.nodeType !== 1) return;
      const images = element.querySelectorAll("img");
      images.forEach((img) => {
        if (img.dataset.blacklistChecked) return;
        img.dataset.blacklistChecked = "true";
        const src = img.src || img.getAttribute("src");
        if (src && storage.isBlacklistedSync(src)) {
          img.style.display = "none";
          img.dataset.blacklisted = "true";
          log.info("Filtered blacklisted image:", src);
        }
      });
    }
    function scanExistingMessages(doc) {
      const container = util.findMessageContainer(doc);
      if (container) {
        filterBlacklistedImages(container);
      }
    }
    function startBlacklistFilter(doc) {
      if (doc.__sneed_blacklistFilter) return;
      const container = util.findMessageContainer(doc);
      if (!container) {
        log.warn("Could not find message container for blacklist filter");
        return;
      }
      scanExistingMessages(doc);
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              filterBlacklistedImages(node);
            }
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      events.addManagedObserver(container, observer);
      doc.__sneed_blacklistFilter = true;
      log.info("Blacklist filter started");
    }
    function rescanMessages(doc) {
      const container = util.findMessageContainer(doc);
      if (!container) return;
      const images = container.querySelectorAll("img[data-blacklist-checked]");
      images.forEach((img) => {
        delete img.dataset.blacklistChecked;
        const src = img.src || img.getAttribute("src");
        if (src && storage.isBlacklistedSync(src)) {
          img.style.display = "none";
          img.dataset.blacklisted = "true";
        } else if (img.dataset.blacklisted) {
          img.style.display = "";
          delete img.dataset.blacklisted;
        }
      });
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.startBlacklistFilter = startBlacklistFilter;
    SNEED.features.rescanMessages = rescanMessages;
  })();

  // src/features/watched-users.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const events = SNEED.core.events;
    const storage = SNEED.core.storage;
    const log = SNEED.log;
    const DEFAULT_WATCHED_USERS = ["Null"];
    let watchedUsersCache = null;
    let watchedUsersLowerCache = null;
    async function getWatchedUsers() {
      if (watchedUsersCache) return watchedUsersCache;
      try {
        const stored = await storage.getWatchedUsers();
        watchedUsersCache = stored || [...DEFAULT_WATCHED_USERS];
        watchedUsersLowerCache = watchedUsersCache.map((u) => u.toLowerCase());
        return watchedUsersCache;
      } catch (e) {
        log.error("Failed to load watched users:", e);
        watchedUsersCache = [...DEFAULT_WATCHED_USERS];
        watchedUsersLowerCache = watchedUsersCache.map((u) => u.toLowerCase());
        return watchedUsersCache;
      }
    }
    async function saveWatchedUsers(users) {
      try {
        await storage.saveWatchedUsers(users);
        watchedUsersCache = users;
        watchedUsersLowerCache = users.map((u) => u.toLowerCase());
      } catch (e) {
        log.error("Failed to save watched users:", e);
      }
    }
    function isWatchedUser(username) {
      if (!watchedUsersLowerCache) return false;
      return watchedUsersLowerCache.includes(username.toLowerCase());
    }
    function createWatchedUsersPanel(doc) {
      const panel = doc.createElement("div");
      panel.id = "sneed-watched-users";
      panel.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 6px 8px;
            display: none;
        `;
      const header = doc.createElement("div");
      header.style.cssText = `
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
      header.textContent = "Watched Users";
      panel.appendChild(header);
      const list = doc.createElement("div");
      list.id = "sneed-watched-users-list";
      list.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;
      panel.appendChild(list);
      return panel;
    }
    function updateWatchedUsersPanel(doc) {
      const chatActivity = doc.querySelector("#chat-activity");
      if (!chatActivity) return;
      let panel = doc.getElementById("sneed-watched-users");
      if (!panel) {
        panel = createWatchedUsersPanel(doc);
        chatActivity.insertBefore(panel, chatActivity.firstChild);
      }
      const list = doc.getElementById("sneed-watched-users-list");
      if (!list) return;
      const foundUsernames = /* @__PURE__ */ new Set();
      const foundElements = [];
      const userEntries = chatActivity.querySelectorAll(".activity[data-username]");
      for (const entry of userEntries) {
        const username = entry.dataset.username;
        if (!username) continue;
        const usernameLower = username.toLowerCase();
        if (isWatchedUser(username) && !foundUsernames.has(usernameLower)) {
          foundUsernames.add(usernameLower);
          foundElements.push(entry.cloneNode(true));
        }
      }
      list.innerHTML = "";
      if (foundElements.length > 0) {
        panel.style.display = "block";
        for (const element of foundElements) {
          element.style.cssText = `
                    background: rgba(255, 200, 0, 0.1);
                    border-left: 2px solid rgba(255, 200, 0, 0.5);
                    padding-left: 6px;
                    margin: 0;
                `;
          list.appendChild(element);
        }
      } else {
        panel.style.display = "none";
      }
    }
    let lastCursorRange = null;
    function trackCursorPosition(doc) {
      const input = doc.getElementById("new-message-input");
      if (!input) return;
      const saveCursor = () => {
        const win = doc.defaultView || window;
        const selection = win.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (input.contains(range.commonAncestorContainer) || input === range.commonAncestorContainer) {
            lastCursorRange = range.cloneRange();
          }
        }
      };
      events.addManagedEventListener(input, "keyup", saveCursor);
      events.addManagedEventListener(input, "mouseup", saveCursor);
      events.addManagedEventListener(input, "blur", saveCursor);
    }
    function insertMention(username, doc) {
      const input = doc.getElementById("new-message-input");
      if (!input) return;
      const mention = `@${username} `;
      if (input.contentEditable === "true") {
        const win = doc.defaultView || window;
        const selection = win.getSelection();
        input.focus();
        if (lastCursorRange) {
          selection.removeAllRanges();
          selection.addRange(lastCursorRange);
        }
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (input.contains(range.commonAncestorContainer) || input === range.commonAncestorContainer) {
            range.deleteContents();
            const textNode = doc.createTextNode(mention);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            lastCursorRange = range.cloneRange();
          } else {
            input.focus();
            const range2 = doc.createRange();
            range2.selectNodeContents(input);
            range2.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range2);
            doc.execCommand("insertText", false, mention);
          }
        } else {
          input.textContent += mention;
        }
      } else {
        input.value += mention;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function setupActivityClickToMention(chatActivity, doc) {
      trackCursorPosition(doc);
      events.addManagedEventListener(chatActivity, "click", (e) => {
        var _a, _b;
        const userLink = e.target.closest(".activity a.user");
        if (!userLink) return;
        e.preventDefault();
        e.stopPropagation();
        const activityEl = userLink.closest(".activity");
        const username = ((_a = activityEl == null ? void 0 : activityEl.dataset) == null ? void 0 : _a.username) || ((_b = userLink.textContent) == null ? void 0 : _b.trim());
        if (username) {
          insertMention(username, doc);
          log.info(`Inserted mention for: ${username}`);
        }
      });
    }
    async function startWatchedUsers(doc) {
      if (doc.__sneed_watchedUsers) return;
      const chatActivity = doc.querySelector("#chat-activity");
      if (!chatActivity) {
        log.warn("Could not find chat-activity for watched users");
        return;
      }
      await getWatchedUsers();
      updateWatchedUsersPanel(doc);
      setupActivityClickToMention(chatActivity, doc);
      let debounceTimer = null;
      const debouncedUpdate = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          updateWatchedUsersPanel(doc);
        }, 250);
      };
      const observer = new MutationObserver(debouncedUpdate);
      observer.observe(chatActivity, { childList: true });
      events.addManagedObserver(chatActivity, observer);
      doc.__sneed_watchedUsers = {
        cleanup: () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          observer.disconnect();
          const panel = doc.getElementById("sneed-watched-users");
          if (panel) panel.remove();
        }
      };
      log.info("Watched users feature started");
    }
    function stopWatchedUsers(doc) {
      if (doc.__sneed_watchedUsers && doc.__sneed_watchedUsers.cleanup) {
        doc.__sneed_watchedUsers.cleanup();
        doc.__sneed_watchedUsers = null;
        log.info("Watched users feature stopped");
      }
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.startWatchedUsers = startWatchedUsers;
    SNEED.features.stopWatchedUsers = stopWatchedUsers;
    SNEED.features.getWatchedUsers = getWatchedUsers;
    SNEED.features.saveWatchedUsers = saveWatchedUsers;
    SNEED.features.updateWatchedUsersPanel = updateWatchedUsersPanel;
  })();

  // src/features/youtube-titles.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const YOUTUBE_PATTERNS = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    const titleCache = /* @__PURE__ */ new Map();
    const initializedDocs = /* @__PURE__ */ new WeakSet();
    function extractVideoId(url) {
      for (const pattern of YOUTUBE_PATTERNS) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    }
    function getVideoUrl(videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    let contextValid = true;
    function isExtensionContextValid() {
      try {
        return contextValid && chrome.runtime && !!chrome.runtime.id;
      } catch (e) {
        contextValid = false;
        return false;
      }
    }
    async function fetchVideoTitle(videoUrl) {
      if (!isExtensionContextValid()) {
        return null;
      }
      if (titleCache.has(videoUrl)) {
        return titleCache.get(videoUrl);
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: "fetchYouTubeInfo",
          videoUrl
        });
        if (response && response.success) {
          const info = {
            title: response.title,
            author: response.author
          };
          titleCache.set(videoUrl, info);
          return info;
        }
      } catch (e) {
        if (e.message && e.message.includes("Extension context invalidated")) {
          contextValid = false;
          console.log("[KEES] Extension was reloaded, YouTube titles disabled for this page");
        } else {
          console.error("[KEES] Failed to fetch YouTube title:", e);
        }
      }
      return null;
    }
    function createTitleDisplay(doc, title, author, videoUrl) {
      const container = doc.createElement("div");
      container.className = "kees-youtube-title";
      container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
            border: 1px solid #333;
            border-left: 3px solid #ff0000;
            border-radius: 4px;
            margin: 4px 0;
            max-width: 450px;
            text-decoration: none;
            transition: all 0.15s ease;
        `;
      const link = doc.createElement("a");
      link.href = videoUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: inherit;
            width: 100%;
        `;
      const icon = doc.createElement("div");
      icon.style.cssText = `
            width: 36px;
            height: 26px;
            background: #ff0000;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;
      icon.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
      const textContent = doc.createElement("div");
      textContent.style.cssText = "overflow: hidden; flex: 1; min-width: 0;";
      const titleEl = doc.createElement("div");
      titleEl.style.cssText = `
            font-weight: 500;
            font-size: 13px;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
      titleEl.textContent = title;
      titleEl.title = title;
      const authorEl = doc.createElement("div");
      authorEl.style.cssText = "font-size: 11px; color: #888; margin-top: 1px;";
      authorEl.textContent = author;
      textContent.appendChild(titleEl);
      textContent.appendChild(authorEl);
      link.appendChild(icon);
      link.appendChild(textContent);
      container.appendChild(link);
      container.addEventListener("mouseenter", () => {
        container.style.background = "linear-gradient(135deg, #252525 0%, #303030 100%)";
        container.style.borderLeftColor = "#ff3333";
      });
      container.addEventListener("mouseleave", () => {
        container.style.background = "linear-gradient(135deg, #1a1a1a 0%, #252525 100%)";
        container.style.borderLeftColor = "#ff0000";
      });
      return container;
    }
    async function processLink(doc, link) {
      if (link.dataset.keesYoutubeProcessed) return;
      if (link.closest(".kees-youtube-title")) return;
      link.dataset.keesYoutubeProcessed = "true";
      const videoId = extractVideoId(link.href);
      if (!videoId) return;
      const videoUrl = getVideoUrl(videoId);
      const info = await fetchVideoTitle(videoUrl);
      if (!info) return;
      console.log("[KEES] YouTube title:", info.title);
      const titleDisplay = createTitleDisplay(doc, info.title, info.author, link.href);
      const wrapper = doc.createElement("div");
      wrapper.style.cssText = "display: block;";
      wrapper.appendChild(titleDisplay);
      if (link.nextSibling) {
        link.parentNode.insertBefore(wrapper, link.nextSibling);
      } else {
        link.parentNode.appendChild(wrapper);
      }
    }
    function processAllLinks(doc) {
      const links = doc.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
      console.log("[KEES] Found", links.length, "YouTube links");
      links.forEach((link) => processLink(doc, link));
    }
    function setupObserver(doc) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches('a[href*="youtube.com"], a[href*="youtu.be"]')) {
                processLink(doc, node);
              }
              const links = node.querySelectorAll ? node.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]') : [];
              links.forEach((link) => processLink(doc, link));
            }
          }
        }
      });
      observer.observe(doc.body, {
        childList: true,
        subtree: true
      });
      return observer;
    }
    function start(doc) {
      if (!doc || initializedDocs.has(doc)) return;
      initializedDocs.add(doc);
      processAllLinks(doc);
      setupObserver(doc);
      console.log("[KEES] YouTube titles started");
    }
    function init() {
      console.log("[KEES] YouTube titles module loaded");
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.youtubeTitles = {
      init,
      start,
      processLink,
      fetchVideoTitle
    };
    init();
  })();

  // src/features/double-click-edit.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const MESSAGE_SELECTOR = ".chat-message";
    const EDIT_BUTTON_SELECTOR = ".button.edit";
    const initializedDocs = /* @__PURE__ */ new WeakSet();
    function handleDoubleClick(doc, e) {
      const message = e.target.closest(MESSAGE_SELECTOR);
      if (!message) return;
      if (e.target.closest("a, button, .button")) return;
      const editButton = message.querySelector(EDIT_BUTTON_SELECTOR);
      if (!editButton) return;
      editButton.click();
    }
    function start(doc) {
      if (!doc || initializedDocs.has(doc)) return;
      initializedDocs.add(doc);
      doc.body.addEventListener("dblclick", (e) => handleDoubleClick(doc, e));
    }
    function init() {
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.doubleClickEdit = { init, start };
    init();
  })();

  // src/features/zipline-upload.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const STORAGE_KEY_ENABLED = "kees-zipline-enabled";
    const STORAGE_KEY_STRIP_EXIF = "kees-zipline-strip-exif";
    const initializedDocs = /* @__PURE__ */ new WeakSet();
    let stripExifEnabled = true;
    function createUploadButton(doc) {
      const btn = doc.createElement("button");
      btn.id = "zipline-upload-button";
      btn.type = "button";
      btn.title = "Upload media to Zipline";
      btn.style.cssText = `
            background: transparent;
            border: none;
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
            margin-right: 4px;
        `;
      const svgNS = "http://www.w3.org/2000/svg";
      function createUploadIcon() {
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.style.color = "#888";
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
        const polyline = document.createElementNS(svgNS, "polyline");
        polyline.setAttribute("points", "17 8 12 3 7 8");
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", "12");
        line.setAttribute("y1", "3");
        line.setAttribute("x2", "12");
        line.setAttribute("y2", "15");
        svg.appendChild(path);
        svg.appendChild(polyline);
        svg.appendChild(line);
        return svg;
      }
      btn.appendChild(createUploadIcon());
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "rgba(255,255,255,0.1)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "transparent";
      });
      return btn;
    }
    function createFileInput(doc) {
      const input = doc.createElement("input");
      input.type = "file";
      input.id = "zipline-file-input";
      input.accept = "image/*,video/*,audio/*";
      input.style.display = "none";
      return input;
    }
    async function stripExifData(file) {
      if (!file.type.startsWith("image/") || file.type === "image/gif") {
        return file;
      }
      try {
        const img = await createImageBitmap(file);
        let canvas, ctx;
        if (typeof OffscreenCanvas !== "undefined") {
          canvas = new OffscreenCanvas(img.width, img.height);
          ctx = canvas.getContext("2d");
        } else {
          canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx = canvas.getContext("2d");
        }
        ctx.drawImage(img, 0, 0);
        let outputType = file.type;
        let quality = 0.92;
        if (file.type === "image/png") {
          outputType = "image/png";
          quality = void 0;
        } else if (file.type === "image/webp") {
          outputType = "image/webp";
          quality = 0.92;
        } else {
          outputType = "image/jpeg";
          quality = 0.92;
        }
        let blob;
        if (canvas.convertToBlob) {
          blob = await canvas.convertToBlob({ type: outputType, quality });
        } else {
          blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, outputType, quality);
          });
        }
        const newFile = new File([blob], file.name, { type: outputType });
        console.log(`[KEES] Stripped EXIF: ${file.size} -> ${newFile.size} bytes`);
        return newFile;
      } catch (e) {
        console.warn("[KEES] Failed to strip EXIF, using original:", e);
        return file;
      }
    }
    async function handleFileSelect(file, doc) {
      if (!file) return;
      const inputElement = doc.getElementById("new-message-input");
      if (!inputElement) return;
      const uploadBtn = doc.getElementById("zipline-upload-button");
      const originalChildren = Array.from(uploadBtn.childNodes).map((n) => n.cloneNode(true));
      const spinSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      spinSvg.setAttribute("width", "24");
      spinSvg.setAttribute("height", "24");
      spinSvg.setAttribute("viewBox", "0 0 24 24");
      spinSvg.setAttribute("fill", "none");
      spinSvg.setAttribute("stroke", "currentColor");
      spinSvg.setAttribute("stroke-width", "2");
      spinSvg.style.cssText = "color: #888; animation: spin 1s linear infinite;";
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      circle.setAttribute("stroke-dasharray", "30 60");
      spinSvg.appendChild(circle);
      uploadBtn.replaceChildren(spinSvg);
      uploadBtn.disabled = true;
      if (!doc.getElementById("kees-spin-style")) {
        const style = doc.createElement("style");
        style.id = "kees-spin-style";
        style.textContent = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
        doc.head.appendChild(style);
      }
      try {
        let processedFile = file;
        if (stripExifEnabled && file.type.startsWith("image/")) {
          processedFile = await stripExifData(file);
        }
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(processedFile);
        });
        const runtime = getRuntime();
        if (!runtime || !runtime.sendMessage) {
          throw new Error("Extension runtime not available. Try refreshing the page.");
        }
        const response = await runtime.sendMessage({
          type: "uploadToZipline",
          fileData: base64,
          fileName: processedFile.name,
          mimeType: processedFile.type
        });
        if (response.success) {
          const url = response.url;
          const isImage = processedFile.type.startsWith("image/");
          const textToInsert = isImage ? `[img]${url}[/img] ` : `${url} `;
          if (inputElement.contentEditable === "true") {
            inputElement.focus();
            const win = doc.defaultView || window;
            const selection = win.getSelection();
            let range;
            if (selection.rangeCount === 0) {
              range = doc.createRange();
              range.selectNodeContents(inputElement);
              range.collapse(false);
              selection.addRange(range);
            } else {
              range = selection.getRangeAt(0);
            }
            const textNode = doc.createTextNode(textToInsert);
            range.deleteContents();
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            inputElement.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            inputElement.value += textToInsert;
          }
          console.log("[KEES] Zipline upload successful:", url, isImage ? "(image)" : "");
        } else {
          console.error("[KEES] Zipline upload failed:", response.error);
          alert("Upload failed: " + response.error);
        }
      } catch (e) {
        console.error("[KEES] Zipline upload error:", e);
        alert("Upload failed: " + e.message);
      } finally {
        uploadBtn.replaceChildren(...originalChildren);
        uploadBtn.disabled = false;
      }
    }
    function getRuntime() {
      if (typeof chrome !== "undefined" && chrome.runtime) return chrome.runtime;
      if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
      return null;
    }
    function getStorage() {
      if (typeof chrome !== "undefined" && chrome.storage) return chrome.storage;
      if (typeof browser !== "undefined" && browser.storage) return browser.storage;
      return null;
    }
    async function start(doc) {
      if (!doc || initializedDocs.has(doc)) return;
      const storage = getStorage();
      if (!storage) {
        console.log("[KEES] Storage API not available");
        return;
      }
      const settings = await new Promise((resolve) => {
        storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_STRIP_EXIF], resolve);
      });
      if (!settings[STORAGE_KEY_ENABLED]) {
        console.log("[KEES] Zipline upload disabled");
        return;
      }
      stripExifEnabled = settings[STORAGE_KEY_STRIP_EXIF] !== false;
      storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEY_STRIP_EXIF]) {
          stripExifEnabled = changes[STORAGE_KEY_STRIP_EXIF].newValue !== false;
        }
      });
      initializedDocs.add(doc);
      const checkForInput = () => {
        const inputElement = doc.getElementById("new-message-input");
        const inputContainer = inputElement == null ? void 0 : inputElement.parentElement;
        if (!inputContainer || doc.getElementById("zipline-upload-button")) {
          return;
        }
        const uploadBtn = createUploadButton(doc);
        const fileInput = createFileInput(doc);
        uploadBtn.style.position = "absolute";
        uploadBtn.style.right = "40px";
        uploadBtn.style.top = "50%";
        uploadBtn.style.transform = "translateY(-50%)";
        uploadBtn.style.zIndex = "10";
        uploadBtn.addEventListener("click", () => {
          fileInput.click();
        });
        fileInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (file) {
            handleFileSelect(file, doc);
            fileInput.value = "";
          }
        });
        inputContainer.appendChild(uploadBtn);
        inputContainer.appendChild(fileInput);
        inputElement.style.paddingRight = "80px";
        console.log("[KEES] Zipline upload button added");
      };
      checkForInput();
      setTimeout(checkForInput, 500);
      setTimeout(checkForInput, 1e3);
    }
    function init() {
      console.log("[KEES] Zipline upload module loaded");
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.ziplineUpload = {
      init,
      start
    };
    init();
  })();

  // src/features/mention-notifications.js
  (function() {
    "use strict";
    const SNEED = window.SNEED || {};
    window.SNEED = SNEED;
    const STORAGE_KEY_ENABLED = "kees-mention-notifications";
    const STORAGE_KEY_SHOW_BODY = "kees-mention-show-body";
    const MENTION_SELECTOR = ".chat-message--highlightYou";
    const initializedDocs = /* @__PURE__ */ new WeakSet();
    const processedMessages = /* @__PURE__ */ new WeakSet();
    let isEnabled = false;
    let showBody = false;
    function checkForMention(messageElement, doc) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
      if (!isEnabled) return;
      if (processedMessages.has(messageElement)) return;
      processedMessages.add(messageElement);
      if (!messageElement.classList.contains("chat-message--highlightYou")) return;
      let author = ((_b = (_a = messageElement.querySelector(".chat-user-name")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_d = (_c = messageElement.querySelector(".username")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || ((_f = (_e = messageElement.querySelector('[class*="user"]')) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim());
      let content = ((_h = (_g = messageElement.querySelector(".chat-message-content")) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim()) || ((_j = (_i = messageElement.querySelector(".message-content")) == null ? void 0 : _i.textContent) == null ? void 0 : _j.trim()) || ((_l = (_k = messageElement.querySelector(".content")) == null ? void 0 : _k.textContent) == null ? void 0 : _l.trim()) || ((_m = messageElement.textContent) == null ? void 0 : _m.trim()) || "";
      sendNotification(author || "Someone", content, doc);
    }
    function sendNotification(author, content, doc) {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        Notification.requestPermission();
        return;
      }
      if (Notification.permission !== "granted") return;
      const docHasFocus = doc.hasFocus();
      let parentHasFocus = false;
      try {
        parentHasFocus = window.parent && window.parent.document.hasFocus();
      } catch (e) {
      }
      if (docHasFocus || parentHasFocus) return;
      let body = "";
      if (showBody && content) {
        body = content.length > 150 ? content.substring(0, 150) + "..." : content;
      }
      const notification = new Notification(`${author} mentioned you in chat`, {
        body,
        icon: "https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png",
        tag: "kees-mention-" + Date.now(),
        requireInteraction: false
      });
      notification.onclick = () => {
        window.focus();
        if (window.parent) window.parent.focus();
        notification.close();
      };
      setTimeout(() => notification.close(), 5e3);
    }
    function setupObserver(doc) {
      const chatContainer = doc.querySelector(".chat-messages, .chat-box, #chat-messages");
      if (!chatContainer) {
        console.log("[KEES] Chat container not found for mention observer");
        return;
      }
      const existingMessages = chatContainer.querySelectorAll(".chat-message");
      existingMessages.forEach((msg) => processedMessages.add(msg));
      console.log("[KEES] Marked", existingMessages.length, "existing messages as processed");
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches && node.matches(".chat-message")) {
              checkForMention(node, doc);
            } else if (node.querySelectorAll) {
              const messages = node.querySelectorAll(".chat-message");
              messages.forEach((msg) => checkForMention(msg, doc));
            }
          }
        }
      });
      observer.observe(chatContainer, {
        childList: true,
        subtree: true
      });
      console.log("[KEES] Mention notification observer started");
    }
    async function start(doc) {
      if (!doc || initializedDocs.has(doc)) return;
      initializedDocs.add(doc);
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_SHOW_BODY], resolve);
      });
      isEnabled = settings[STORAGE_KEY_ENABLED] === true;
      showBody = settings[STORAGE_KEY_SHOW_BODY] === true;
      if (!isEnabled) {
        console.log("[KEES] Mention notifications disabled");
      } else {
        console.log("[KEES] Mention notifications enabled, showBody:", showBody);
      }
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      setupObserver(doc);
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (changes[STORAGE_KEY_ENABLED]) {
            isEnabled = changes[STORAGE_KEY_ENABLED].newValue === true;
            console.log("[KEES] Mention notifications", isEnabled ? "enabled" : "disabled");
          }
          if (changes[STORAGE_KEY_SHOW_BODY]) {
            showBody = changes[STORAGE_KEY_SHOW_BODY].newValue === true;
            console.log("[KEES] Show body in notifications:", showBody);
          }
        }
      });
    }
    function init() {
      console.log("[KEES] Mention notifications module loaded");
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.mentionNotifications = {
      init,
      start
    };
    init();
  })();

  // src/features/mention-sort.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    let sorting = false;
    let pendingSort = false;
    function buildActivityMap(doc) {
      const activity = {};
      const messages = doc.querySelectorAll(".chat-message");
      messages.forEach((msg, i) => {
        const authorEl = msg.querySelector(".author");
        if (authorEl) {
          const username = (authorEl.textContent || "").trim().toLowerCase();
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
        const items = Array.from(dropdown.querySelectorAll(".mention-item"));
        if (items.length <= 1) return;
        items.sort((a, b) => {
          const userA = (a.dataset.username || "").toLowerCase();
          const userB = (b.dataset.username || "").toLowerCase();
          const timeA = activity[userA] ?? -1;
          const timeB = activity[userB] ?? -1;
          if (timeA !== timeB) return timeB - timeA;
          return userA.localeCompare(userB);
        });
        items.forEach((item) => dropdown.appendChild(item));
        items.forEach((item, i) => {
          item.classList.toggle("active", i === 0);
        });
      } finally {
        sorting = false;
      }
    }
    function sortWhenReady(doc, activity, attempts) {
      const dropdown = doc.querySelector(".mention-dropdown");
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
      const input = doc.getElementById("new-message-input");
      if (!input) return;
      SNEED.core.events.addManagedEventListener(input, "input", () => {
        if (pendingSort) return;
        const text = input.textContent || "";
        const atIdx = text.lastIndexOf("@");
        if (atIdx === -1) return;
        const afterAt = text.slice(atIdx + 1);
        if (afterAt.includes(" ")) return;
        pendingSort = true;
        const activity = buildActivityMap(doc);
        sortWhenReady(doc, activity, 0);
      });
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.mentionSort = { start };
  })();

  // src/features/whisper-box.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    let maxHistoryPerPartner = 100;
    const conversations = {};
    let activePartner = null;
    let boxElement = null;
    let currentDoc = null;
    let closed = false;
    let globalEnabled = false;
    let hideMainChat = true;
    let saveDebounceTimer = null;
    let savedPosition = null;
    let savedCollapsed = false;
    async function loadPosition() {
      try {
        const pos = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_POSITION);
        if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
          savedPosition = pos;
        }
      } catch (e) {
      }
    }
    function savePosition(pos) {
      savedPosition = pos;
      SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_POSITION, pos);
    }
    async function loadState() {
      try {
        const state = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_STATE);
        if (state && typeof state === "object") {
          savedCollapsed = state.collapsed === true;
          closed = state.closed === true;
        }
      } catch (e) {
      }
    }
    function saveState() {
      SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_STATE, {
        collapsed: savedCollapsed,
        closed
      });
    }
    async function loadRetention() {
      try {
        const val = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_RETENTION);
        if (val !== void 0 && val !== null) {
          maxHistoryPerPartner = parseInt(val, 10) || 0;
        }
      } catch (e) {
      }
    }
    async function loadGlobalState() {
      try {
        const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL);
        globalEnabled = result === true;
      } catch (e) {
        globalEnabled = false;
      }
    }
    async function loadHideMainState() {
      try {
        const result = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN);
        hideMainChat = result !== false;
      } catch (e) {
        hideMainChat = true;
      }
    }
    async function loadHistory() {
      if (!globalEnabled) return;
      try {
        const history = await SNEED.core.storage.getStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HISTORY);
        if (history && typeof history === "object") {
          for (const [partner, data] of Object.entries(history)) {
            if (!conversations[partner]) {
              conversations[partner] = { partnerId: data.partnerId || 0, messages: [], unread: 0 };
            }
            conversations[partner].messages = data.messages || [];
            conversations[partner].partnerId = data.partnerId || conversations[partner].partnerId;
          }
        }
      } catch (e) {
        SNEED.log.error("Failed to load whisper history:", e);
      }
    }
    function saveHistory() {
      if (!globalEnabled) return;
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        const serialized = {};
        for (const [partner, data] of Object.entries(conversations)) {
          serialized[partner] = {
            partnerId: data.partnerId,
            messages: maxHistoryPerPartner > 0 ? data.messages.slice(-maxHistoryPerPartner) : data.messages
          };
        }
        SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_HISTORY, serialized);
      }, 1e3);
    }
    function addMessage(partnerUsername, partnerId, msg) {
      if (!conversations[partnerUsername]) {
        conversations[partnerUsername] = { partnerId, messages: [], unread: 0 };
      }
      const convo = conversations[partnerUsername];
      convo.partnerId = partnerId;
      convo.messages.push(msg);
      if (maxHistoryPerPartner > 0 && convo.messages.length > maxHistoryPerPartner) {
        convo.messages = convo.messages.slice(-maxHistoryPerPartner);
      }
      if (partnerUsername !== activePartner && msg.direction !== "out") {
        convo.unread++;
      }
      saveHistory();
      if (globalEnabled) {
        SNEED.core.storage.setStorageValue(SNEED.state.STORAGE_KEYS.WHISPER_LATEST, {
          partner: partnerUsername,
          partnerId,
          msg,
          ts: Date.now()
        });
      }
    }
    function markRead(partner) {
      if (conversations[partner]) {
        conversations[partner].unread = 0;
      }
    }
    function getPartnerList() {
      return Object.entries(conversations).map(([username, data]) => ({
        username,
        unread: data.unread
      }));
    }
    function ensureBox(doc) {
      if (boxElement && doc.getElementById("sneed-whisper-box")) return;
      boxElement = SNEED.ui.whisperBox.createWhisperBox(doc, {
        onToggle: (expanded) => {
          savedCollapsed = !expanded;
          saveState();
        },
        onClose: () => {
          if (boxElement) {
            boxElement.remove();
            boxElement = null;
          }
          closed = true;
          saveState();
          showReopenButton(doc);
        },
        onTabClick: (username) => {
          activePartner = username;
          markRead(username);
          refreshUI();
        },
        onTabClose: (username) => {
          delete conversations[username];
          if (activePartner === username) {
            const keys = Object.keys(conversations);
            activePartner = keys.length > 0 ? keys[0] : null;
          }
          saveHistory();
          refreshUI();
        },
        onSend: (text) => {
          if (!activePartner) return;
          sendWhisper(activePartner, text, doc);
        },
        onNewConversation: (username) => {
          if (!conversations[username]) {
            conversations[username] = { partnerId: 0, messages: [], unread: 0 };
          }
          activePartner = username;
          refreshUI();
        },
        onPositionChange: (pos) => {
          savePosition(pos);
        }
      });
      doc.body.appendChild(boxElement);
      if (savedPosition) {
        SNEED.ui.whisperBox.applyPosition(boxElement, savedPosition, doc);
      }
      currentDoc = doc;
    }
    function refreshUI() {
      if (!boxElement) return;
      const partners = getPartnerList();
      SNEED.ui.whisperBox.renderTabs(boxElement, partners, activePartner, (username) => {
        activePartner = username;
        markRead(username);
        refreshUI();
      }, (username) => {
        delete conversations[username];
        if (activePartner === username) {
          const keys = Object.keys(conversations);
          activePartner = keys.length > 0 ? keys[0] : null;
        }
        saveHistory();
        refreshUI();
      }, (username) => {
        if (!currentDoc) return false;
        const lower = username.toLowerCase();
        const activities = currentDoc.querySelectorAll("#chat-activity .activity[data-username]");
        for (const el of activities) {
          if ((el.dataset.username || "").toLowerCase() === lower) return true;
        }
        return false;
      });
      const msgs = activePartner && conversations[activePartner] ? conversations[activePartner].messages : [];
      SNEED.ui.whisperBox.renderMessages(boxElement, msgs);
      const input = boxElement.querySelector(".whisper-input");
      if (input) {
        input.placeholder = activePartner ? `Whisper to ${activePartner}...` : "Type a whisper...";
      }
    }
    function sendWhisper(partner, text, doc) {
      const chatInput = doc.getElementById("new-message-input");
      if (!chatInput) return;
      chatInput.textContent = `/w @${partner}, ${text}`;
      if (SNEED.util.positionCursorAtEnd) {
        SNEED.util.positionCursorAtEnd(doc, chatInput);
      }
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      chatInput.dispatchEvent(enterEvent);
    }
    function addReopenButton(doc) {
      if (doc.getElementById("sneed-whisper-reopen")) return;
      const btn = doc.createElement("button");
      btn.id = "sneed-whisper-reopen";
      btn.textContent = "Whispers";
      btn.title = "Open whisper box";
      btn.style.cssText = `
            position: fixed; bottom: 8px; right: 16px; z-index: 9998;
            background: #1a1a2e; color: #999; border: 1px solid #333;
            border-radius: 6px; padding: 4px 12px; font-size: 11px;
            cursor: pointer; font-family: inherit; display: none;
        `;
      btn.addEventListener("mouseenter", () => {
        btn.style.color = "#fff";
        btn.style.borderColor = "#4a9eff";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.color = "#999";
        btn.style.borderColor = "#333";
      });
      btn.addEventListener("click", () => {
        closed = false;
        savedCollapsed = false;
        saveState();
        btn.style.display = "none";
        ensureBox(doc);
        refreshUI();
      });
      doc.body.appendChild(btn);
      if (closed) btn.style.display = "block";
    }
    function showReopenButton(doc) {
      const btn = doc.getElementById("sneed-whisper-reopen");
      if (btn) btn.style.display = "block";
    }
    function hideReopenButton(doc) {
      const btn = doc.getElementById("sneed-whisper-reopen");
      if (btn) btn.style.display = "none";
    }
    function sendWhisperNotification(partner, messageText, doc) {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const docHasFocus = doc.hasFocus();
      let parentHasFocus = false;
      try {
        parentHasFocus = window.parent && window.parent.document.hasFocus();
      } catch (e) {
      }
      if (docHasFocus || parentHasFocus) return;
      const body = messageText.length > 150 ? messageText.substring(0, 150) + "..." : messageText;
      const notification = new Notification(`Whisper from ${partner}`, {
        body,
        icon: "https://kiwifarms.st/styles/custom/emotes/bmj_ross_hq.png",
        tag: "kees-whisper-" + Date.now(),
        requireInteraction: false
      });
      notification.onclick = () => {
        window.focus();
        if (window.parent) window.parent.focus();
        notification.close();
      };
      setTimeout(() => notification.close(), 5e3);
    }
    function extractWhisper(node) {
      if (!node.classList || !node.classList.contains("chat-message--whisper")) return null;
      const partner = node.dataset.whisperPartner;
      const partnerId = parseInt(node.dataset.whisperPartnerId || "0", 10);
      const authorId = parseInt(node.dataset.author || "0", 10);
      const timestamp = parseInt(node.dataset.timestamp || "0", 10);
      const messageEl = node.querySelector(".message");
      const html = messageEl ? messageEl.innerHTML : "";
      const directionEl = node.querySelector(".whisper-direction");
      const directionText = directionEl ? directionEl.textContent.trim().toLowerCase() : "";
      const direction = directionText === "to" ? "out" : "in";
      const authorEl = node.querySelector(".author");
      const authorName = direction === "out" ? "You" : partner;
      if (!partner) return null;
      return {
        partner,
        partnerId,
        authorId,
        direction,
        author: authorName,
        html,
        timestamp
      };
    }
    async function start(doc) {
      await loadRetention();
      await loadGlobalState();
      await loadHideMainState();
      await loadPosition();
      await loadState();
      await loadHistory();
      chrome.storage.onChanged.addListener((changes) => {
        if (changes[SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL]) {
          globalEnabled = changes[SNEED.state.STORAGE_KEYS.WHISPER_GLOBAL].newValue === true;
        }
        if (changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN]) {
          hideMainChat = changes[SNEED.state.STORAGE_KEYS.WHISPER_HIDE_MAIN].newValue !== false;
        }
        if (changes[SNEED.state.STORAGE_KEYS.WHISPER_RETENTION]) {
          const val = parseInt(changes[SNEED.state.STORAGE_KEYS.WHISPER_RETENTION].newValue, 10);
          maxHistoryPerPartner = isNaN(val) ? 100 : val;
        }
      });
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "relaySendWhisper" && message.partner && message.text) {
          sendWhisper(message.partner, message.text, doc);
        }
      });
      const container = doc.getElementById("chat-messages") || SNEED.util.findMessageContainer(doc);
      if (!container) return;
      const observer = new MutationObserver((mutations) => {
        var _a, _b;
        let newWhispers = false;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            const whisperNode = node.classList && node.classList.contains("chat-message--whisper") ? node : node.querySelector && node.querySelector(".chat-message--whisper");
            const whisper = whisperNode ? extractWhisper(whisperNode) : null;
            if (!whisper) continue;
            if (hideMainChat) {
              whisperNode.style.display = "none";
            }
            addMessage(whisper.partner, whisper.partnerId, {
              direction: whisper.direction,
              author: whisper.author,
              html: whisper.html,
              timestamp: whisper.timestamp
            });
            newWhispers = true;
            if (whisper.direction === "in") {
              const plainText = ((_b = (_a = whisperNode.querySelector(".message")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
              sendWhisperNotification(whisper.partner, plainText, doc);
            }
            if (!activePartner) {
              activePartner = whisper.partner;
              markRead(whisper.partner);
            }
          }
        }
        if (newWhispers) {
          if (closed) {
            closed = false;
            savedCollapsed = false;
            saveState();
            hideReopenButton(doc);
          }
          ensureBox(doc);
          SNEED.ui.whisperBox.expand(boxElement);
          refreshUI();
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      SNEED.core.events.addManagedObserver(container, observer);
      if (!closed) {
        if (Object.keys(conversations).length > 0 && !activePartner) {
          activePartner = Object.keys(conversations)[0];
        }
        ensureBox(doc);
        refreshUI();
        if (savedCollapsed || Object.keys(conversations).length === 0) {
          const body = boxElement.querySelector(".whisper-body");
          const arrow = boxElement.querySelector(".whisper-toggle-arrow");
          if (body) body.classList.add("collapsed");
          if (arrow) arrow.classList.add("collapsed");
          boxElement.classList.remove("expanded");
          boxElement.style.height = "";
        }
      }
      addReopenButton(doc);
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.whisperBox = { start };
  })();

  // src/features/bot-column.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    let botUsersLower = [];
    let enabled = false;
    let hideFromMain = false;
    const STYLES = `
        .sneed-has-bot-col {
            display: flex !important;
            flex-direction: row !important;
        }
        .sneed-has-bot-col > #chat-scroller,
        .sneed-has-bot-col > :first-child:not(.sneed-bot-col) {
            flex: 1 !important;
            min-width: 0 !important;
        }
        .sneed-bot-col {
            width: 300px;
            min-width: 200px;
            max-width: 50%;
            border-left: 1px solid #333;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            resize: horizontal;
            overflow: auto;
        }
        .sneed-bot-col-header {
            padding: 6px 10px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid #333;
            color: #999;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .sneed-bot-col-messages {
            flex: 1;
            overflow-y: auto;
            padding: 4px;
        }
        .sneed-bot-col-messages .chat-message {
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
    `;
    function isBotUser(username) {
      if (!username) return false;
      return botUsersLower.includes(username.toLowerCase());
    }
    function getMessageAuthor(msgEl) {
      const authorEl = msgEl.querySelector(".author");
      if (authorEl) return authorEl.textContent.trim();
      return null;
    }
    function injectStyles(doc) {
      if (doc.getElementById("sneed-bot-column-styles")) return;
      const style = doc.createElement("style");
      style.id = "sneed-bot-column-styles";
      style.textContent = STYLES;
      (doc.head || doc.documentElement).appendChild(style);
    }
    function createColumn(doc) {
      const col = doc.createElement("div");
      col.className = "sneed-bot-col";
      col.id = "sneed-bot-column";
      const header = doc.createElement("div");
      header.className = "sneed-bot-col-header";
      header.textContent = "Bot Messages";
      const messages = doc.createElement("div");
      messages.className = "sneed-bot-col-messages";
      col.appendChild(header);
      col.appendChild(messages);
      return col;
    }
    function start(doc) {
      chrome.storage.local.get([
        SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED,
        SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN,
        SNEED.state.STORAGE_KEYS.BOT_USERS
      ], (result) => {
        enabled = result[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED] === true;
        hideFromMain = result[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN] === true;
        const users = result[SNEED.state.STORAGE_KEYS.BOT_USERS] || [];
        botUsersLower = users.map((u) => u.toLowerCase());
        if (enabled && botUsersLower.length > 0) {
          setupColumn(doc);
        }
        chrome.storage.onChanged.addListener((changes) => {
          let needsRefresh = false;
          if (changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED]) {
            enabled = changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_ENABLED].newValue === true;
            needsRefresh = true;
          }
          if (changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN]) {
            hideFromMain = changes[SNEED.state.STORAGE_KEYS.BOT_COLUMN_HIDE_MAIN].newValue === true;
          }
          if (changes[SNEED.state.STORAGE_KEYS.BOT_USERS]) {
            const users2 = changes[SNEED.state.STORAGE_KEYS.BOT_USERS].newValue || [];
            botUsersLower = users2.map((u) => u.toLowerCase());
            needsRefresh = true;
          }
          if (needsRefresh) {
            teardownColumn(doc);
            if (enabled && botUsersLower.length > 0) {
              setupColumn(doc);
            }
          }
        });
      });
    }
    function setupColumn(doc) {
      const chatMessages = doc.getElementById("chat-messages");
      if (!chatMessages) return;
      const scroller = chatMessages.closest("#chat-scroller") || chatMessages.parentElement;
      if (!scroller || doc.getElementById("sneed-bot-column")) return;
      injectStyles(doc);
      const parent = scroller.parentElement;
      parent.classList.add("sneed-has-bot-col");
      const botCol = createColumn(doc);
      parent.appendChild(botCol);
      const botMessages = botCol.querySelector(".sneed-bot-col-messages");
      const existing = chatMessages.querySelectorAll(".chat-message");
      existing.forEach((msg) => {
        processMessage(msg, botMessages, doc);
      });
      const observer = new MutationObserver((mutations) => {
        let added = false;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.classList && node.classList.contains("chat-message")) {
              if (processMessage(node, botMessages, doc)) added = true;
            }
          }
        }
        if (added) {
          botMessages.scrollTop = botMessages.scrollHeight;
        }
      });
      observer.observe(chatMessages, { childList: true });
      SNEED.core.events.addManagedObserver(chatMessages, observer);
      doc.__sneed_botColumn = {
        cleanup: () => {
          observer.disconnect();
          teardownColumn(doc);
        }
      };
    }
    function processMessage(msgEl, botContainer, doc) {
      const author = getMessageAuthor(msgEl);
      if (!author || !isBotUser(author)) return false;
      const msgId = msgEl.id || msgEl.dataset.id;
      if (msgId) {
        const existing = botContainer.querySelector(`[id="${msgId}"], [data-id="${msgId}"]`);
        if (existing) {
          const clone2 = msgEl.cloneNode(true);
          existing.replaceWith(clone2);
          if (hideFromMain) msgEl.style.display = "none";
          return false;
        }
      }
      const clone = msgEl.cloneNode(true);
      botContainer.appendChild(clone);
      if (hideFromMain) {
        msgEl.style.display = "none";
      }
      return true;
    }
    function teardownColumn(doc) {
      const botCol = doc.getElementById("sneed-bot-column");
      if (botCol) {
        const parent = botCol.parentElement;
        botCol.remove();
        if (parent) parent.classList.remove("sneed-has-bot-col");
      }
      const chatMessages = doc.getElementById("chat-messages");
      if (chatMessages) {
        chatMessages.querySelectorAll('.chat-message[style*="display: none"]').forEach((msg) => {
          const author = getMessageAuthor(msg);
          if (author && isBotUser(author)) {
            msg.style.display = "";
          }
        });
      }
      if (doc.__sneed_botColumn) {
        delete doc.__sneed_botColumn;
      }
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.botColumn = { start };
  })();

  // src/features/wave-animation.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const WAVE_INTERVAL = 200;
    const SIZE_NORMAL = 5;
    const SIZE_HIGHLIGHT = 7;
    const RAINBOW_COLORS = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"];
    let activeWave = null;
    let pageScriptInjected = false;
    function injectPageScript(doc) {
      if (pageScriptInjected) return;
      pageScriptInjected = true;
      const script = doc.createElement("script");
      script.src = chrome.runtime.getURL("src/wave-edit-page.js");
      doc.documentElement.appendChild(script);
      script.addEventListener("load", () => script.remove());
    }
    function sendEdit(doc, uuid, message) {
      const win = doc.defaultView || window;
      win.dispatchEvent(new CustomEvent("__kees_edit_message", {
        detail: { uuid, message }
      }));
    }
    function buildSizeWaveFrame(chars, pos) {
      let result = "";
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].trim() === "") {
          result += chars[i];
          continue;
        }
        if (i === pos) {
          result += `[size=${SIZE_HIGHLIGHT}]${chars[i]}[/size]`;
        } else {
          result += chars[i];
        }
      }
      return result;
    }
    function buildColorWaveFrame(chars, pos) {
      let result = "";
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].trim() === "") {
          result += chars[i];
          continue;
        }
        if (i === pos) {
          result += `[color=#ff0000]${chars[i]}[/color]`;
        } else {
          result += chars[i];
        }
      }
      return result;
    }
    function buildRainbowWaveFrame(chars, pos) {
      let result = "";
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].trim() === "") {
          result += chars[i];
          continue;
        }
        const colorIdx = (i + pos) % RAINBOW_COLORS.length;
        result += `[color=${RAINBOW_COLORS[colorIdx]}]${chars[i]}[/color]`;
      }
      return result;
    }
    const WAVE_TYPES = {
      sizewave: buildSizeWaveFrame,
      colorwave: buildColorWaveFrame,
      rainbowwave: buildRainbowWaveFrame
    };
    function startWave(type, uuid, originalText, doc) {
      stopWave(doc);
      injectPageScript(doc);
      const cleanText = originalText.replace(/\[[^\]]+\]/g, "");
      const chars = [...cleanText];
      if (!cleanText.trim() || chars.length === 0) return;
      const builder = WAVE_TYPES[type];
      if (!builder) return;
      let frame = 0;
      activeWave = {
        type,
        uuid,
        originalText: cleanText,
        timer: setInterval(() => {
          const message = builder(chars, frame);
          sendEdit(doc, uuid, message);
          frame++;
          if (frame >= chars.length) {
            clearInterval(activeWave.timer);
            setTimeout(() => {
              sendEdit(doc, uuid, cleanText);
              activeWave = null;
            }, WAVE_INTERVAL);
          }
        }, WAVE_INTERVAL)
      };
    }
    function stopWave(doc) {
      if (activeWave) {
        clearInterval(activeWave.timer);
        if (activeWave.uuid && activeWave.originalText && doc) {
          sendEdit(doc, activeWave.uuid, activeWave.originalText);
        }
        activeWave = null;
      }
    }
    function getLastOwnMessage(doc) {
      var _a, _b;
      const messages = doc.querySelectorAll("#chat-messages .chat-message");
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.classList.contains("chat-message--whisper")) continue;
        if (msg.classList.contains("chat-message--systemMsg")) continue;
        const id = msg.id || msg.dataset.id;
        if (!id) continue;
        const editBtn = msg.querySelector(".button.edit");
        const deleteBtn = msg.querySelector(".button.delete");
        if (editBtn || deleteBtn) {
          const uuid = id.replace("chat-message-", "");
          const raw = msg.dataset.raw;
          const text = raw || ((_b = (_a = msg.querySelector(".message")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
          return { uuid, text };
        }
      }
      return null;
    }
    function handleCommand(command, doc) {
      const trimmed = command.trim();
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      if (cmd === "/stopwave") {
        stopWave(doc);
        return true;
      }
      const type = cmd.substring(1);
      if (WAVE_TYPES[type]) {
        const argText = parts.slice(1).join(" ");
        if (argText) {
          waitForOwnMessage(doc, argText, (uuid, text) => {
            startWave(type, uuid, text, doc);
          });
          const inputElement = doc.getElementById("new-message-input");
          if (inputElement) {
            inputElement.textContent = argText;
            SNEED.util.positionCursorAtEnd(doc, inputElement);
          }
          return false;
        } else {
          const lastMsg = getLastOwnMessage(doc);
          if (!lastMsg) return true;
          startWave(type, lastMsg.uuid, lastMsg.text, doc);
          return true;
        }
      }
      return false;
    }
    function waitForOwnMessage(doc, expectedText, callback) {
      const chatMessages = doc.getElementById("chat-messages");
      if (!chatMessages) return;
      const observer = new MutationObserver((mutations) => {
        var _a, _b;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (!node.classList || !node.classList.contains("chat-message")) continue;
            if (node.classList.contains("chat-message--whisper")) continue;
            if (node.classList.contains("chat-message--systemMsg")) continue;
            const editBtn = node.querySelector(".button.edit");
            const deleteBtn = node.querySelector(".button.delete");
            if (!editBtn && !deleteBtn) continue;
            const id = node.id || node.dataset.id;
            if (!id) continue;
            const uuid = id.replace("chat-message-", "");
            const raw = node.dataset.raw;
            const text = raw || ((_b = (_a = node.querySelector(".message")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || "";
            observer.disconnect();
            setTimeout(() => callback(uuid, text), 100);
            return;
          }
        }
      });
      observer.observe(chatMessages, { childList: true });
      setTimeout(() => observer.disconnect(), 5e3);
    }
    function start(doc) {
      const inputElement = doc.getElementById("new-message-input");
      const messageForm = doc.getElementById("new-message-form");
      if (!inputElement || !messageForm) return;
      SNEED.core.events.addManagedEventListener(inputElement, "keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const text = (inputElement.textContent || "").trim();
          if (handleCommand(text, doc)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            inputElement.textContent = "";
            const event = new Event("input", { bubbles: true });
            inputElement.dispatchEvent(event);
            return false;
          }
        }
      }, true);
      window.addEventListener("beforeunload", () => stopWave(doc));
    }
    SNEED.features = SNEED.features || {};
    SNEED.features.waveAnimation = { start, stopWave };
  })();

  // src/bootstrap.js
  (function() {
    "use strict";
    const SNEED = window.SNEED;
    const log = SNEED.log;
    const state = SNEED.state;
    const storage = SNEED.core.storage;
    const events = SNEED.core.events;
    const ui = SNEED.ui;
    const features = SNEED.features;
    const util = SNEED.util;
    function captureChatConfig() {
      window.addEventListener("__kees_chat_config", (e) => {
        const data = e.detail;
        if (data && data.wsUrl) {
          chrome.storage.local.set({
            [state.STORAGE_KEYS.CHAT_WS_URL]: data.wsUrl,
            [state.STORAGE_KEYS.CHAT_USER]: data.user || null
          });
        }
      }, { once: true });
      const script = document.createElement("script");
      script.textContent = `
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
        `;
      document.documentElement.appendChild(script);
      script.remove();
      function saveRoom() {
        const room = parseInt(window.location.hash.substring(1), 10);
        if (room > 0) {
          chrome.storage.local.set({ [state.STORAGE_KEYS.CHAT_LAST_ROOM]: room });
        }
      }
      saveRoom();
      window.addEventListener("hashchange", saveRoom);
    }
    function hideOfficialToolbar(doc) {
      if (doc.getElementById("sneed-hide-toolbar")) return;
      const style = doc.createElement("style");
      style.id = "sneed-hide-toolbar";
      style.textContent = ".chat-toolbar { display: none !important; }";
      (doc.head || doc.documentElement).appendChild(style);
    }
    function injectEmoteBar() {
      const isIframe = util.isInIframe();
      if (isIframe) {
        const messageForm = document.getElementById("new-message-form");
        if (messageForm && !document.getElementById("custom-emote-bar")) {
          hideOfficialToolbar(document);
          const emoteBar = ui.createEmoteBar(document);
          const formatBar = ui.createFormatBar(document);
          messageForm.parentNode.insertBefore(emoteBar, messageForm);
          messageForm.parentNode.insertBefore(formatBar, messageForm);
          features.addEmoteToggleButton(document);
          const directInput = document.getElementById("new-message-input");
          features.attachShiftEnterHandler(directInput, document);
          const root = messageForm.parentElement || document.body;
          if (root && !root.__sneed_bar_observed) {
            observeForBarsRemoval(root, document);
          }
          if (features.startBlacklistFilter) {
            features.startBlacklistFilter(document);
          }
          if (features.startWatchedUsers) {
            features.startWatchedUsers(document);
          }
          if (SNEED.features.ziplineUpload && SNEED.features.ziplineUpload.start) {
            SNEED.features.ziplineUpload.start(document);
          }
          if (SNEED.features.mentionNotifications && SNEED.features.mentionNotifications.start) {
            SNEED.features.mentionNotifications.start(document);
          }
          if (SNEED.features.mentionSort && SNEED.features.mentionSort.start) {
            SNEED.features.mentionSort.start(document);
          }
          if (SNEED.features.whisperBox && SNEED.features.whisperBox.start) {
            SNEED.features.whisperBox.start(document);
          }
          if (SNEED.features.botColumn && SNEED.features.botColumn.start) {
            SNEED.features.botColumn.start(document);
          }
          if (SNEED.features.waveAnimation && SNEED.features.waveAnimation.start) {
            SNEED.features.waveAnimation.start(document);
          }
          log.info("Emote and format bars injected into test-chat");
        }
      } else {
        const iframe = document.getElementById("rust-shim");
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc && iframeDoc.readyState === "complete") {
              const messageForm = iframeDoc.getElementById("new-message-form");
              if (messageForm && !iframeDoc.getElementById("custom-emote-bar")) {
                hideOfficialToolbar(iframeDoc);
                const emoteBar = ui.createEmoteBar(iframeDoc);
                const formatBar = ui.createFormatBar(iframeDoc);
                messageForm.parentNode.insertBefore(emoteBar, messageForm);
                messageForm.parentNode.insertBefore(formatBar, messageForm);
                features.addEmoteToggleButton(iframeDoc);
                const iframeInput = iframeDoc.getElementById("new-message-input");
                features.attachShiftEnterHandler(iframeInput, iframeDoc);
                const root = messageForm.parentElement || iframeDoc.body;
                if (root && !root.__sneed_bar_observed) {
                  observeForBarsRemoval(root, iframeDoc);
                }
                if (features.startBlacklistFilter) {
                  features.startBlacklistFilter(iframeDoc);
                }
                if (features.startWatchedUsers) {
                  features.startWatchedUsers(iframeDoc);
                }
                if (SNEED.features.youtubeTitles && SNEED.features.youtubeTitles.start) {
                  SNEED.features.youtubeTitles.start(iframeDoc);
                }
                if (SNEED.features.doubleClickEdit && SNEED.features.doubleClickEdit.start) {
                  SNEED.features.doubleClickEdit.start(iframeDoc);
                }
                if (SNEED.features.ziplineUpload && SNEED.features.ziplineUpload.start) {
                  SNEED.features.ziplineUpload.start(iframeDoc);
                }
                if (SNEED.features.mentionNotifications && SNEED.features.mentionNotifications.start) {
                  SNEED.features.mentionNotifications.start(iframeDoc);
                }
                if (SNEED.features.mentionSort && SNEED.features.mentionSort.start) {
                  SNEED.features.mentionSort.start(iframeDoc);
                }
                if (SNEED.features.whisperBox && SNEED.features.whisperBox.start) {
                  SNEED.features.whisperBox.start(iframeDoc);
                }
                if (SNEED.features.botColumn && SNEED.features.botColumn.start) {
                  SNEED.features.botColumn.start(iframeDoc);
                }
                if (SNEED.features.waveAnimation && SNEED.features.waveAnimation.start) {
                  SNEED.features.waveAnimation.start(iframeDoc);
                }
                log.info("Emote and format bars injected into iframe");
              }
            }
          } catch (e) {
            log.info("Cannot access iframe content (cross-origin):", e);
          }
        }
      }
    }
    function observeForIframe(doc) {
      if (doc.__sneed_iframe_observed) return;
      doc.__sneed_iframe_observed = true;
      const obs = new MutationObserver(() => {
        const iframe = doc.getElementById("rust-shim");
        if (iframe && !iframe.__sneed_observed) {
          iframe.__sneed_observed = true;
          iframe.addEventListener("load", () => checkAndReinject(), { passive: true });
          state.addTimer(setTimeout(checkAndReinject, 50));
          try {
            const iframeWin = iframe.contentWindow;
            if (iframeWin && !iframe.__sneed_unload_handler) {
              iframe.__sneed_unload_handler = true;
              iframeWin.addEventListener("beforeunload", () => {
                var _a;
                events.cleanupIframeObservers(iframe);
                const iframeDoc = iframe.contentDocument || ((_a = iframe.contentWindow) == null ? void 0 : _a.document);
                if (iframeDoc) {
                  if (iframeDoc.__sneed_sendWatcher) {
                    iframeDoc.__sneed_sendWatcher.destroy();
                  }
                  delete iframeDoc.__sneed_blacklistFilter;
                }
              });
            }
          } catch (e) {
          }
        }
      });
      obs.observe(doc.documentElement, { childList: true, subtree: true });
      events.addManagedObserver(doc.documentElement, obs, true);
    }
    function observeForBarsRemoval(chatRoot, doc) {
      if (chatRoot.__sneed_bar_observed) return;
      chatRoot.__sneed_bar_observed = true;
      const obs = new MutationObserver((mutations) => {
        var _a, _b;
        for (const m of mutations) {
          for (const n of m.removedNodes) {
            if (!n || n.nodeType !== 1) continue;
            if (n.id === "custom-emote-bar" || n.id === "custom-format-bar" || ((_a = n.querySelector) == null ? void 0 : _a.call(n, "#custom-emote-bar")) || ((_b = n.querySelector) == null ? void 0 : _b.call(n, "#custom-format-bar"))) {
              ui.cleanupBars(doc);
              checkAndReinject();
              return;
            }
          }
        }
      });
      obs.observe(chatRoot, { childList: true, subtree: true });
      events.addManagedObserver(chatRoot, obs);
    }
    function checkAndReinject() {
      if (!state.canReinject()) return;
      const isIframe = util.isInIframe();
      if (isIframe) {
        if (!document.getElementById("custom-emote-bar") || !document.getElementById("custom-format-bar")) {
          injectEmoteBar();
          state.incrementReinjectAttempts();
        }
      } else {
        const iframe = document.getElementById("rust-shim");
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc && (!iframeDoc.getElementById("custom-emote-bar") || !iframeDoc.getElementById("custom-format-bar"))) {
              injectEmoteBar();
              state.incrementReinjectAttempts();
            }
          } catch (e) {
          }
        }
      }
    }
    async function init() {
      if (state.isInitialized()) {
        log.warn("Already initialized");
        return;
      }
      log.info("Initializing Sneedchat Enhancer Extension...");
      await storage.initAll();
      captureChatConfig();
      function waitForReady() {
        if (document.readyState === "loading") {
          events.addGlobalEventListener(document, "DOMContentLoaded", () => {
            state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
          });
        } else {
          state.addTimer(setTimeout(injectEmoteBar, state.CONFIG.INIT_DELAY));
        }
        observeForIframe(document);
      }
      waitForReady();
      events.addGlobalEventListener(document, "visibilitychange", () => {
        if (!document.hidden) {
          checkAndReinject();
        }
      });
      events.addGlobalEventListener(window, "focus", () => {
        checkAndReinject();
      });
      state.addTimer(setTimeout(checkAndReinject, state.CONFIG.POLLING_CHECK_DELAY));
      events.addGlobalEventListener(window, "unload", () => {
        state.clearAllTimers();
        events.cleanupAllObservers();
        events.cleanupAllListeners();
        ui.cleanupBars(document);
        if (document.__sneed_sendWatcher) {
          document.__sneed_sendWatcher.destroy();
        }
        const iframe = document.getElementById("rust-shim");
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
              if (iframeDoc.__sneed_sendWatcher) {
                iframeDoc.__sneed_sendWatcher.destroy();
              }
              ui.cleanupBars(iframeDoc);
            }
            events.cleanupIframeObservers(iframe);
          } catch (e) {
          }
        }
      });
      state.setInitialized(true);
      log.info("Sneedchat Enhancer Extension initialized");
    }
    SNEED.init = init;
    SNEED.injectEmoteBar = injectEmoteBar;
    SNEED.checkAndReinject = checkAndReinject;
  })();

  // src/chat-content.js
  window.SNEED.init();
})();
