# P2P Architecture

This document explains how Zenith TV's peer-to-peer player control works —
the problems it solves, the message protocol, and how the state flows
between two devices so that a "remote control" device can mirror the
exact player state of the device that actually renders video.

---

## 1. Goals

Zenith TV runs on multiple platforms (Electron desktop, Tizen TV, Flutter
Android) and each of them can act either as:

- **Player** — the device that actually hosts a native video player
  (VLC on desktop, AVPlay on Tizen) and renders the stream on screen.
- **Remote control** — a device that does NOT play video locally, but
  displays the player's UI (time, tracks, current item, controls) and
  forwards user commands (play/pause/seek/track selection) over the
  network to the player.

The core requirements are:

1. A remote control can pair with a player over the local network and
   immediately show the exact same playback state.
2. After pairing, every change on the player (time tick, track change,
   subtitle delay, volume, state transition) reflects on the remote
   control with sub-second latency.
3. Commands from the remote control are honored by the player as if the
   user had pressed buttons locally.
4. The two devices share the same M3U content library, so that
   `currentItem` resolves to the same poster/title/description on both
   ends without having to serialize the entire `WatchableObject` over
   the wire.
5. The protocol is **identical across platforms**. A desktop-as-server
   talking to a Tizen-as-client must speak the exact same wire format as
   two desktops talking to each other.

---

## 2. Problems We Had to Solve

### 2.1 "Two stores, two truths" problem

Initially the plan was for the server (remote control) to have its own
independent player store that would be updated by polling
(`state_update` every 2 seconds). This had several problems:

- **Paused state looks dead.** When VLC is paused it emits no events.
  A 2-second poll would still work, but the remote UI would lag behind
  any track change or settings update until the next tick.
- **Stale data at the moment of connection.** The very first time a
  remote connects, it has nothing — no duration, no track list, no
  `currentItem`. It needs a complete snapshot *once* before incremental
  updates start making sense.
- **Two separate data shapes.** "Full snapshot" and "incremental update"
  would have been two different message types, with two different
  handlers, drifting apart over time.

**Solution (Approach B — raw event forwarding):**

The real VLC player on the client side already emits structured events
(`mediaInfo`, `playerInfo`, `currentVideo`) through `VlcEventData`. We
forward those events **unchanged** over P2P as `client_event` messages,
using `ClientEventData` as the wire type (a type alias of `VlcEventData`).
The server side has a *mirror* store whose handler is a side-effect-free
copy of the VLC handler — it takes the same `ClientEventData` and applies
it to its own state fields. One handler family, one wire format, zero drift.

For the initial sync, the server sends `state_request`. The client
responds with a single `client_event` whose payload is a **synthetic**
full-state snapshot — the same shape as any other event, just with all
three sub-objects populated at once. The server's mirror handler
doesn't know or care that this event is synthetic; it just applies it.

### 2.2 `currentItem` over the wire

`WatchableObject` is a rich domain object: poster URLs, metadata, user
data, parent group references, etc. Serializing it over P2P on every
update would be wasteful and fragile (parent references don't
round-trip cleanly).

**Solution:** Both sides already have the same M3U library loaded (the
profile sync flow guarantees this — see §7). So instead of sending the
object, we send only the **URL** of the currently-playing item. The
receiving side uses `contentStore.findByUrl(url)` to resolve it locally.

The URL travels in `MediaInfo.url` — an optional field that is only
populated in two cases:

1. The client is forwarding its own real `mediaInfo` event to the
   server (client injects `currentItem.Url` into `mediaInfo.url` right
   before sending).
2. The client is building a full-state snapshot in response to
   `state_request` (same injection).

For normal per-change events (e.g. `currentVideo.time`), `mediaInfo` is
not present, so there's nothing to inject. The server just updates time
on its mirror store and keeps the previous `currentItem`.

### 2.3 Tizen has no central event stream

Desktop VLC calls a C++ callback for every state change, which we
bridge to `VlcEventData` and forward. Tizen AVPlay has no equivalent —
it has per-callback hooks (`oncurrentplaytime`, `onbufferingprogress`,
…) but no unified event that says "time changed from X to Y, here is
the full current state".

**Solution:** On Tizen, we don't try to forward per-event. Instead,
the Tizen P2P manager:

- On `state_request`: builds and sends a full `client_event` snapshot once.
- On a fixed interval (500 ms): builds and sends a full `client_event`
  snapshot again.

It's the same wire format as the desktop's per-event forwarding — the
server's mirror handler can't even tell the difference. Tizen just pays
a little bandwidth for not having callbacks.

### 2.4 Circular imports between player and P2P stores

The desktop `vlcPlayer` store needs to call `p2pStore.sendToRemote()` to
forward events, AND the `p2pStore` needs to route incoming commands to
the `vlcPlayer` store. Directly importing both ways creates a cycle
that Vite and TypeScript both dislike.

**Solution:** A module-scope callback pattern. The `p2pStore` exposes
`setClientMessageHandler(fn)`. On startup, `vlcPlayer._setupEventListeners`
registers its routing function there. When a P2P message arrives in
client mode, `p2pStore` just calls `clientMessageHandler(message)`
without knowing or importing `vlcPlayer` — the cycle is broken at the
import graph level.

### 2.5 Proxy actions being overwritten

The desktop `universalPlayerStore` is a thin facade that, at runtime,
delegates actions to either `vlcPlayerStore` or `p2pPlayerStore`
depending on the current P2P mode. It also subscribes to both source
stores and mirrors their state fields into its own state, so React
components can read from one store regardless of which one is active.

The subtle bug: Zustand's `set()` does a shallow merge. If you do
`set(sourceStoreState)` from inside a subscribe callback, Zustand will
happily merge the *action functions* from the source store too —
overwriting the universal store's proxy functions with the source
store's own functions, which close over the wrong store. The result:
calls silently stop hitting the active store.

**Solution:** `pickState()` helper, typed with `Omit<UniversalState,
action keys>`, that projects only the state fields out of a snapshot.
All subscribe callbacks go through `pickState` so proxy actions stay
intact.

---

## 3. Actors and Modes

### 3.1 Desktop (Electron)

The desktop app can operate in three P2P modes, selected by
`p2pStore.mode`:

- **`off`** — P2P is disabled. `universalPlayerStore` proxies to the
  local `vlcPlayerStore`. Standard single-device usage.
- **`client`** — This device is a real player and is connected to a
  remote server that wants to control it. VLC runs locally. The client
  forwards every VLC event over the wire and accepts incoming
  `open` / `playback` / `audio` / `video` / `subtitle` / `window` /
  `shortcut` commands. `universalPlayerStore` still proxies to the
  local `vlcPlayerStore`, because VLC is the source of truth.
- **`server`** — This device is a remote control ("kumanda"). It does
  NOT run VLC. `universalPlayerStore` proxies to `p2pPlayerStore`, a
  mirror store fed exclusively by incoming `client_event` messages from a
  paired client. All user commands are forwarded to the client via
  `sendToPlayer()`.

The mode switch is live — `universalPlayerStore` subscribes to
`p2pStore.mode` changes and re-picks the active source store on the
fly.

### 3.2 Tizen

Tizen only has two modes:

- **Solo** — Standalone TV player. No P2P. AVPlay drives the UI.
- **Client** — Connects to a desktop server as a player. Accepts
  incoming commands (same set as desktop client mode) and broadcasts
  its state on a 500 ms interval, plus on-demand via `state_request`.

Tizen cannot be a server — a TV with no keyboard and no mouse makes a
lousy remote control, and the feature would duplicate a lot of desktop
UI code.

### 3.3 Android (planned)

The Android app targets three form factors — phone, tablet, and TV —
with different P2P role capabilities per form factor:

| Form factor | Client mode | Server mode | Notes |
|-------------|-------------|-------------|-------|
| **Phone**   | disabled    | enabled     | Phone acts as a remote control for a player device |
| **Tablet**  | enabled     | enabled     | Full desktop-equivalent experience; both roles supported |
| **TV**      | enabled     | disabled    | TV renders video; cannot act as a remote control |

The architecture supports all three roles in a single codebase — the
form factor is detected at startup and the unavailable role is simply
disabled in the UI and P2P store. The code paths themselves are shared.

Key use case driving the tablet/phone split: a phone connected to a TV
via HDMI puts the TV in player (client) mode while the phone acts as
the remote control (server). The tablet supports both because it can
either render video itself or control another device.

---

## 4. Wire Protocol

All messages share a common envelope:

```ts
interface P2PMessage<T = unknown> {
  type: string;
  payload?: T;
}
```

Transport is WebSocket (`ws://<host>:8080`). The server side is an
Electron-hosted combined HTTP + WebSocket server living in
`apps/desktop/electron/ipc/p2pServer.ts`. HTTP is used for
discovery/handshake; WebSocket carries the persistent control stream.

### 4.1 Message catalog

| Type              | Direction         | Payload                           | Purpose                                    |
|-------------------|-------------------|-----------------------------------|--------------------------------------------|
| `pair_request`    | server → client   | device info                       | Request pairing; client decides to accept  |
| `open`            | server → player   | `OpenOptions` (`{ file: string }`) | Load and start a stream                    |
| `playback`        | server → player   | `PlaybackOptions`                 | play / pause / stop / seek / rate          |
| `audio`           | server → player   | `AudioOptions`                    | Volume, mute, audio track, delay           |
| `video`           | server → player   | `VideoOptions`                    | Video track, scale, aspect ratio, …        |
| `subtitle`        | server → player   | `SubtitleOptions`                 | Subtitle track, delay                      |
| `window`          | server → player   | `WindowOptions`                   | Screen mode / resize / visibility          |
| `shortcut`        | server → player   | `ShortcutOptions`                 | Keyboard shortcut map (desktop-only)       |
| `state_request`   | server → player   | `Record<string, never>`           | Ask player to send a full snapshot now     |
| `client_event`    | player → server   | `ClientEventData`                 | Real or synthetic player event             |
| `profile_sync`    | bidirectional     | `ProfileSyncPayload`              | Profile / M3U / userData sync (see §7)     |

Note: `state_update` existed in an earlier version but has been replaced
by `client_event`. There is now exactly one message type for player-to-
server state transfer, regardless of whether it carries a real event or
a full snapshot.

### 4.2 `ClientEventData` shape

Defined in `shared/content/src/types/player.ts` as a type alias of
`VlcEventData` (the internal VLC event format and the wire format are
identical shapes, but named separately so call sites are unambiguous
about which role the data is playing):

```ts
interface VlcEventData {        // internal: VLC core → vlcPlayerStore
  mediaInfo?: MediaInfo;
  playerInfo?: PlayerSettings;
  currentVideo?: CurrentVideoState;
  shortcut?: ShortcutAction;
}

type ClientEventData = VlcEventData;  // wire: client → server over P2P
```

- `mediaInfo` — duration, seekability, track lists, and the optional
  URL injected by the forwarder. Sent when a new media is loaded or as
  part of a full snapshot.
- `playerInfo` — volume, muted, rate, screen mode. Sent when any of
  these change.
- `currentVideo` — time, state, buffering, position, video adjustments,
  delays, current track selection. Sent on every tick that moves one
  of these.
- `shortcut` — carries a keyboard shortcut action that the player
  invoked. Used so the server mirror can animate/flash the same UI.

A real VLC event typically has **one** of these populated (the one
that actually changed). A synthetic full-state event has all three.
The handler on both ends treats them uniformly.

---

## 5. Event Flow Diagrams

### 5.1 Initial connection

```
Server (desktop, mode='server')         Client (desktop or Tizen)
          │                                       │
          │  ── WebSocket connect ─────────────>  │
          │                                       │
          │  ── profile_sync (profile info) ────> │
          │                                       │ creates/selects
          │                                       │ profile, may
          │                                       │ request M3U
          │                                       │
          │  <──────── profile_sync ───────────── │ (M3U request
          │                                       │  or merged
          │                                       │  userData)
          │                                       │
          │  ── state_request (empty) ──────────> │
          │                                       │ builds full
          │                                       │ VlcEventData
          │                                       │ snapshot
          │  <──────── client_event ────────────  │ (mediaInfo with
          │                                       │  url + playerInfo
          │                                       │  + currentVideo)
          │                                       │
          │ p2pPlayerStore applies                │
          │ snapshot via mirror handler           │
          │ currentItem resolved via              │
          │ findByUrl(mediaInfo.url)              │
          │                                       │
```

After this single exchange the server has the complete, correct state.
It never needs to re-request unless something goes wrong and it wants
to resync.

### 5.2 Steady-state updates

**Desktop client → any server:**

```
VLC native event → vlcPlayerStore.handleVlcEvent()
                        │
                        │ applies locally (so local UI updates)
                        │
                        │ if mode === 'client' and this is a mediaInfo
                        │ event, inject currentItem.Url into
                        │ mediaInfo.url
                        │
                        └──> p2pStore.sendToRemote({
                               type: 'client_event',
                               payload: eventData
                             })

                    (network)

Server receives → p2pStore._handleMessage()
                        │
                        │ non-pairing, non-profile → routed to
                        │ p2pPlayerStore._handleRemoteVlcEvent()
                        │
                        │ same field-by-field application as the
                        │ local vlcPlayer handler, minus side effects
                        │ (no sticky saves, no track prefs writes,
                        │ no watch progress saves)
                        │
                        │ if eventData.mediaInfo?.url is set,
                        │ updates.currentItem =
                        │   contentStore.findByUrl(url) ?? null
                        │
                        └──> set(updates)

universalPlayerStore (in server mode) subscribes to
p2pPlayerStore, mirrors its state, and React renders.
```

**Tizen client → desktop server:**

```
500 ms interval fires
        │
        └──> tizenPlayerStore.getFullVlcEvent()
                    │
                    │ builds VlcEventData with all three sub-objects,
                    │ mediaInfo.url = currentItem.Url
                    │
                    └──> sendMessage({ type: 'client_event', payload })
```

Same receiver side as desktop. The server cannot tell that this is a
synthetic snapshot from Tizen vs. a real event from a desktop client.

### 5.3 Command flow (server → player)

```
User clicks "Play" on server UI
        │
        └──> useUniversalPlayerStore().playback({ action: 'play' })
                    │
                    │ mode === 'server', so delegates to
                    │ p2pPlayerStore.playback(...)
                    │
                    └──> p2pStore.sendToPlayer({
                           type: 'playback',
                           payload: { action: 'play' }
                         })

            (network)

Client receives → p2pStore._handleMessage()
                    │
                    │ mode === 'client', routed via
                    │ clientMessageHandler (registered by vlcPlayer)
                    │
                    └──> vlcPlayerStore.playback({ action: 'play' })
                              │
                              │ calls native VLC API
                              │
                              VLC emits state change event
                              │
                              └──> vlcPlayerStore.handleVlcEvent()
                                          │
                                          │ applies locally AND
                                          │ forwards as client_event
                                          │
                                          server's mirror updates
```

Notice the round trip: server never optimistically updates its own
state. It waits for the player's actual event to come back, so there's
no chance of the two sides disagreeing about "is it playing yet?".
Latency on LAN is a few milliseconds, so this is imperceptible.

---

## 6. Store Topology

### 6.1 Desktop

```
┌─────────────────────────────────────────────────────────────┐
│                   useUniversalPlayerStore                    │
│  (facade that components read from; picks active source)    │
└─────────────────────────────────────────────────────────────┘
             │                             │
             │ mode !== 'server'           │ mode === 'server'
             ▼                             ▼
┌──────────────────────┐         ┌──────────────────────┐
│   useVlcPlayerStore  │         │  useP2PPlayerStore   │
│  (real VLC backend)  │         │  (mirror, fed by     │
│                      │         │   client_event)       │
└──────────────────────┘         └──────────────────────┘
          │                                  ▲
          │ if mode === 'client',            │
          │ forward handleVlcEvent           │
          │ output as client_event              │ if mode === 'server',
          ▼                                  │ apply client_event
┌──────────────────────────────────────────────────────────┐
│                      useP2PStore                          │
│ mode: off / client / server                               │
│ clientMessageHandler (registered by vlcPlayer)            │
│ sendToRemote(msg)  → client→server                        │
│ sendToPlayer(msg)  → server→client                        │
│ _handleMessage(msg, fromId)                               │
└──────────────────────────────────────────────────────────┘
          ▲
          │ WebSocket events from main process
          │
┌──────────────────────────────────────────────────────────┐
│           electron/ipc/p2pServer.ts (main process)        │
│        HTTP + WebSocket server on port 8080               │
└──────────────────────────────────────────────────────────┘
```

Key property: there's exactly **one real player store** (`vlcPlayer`)
and it's the only one that actually talks to VLC. The mirror store
(`p2pPlayer`) has identical state fields but never touches VLC. The
facade (`universalPlayer`) picks between them at runtime.

### 6.2 Tizen

```
┌────────────────────────┐     ┌────────────────────────┐
│  useTizenPlayerStore   │     │  useP2PClientStore     │
│  (AVPlay backend)      │     │  (WebSocket client)    │
└────────────────────────┘     └────────────────────────┘
             │                            ▲
             │ getFullVlcEvent()          │
             │ (on 500 ms interval and    │ sendMessage /
             │  on state_request)         │ lastReceivedMessage
             ▼                            │
┌────────────────────────────────────────────────────┐
│              <P2PManager /> component              │
│  - broadcasts snapshots                             │
│  - handles incoming commands by calling             │
│    useTizenPlayerStore actions                      │
│  - handles state_request by sending a snapshot      │
│  - handles profile_sync                             │
└────────────────────────────────────────────────────┘
```

Tizen has no server mode, no universal facade, and no mirror store.
`tizenPlayerStore` is always the only source of truth.

---

## 7. Profile Sync (relationship to P2P)

Profile sync is technically a separate protocol but it ships over the
same WebSocket and lives in the same codebase, so it belongs in this
doc.

The problem: before the server can show `currentItem` as "that movie
with the right poster", both devices need to have loaded the same M3U
playlist and the same saved userData (watch progress, track prefs,
favorites, hidden items).

The flow, sent as `profile_sync` messages with `ProfileSyncPayload`:

1. **On WebSocket connect**, the server sends `profile_sync` with its
   `profile` info: username, uuid, M3U URL.
2. **Client creates/selects** a profile with that username and maps
   it to the server's UUID. If the client already has the same M3U
   (by URL), it just reloads from disk.
3. **If the M3U is missing**, the client sends back `profile_sync` with
   `{ request: 'full' }`, asking for the full M3U data.
4. **Server responds** with `profile_sync` carrying `m3uData`
   (`{ source, update, stats }`). Client writes to its local cache via
   `syncM3UData`, then reloads.
5. **Client sends** `profile_sync` with its current `userData`. Server
   runs `mergeUserData(localUserData, remoteUserData)` — a
   timestamp-based merge that resolves conflicts by "latest timestamp
   wins per-field".
6. **Server sends back** the merged `userData` so both ends are
   byte-identical.

Only after profile sync completes does `state_request` /
`client_event` become meaningful, because `findByUrl` on the receiver
side needs the M3U to resolve anything.

The merge function lives in `shared/content/src/utils/mergeUserData.ts`
and is shared by both platforms — no duplication.

---

## 8. Key Type Definitions

All cross-platform types live in `shared/content/src/types/`:

- `player.ts` — `VlcState`, `ScreenMode`, `VlcTrack`, `OpenOptions`,
  `PlaybackOptions`, `AudioOptions`, `VideoOptions`, `SubtitleOptions`,
  `WindowOptions`, `WindowResizeOptions`, `ShortcutAction`,
  `ShortcutOptions`, `MediaInfo`, `PlayerSettings`, `CurrentVideoState`,
  `VlcEventData`, `ClientEventData`.
- `p2p.ts` — `P2PConnection`, `P2PMessage`, `P2PEventData`,
  `ProfileInfo`, `M3UDataSync`, `ProfileSyncPayload`,
  `StateRequestPayload`.

Platform-specific extensions stay local:

- `apps/desktop/src/types/types.ts` — `WindowStyleOptions` (Electron
  window chrome) and `UseVlcPlayerReturn` (React hook surface). All
  player types are imported directly from `@zenith-tv/content`.
- Tizen has no platform-specific player type extensions. All stores
  import directly from `@zenith-tv/content`.

This guarantees wire-level byte compatibility: if you change a field in
`MediaInfo`, you have to change it in exactly one file, and both sides
of the network pick it up at the same time.

---

## 9. Invariants Worth Remembering

1. **VLC is always source of truth on the player side.** The client
   never updates its own state speculatively; it always waits for the
   real VLC event and uses that to drive both local UI and forwarded
   P2P events.
2. **The server is always a mirror on the control side.** The server
   never guesses state. It applies what it's told. If the client goes
   silent, the server's state stops updating — by design.
3. **`mediaInfo.url` is the only identifier that crosses the wire for
   `currentItem`.** Never try to serialize a `WatchableObject`. Always
   rely on `findByUrl` on the receiving end.
4. **One message type for state sync: `client_event`.** Whether it's a
   real VLC event forwarded by the desktop client or a synthetic full
   snapshot from Tizen, the handler is the same and the shape is
   `ClientEventData`.
5. **Mode switches are live.** The `universalPlayerStore` subscribes
   to `p2pStore.mode` changes and rebinds its proxy on the fly. Don't
   cache the active store in a React ref.
6. **Profile sync must complete before `findByUrl` can resolve.** The
   server issues `state_request` only after a profile_sync exchange
   that ensures the M3U is loaded on both sides.
7. **Tizen never forwards per-event.** It always sends full snapshots
   on a 500 ms cadence plus on-demand. The server can't tell the
   difference, but this is important when debugging bandwidth.

---

## 10. File Map

```
shared/content/src/types/player.ts        ← cross-platform player types
shared/content/src/types/p2p.ts           ← P2P message types
shared/content/src/stores/content/        ← findByUrl lives here
shared/content/src/utils/mergeUserData.ts ← userData conflict resolver
shared/content/src/utils/httpDiscovery.ts ← subnet scan for servers

apps/desktop/electron/ipc/p2pServer.ts    ← WS + HTTP server
apps/desktop/electron/ipc/p2pHandlers.ts  ← IPC bridge to renderer
apps/desktop/src/stores/p2pStore.ts       ← mode, routing, pair flow
apps/desktop/src/stores/vlcPlayer.ts      ← VLC backend + client-side forward
apps/desktop/src/stores/p2pPlayerStore.ts ← server-side mirror store
apps/desktop/src/stores/universalPlayerStore.ts ← mode-based facade

apps/tizen/src/stores/tizenPlayer.ts      ← AVPlay backend + getFullVlcEvent
apps/tizen/src/stores/p2pClientStore.ts   ← WebSocket client
apps/tizen/src/components/P2P/P2PManager.tsx ← broadcast + command dispatch
```
