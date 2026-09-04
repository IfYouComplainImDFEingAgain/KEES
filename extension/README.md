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
- **Message Actions** - Replaces the hover-only report link with three buttons at the end of every message's meta line: copy message UUID, go to the poster's profile, and report the message
- **New Account Badge** - Flags recently-joined accounts (default: under 30 days) with a `NEW·<age>` chip, both on chat messages and in the online-users column. Join dates are scraped once per user from their profile, throttled, and cached locally forever. Column entries only trigger a lookup once they scroll into view, and queue behind message lookups
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
- **Undelete Messages** - Deleted chat messages stay in the log with a dark red background and a `DELETED` chip instead of vanishing (enabled by default). Users on the Bot Column list are exempt, since bots delete their own command echoes and game boards constantly — adding a bot to that list also drops anything of theirs already being held. The message is only held back locally in your own browser — nothing is re-sent to the site, and turning the setting off drops any messages that were being held
- **Scrollback Limit** - Keep more chat history than Sneedchat's own 200-message cap (default 200, up to 1000). The site's prune loop can't simply be blocked — that hangs the tab — so the cap is lifted by clamping what `#chat-messages` reports as its child count, and KEES trims to your limit instead. If the site ever prunes through the clamp anyway, it switches itself off and hands pruning back
- **Mute Gambling** - Hide gambling commands (slots, roulette, blackjack, dice, coinflip, etc.) and bot responses including animated game boards and images
- **Keyword Filter** - Hide incoming chat messages containing specified words or phrases (case-insensitive substring matching)
- **PII Guard** - Block outgoing messages that contain protected personal information (e.g. real name, phone number, address). Protected strings are stored in `chrome.storage.local` which is inaccessible to the website, patterns are never injected into the DOM, and blocked messages never leave the client

### Forum Features
- **Featured Posts Consolidation** - Collect featured posts from multiple pages into a single view
- **User Muting** - Hide posts from specific users with one click
- **Mute Disruptive Guests** - Auto-hide posts from users marked as "Disruptive Guest"
- **Reaction Filter** - Auto-hide posts with high negative reaction ratios (configurable threshold)
- **Attachment EXIF Stripping** - Automatically remove location/camera metadata from image attachments (enabled by default)

### User Profile Features
- **Forum Activity Analysis** - Analyze which forums a user posts in most frequently with cached results, shown as a per-forum breakdown plus a stacked bar chart of posting frequency over time. Lives in its own "Forum Activity" tab alongside the profile's native tabs, between "Postings" and "About"
- **Forum Activity JSON Export** - "Export JSON" downloads everything the analysis produced: the run's own parameters, the per-forum totals, the daily timeline behind the chart, and the deduped per-post records (forum, thread title, permalink, timestamp) those totals were counted from

### User Tagging
- **Your Tags** - Tag any user from their profile, from the Tag Manager, or from a restricted profile that shows nothing but "This member limits who may view their full profile." Your tags always render **first** in the chip row and are styled solid and bold, ahead of the dimmed, dashed auto tags
- **Tag Library** - Optionally save labels you reuse, each with its own colour, in settings. Saved labels are offered as autocomplete wherever you add a tag, and recolouring one updates every chip carrying it instantly — no recompute, no page reload. Entirely optional: you can still type any tag by hand and never open the library
- **Auto Tags from Forum Activity** - Automatically tag users by the forums/sub-forums they post in most, using your short names (configurable threshold and max tags per user). Auto tags are stored separately from your own tags, so regenerating never overwrites tags you added by hand. Turning auto-tagging off just hides them — the computed tags and the collected activity are kept, so switching it back on is instant and needs no recompute. The shipped dataset can also include per-megathread tags for specific threads (chips link to the thread); everything else stays lumped into its forum
- **Forum Short Names** - Map long forum names to short labels used on tags. Forums populate this list automatically as you browse
- **Passive Activity Collection** - As you read threads, each post is counted toward its author's per-forum activity table. No extra network requests — the table builds up as you browse normally. Each thread page is recorded once it's counted, so reloads, revisits, and re-crawls never double-count it
- **Hide Tags** - Hide all tag chips globally (a toggle in settings and on the dashboard) or hide a specific user's chips from the Tag Manager. Chips update live everywhere
- **Accurate Per-User Counts** - On a profile, "Generate from forum activity" crawls that user's own posts for an exact per-forum breakdown (and refreshes their auto tags)
- **Bounded Crawler** - Opt-in, throttled crawl to populate the activity table for many users at once. Crawl buttons appear directly on the pages: on a forum — "Crawl this forum", a "Crawl" button per sub-forum box, and "Crawl all sub-forums"; on a thread — "Crawl this thread" (reads every page, ideal for megathreads). A floating progress/Stop HUD shows status. Hard caps bound the work and it auto-stops the moment it sees a non-200 response or a proof-of-work challenge page
- **Tag Manager** - A dedicated full-page dashboard (opened in its own tab) listing every tagged user with their manual and auto tags, forum activity, and top forums; plus auto-tag settings, forum short names, live crawl status, recent-crawl history, and JSON export/import
- **Export / Import** - Back up or transfer all tags, your tag library, forum short names, and activity as a JSON file
- **Preloaded Dataset** - The extension can ship with a prebuilt activity + tags dataset (`data/preload.json`), imported once per release in merge mode (never overwrites your own manual tags) so users get tags out of the box without crawling. It is generated offline by the author's crawler ([`kf-tag-crawler`](#preloaded-dataset-generation)); nothing is ever uploaded from the user's browser

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

### Firefox for Android

This extension is desktop-only. A separate, much smaller Android build lives in [`../mobile`](../mobile/README.md) and ships just User Muting, the Native Video Player, and the two homepage cleanup options. See its README for building, signing, and the install-from-file steps.

Note that these files are **shared** with that build — it copies them rather than forking them, so changes here land there too:

```
src/features/user-muting.js
src/features/native-video-player.js
src/homepage-content.js
src/homepage-hide.css
```

Mobile-only styling belongs in `mobile/src/features/user-muting.css`, which mirrors the class names in `src/features/user-muting.css`. `homepage-hide.css` is shared rather than duplicated because it is functional, not cosmetic.

## Usage

### Settings Page
Click the extension icon in your browser toolbar to open the full settings page in a **new browser tab** (also reachable via `chrome://extensions` → KEES → Details → Extension options). Settings are laid out as a responsive multi-column grid of cards:
- **Cosmetics** - Toggle homepage chat and sponsored content visibility
- **Post Settings** - Attachment EXIF stripping, mute disruptive guests, reaction filter thresholds
- **Chat Settings** - Mention notifications, mute gambling, undelete messages, scrollback limit, global whisper box, whisper retention, hide whispers in main chat
- **Zipline Upload** - Configure URL, API key, and EXIF stripping for image uploads
- **Bot Column** - Move bot messages to a separate column
- **@everyone List** - Manage usernames for @everyone expansion
- **PII Guard** - Toggle outgoing message protection and manage protected strings (displayed masked in the UI for shoulder-surfing resistance)
- **Filtered Keywords** - Manage words/phrases to hide from incoming chat messages
- **Muted Users** - Manage your muted users list
- **User Tags** - Toggle auto-tagging and tag chips, edit your **tag library** (reusable labels and their colours), and open the **Tag Manager** — the dedicated page where per-user tagging lives (tagged-user list, activity, crawls, short names, backup)

### Tag Manager
Open it from the settings page ("Open Tag Manager →") or the "Manage all tags →" link on any member profile. It opens in its own tab and provides:
- **Summary stats** - Tagged users, manual/auto tag counts, forums tracked, total posts recorded
- **Tagged Users table** - Every user with tags or recorded activity; search by username or tag, sort by posts/name/manual count, add manual tags inline with a colour picker and saved-label autocomplete, remove them, and expand a user's full per-forum breakdown. Auto-tag chips and the per-forum breakdown link to the source forum/sub-forum
- **Auto-tagging** - Enable/disable, threshold %, max tags per user, and a recompute button
- **Forum Crawler** - Live crawl status (updates across tabs), a recent-crawl history log, crawl limits (delay, threads per forum, thread-page cap), and start-by-ID controls for forums or a single thread/megathread (needs an open kiwifarms.st tab)
- **Forum Short Names** - Edit the short label used on tags for each forum; the forum name links to that forum/sub-forum
- **Backup** - Export/import all tagging data as JSON

### Chat Page
The emote bar and format bar appear above the chat input when you're on a chat page.

### Forum Threads
- **Featured Posts** - Click the golden "Featured" button in the pagination area to collect featured posts from nearby pages
- **Mute Users** - Click the "Mute" button next to any post to hide all posts from that user
- **Disruptive Guests** - Posts from disruptive guests are automatically hidden (click to reveal)
- **Reaction Filter** - Posts exceeding the negative reaction threshold are automatically collapsed

### User Profiles
- **Forum Activity** - Open the "Forum Activity" tab on the profile and click "Analyze Forum Activity" to see which forums a user posts in most (results are cached locally). "Export JSON" saves the underlying data — aggregates and raw post records — as a file. Analyses cached before this feature existed hold no post records; hit "Refresh Analysis" once to capture them
- **User Tags** - In the "User Tags" box, add your own tags or click "Generate from forum activity" to produce accurate forum-based auto tags. Tags appear as chips next to the user's name across the site. The box also appears on restricted profiles that show only the "limits who may view" notice, so those users can still be tagged (activity analysis is hidden there, since it has nothing to read)

### Forum Threads & Profiles
- **Tag Chips** - Users you've tagged show colored chips below the author's name in posts and on their profile header, your own tags first. Browsing threads also passively builds the per-user forum activity table used for auto tags
- **Crawl Buttons** - On a forum page, use "⟳ Crawl this forum" next to the title, the "Crawl" button on any sub-forum box, or "⟳ Crawl all sub-forums". On a thread page, use "⟳ Crawl this thread" to read every page of that thread (built for megathreads). A floating HUD shows progress and a Stop button; the crawl runs while you stay on the page

## Development

No build step required. All source files are loaded directly by the browser — no bundler, no transpilation, no minification. Load the `extension/` directory directly in your browser to develop.

### Project Structure
```
extension/
├── manifest.json          # Extension manifest (MV3)
├── icons/
├── data/
│   └── preload.json       # Prebuilt activity + tags shipped with the extension (author-generated)
├── settings/              # Full-page settings UI (opens in a tab)
│   ├── settings.html
│   └── settings.js
├── tags/                  # Tag Manager dashboard (opens in a tab)
│   ├── tags.html
│   └── tags.js
└── src/
    ├── background.js      # Service worker (also opens the settings tab on icon click)
    ├── homepage-content.js # Homepage script
    ├── whisper-content.js  # Global whisper/chat box
    ├── bootstrap.js        # Chat page initialization
    ├── homepage-hide.css
    ├── core/              # Core modules
    ├── ui/                # UI components
    ├── features/          # Feature modules
    │   └── tagging/       # User tagging (store, preload, passive scanner, display, member UI, crawler + in-page buttons)
    ├── util/              # Utilities
    └── bootstrap.js       # Initialization
```

## Preloaded Dataset Generation

The built-in tag dataset (`data/preload.json`) is produced offline by a separate,
author-run tool: **kf-tag-crawler** (Python). It logs into the forum with your own
session, solves the Tartarus proof-of-work, crawls the forums/threads you choose,
tallies per-user activity, computes auto-tags, and writes the bundle here.

Workflow:
1. In `kf-tag-crawler`, run e.g. `python crawl.py --cookies-file cookies.txt --forums 41,19 --out /path/to/this-extension/data/preload.json --preload-version N`.
2. Bump `preloadVersion` each time you ship new data — the extension re-imports it once per release.
3. Commit the updated `data/preload.json` and release.

The dataset uses the same JSON shape as the Tag Manager's Export, so you can also hand-craft or edit it. Importing is merge-only and never touches users' own manual tags or preferences. See the kf-tag-crawler README for full options and the (one-account) ban-risk caveats.

## License

MIT
