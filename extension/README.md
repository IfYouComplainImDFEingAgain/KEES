# Kiwi Extra Enhancement Suite (KEES)

A browser extension that adds enhanced features to Xenforo chat and forum pages.

## Features

### Chat Features
- **Emote Bar** - Quick access to custom and site emotes
- **Extended Format Bar** - BBCode formatting buttons (Bold, Italic, Underline, Strikethrough, Center, Size, Code, URL, Color, Rainbow, Image, Bullets) — replaces the site's built-in toolbar
- **Size Picker** - Text size selection with preset sizes
- **Color Picker** - Advanced color selection for text formatting
- **Rainbow Text** - Animated rainbow text effect
- **WYSIWYG Editor** - Toggle between raw BBCode and visual editing mode (supports center and size formatting)
- **Custom Emotes** - Add and manage your own custom emotes
- **Image Blacklist** - Filter images from chat (supports bulk adding multiple URLs)
- **Watched Users** - Highlight messages from users you're watching
- **YouTube Titles** - Automatically displays video title and channel name for YouTube links
- **Double-Click Edit** - Double-click your own messages to quickly enter edit mode
- **Zipline Upload** - Upload media to your Zipline instance (images auto-wrapped in [img] tags, EXIF stripping enabled by default)
- **Mention Notifications** - Browser notifications when someone mentions you in chat (with optional message preview)
- **Mention Sort** - @mention autocomplete sorted by recent chat activity instead of alphabetical
- **@everyone Expansion** - Type `@everyone` to mention all users in your configured list
- **Whisper Box** - Floating draggable/resizable whisper window with per-user conversation tabs, unread badges, time separators, and user autocomplete
- **Global Whisper Box** - Whisper box available on all site pages (forum, threads, profiles, etc.) with whispers relayed from the chat tab
- **Whisper Persistence** - Save whisper history with configurable retention per conversation
- **Hide Whispers in Main Chat** - Only show whispers in the whisper box (enabled by default)
- **Scrollback Limit** - Configurable chat message history (default 100, up to 5000)

### Forum Features
- **Featured Posts Consolidation** - Collect featured posts from multiple pages into a single view
- **User Muting** - Hide posts from specific users with one click
- **Mute Disruptive Guests** - Auto-hide posts from users marked as "Disruptive Guest"
- **Reaction Filter** - Auto-hide posts with high negative reaction ratios (configurable threshold)
- **Attachment EXIF Stripping** - Automatically remove location/camera metadata from image attachments (enabled by default)

### User Profile Features
- **Forum Activity Analysis** - Analyze which forums a user posts in most frequently with cached results

### Homepage Features
- **Disable Homepage Chat** - Hide the chat widget on the forum homepage
- **Remove Sponsored Content** - Hide sponsored banners on the homepage

## Installation

### Chrome / Chromium-based browsers

1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension` folder

### Firefox

1. Download or clone this repository
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from the `extension` folder

## Usage

### Extension Popup
Click the extension icon in your browser toolbar to access settings:
- **Cosmetics** - Toggle homepage chat and sponsored content visibility
- **Post Settings** - Attachment EXIF stripping, mute disruptive guests, reaction filter thresholds
- **Chat Settings** - Mention notifications, scrollback limit, global whisper box, whisper retention, hide whispers in main chat
- **Zipline Upload** - Configure URL, API key, and EXIF stripping for image uploads
- **@everyone List** - Manage usernames for @everyone expansion
- **Muted Users** - Manage your muted users list

### Chat Page
The emote bar and format bar appear above the chat input when you're on a chat page.

### Forum Threads
- **Featured Posts** - Click the golden "Featured" button in the pagination area to collect featured posts from nearby pages
- **Mute Users** - Click the "Mute" button next to any post to hide all posts from that user
- **Disruptive Guests** - Posts from disruptive guests are automatically hidden (click to reveal)
- **Reaction Filter** - Posts exceeding the negative reaction threshold are automatically collapsed

### User Profiles
- **Forum Activity** - Click "Analyze Forum Activity" to see which forums a user posts in most (results are cached locally)

## Building from Source

### Prerequisites
- **Operating System**: Any (Linux, macOS, Windows, including ARM64)
- **Node.js**: Version 16 or higher (tested with Node 20; compatible with Node 24)
- **npm**: Included with Node.js

No other tools are required. The only build dependency is [esbuild](https://esbuild.github.io/) (open source, installed locally via npm, pinned in `package-lock.json`).

### Build Instructions

1. Clone the repository and navigate to the extension directory:
```bash
git clone https://github.com/IfYouComplainImDFEingAgain/KEES.git
cd KEES/extension
```

2. Install dependencies (uses lockfile for exact versions):
```bash
npm ci
```

3. Build the extension:
```bash
npm run build
```

This runs `node build.js` which uses [esbuild](https://esbuild.github.io/) to bundle the source files in `src/` into the output files in `dist/`. No minification or obfuscation is applied. The build produces:
- `dist/chat-content.js` — bundled from `src/chat-content.js` and its imports
- `dist/forum-content.js` — bundled from `src/forum-content.js`
- `dist/homepage-content.js` — bundled from `src/homepage-content.js`
- `dist/member-content.js` — bundled from `src/member-content.js`

The following files are loaded directly without bundling:
- `src/background.js` — service worker / background script
- `src/whisper-content.js` — global whisper box (self-contained)
- `src/features/scrollback.js` — scrollback limit override
- `src/attachment-exif-inject.js` — EXIF stripping injector
- `src/attachment-exif-page.js` — EXIF stripping page script
- `src/wave-edit-page.js` — message edit page script
- `popup/popup.html` and `popup/popup.js` — settings UI

4. The built extension is in the `extension/` directory and can be loaded directly in the browser.

### Watch mode (development)
```bash
npm run watch
```

### Project Structure
```
extension/
├── manifest.json          # Extension manifest (MV3)
├── build.js               # esbuild bundler config
├── package.json
├── dist/                  # Built output
│   ├── chat-content.js
│   ├── forum-content.js
│   ├── homepage-content.js
│   └── member-content.js
├── icons/
│   ├── icon-48.png
│   └── icon-128.png
├── popup/
│   ├── popup.html
│   └── popup.js
└── src/
    ├── background.js      # Service worker for API calls
    ├── chat-content.js    # Chat page entry point
    ├── forum-content.js   # Forum thread entry point
    ├── homepage-content.js # Homepage entry point
    ├── member-content.js  # User profile entry point
    ├── homepage-hide.css  # CSS for instant content hiding
    ├── core/              # Core modules
    ├── ui/                # UI components
    ├── features/          # Feature modules
    ├── util/              # Utilities
    └── bootstrap.js       # Initialization
```

## License

MIT
