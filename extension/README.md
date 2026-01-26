# Sneedchat Enhancer

A browser extension that adds enhanced features to Kiwi Farms chat and forum pages.

## Features

### Chat Features
- **Emote Bar** - Quick access to custom and site emotes
- **Format Bar** - BBCode formatting buttons (bold, italic, spoiler, etc.)
- **Color Picker** - Advanced color selection for text formatting
- **Rainbow Text** - Animated rainbow text effect
- **WYSIWYG Editor** - Toggle between raw BBCode and visual editing mode
- **Custom Emotes** - Add and manage your own custom emotes
- **User Blacklist** - Filter messages from specific users
- **Watched Users** - Highlight messages from users you're watching

### Forum Features
- **Featured Posts Consolidation** - Collect featured posts from multiple pages into a single view
- **User Muting** - Hide posts from specific users with one click

### Homepage Features
- **Disable Homepage Chat** - Option to hide the chat widget on the forum homepage

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
- Toggle homepage chat visibility
- Manage muted users list

### Chat Page
The emote bar and format bar appear above the chat input when you're on a chat page.

### Forum Threads
- **Featured Posts** - Click the golden "Featured" button in the pagination area to collect featured posts from nearby pages
- **Mute Users** - Click the "Mute" button next to any post to hide all posts from that user

## Development

### Prerequisites
- Node.js 16+
- npm

### Setup
```bash
cd extension
npm install
```

### Build
```bash
npm run build
```

### Watch mode
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
│   └── homepage-content.js
├── icons/
│   ├── icon-48.png
│   └── icon-128.png
├── popup/
│   ├── popup.html
│   └── popup.js
└── src/
    ├── chat-content.js    # Chat page entry point
    ├── forum-content.js   # Forum thread entry point
    ├── homepage-content.js
    ├── core/              # Core modules
    ├── ui/                # UI components
    ├── features/          # Feature modules
    ├── util/              # Utilities
    └── bootstrap.js       # Initialization
```

## Supported Sites

- kiwifarms.st
- kiwifarms.tw
- kiwifarms.net

## License

MIT
