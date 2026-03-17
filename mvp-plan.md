# MVP Plan: Durable Agent Canvas X for VS Code with External Terminal Host

## Summary

Build a macOS/Linux desktop-only VS Code extension that renders terminal tiles
with `ghostty-web` inside a React canvas, using shadcn/ui in Base UI mode for
the shell chrome. Keep the two-surface MVP: a standalone `WebviewPanel` and a
contributed bottom-panel `WebviewView`, with exactly one active host at a time
and a controlled handoff between them.

Use an external local terminal-host daemon for all terminal sessions. The daemon
owns PTYs and session state, the VS Code extension host acts as the
controller/bridge, and the webview is a thin UI client. Commit to
`@replit/ruspty` for PTY execution inside the daemon. Durable persistence is the
only runtime mode: every terminal tile uses the daemon-backed lifecycle.

Session durability works as follows:

- live sessions survive VS Code window reloads and app restarts by reattaching
  to the daemon
- when the last UI host detaches, the daemon keeps sessions alive for 5 minutes;
  reattaching within that window cancels cleanup
- if a live session cannot be reattached after restart, the tile restores in a
  read-only cold-restore state from persisted scrollback and metadata until the
  user explicitly starts a new shell

## UI Foundation

Treat shadcn Base UI as the default component layer for the webview app.

- initialize shadcn for the Vite webview frontend in Base UI mode so the
  project has a `components.json`, generated UI source files, and registry/MCP
  support
- use the shadcn MCP server to inspect components, pull examples, generate add
  commands, and audit the installed set
- pull a small baseline set of components up front:
  - `button`, `tooltip`, `separator` for the canvas toolbar and zoom controls
  - `card`, `badge`, `dropdown-menu`, `context-menu` for tile chrome and tile
    actions
  - `dialog`, `tabs` for host switching affordances, settings, and
    confirmations
  - `scroll-area` for overflowed inspector or palette regions
  - `skeleton`, `empty` for loading and zero-state UX
- keep custom UI code limited to:
  - infinite canvas rendering
  - tile drag/resize handles and hit-testing
  - `ghostty-web` mount/lifecycle management
  - PTY/session and daemon bridge plumbing
- do not use generic styled `div` shells where a shadcn component already
  exists
- do not use shadcn `resizable` for tile geometry; freeform tile resize remains
  canvas-specific pointer logic

## MCP Workflow

Use the shadcn MCP tools as the normal component acquisition path once Base UI
initialization is in place.

- `view_items_in_registries` to inspect candidate components before adding them
- `get_item_examples_from_registries` when composition or usage details are
  unclear
- `get_add_command_for_items` to generate the exact add command for the approved
  component set
- `get_audit_checklist` after adding components to verify imports, composition,
  and styling rules

## Runtime Architecture

Add a local terminal-host daemon launched and supervised by the extension host.

- store daemon artifacts under the extension's `globalStorageUri`: Unix socket,
  auth token, pid file, and per-session history files
- move the PTY backend boundary into the daemon:
  - `ITerminalBackend` lives inside the daemon, not the extension host
  - `RusptyBackend` implements spawn, write, resize, signal, kill, and
    exit/data callbacks
- add a `TerminalHostClient` in the extension host that speaks a versioned local
  IPC protocol to the daemon
- keep the extension host responsible for:
  - workspace snapshot persistence
  - active-host coordination
  - daemon lifecycle supervision
  - webview-to-daemon request routing
  - cold-restore metadata lookup
- keep the webview responsible for:
  - canvas layout, pan, zoom, drag, resize
  - `ghostty-web` mounting and disposal
  - local interaction state during pointer activity
  - rendering live vs cold-restored tile states

## Session Model and Lifecycle

Define one durable session per tile. `tileId` is the stable identity and is
reused as the daemon `sessionId`.

- on tile creation, the extension host requests
  `createOrAttach(sessionId, workspaceId, cwd, shell, cols, rows)` from the
  daemon
- on host handoff, dispose the current UI host, create the target host, hydrate
  the saved workspace snapshot, and reattach each visible tile to its existing
  daemon session without recreating PTYs
- on last host detach, the daemon starts a 5-minute grace timer per unattached
  session
- on explicit tile close, kill the daemon session immediately, remove persisted
  history, and delete the tile from the workspace snapshot
- on session exit, keep the tile in an exited state long enough to show final
  output and status; if the session is later unrecoverable after restart,
  cold-restore from disk and mark the tile disconnected/read-only

## Persistence and Restore

Persist raw terminal scrollback and session metadata per tile under
`globalStorageUri/terminal-history/<workspaceId>/<tileId>/`.

- metadata includes at minimum: `workspaceId`, `tileId`, `cwd`, `shell`, `cols`,
  `rows`, `startedAt`, `endedAt`, `exitCode`, and restore status
- warm restore:
  - if the daemon still has a live session, reattach and stream live output
    immediately
- cold restore:
  - if the daemon session is gone but persisted history exists, restore
    scrollback into a read-only terminal tile
  - show disconnected status and an explicit "Start New Shell" action
  - do not auto-spawn a replacement shell
- do not promise arbitrary machine-level durability beyond daemon-managed local
  persistence; the guarantee is app/window restart recovery on the same machine
  and user account

## Phases

### Phase 1: Single-Host Canvas Shell

- replace the sample extension with a reusable canvas host
- start with a standalone `WebviewPanel` as the first host surface
- initialize shadcn in Base UI mode for the webview app and commit the generated
  config/util files
- use the shadcn MCP server to retrieve the baseline shell components for
  toolbar, tile chrome, menus, dialogs, loading states, and empty states
- build the React canvas shell with shared visual behavior:
  - infinite/freeform canvas remains custom
  - tile creation
  - drag and resize
  - pan and zoom
  - tile focus state
  - toolbar, menus, empty state, and loading state use shadcn components instead
    of custom wrappers
- keep drag, resize, pan, and zoom local in the webview during active
  interaction
- persist layout and viewport snapshots to the extension host on interaction
  settle and host disposal
- mount `ghostty-web` in each tile with placeholder/demo output so canvas and
  terminal mount behavior are stable before daemon wiring
- add host reopen/hydration so the canvas can restore from the saved workspace
  snapshot

### Phase 2: External Terminal Host + Durable Sessions

- add the external terminal-host daemon and `TerminalHostClient`
- define `ITerminalBackend` inside the daemon and implement it with
  `@replit/ruspty`
- create one daemon-backed shell session per tile
- replace placeholder tile content with live `ghostty-web` terminals
- bridge terminal data with explicit performance rules:
  - send user keystrokes from `ghostty-web` to the extension host immediately
  - batch daemon output from the extension host to the active host webview
  - debounce and quantize resize events before calling terminal resize
- persist scrollback and session metadata for warm and cold restore
- keep session lifetime independent from any single host so closing or moving the
  UI does not kill active shells immediately

### Phase 3: Bottom-Panel Host + Surface Handoff

- add a contributed bottom-panel webview view
- add commands to show the canvas in either surface:
  - `openCanvasPanel`
  - `revealCanvasBottomPanel`
  - `moveCanvasToPanel`
  - `moveCanvasToBottomPanel`
- implement single-active-host handoff:
  - serialize the latest workspace snapshot in the extension host
  - dispose the current host UI
  - create the target host and hydrate it from the saved snapshot
  - reattach live daemon sessions without recreating them
- if the user asks to open the second surface while one is already active,
  switch hosts instead of mirroring the UI
- polish basic UX without expanding scope:
  - sensible default tile placement
  - simple zoom controls/reset built from shadcn `button`, `tooltip`, and
    `separator`
  - minimal empty, loading, menu, and dialog states built from the shadcn Base
    UI set already in the project

### Phase 4: Reload, Grace Timeout, and Cold Restore

- reattach live daemon sessions on VS Code window reload or app restart when the
  daemon is still running and the session grace timer has not expired
- start a 5-minute grace timer when the last host detaches; cancel it on
  reattach
- when live reattach fails but persisted history exists, restore the tile into a
  read-only disconnected state with explicit restart affordance
- remove expired sessions and stale restore metadata when the grace timer elapses
  and the session has no active host

## Trust and Shell Policy

- default shell for new tiles is the user's default login shell, with workspace
  folder as `cwd` when available
- in untrusted workspaces, allow shell creation only after an explicit
  warning/confirmation from the extension host
- show the warning on the first spawn attempt per window session; if accepted,
  normal daemon session creation proceeds

## Key Changes

- extension host:
  - workspace/session controller for saved canvas snapshots and host handoff
  - daemon lifecycle supervisor and `TerminalHostClient`
  - message bridge between the active host and the daemon only
  - cold-restore metadata lookup and reconnect orchestration
- terminal host daemon:
  - `ITerminalBackend` abstraction
  - `RusptyBackend` implementation for macOS/Linux shells
  - session manager for durable create, attach, detach, resize, signal, kill,
    and grace-timeout cleanup
  - local IPC server with token-authenticated, versioned protocol
- webview frontend:
  - shadcn Base UI component layer checked into source
  - MCP-backed component acquisition workflow for registry items and examples
  - React canvas app with local-first interaction state for drag/resize/pan/zoom
  - `ghostty-web` initialization once per active host
  - live and cold-restored terminal tile rendering
- host surfaces:
  - standalone panel
  - bottom-panel view
  - both backed by the same workspace/session model, but never live at the same
    time in MVP

## Public Interfaces / Contracts

- commands and views:
  - `openCanvasPanel`
  - `revealCanvasBottomPanel`
  - `moveCanvasToPanel`
  - `moveCanvasToBottomPanel`
  - one contributed bottom-panel webview view
- extension-host models:
  - `CanvasWorkspaceSnapshot`
  - `CanvasViewport`
  - `TerminalTileModel`
  - `TerminalTileRuntimeState` with `live | exited | restored | disconnected`
- daemon IPC requests:
  - `hello`
  - `listSessions`
  - `createOrAttach`
  - `write`
  - `resize`
  - `signal`
  - `detach`
  - `kill`
  - `shutdown`
- daemon IPC events:
  - `data`
  - `exit`
  - `error`
  - `sessionDetached`
  - `sessionGraceExpired`
- webview message contract:
  - `ready`
  - `workspaceSnapshot`
  - `createTile`
  - `closeTile`
  - `commitTileLayout`
  - `commitViewport`
  - `terminalInput`
  - `terminalResize`
  - `attachTileSession`
  - `terminalOutputBatch`
  - `sessionStatus`
  - `sessionExited`
  - `restoredSnapshot`
- UI/component contract:
  - shadcn `components.json` exists and is initialized with `base`
  - baseline shell components are acquired through shadcn MCP workflow rather
    than handwritten clones
  - custom styling is limited to the canvas substrate and terminal-specific
    integration points

## Test Plan

- shadcn Base UI initialization produces a valid `components.json` and generated
  UI files for the webview app
- shadcn MCP workflow yields the expected baseline component set with no
  duplicate hand-built replacements
- panel and bottom-panel hosts both hydrate from the same saved workspace
  snapshot
- only one host is active at a time; switching surfaces performs a clean
  handoff with no duplicate streaming
- creating a tile creates or attaches exactly one daemon session
- terminal input, resize, signal, and output routing work per session and
  preserve ordering under noisy output
- reloading the VS Code window reattaches to live daemon sessions without
  recreating PTYs
- restarting VS Code restores live sessions when the daemon still owns them
- if live reattach fails but persisted history exists, the tile restores
  read-only and does not auto-spawn
- closing the last host starts the 5-minute grace timer; reopening within that
  window reattaches; reopening after expiry yields cold restore only
- explicit tile close kills the session immediately and removes restore
  artifacts
- untrusted workspace spawn attempts show the warning gate and only create
  sessions after confirmation
- `ghostty-web` mounts once per visible live tile, disposes cleanly on handoff,
  and restores static scrollback correctly for cold-restored tiles

## Assumptions

- MVP is desktop VS Code only on macOS and Linux
- `@replit/ruspty` is the committed PTY backend for the daemon in MVP
- durable persistence uses a Superset-style external local terminal host, not
  `tmux`
- durable mode is not optional; all terminal tiles use the daemon-backed runtime
- cold restore is read-only until the user explicitly starts a new shell
- the extension host remains the source of truth for canvas layout and host
  switching; the daemon is the source of truth for live terminal process state
