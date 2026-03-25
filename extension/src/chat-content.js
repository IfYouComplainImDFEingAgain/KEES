/**
 * chat-content.js - Extension entry point for chat pages
 * Imports all modules in correct order and initializes the extension.
 */

// Core modules (order matters)
import './core/namespace.js';
import './util/dom.js';
import './core/state.js';
import './core/storage.js';
import './core/events.js';
import './core/bbcode-converter.js';

// UI modules
import './ui/styles.js';
import './ui/color-picker.js';
import './ui/size-picker.js';
import './ui/whisper-box.js';
import './ui/dialogs.js';
import './ui/bars.js';

// Feature modules
import './features/formatting.js';
import './features/input.js';
import './features/blacklist-filter.js';
import './features/watched-users.js';
import './features/youtube-titles.js';
import './features/double-click-edit.js';
import './features/zipline-upload.js';
import './features/mention-notifications.js';
import './features/mention-sort.js';
import './features/whisper-box.js';
import './features/bot-column.js';
import './features/wave-animation.js';

// Bootstrap (must be last)
import './bootstrap.js';

// Initialize the extension
window.SNEED.init();
