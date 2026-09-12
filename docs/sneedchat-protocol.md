# SneedChat WebSocket protocol

There is no official specification for this protocol. What follows is reverse
engineered, and it is written down because KEES parses these frames in two
places and depends on how the client renders a third.

**Sources, and how far each can be trusted:**

| Source | Where | Trust |
|---|---|---|
| Frames captured off the wire | This document's examples | Authoritative, but only for the cases actually observed |
| The minified client | `other-scripts/chat.js`, tracked | Authoritative for everything it handles, since it has to. But this snapshot is from 2026-03-25 and **predates the whisper change below** - the live build handles at least one thing this copy does not |
| ruforo's chat server | `ignore/ruforo/src/web/chat/*.rs`, untracked and local-only | **Historical.** The open-source ancestor, since diverged - it still keys messages by a `u32` `message_id` where the live server uses a UUID string, and knows nothing of whispers, MOTDs or permissions. Good for connection lifecycle and command parsing, not for payload shapes |

Anything below marked *(ruforo-era)* comes only from that old server and has not
been confirmed against the live one.

## Transport

The URL comes from `APP.chat_ws_url`, set inline on any chat page. The client
overrides its host, port and scheme with the current page's before connecting,
so only the path of that URL really matters:

```js
const url = new URL(APP.chat_ws_url);
url.hostname = location.hostname;
url.port     = location.port;
url.protocol = location.protocol === 'http:' ? 'ws:' : 'wss:';
```

Authentication is by cookie: there is no login frame and no token in the URL.
*(ruforo-era: the session is resolved from `xf_session` during the HTTP upgrade,
and a failed resolve yields a guest session - user id `0`, username `Guest` -
rather than a rejected connection. The live client's skipping of user id `"0"`
in presence frames suggests the guest bucket still works this way.)*

Every frame in both directions is text. There is no application-level ping: the
server sends WebSocket ping control frames and the browser pongs automatically
*(ruforo-era: 1s interval, 5s timeout)*.

On close the client waits 3 seconds and reconnects, then **re-joins the room and
replays the entire join sequence**. This matters more than it sounds - see
[Replay](#replay).

## Client to server

Frames are plain text, trimmed. A frame that does not start with `/` is posted
as a message to the currently joined room; with no room joined *(ruforo-era)*
the server replies `You say something to yourself. Nobody replies.`
*(ruforo-era: frames of 1024 bytes or more are dropped silently.)*

| Command | Sent as | Notes |
|---|---|---|
| `/join <room_id>` | `/join 15` | Decimal room id. Triggers the join sequence below |
| `/edit <json>` | `/edit {"uuid":"<uuid>","message":"<bbcode>"}` | Note `uuid`. ruforo used `{"id": <u32>, ...}` - that form is dead |
| `/delete <uuid>` | `/delete 33f93aab-...` | ruforo took a numeric id here too |
| `/motd <uuid>` | `/motd 814e4032-...` | Pins an existing message as the room MOTD. Gated on `can_motd` |
| `/w @<user>, <text>` | `/w @Lach, hello` | Whisper. The comma is part of the format. Server-side only - the client just builds the string and posts it as an ordinary message frame |
| `/reset` | `/reset` | *(ruforo-era)* Server restart hook |

The list is not closed. Anything else beginning with `/` is passed through as a
normal frame, so server-side commands the client knows nothing about cannot be
enumerated from it. *(ruforo-era: an unrecognised command came back as
`Unknown command: "/foo"`.)*

KEES sends `/join` (`src/whisper-content.js`), `/edit` (`src/wave-edit-page.js`,
via a hook on `WebSocket.prototype.send` to reuse the page's own socket) and
`/w` (`src/features/whisper-box.js`, typed into the real chat input).

## Server to client

One JSON object per frame, with one or more of the top-level keys below.

A frame that fails to parse as JSON is not an error: the client renders the raw
text as a system line. Errors and command replies arrive this way.

| Key | Type | Meaning |
|---|---|---|
| `messages` | array | New messages, edits and replayed history, all in one shape |
| `delete` | array of uuid | Messages to remove from the room |
| `users` | map of id to user | Presence: joins, and the full roster on join |
| `user` | map of id to `false` | Presence: departures. Only `false` values are meaningful |
| `whisper` | message object | A single live whisper |
| `motd` | message object or `null` | Room MOTD. `null` clears it |
| `permissions` | object | What this user may do in this room |
| `system` | string | Server notice, rendered as a system line |
| `history` | `true` | Marks a `messages` frame as replayed backlog, not live |

Keys combine freely in one frame, and the client checks each independently.

### The join sequence

After `/join <id>` the server sends, in order:

1. `{"permissions": {...}}`
2. `{"motd": {...}}` - omitted where the room has none
3. `{"messages": [...], "history": true}` - the backlog, oldest first
4. `{"users": {...}}` - the full roster

Steps 1 to 3 are as captured off the wire; the roster is placed last from
ruforo's ordering and the client's handling, not from a capture.

The client resets its permissions to all-false and clears the MOTD before every
join, so a room with neither leaves both unset rather than inheriting the last
room's.

### Message objects

Used by `messages[]`, `whisper` and `motd` alike:

```json
{
    "author": {
        "id": 86684,
        "username": "Lach",
        "avatar_url": "/data/avatars/m/86/86684.webp?1781319638"
    },
    "message": "rendered <strong>HTML</strong>",
    "message_raw": "rendered [b]BBCode[/b]",
    "message_uuid": "33f93aab-e0f2-4476-8d83-3452f4ada72d",
    "message_date": 1789227855,
    "message_edit_date": 0,
    "room_id": 15
}
```

- `message` is server-rendered HTML, sanitized server-side, which the official
  client inserts with `innerHTML` and does not sanitize again. KEES does not
  extend it that trust: `whisper-content.js` runs it through `sanitizeHTML()`
  before rendering.
- `message_raw` is the BBCode source, used to populate the edit box.
- `message_uuid` is the identity. It is the only stable handle a message has,
  and `/edit`, `/delete` and `/motd` all address messages by it.
- Dates are Unix seconds. `message_edit_date` is `0` when never edited.
- `avatar_url` is site-relative and may be empty.

**Edits arrive as ordinary `messages` entries** carrying an existing
`message_uuid`. There is no separate edit frame - a client is expected to look
the uuid up and replace in place, and to treat a miss as a new message. The one
special case the client handles is an edit whose uuid matches the current MOTD,
which updates the MOTD instead.

### Whispers

Whispers carry a `recipient` shaped like `author`, and `room_id: 0`:

```json
{
    "author":    { "id": 74817,  "username": "...", "avatar_url": "..." },
    "recipient": { "id": 128362, "username": "...", "avatar_url": "..." },
    "message": "this is a whisper",
    "message_raw": "this is a whisper",
    "message_uuid": "6133fe81-8706-47f5-8094-b0bc9e43d6c1",
    "message_date": 1789227835,
    "message_edit_date": 0,
    "room_id": 0
}
```

Direction is derived, not stated: the conversation partner is `recipient` when
`author.id` is your own id, and `author` otherwise.

**Protocol change, September 2026.** Whispers used to arrive only as a live
`{"whisper": {...}}` frame. They now *also* ride inside the `messages` array of
the join sequence, as the whisper backlog, distinguishable only by carrying a
`recipient`. Both forms are live. A client that iterates `messages` without
checking for `recipient` will mix private whispers into the room log - which is
exactly what the `other-scripts/chat.js` snapshot here does, since it routes
every `messages` entry through the room renderer. The deployed client renders
the backlog as proper whisper bubbles, so it has been updated since.

### Deletions

```json
{ "delete": ["33f93aab-e0f2-4476-8d83-3452f4ada72d"] }
```

The client removes the element outright; there is no tombstone and no reason
given. Whether a deleted message is simply absent from a later backlog, or
whether the deletion is replayed too, has not been checked - KEES's undelete
works by intercepting the removal, so it has never had to care.

### Presence

```json
{ "users": { "86684": { "id": 86684, "username": "Lach",
                        "avatar_url": "...", "last_activity": 1789227855 } } }
{ "user":  { "86684": false } }
```

`users` carries the full roster on join and a single entry when someone joins.
`user` is only ever used for departures - the client ignores any entry whose
value is not `false`. User id `"0"` is the guest bucket and is skipped.

### Permissions

Sent once per join, before anything else. All ten keys are always present:

```json
{ "permissions": {
    "can_view": true,       "can_send": true,
    "can_edit_own": true,   "can_edit_other": false,
    "can_delete_own": true, "can_delete_other": false,
    "can_report": true,     "can_view_deleted": false,
    "can_undelete": false,  "can_motd": false
} }
```

The client uses them to disable the input (`can_send`) and to strip per-message
action buttons: `.edit` on `can_edit_own` / `can_edit_other`, `.delete` on
`can_delete_own` / `can_delete_other`, `.pin` on `can_motd`, and `.report` on
`can_report` for other people's messages only. Reporting is not a socket
command - the button links to `/chat/messages/<uuid>/report`.

`can_view_deleted` and `can_undelete` appear in the client only in the
all-false reset literal. Nothing reads them, so whatever they gate is either
server-side or not yet built.

## Replay

Every join replays the backlog, and every reconnect re-joins - so an idle tab on
a flaky connection replays the same messages repeatedly. The room log tolerates
this because messages are keyed by uuid and replace in place.

Anything that *accumulates* rather than replaces has to deduplicate. That is
what broke KEES when whispers moved into `messages[]`: the whisper box retains
conversations across sessions, so each join appended the whole backlog again.

Note the `history: true` flag distinguishes a replayed `messages` frame from a
live one. Only code reading the socket can use it; code reading the DOM cannot,
because the client renders backlog and live messages identically. KEES
deduplicates on `direction|timestamp|body` instead, since the DOM gives whispers
no uuid.

## What KEES depends on

| File | Reads | Breaks if |
|---|---|---|
| `src/whisper-content.js` | The socket directly: `system`, `messages` (skipping `recipient`), `users`, `user` | Frame keys or the whisper marker change |
| `src/features/whisper-box.js` | DOM: `.chat-message--whisper` and its `data-whisper-partner`, `data-whisper-partner-id`, `data-author`, `data-timestamp` | The client stops setting those datasets, or starts giving whispers a uuid (which would be an improvement - see below) |
| `src/chat-messages-page.js` | DOM: `.chat-message` removals, driven by `delete` frames | The client stops removing nodes to delete them |
| `src/wave-edit-page.js` | Sends `/edit` on the page's own socket | The `/edit` payload shape changes again |
| `src/capture-chat-config.js` | `APP.chat_ws_url`, `APP.user` | The inline config moves or is renamed |

The DOM-reading paths are the fragile ones. The client sets
`id="chat-message-<uuid>"` on room messages but **not** on whispers, which is
the whole reason whisper deduplication needs a composite key. If that ever
changes, key on the uuid instead.

## Not established

- Whether the live server still enforces ruforo's 1024-byte frame limit.
- The full set of server-side slash commands. `/w` is known because the client
  composes it; others would only show up by trying them.
- Whether `system` and raw non-JSON frames are both still emitted, or whether
  `system` has replaced the plain-text replies ruforo used.
- What `can_view_deleted` and `can_undelete` gate.
