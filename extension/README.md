# Kiwi Extra Enhancement Suite (KEES)

A browser extension that adds enhanced features to Kiwi Farms chat and forum pages.

## Features

### Chat Features
- **Emote Bar** - Quick access to custom and site emotes
- **Format Bar** - BBCode formatting buttons (bold, italic, spoiler, etc.)
- **Color Picker** - Advanced color selection for text formatting
- **Rainbow Text** - Animated rainbow text effect
- **WYSIWYG Editor** - Toggle between raw BBCode and visual editing mode
- **Custom Emotes** - Add and manage your own custom emotes
- **Image Blacklist** - Filter images from chat (supports bulk adding multiple URLs)
- **Watched Users** - Highlight messages from users you're watching
- **YouTube Titles** - Automatically displays video title and channel name for YouTube links
- **Double-Click Edit** - Double-click your own messages to quickly enter edit mode
- **Zipline Upload** - Upload media to your Zipline instance (images auto-wrapped in [img] tags)
- **Mention Notifications** - Browser notifications when someone mentions you in chat (with optional message preview)
- **Scrollback Limit** - Configurable chat message history (default 100, up to 5000)

### Forum Features
- **Featured Posts Consolidation** - Collect featured posts from multiple pages into a single view
- **User Muting** - Hide posts from specific users with one click
- **Mute Disruptive Guests** - Auto-hide posts from users marked as "Disruptive Guest"
- **Reaction Filter** - Auto-hide posts with high negative reaction ratios (configurable threshold)

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
- **Post Settings** - Mute disruptive guests, configure reaction filter thresholds
- **Chat Settings** - Mention notifications, scrollback limit
- **Zipline Upload** - Configure URL and API key for image uploads
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

## Supported Sites

- kiwifarms.st
- kiwifarms.tw
- kiwifarms.net

## License

MIT
