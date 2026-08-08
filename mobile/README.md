# KEES Mobile

A deliberately small Firefox for Android build of KEES. It ships these features and nothing else:

- **User Muting** — hide posts from specific users on thread pages, with a Mute/Unmute button on every post and a collapsed "click to reveal" placeholder in place of the hidden post.
- **Native Video Player** — replace the site's Ephyra player with the browser's own `<video>` / `<audio>` element, so Android's native controls and background/PiP behaviour apply.
- **Disable Homepage Chat** — hide the chat widget on the forum homepage.
- **Remove Sponsored Content** — hide sponsored banners on the homepage.

The two homepage options are applied at `document_start` via a stylesheet that hides both by default and un-hides whatever you have not disabled, so nothing flashes on screen before it disappears.

The desktop extension is ~17,000 lines across 60 files, with 33 content scripts on the chat page alone. Almost none of it is useful on a phone and all of it costs battery. This build is ~590 lines, asks for one permission (`storage`), and has no background script.

## What is deliberately not here

Chat (the whole Sneedchat feature set), user tagging and the crawler, whisper, YouTube titles, keyword/gambling/reaction/disruptive-guest filters, EXIF stripping, Zipline upload, featured posts, forum activity analysis. Use the desktop extension for those.

## Relationship to the desktop extension

These files are **not** committed here. `build.sh` copies them from `../extension/` to the same relative path, so a fix on the desktop side lands on mobile too, and they are listed in the repo `.gitignore`:

```
src/features/user-muting.js
src/features/native-video-player.js
src/homepage-content.js
src/homepage-hide.css
```

`homepage-hide.css` is shared because it is functional — it hides elements before first paint, and the JS toggles its restore classes. `src/features/user-muting.css` is the opposite case: pure presentation, so mobile keeps its own touch-sized copy (44px targets, larger type, a toast that clears the Fenix bottom toolbar) sharing class names with `extension/src/features/user-muting.css`. **Mobile-only changes go in that stylesheet, never in a divergent copy of the JS.**

Storage keys match the desktop build: `sneedchat-muted-users`, `kees-native-video-player`, `sneedchat-disable-homepage-chat`, `kees-disable-sponsored`. The two are separate add-ons with separate storage, so nothing syncs automatically — matching keys just means a value moved between them lands in the right place.

## Building

```bash
./mobile/build.sh          # sync the two shared feature scripts
./mobile/build.sh --zip    # sync, then write kees-mobile-<version>.zip to the repo root
```

Run the sync before loading the extension for the first time and after touching either shared file. No bundler, no transpilation — the zip is the source.

## Development

**On desktop first** (same Gecko engine, much faster iteration):

1. `./mobile/build.sh`
2. `about:debugging` → This Firefox → Load Temporary Add-on → pick `mobile/manifest.json`
3. Use Responsive Design Mode at 412×915 with touch simulation to check layout and tap targets

**On the phone**, over USB:

1. Firefox for Android → Settings → enable **Remote debugging via USB**
2. ```bash
   npx web-ext run -t firefox-android \
     --android-device <adb-device-id> \
     --firefox-apk org.mozilla.fenix \
     --source-dir mobile
   ```

This installs a temporary, unsigned build and needs no AMO account. It disappears when Firefox restarts.

**Linting** — run what CI runs:

```bash
npx web-ext lint --source-dir mobile --ignore-files build.sh
```

## Releasing

Bump `version` in `manifest.json`, then push a `kees-mobile-vX.Y.Z` tag. `.github/workflows/package-mobile.yml` syncs the shared scripts, verifies every path the manifest references, lints, zips, and attaches the result to a GitHub Release. Mobile versions independently of the desktop extension, which uses `kees-vX.Y.Z`.

If `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` repository secrets are set, the workflow also runs `web-ext sign --channel unlisted` and attaches the signed `.xpi`. Without them it still produces the unsigned zip.

## Installing on Firefox for Android

**Firefox for Android enforces Mozilla signatures on every channel — release, beta and nightly.** There is no pref to turn that off. The unsigned zip from a GitHub Release will not install on stock Firefox; only an AMO-signed `.xpi` will. Two ways to get one:

- **Unlisted signing** (private): `web-ext sign --channel unlisted` with AMO API credentials. AMO signs it without a public listing or a review queue.
- **Listed on AMO** (public): a normal AMO submission, which puts up a public listing and goes through review.

Either way the resulting `.xpi` installs the same way. Note that installing straight from a web link does not work on Android — the browser just downloads the file, and you install it from there:

1. Download the `.xpi` on the phone.
2. Firefox → Settings → About Firefox → tap the logo **five times** ("Debug menu enabled").
3. Back to Settings → **Install add-on from file**.
4. Pick the downloaded `.xpi` and confirm.

Requires Firefox for Android 142 or later (`browser_specific_settings.gecko_android.strict_min_version`).

The `.xpi` installed this way persists across browser restarts, unlike the `web-ext run` development install.

## Usage

- **Mute a user** — tap **Mute** on any of their posts. The post collapses to a placeholder; tap the placeholder to reveal it anyway.
- **Manage the list** — the add-on's Settings page (Firefox menu → Add-ons → KEES Mobile → Settings, or the KEES Mobile entry in the main menu). Add users by name, or Remove to unmute.
- **Native video** — off by default. Turn it on in Settings, then reload a thread with a video attachment.
- **Homepage cleanup** — both off by default. Turn them on in Settings, then reload the homepage.

## Privacy

No data collection, no telemetry, no backend. See [PRIVACY.md](PRIVACY.md).
