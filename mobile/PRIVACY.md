# KEES Mobile Privacy Policy

_Last updated: 2026-08-08_

KEES Mobile is a Firefox for Android extension that hides posts from muted users and swaps the site's video player for the browser's own, on Kiwi Farms thread pages. This document describes what data the extension handles and how.

## Summary

KEES Mobile does not collect, transmit, sell, or share any personal data. It has no analytics, no telemetry, no remote logging, and no author-operated backend. All data stays on your device.

## What is stored locally

KEES Mobile uses `chrome.storage.local` to persist two things, **only on your own device**:

| Key | Contents |
|---|---|
| `sneedchat-muted-users` | The list of usernames you have chosen to mute |
| `kees-native-video-player` | Whether the native video player is enabled (a single true/false) |

That is the complete list. You can clear it by removing the extension.

## What is sent to external services

Nothing. KEES Mobile makes no network requests of its own. It only reads and modifies pages your browser has already loaded from `kiwifarms.st`, and the native video player points a standard `<video>` element at the same attachment URL the site's own player would have used.

There is no author-operated server to send anything to, because none exists.

## Permissions

- **`storage`** — to save the two values above across browser sessions.
- **Host access to `https://kiwifarms.st/*`** — required to inject content scripts into thread pages so the extension can hide muted posts and replace media players. No other website is accessed.

KEES Mobile requests no other permissions. It has no background script, no notifications, and no tab access.

## Remote code

KEES Mobile does not download or execute remote code. All JavaScript is packaged inside the extension at publish time, unbundled and unminified.

## Data sharing

None. There is no collected data to share.

## Children

KEES Mobile is not directed at children and does not knowingly collect any information about any user, child or adult.

## Changes to this policy

If the extension is updated in a way that changes how data is handled, this document will be updated in the same release. The "Last updated" date at the top reflects the most recent revision.

## Contact

Questions about this policy can be raised as an issue on the extension's source repository.
