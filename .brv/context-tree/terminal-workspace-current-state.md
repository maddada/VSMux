# Terminal Workspace Current State

## Frontend terminal model

- The workspace terminal renderer is `restty`, not xterm.
- Frontend terminal runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- The reason for the cache is to keep one stable `Restty` runtime/transport per terminal session so switching sessions does not recreate the frontend terminal and replay it again.
- Cache invalidation is generation-based through `renderNonce`. If a terminal session is intentionally recreated, the generation changes and the old runtime is destroyed.
- When a terminal session is removed, the controller explicitly sends `destroyTerminalRuntime` to the workspace so a recycled `sessionId` cannot inherit an old transcript.

## Workspace pane projection and switching

- The workspace pane projection includes terminal sessions from all groups, not just the active group.
- This is intentional so cross-group switching can keep terminals warm instead of creating a fresh pane set when the user switches groups.
- Inactive terminal panes stay mounted in the same layout slot behind the active pane.
- The design goal is instant switching without reconnecting and without hidden-pane reflow.
- Hidden or inactive terminal behavior should avoid any size change caused only by being hidden, because hidden-pane size churn was a major cause of transcript loss and visible tail changes.

## Terminal bootstrap vs steady-state maintenance

- `workspace/terminal-pane.tsx` separates bootstrap visuals from steady-state maintenance.
- Startup black-surface seeding and canvas reveal logic are bootstrap-only and stop after the first successful reveal.
- The reason is that rerunning startup visual logic during observer-driven maintenance caused periodic black flashes in visible terminals.
- Steady-state maintenance should stay focused on safe tasks like size updates, scroll-host binding, and scroll-to-bottom visibility, not startup-black styling.

## Daemon ownership and lifetime

- VSmux uses a per-workspace daemon, not a single global daemon.
- The reason is stability: sharing one daemon across unrelated projects caused daemon ownership conflicts and stale-daemon replacement problems.
- The extension synchronizes session leases to the daemon for sidebar-listed terminal sessions.
- The intended behavior is that any terminal session still shown in the VSmux sidebar stays alive while VS Code is running, even if the VSmux sidebar or workarea is closed.
- The configured background timeout only matters after VS Code is gone long enough for the lease to expire.

## Reattach vs resume semantics

- `createOrAttach` responses include `didCreateSession`.
- The controller uses that to distinguish:
  - reattaching to an already-live daemon PTY
  - creating a replacement backend terminal
- Resume commands must only run when a backend terminal was truly recreated.
- If a live daemon terminal still exists, the correct behavior is reattach, not resume.

## Persisted terminal presentation state

- Persisted terminal session state stores `agentName`, `agentStatus`, and `title` in `extension/session-state-file.ts`.
- `extension/terminal-daemon-session-state.ts` preserves the last known agent/title unless a better live or title-derived value is available.
- The reason is cold-start correctness: if the daemon is not live, the sidebar should still be able to show the last known agent/title after reload.

## Important lessons

- Avoid hidden-pane reflow. Hidden-pane size changes can alter wrapping and make the visible tail look cut back even without reconnect.
- Avoid reusing a cached frontend runtime for a recycled `sessionId` after session close.
- Avoid rerunning startup-black/canvas-reveal logic during steady-state observer activity.
- Prefer keeping frontend session switching as a pure show/hide concern, while daemon/session lifetime is handled separately by per-workspace ownership and leases.
