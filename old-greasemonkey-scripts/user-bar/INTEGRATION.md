# Sneedchat User Bar - Integration Notes

## File Tree

```
user-bar/
├── loader.user.js          # Userscript loader (install this in Tampermonkey)
├── manifest.json           # Module manifest with load order
├── INTEGRATION.md          # This file
├── core/
│   ├── state.js            # State, config, default data
│   ├── storage.js          # localStorage persistence
│   └── events.js           # Event & observer management
├── ui/
│   ├── styles.js           # Style configuration
│   ├── color-picker.js     # Color picker popup
│   ├── dialogs.js          # Blacklist/emote manager popups
│   └── bars.js             # Emote bar + Format bar
├── features/
│   ├── formatting.js       # Text formatting + emote insertion
│   └── input.js            # Input resize + shift-enter
├── util/
│   └── dom.js              # DOM utilities
└── bootstrap.js            # Main entry point
```

## Setup for GitHub Hosting

### 1. Update BASE_URL in loader.user.js

Change the `BASE_URL` constant to point to your GitHub raw files:

```javascript
const BASE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/sneedchat-enhancer/v3.5.0/user-bar/';
```

### 2. Tag Releases

Create git tags for version pinning:

```bash
git add .
git commit -m "Release v3.5.0 - Modular architecture"
git tag v3.5.0
git push origin master --tags
```

### 3. Update VERSION

When releasing updates:
1. Update `version` in `loader.user.js`
2. Update `version` in `manifest.json`
3. Create a new git tag matching the version

## Local Development

### Option 1: Python HTTP Server

```bash
cd /path/to/sneedchat-enhancer
python3 -m http.server 8080
```

Then update `loader.user.js`:
```javascript
const BASE_URL = 'http://localhost:8080/user-bar/';
```

### Option 2: Node.js HTTP Server

```bash
npx http-server /path/to/sneedchat-enhancer -p 8080 --cors
```

### Option 3: Direct File Loading (for quick testing)

For initial testing, you can temporarily load modules directly:
1. Open browser console on the target page
2. Paste the contents of each module file in order
3. Call `SNEED.init()` to start

## Module Load Order

Modules must be loaded in this specific order (defined in `manifest.json`):

1. `util/dom.js` - DOM utilities (no dependencies)
2. `core/state.js` - State management (no dependencies)
3. `core/storage.js` - Storage (depends on state)
4. `core/events.js` - Events (depends on state, util)
5. `ui/styles.js` - Styles (depends on SNEED.ui namespace)
6. `ui/color-picker.js` - Color picker (depends on util, events, styles)
7. `ui/dialogs.js` - Dialogs (depends on util, events, storage, styles)
8. `ui/bars.js` - Bars (depends on util, events, storage, state, styles, dialogs)
9. `features/formatting.js` - Formatting (depends on util, ui)
10. `features/input.js` - Input handling (depends on state, events, ui)
11. `bootstrap.js` - Entry point (depends on everything)

## Global Namespace Structure

All code lives under `window.SNEED`:

```javascript
window.SNEED = {
    version: "3.5.0",
    log: { info, error, warn },

    state: {
        defaultEmotes,
        toggleButtonConfig,
        formatTools,
        CONFIG,
        STORAGE_KEYS,
        runtime,
        // getters/setters
    },

    core: {
        storage: {
            getEmotes, saveEmotes, resetEmotesToDefault, initEmotes,
            getBlacklist, saveBlacklist, isBlacklisted, addToBlacklist,
            removeFromBlacklist, clearBlacklist
        },
        events: {
            addManagedEventListener, removeElementListeners,
            addGlobalEventListener, cleanupAllListeners,
            addManagedObserver, removeElementObservers,
            cleanupAllObservers, ensureSendWatcher,
            getResizeCache, setResizeCache, deleteResizeCache
        }
    },

    ui: {
        STYLES,
        COLOR_PALETTE,
        showColorPicker,
        showBlacklistManager,
        showEmoteManager,
        showEmoteEditor,
        showExportDialog,
        createEmoteBar,
        createFormatBar,
        createEmoteToggleButton,
        reloadEmoteBar,
        cleanupBars
    },

    features: {
        applyFormatting,
        insertEmote,
        createOptimizedResizer,
        createShiftEnterHandler,
        attachShiftEnterHandler,
        showSendFailureIndicator,
        addEmoteToggleButton
    },

    util: {
        stylesToString,
        findMessageContainer,
        getTargetDocument,
        isInIframe,
        createElement,
        createButton,
        getSelectionAndRange,
        insertTextAtCursor,
        positionCursorAtEnd
    },

    init,              // Main initialization function
    injectEmoteBar,    // Manual injection
    checkAndReinject   // Reinject if bars removed
};
```

## Troubleshooting

### Modules fail to load
- Check browser console for fetch errors
- Verify BASE_URL is correct
- Check CORS headers if using a custom server
- Verify manifest.json is valid JSON

### Bars don't appear
- Check if `SNEED.init()` was called
- Look for errors in console
- Verify the page has `#new-message-form` element
- Try `SNEED.checkAndReinject()` manually

### Cross-origin errors
- The script handles cross-origin iframe access gracefully
- Some functionality may be limited on cross-origin pages

## Migration from Monolithic Script

The modular version maintains 100% feature parity with the original `user-bar.js`:

- All emotes, formatting tools, and blacklist features work identically
- localStorage keys are the same, so existing data is preserved
- UI looks and behaves the same

The only differences are:
- Code is split across multiple files
- Loads from remote URL instead of being self-contained
- Slightly larger total size due to module structure overhead
