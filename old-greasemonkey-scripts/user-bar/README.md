# Sneedchat User Bar

A userscript that adds a customizable emote bar and formatting toolbar to Sneedchat.

![Emote Picker](../img/emote-picker.png)
![Text Editor](../img/text-editor.png)
![Color Picker](../img/color-picker.png)

## Features

### Emote Bar
- Quick-access emote buttons with custom emotes
- Click to insert, Shift+Click to insert without auto-send
- Add/edit/remove custom emotes via the emote manager
- Import/export emote configurations

### Format Bar
- **Bold** and **Italic** formatting
- **Color picker** with preset palette
- **Rainbow text** - colors each character through the spectrum
- **Bullet points** - add bullets to selected lines
- **Image insertion** with inline preview
- **Line breaks** (`[br]` tag)
- **Image blacklist manager** - hide unwanted images
- **Emote manager** - customize your emote collection

### WYSIWYG Editor
Toggle between two editing modes:

- **WYSIWYG Mode** (default, `<>` grayed out):
  - See formatting visually as you type
  - Bold text appears **bold**, colors appear colored
  - Images display inline as thumbnails
  - Automatically converts to BBCode on send

- **Raw BBCode Mode** (`<>` solid):
  - Insert BBCode tags directly as text
  - See `[b]text[/b]`, `[color=#hex]text[/color]`, etc.
  - Classic editing experience

Click the `<>` button to toggle modes. Your preference is saved.

### Other Features
- **Watched Users** - highlight messages from specific users
- **Auto-resize input** - input box grows with content
- **Shift+Enter** - insert newline without sending
- **Character limit warning** - warns when approaching message limit
- **Send failure recovery** - restores message if send fails

## Installation

### From GitHub (Recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click on one of the loader scripts:
   - [Stable (master)](https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/master/user-bar/loader.user.js)
   - [Development (dev)](https://raw.githubusercontent.com/ClaudetteTheGreat/sneed-bar/dev/user-bar/loader-dev.user.js)
3. Click "Install" when prompted

![Install](../img/install.png)

### Updating

Check for updates in your userscript manager settings.

![Updates](../img/update.png)

### Local Development

Use `loader-local.user.js` and update the file paths to your local directory.

## Usage

### Formatting Text

1. Type your message
2. Select text you want to format
3. Click a formatting button:
   - **B** - Bold
   - **I** - Italic
   - Color palette - Pick a color
   - Rainbow - Apply rainbow colors
   - Image - Wrap URL in image tags

### WYSIWYG Mode

In WYSIWYG mode:
- Formatting is visual - bold text looks bold
- Select a URL and click the image button to see an inline preview
- All formatting is converted to BBCode when you press Enter

Toggle to Raw mode if you prefer seeing/editing BBCode directly.

### Managing Emotes

Click the gear icon to open the Emote Manager:
- Add new emotes with image URL, emoji, or text
- Edit existing emotes
- Reorder emotes
- Import/export your collection

### Image Blacklist

Click the block icon to manage blacklisted images:
- Right-click any chat image to add it to the blacklist
- Blacklisted images are hidden from chat
- Manage your blacklist from the dialog

## File Structure

```
user-bar/
├── loader.user.js          # Stable release loader
├── loader-dev.user.js      # Development loader
├── loader-local.user.js    # Local development loader
├── core/
│   ├── namespace.js        # Global namespace setup
│   ├── state.js            # Configuration and state
│   ├── storage.js          # localStorage persistence
│   ├── events.js           # Event management
│   └── bbcode-converter.js # HTML <-> BBCode conversion
├── ui/
│   ├── styles.js           # Style definitions
│   ├── color-picker.js     # Color picker popup
│   ├── dialogs.js          # Manager dialogs
│   └── bars.js             # Emote and format bars
├── features/
│   ├── formatting.js       # Text formatting logic
│   ├── input.js            # Input handling
│   ├── blacklist-filter.js # Image blacklist
│   └── watched-users.js    # User highlighting
├── util/
│   └── dom.js              # DOM utilities
└── bootstrap.js            # Initialization
```

## Configuration

Settings are stored in localStorage:
- `sneedchat-custom-emotes` - Your custom emote collection
- `sneedchat-image-blacklist` - Blacklisted image URLs
- `sneedchat-wysiwyg-mode` - WYSIWYG toggle state

## Browser Support

Tested on:
- Firefox with Tampermonkey/Violentmonkey
- Chrome with Tampermonkey
- Tested on Firefox Mobile

## License

MIT
