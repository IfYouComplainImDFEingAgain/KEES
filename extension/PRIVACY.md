# KEES Privacy Policy

_Last updated: 2026-06-05_

Kiwi Extra Enhancement Suite (KEES) is a browser extension that adds quality-of-life features to the Kiwi Farms chat and forum interface. This document describes what data the extension handles and how.

## Summary

KEES does not collect, transmit, sell, or share any personal data. It has no analytics, no telemetry, no remote logging, and no author-operated backend. All user data stays on your device.

## What is stored locally

KEES uses `chrome.storage.local` to persist your settings and state across browser sessions. The following data is stored **only on your own device** and is never transmitted to the extension author:

- Custom emote list and emote bar configuration
- Image blacklist
- Whisper history and whisper box position/size
- Watched users list and watched-users panel state
- Muted users list and chat-mute preferences
- `@everyone` mention list
- BBCode / WYSIWYG editor mode preference
- Keyword filter list (words/phrases to hide from incoming chat messages)
- PII guard protected strings (personal information patterns used to block outgoing messages — stored locally, never transmitted, never injected into the page DOM)
- Feature toggles (keyword filter, PII guard, gambling filter, homepage cleanup, etc.)
- UI state (collapsed panels, tab selections, last visited chat room)
- Zipline image host URL and API key (only if you choose to configure Zipline uploads)
- User tags you create — both manual tags and auto-generated forum-activity tags — including the usernames and user IDs of the forum members they apply to
- Per-user forum post-activity counts collected as you browse threads or run the tagging crawler
- Forum short-name (alias) mappings and tagging settings (auto-tag threshold, crawler scope and limits, tag-chip visibility and per-user hide list)
- A per-thread record of which page numbers have already been counted, used only to avoid double-counting activity
- Join dates of chat participants (one entry per user id), cached so the "New Account Badge" feature only ever reads a given member's profile once

Some tag and forum-activity data may arrive as a **prebuilt dataset shipped inside the extension** (generated offline by the author) rather than collected on your device. It is loaded into local storage on update, in merge mode so it never overwrites tags you created, and — like everything else here — is never sent anywhere.

You can inspect or clear this data at any time via `chrome://extensions` → KEES → "Storage" (or by removing the extension).

## What is sent to external services

KEES makes network requests only in response to explicit user actions or to features you enable. It never sends data to a server controlled by the extension author, because no such server exists.

| Destination | When | What is sent |
|---|---|---|
| `kiwifarms.st` (chat WebSocket and forum pages) | Whenever you use Kiwi Farms normally | The same requests your browser would make without the extension. KEES adds no tracking. |
| `kiwifarms.st` (forum, thread, and member-search pages) | Only when you click "Analyze Forum Activity" / "Generate from forum activity" on a profile, or start the tagging crawler | Authenticated same-site page requests (using your existing session) to read public post/forum data for building the activity table. Throttled, bounded, and never sent anywhere off your device. |
| `kiwifarms.st` (member profile pages) | When the "New Account Badge" feature is enabled and someone posts in chat whose join date is not already cached | An authenticated same-site request for that member's public profile page, to read the "Joined" date. One request per user, ever; serialised with a delay; the result stays on your device. |
| `www.youtube.com` (oEmbed API) | When the chat contains a YouTube link and the "YouTube titles" feature is enabled | The public URL of the YouTube video, to retrieve its title and thumbnail. No cookies, no user info. |
| Your Zipline instance | Only if you have configured a Zipline server and manually upload a file through KEES | The file you chose to upload, plus your Zipline API key (used for authentication with _your own_ Zipline server). |

No other outbound requests are made.

## Notifications

The `notifications` permission is used solely to display a desktop alert when you are `@`-mentioned in chat or when a watched user posts while the chat tab is not focused. Notification content is generated locally from the chat message; nothing is sent anywhere.

## Host permissions

KEES requests host access to `https://kiwifarms.st/*`. This access is required to inject content scripts into chat and forum pages so the extension can modify the DOM to render its UI and features. KEES does not request access to any other website.

## Remote code

KEES does not download or execute remote code. All JavaScript is packaged inside the extension at publish time. External network requests return data (JSON, images, files) — never executable code.

## Data sharing

KEES does not share, sell, rent, or transfer any user data to any third party, because it does not collect any user data to share in the first place.

## Children

KEES is not directed at children and does not knowingly collect any information about any user, child or adult.

## Changes to this policy

If the extension is updated in a way that changes how data is handled, this document will be updated in the same release. The "Last updated" date at the top reflects the most recent revision.

## Contact

Questions about this policy can be raised as an issue on the extension's source repository.
