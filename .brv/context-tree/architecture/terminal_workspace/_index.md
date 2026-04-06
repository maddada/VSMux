---
children_hash: 69731d18bfc4c96167b5874c98de24fcbba8d0f9f5848218b0604db6e157e95d
compression_ratio: 0.11838539438025959
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration.md,
    agent_manager_x_focus_path_without_sidebar_rehydration.md,
    context.md,
    current_state.md,
    session_rename_title_auto_summarization.md,
    sidebar_browsers_empty_state.md,
    sidebar_fork_session_behavior.md,
    sidebar_session_card_last_interaction_timestamps.md,
    sidebar_session_fork_support.md,
    simple_grouped_session_workspace_state.md,
    t3_managed_runtime_upgrade_and_recovery.md,
    terminal_pane_runtime_thresholds_and_behaviors.md,
    terminal_persistence_across_reloads.md,
    terminal_persistence_across_vs_code_reloads.md,
    terminal_titles_activity_and_completion_sounds.md,
    terminal_titles_activity_and_sidebar_runtime.md,
    title_activity_and_sidebar_runtime.md,
    vsix_packaging_and_t3_embed_validation.md,
    vsmux_ai_devtools_integration.md,
    workspace_browser_t3_integration.md,
    workspace_focus_and_sidebar_drag_semantics.md,
    workspace_focus_debugging.md,
    workspace_panel_focus_hotkeys.md,
    workspace_panel_startup_without_loading_placeholder.md,
    workspace_panel_startup_without_placeholder.md,
    workspace_session_sleep_wake_support.md,
    workspace_sidebar_interaction_state.md,
  ]
covers_token_total: 42066
summary_level: d1
token_count: 4980
type: summary
---

# Terminal Workspace Architecture Summary

## Topic Scope

`terminal_workspace` captures the current VSmux workspace architecture for terminal rendering, pane retention, grouped session state, sidebar interactions, daemon-backed persistence, T3 integration, and adjacent controller/runtime behaviors. The core baseline is in `context.md` and `current_state.md`; most other entries refine a specific subsystem or UX rule.

## Core Runtime and State Model

- `current_state.md` is the architectural anchor:
  - Frontend renderer is **Restty**.
  - Runtime cache is keyed by `sessionId` and invalidated by `renderNonce`.
  - Hidden connected panes remain mounted and painted behind the active pane rather than being torn down.
  - Workspace projection includes sessions from **all groups**, not just active panes.
  - Backend is a **per-workspace daemon** that renews managed session leases.
  - Persisted disconnected session state preserves sidebar metadata when daemon state is unavailable.
- Main files:
  - `workspace/terminal-runtime-cache.ts`
  - `workspace/terminal-pane.tsx`
  - `workspace/workspace-app.tsx`
  - `extension/native-terminal-workspace/workspace-pane-session-projection.ts`
  - `extension/daemon-terminal-workspace-backend.ts`

## Persistence, Reload Survival, and Daemon Lifecycle

Entries `terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md` describe the same persistence architecture at different compression levels.

### Persistent architecture

- Three-part model:
  1. `extension/session-grid-store.ts` persists grouped workspace layout in VS Code `workspaceState` under `VSmux.sessionGridSnapshot`
  2. A detached **per-workspace Node.js daemon** keeps PTYs alive across reloads
  3. Restored webviews rebuild panes and reattach through replay
- Daemon/runtime files:
  - `extension/daemon-terminal-runtime.ts`
  - `extension/terminal-daemon-process.ts`
  - `extension/workspace-panel.ts`

### Important thresholds and protocol behavior

- Control connect timeout: `3000ms`
- Daemon ready timeout: `10000ms`
- Owner heartbeat interval: `5000ms`
- Owner heartbeat timeout: `20000ms`
- Startup grace: `30000ms`
- Session attach ready timeout: `15000ms`
- Replay buffer cap: `8 MiB`
- Replay chunk size: `128 KiB`

### Architectural decisions

- `retainContextWhenHidden: false` for the workspace webview; reconstruction is expected.
- Reattach uses replay-before-live promotion with pending attach queues.
- `releaseCachedTerminalRuntime()` detaches DOM without full destruction; `destroyCachedTerminalRuntime()` is the real cleanup path.
- Persisted per-session state files preserve title and agent metadata when live daemon state is missing.

## Workspace Panel Startup, Bootstrap, and Focus Hotkeys

`workspace_panel_startup_without_placeholder.md` and `workspace_panel_startup_without_loading_placeholder.md` document the same startup redesign.

### Startup behavior

- `openWorkspace` reveals the sidebar first, then:
  - creates a session if none exist, or
  - refreshes workspace state before reveal if sessions already exist
- The old loading placeholder was removed.
- `extension/workspace-panel.ts` stores:
  - `latestMessage`
  - `latestRenderableMessage`
- Renderable messages are limited to `hydrate` and `sessionState`.
- Initial HTML embeds bootstrap state via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`.
- Replay order is fixed:
  1. latest renderable state
  2. latest transient message if different

### Focus-related rules

- One-shot `autoFocusRequest` values are stripped before replay.
- Duplicate stable state is ignored unless a new autofocus request arrives.
- Auto-focus guard is `400ms`.
- Visible lag can trigger automatic `reloadWorkspacePanel` because `AUTO_RELOAD_ON_LAG` is enabled.

### Workspace panel hotkeys

`workspace_panel_focus_hotkeys.md` adds focused-panel hotkey support:

- Context key: `vsmux.workspacePanelFocus`
- Synced from `panel.active && panel.visible`
- Cleared on hide/dispose/panel disposal
- Session/group/layout hotkeys use:
  - `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`
- Directional focus hotkeys remain terminal-only:
  - `terminalFocus`

## Focus Ownership, Pane Ordering, and Drag Semantics

These entries overlap heavily and define the main interaction contract:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_sidebar_interaction_state.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `workspace_focus_debugging.md`

### Stable pane ordering

- Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`, not from filtering a global order.
- `localPaneOrder` is allowed only as a temporary override within the visible session set.
- This preserves **split slot stability**.

### Focus ownership

- `TerminalPane` emits activation intent only:
  - `onActivate("pointer")`
  - `onActivate("focusin")`
- `WorkspaceApp` owns stateful focus decisions and decides whether to:
  - ignore activation
  - apply local visual focus
  - send `vscode.postMessage({ type: "focusSession", sessionId })`

### Guards and debugging

- `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
- Stale pending local focus is cleared when server-reported focus supersedes it.
- T3 iframe focus uses message type `vsmuxT3Focus`.
- Hidden panes and auto-focus-guard conflicts are explicitly ignored and logged.
- Header drag suppression exists when `pointerDragStateRef.current` is active.

### Sidebar drag semantics

- Sidebar reordering must never occur from click-like interactions.
- Real pointer movement threshold: **8px**
- Supporting thresholds:
  - startup interaction block: `1500ms`
  - non-touch drag distance: `6px`
  - touch drag: `250ms` delay, `5px` tolerance
  - session-card hold-to-drag: `130ms`, `12px` tolerance
- Primary reorder messages:
  - `syncPaneOrder`
  - `syncSessionOrder`
  - `moveSessionToGroup`
  - `syncGroupOrder`

## Terminal Pane Runtime Behavior

`terminal_pane_runtime_thresholds_and_behaviors.md` drills into `workspace/terminal-pane.tsx`.

### Connection and rendering model

- Appearance is applied in phases before PTY connection.
- Stable terminal size is required before attach/connect.
- Size stabilization waits up to **20 attempts** and returns after **2 identical measurements**.
- Hidden panes stay painted after PTY startup and should not redraw on visibility flips.

### Thresholds

- Typing autoscroll: `450ms` burst, after `4` printable keypresses
- Scroll-to-bottom button:
  - show above `200px`
  - hide below `40px`
- Scheduler probe:
  - every `50ms`
  - over `5000ms`
  - warning threshold `250ms`
- Lag detection:
  - monitor window `10000ms`
  - lag when average overshoot ≥ `1000ms`
  - only when visible and focused

### Search and key mappings

- Search close clears results and refocuses terminal.
- `SEARCH_RESULTS_EMPTY = { resultCount: 0, resultIndex: -1 }`
- Preserved mappings:
  - Shift+Enter → `\x1b[13;2u`
  - macOS Meta+ArrowLeft → `\x01`
  - macOS Meta+ArrowRight → `\x05`
  - word navigation → `\x1bb` / `\x1bf`

## Grouped Workspace State and Sleep/Wake

`simple_grouped_session_workspace_state.md` and `workspace_session_sleep_wake_support.md` define canonical workspace snapshot rules.

### Snapshot normalization

- File: `shared/simple-grouped-session-workspace-state.ts`
- Tests: `shared/simple-grouped-session-workspace-state.test.ts`
- Guarantees:
  - at least one group exists
  - browser sessions are dropped from normalized terminal workspace groups
  - display IDs are repaired and canonicalized
  - session IDs derive from display IDs via `session-${formatSessionDisplayId(...)}`
  - active-group fallback prefers nearest previous non-empty group

### Session/group operations

- Supports:
  - focus helpers
  - create session/group
  - create group from session
  - move session between groups
  - visible-count normalization
  - fullscreen restore behavior
  - T3 metadata updates preserving session identity

### Sleep/wake layer

- Session records persist `isSleeping`
- Sleeping sessions are excluded from focus and visible split calculations
- Focusing a sleeping session wakes it
- Group sleep/wake toggles all sessions in the group
- Sleeping terminal sessions dispose runtime surfaces while preserving resume metadata
- Relevant UI/controller files:
  - `extension/session-grid-store.ts`
  - `extension/native-terminal-workspace/controller.ts`
  - `sidebar/sortable-session-card.tsx`
  - `sidebar/session-group-section.tsx`

## Sidebar Session Actions and Browser Group Behavior

Main entries:

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `sidebar_browsers_empty_state.md`
- `sidebar_session_card_last_interaction_timestamps.md`

### Fork / resume / reload behavior

- Fork support exists only for **Codex** and **Claude** terminal sessions.
- Copy resume supports:
  - codex
  - claude
  - copilot
  - gemini
  - opencode
- Full reload is limited to Codex and Claude.
- Fork flow:
  - sidebar posts `forkSession`
  - controller validates source/group/title/command
  - creates sibling session in same group
  - reuses agent icon and launch metadata
  - reorders new session immediately after source
  - writes fork command
  - schedules delayed rename after `FORK_RENAME_DELAY_MS = 4000`
- Core files:
  - `extension/native-terminal-workspace/controller.ts`
  - `sidebar/sortable-session-card.tsx`
  - `extension/native-terminal-workspace-session-agent-launch.ts`
  - `shared/session-grid-contract-sidebar.ts`
  - `extension/native-terminal-workspace/sidebar-message-dispatch.ts`

### Command formats

- Codex fork: `codex fork <preferred title>`
- Claude fork: `claude --fork-session -r <preferred title>`
- Delayed rename: `/rename fork <preferred title>`
- Single-shell-argument quoting uses single quotes with escaped embedded quotes.

### Browser group behavior

`sidebar_browsers_empty_state.md`:

- Browser groups no longer show visible `"No browsers"` placeholder.
- Empty browser groups still render a drop-target container for drag/drop.
- Browser groups use `group?.kind === "browser"`.
- Add button posts `openBrowser`; non-browser groups use `createSessionInGroup`.
- Browser groups block rename, visible-count changes, sleep, sorting, group focus-on-click, and context menus.

### Minor UI tweak

`sidebar_session_card_last_interaction_timestamps.md`:

- `.session-last-interaction-time` changed from left-aligned to right-aligned in `sidebar/styles/session-cards.css`.

## Terminal Titles, Activity Derivation, and Completion Sounds

Entries:

- `title_activity_and_sidebar_runtime.md`
- `terminal_titles_activity_and_completion_sounds.md`

### Title precedence and activity model

- Visible session title precedence:
  1. manual user title
  2. terminal title
  3. alias
- Terminal titles are first-class presentation state from daemon snapshots.
- Activity is title-driven for CLI agents.

### Agent-specific marker logic

- Claude:
  - working markers: `⠐`, `⠂`, `·`
  - idle markers: `✳`, `*`
- Codex:
  - working markers: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini:
  - working `✦`
  - idle `◇`
- GitHub Copilot:
  - working `🤖`
  - idle/attention `🔔`

### Gating and patch strategy

- Claude/Codex require observed title transitions before spinner markers count as working.
- Their stale spinner timeout is `3000ms`.
- Gemini/Copilot do not use stale-spinner guard.
- Attention only surfaces after at least `3000ms` of prior working.
- Completion sound is confirmation-delayed by `1000ms`.
- Title/activity changes use targeted patch messages instead of full sidebar/workspace rehydrate.

### Audio delivery

- Sounds are embedded as data URLs in sidebar webview HTML.
- Playback uses unlocked `AudioContext`.
- This avoids VS Code webview issues with delayed `HTMLAudio` and fetch-based decoding.

## Session Rename Title Auto-Summarization

`session_rename_title_auto_summarization.md` defines title-generation constraints.

### Summary rules

- Titles with `trim().length <= 25` are returned unchanged.
- Longer titles are summarized.
- Prompt and sanitizer clamp generated output to **24 chars**.
- Whole-word truncation is preferred before raw slicing.

### Shared text-generation subsystem

- Files:
  - `extension/native-terminal-workspace/session-title-generation.ts`
  - `extension/git/text-generation.ts`
  - `extension/git/text-generation-utils.ts`
  - `extension/git/text-generation.test.ts`
- Timeout: `180000ms`
- Provider behavior:
  - Codex uses stdin prompt delivery
  - non-codex providers use interactive shell
- Pinned models:
  - Codex: `gpt-5.4-mini`, high reasoning effort
  - Claude: `haiku`, high effort

## Browser + T3 + Workspace Integration

`workspace_browser_t3_integration.md` connects browser discovery, workspace panel behavior, and T3 monitoring.

### Browser group filtering

- Sidebar browser group ID: `browser-tabs`
- Internal VSmux/T3-owned tabs are excluded by:
  - panel view type
  - `vsmux.` prefix
  - localhost workspace/t3-embed URLs
- Accepted URLs must be normalized `http/https`.

### Workspace panel identity

- Panel type: `vsmux.workspace`
- Visible title: `VSmux`
- Icon: `media/icon.svg`

### T3 activity monitoring

- Default WebSocket URL: `ws://127.0.0.1:3774/ws`
- RPC methods:
  - `orchestration.getSnapshot`
  - `subscribeOrchestrationDomainEvents`
- Timing:
  - request timeout `15000ms`
  - reconnect delay `1500ms`
  - refresh debounce `100ms`
- T3 activity is websocket-backed and feeds session title/activity refresh plus completion acknowledgement behavior.

## Managed T3 Runtime and Packaging / Embed Validation

Entries:

- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`

### Managed T3 runtime

- Updated managed runtime runs on `127.0.0.1:3774`, legacy docs/runtime referenced `3773`.
- Required websocket route: `/ws`
- Entry point:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Request IDs must be numeric strings matching `^\d+$`.
- Protocol rules include Ping/Pong and streaming `Chunk`, `Ack`, `Exit`.
- Runtime manager stores state under extension global storage `t3-runtime`.

### Recovery and upgrade model

- Do not update T3 directly on main.
- Validate in a worktree, install/test there, then port back to main.
- Mixed-install failures come from mismatch between installed VSIX embed assets and vendored source/dist in main.
- Recovery path is to sync:
  - `forks/t3code-embed/upstream`
  - `forks/t3code-embed/overlay`
  - `forks/t3code-embed/dist`
    from tested worktree back into main, reinstall, and restart managed runtime.

### VSIX packaging

- Main packaging entry: `scripts/vsix.mjs`
- Modes: `package`, `install`
- Build step: `pnpm run compile`
- Package command:
  - `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
- Install command:
  - `<vscodeCli> --install-extension <vsixPath> --force`
- Important packaged paths include:
  - `forks/t3code-embed/dist/**`
  - `out/workspace/**`
  - `out/**`
  - `media/**`
- Validation rule: verify installed T3 embed asset hash under the installed extension path before debugging webview behavior.

## Agent Manager X Bridge and Focus Integration

Entries:

- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`

### Bridge architecture

- New file: `extension/agent-manager-x-bridge.ts`
- Integrated into: `extension/native-terminal-workspace/controller.ts`
- WebSocket broker URL: `ws://127.0.0.1:47652/vsmux`
- Controller owns one `AgentManagerXBridgeClient`.

### Snapshot and command behavior

- Publishes normalized `workspaceSnapshot` payloads with workspace/session metadata.
- Snapshot is sent only when:
  - latest snapshot exists
  - socket is `WebSocket.OPEN`
  - serialized payload differs from `lastSentSerializedSnapshot`
- Snapshots are memory-only and not persisted to disk.
- Reconnect starts at `1000ms`, doubles, caps at `5000ms`.
- Ping messages are ignored.
- `focusSession` broker commands only execute when incoming `workspaceId` matches `latestSnapshot.workspaceId`.

### Focus-path refinement

- `focusSessionFromAgentManagerX` now focuses the target session directly.
- Broker-driven jumps no longer force sidebar container open first.
- This preserves workspace focus behavior while avoiding sidebar reload / re-hydration artifacts.

## AI DevTools / Chat History Integration

`vsmux_ai_devtools_integration.md` extends the extension package with ai-devtools history.

### Architectural position

- VSmux remains the **single shipped extension host**.
- Chat history is embedded as a mostly separate package under `chat-history/`.
- `activateChatHistory(context)` runs during extension activation before `NativeTerminalWorkspaceController` construction.

### Build and packaging impact

- Root build now includes `chat-history:webview:build`.
- Assets live in:
  - `chat-history/dist`
  - `chat-history/media`
- Extension compilation includes:
  - `extension`
  - `shared`
  - `chat-history/src/extension`

### UI integration

- Registers `aiDevtools.conversations` under existing `VSmuxSessions` sidebar container below `VSmux.sessions`.
- Viewer webview uses `retainContextWhenHidden: false`.
- `ai-devtools.suspend` disposes panel, clears sidebar cache, and enters suspended state for memory release.

## Cross-Cutting Patterns and Repeated Decisions

Several entries reinforce the same persistent design choices:

- **Per-workspace ownership**
  - daemon runtime
  - managed T3 runtime
  - Agent Manager X snapshots scoped by workspace identity
- **No unnecessary rehydrate/rebuild**
  - hidden panes stay mounted
  - targeted presentation patches replace full rehydrates
  - startup bootstrap embeds renderable state
  - Agent Manager X focus avoids sidebar rehydration
- **Strict focus centralization**
  - `TerminalPane` emits intent
  - `WorkspaceApp` is authoritative
  - auto-focus uses a `400ms` guard
- **Stable ordering and visibility**
  - visible pane order derives from `visibleSessionIds`
  - sidebar reorder requires real movement
  - group-local visible sessions are restored on focus
- **Memory-conscious webview policy**
  - workspace panel and chat-history viewer both use `retainContextWhenHidden: false`
  - reconstruction relies on persisted state + replay + bootstrap
- **Capability-gated session actions**
  - fork/full reload: Codex + Claude only
  - copy resume includes Codex, Claude, Copilot, Gemini, OpenCode
  - browser sessions are intentionally excluded from several terminal-only actions

## Drill-Down Map

For specific areas, drill into:

- Core architecture: `current_state.md`
- Persistence/reload survival: `terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`
- Startup/bootstrap: `workspace_panel_startup_without_placeholder.md`, `workspace_panel_startup_without_loading_placeholder.md`
- Focus/drag semantics: `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_sidebar_interaction_state.md`, `workspace_focus_debugging.md`
- Pane runtime thresholds: `terminal_pane_runtime_thresholds_and_behaviors.md`
- Grouped state model: `simple_grouped_session_workspace_state.md`
- Sleep/wake: `workspace_session_sleep_wake_support.md`
- Sidebar fork/resume/reload: `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`
- Browser group UX: `sidebar_browsers_empty_state.md`
- Title/activity/sounds: `title_activity_and_sidebar_runtime.md`, `terminal_titles_activity_and_completion_sounds.md`
- Rename summarization: `session_rename_title_auto_summarization.md`
- Browser/T3/workspace coordination: `workspace_browser_t3_integration.md`
- Managed T3 runtime + recovery: `t3_managed_runtime_upgrade_and_recovery.md`
- VSIX/install validation: `vsix_packaging_and_t3_embed_validation.md`
- Agent Manager X bridge: `agent_manager_x_bridge_integration.md`, `agent_manager_x_focus_path_without_sidebar_rehydration.md`
- AI DevTools integration: `vsmux_ai_devtools_integration.md`
