---
children_hash: 936297cca8401da8d439b91da172f68e51e618e32565025d87817efb3ebcdc2f
compression_ratio: 0.1016807978984687
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration.md,
    agent_manager_x_focus_path_without_sidebar_rehydration.md,
    context.md,
    current_state.md,
    default_agent_commands_overrides.md,
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
    terminal_title_normalization_and_session_actions.md,
    terminal_titles_activity_and_completion_sounds.md,
    terminal_titles_activity_and_sidebar_runtime.md,
    title_activity_and_sidebar_runtime.md,
    vsix_packaging_and_t3_embed_validation.md,
    vsmux_ai_devtools_integration.md,
    workspace_browser_t3_integration.md,
    workspace_debug_console_suppression.md,
    workspace_focus_and_sidebar_drag_semantics.md,
    workspace_focus_debugging.md,
    workspace_panel_focus_hotkeys.md,
    workspace_panel_startup_without_loading_placeholder.md,
    workspace_panel_startup_without_placeholder.md,
    workspace_session_sleep_wake_support.md,
    workspace_sidebar_interaction_state.md,
  ]
covers_token_total: 46823
summary_level: d1
token_count: 4761
type: summary
---

# terminal_workspace

## Overview

The `terminal_workspace` topic documents the current VSmux terminal/workspace architecture across the extension host, detached daemon, webview workspace, sidebar, browser/T3 integration, and session-state helpers. The central baseline is `current_state.md`: Restty is the renderer, runtimes are cached by `sessionId`, hidden panes stay mounted, visible pane order comes from active-group projection, the backend is per-workspace, and persisted disconnected state preserves sidebar presentation when daemon state is unavailable.

## Core Runtime and Persistence

### Runtime model

From `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, and `workspace_sidebar_interaction_state.md`:

- Renderer: `Restty`
- Cache key: runtime cache is stable per `sessionId`
- Invalidation: runtime identity changes on `renderNonce`
- Hidden panes:
  - remain mounted in DOM
  - stay painted behind active pane
  - should not redraw on visibility flips after PTY startup
- PTY connect sequence:
  - apply appearance
  - wait for stable size
  - `markTerminalReady(cols, rows)`
  - connect/reattach PTY
- Stable size rule:
  - up to 20 attempts
  - returns after 2 identical measurements
- Runtime lifecycle:
  - `releaseCachedTerminalRuntime()` detaches DOM without destroying runtime
  - `destroyCachedTerminalRuntime()` fully destroys transport/Restty/cache entry

### Runtime thresholds and input behavior

From `terminal_pane_runtime_thresholds_and_behaviors.md`:

- Typing autoscroll: 4 printable keypresses within 450ms
- Scroll-to-bottom hysteresis: show at 200px from bottom, hide at 40px
- Lag detection:
  - sample every 50ms
  - probe window 5000ms
  - visible/focused monitor window 10000ms
  - lag threshold 1000ms average overshoot
  - warn threshold 250ms
- Key mappings:
  - `Shift+Enter` → `\x1b[13;2u`
  - macOS `Meta+ArrowLeft` → `\x01`
  - macOS `Meta+ArrowRight` → `\x05`
  - word navigation → `\x1bb` / `\x1bf`

### Persistence across reloads

From `terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md`:

- Persistence is a 3-part system:
  1. `extension/session-grid-store.ts`
  2. detached per-workspace daemon
  3. restored webview with Restty renderers
- Layout key: `VSmux.sessionGridSnapshot`
- Daemon characteristics:
  - per-workspace, not per-extension-host
  - token-authenticated `/control` and `/session` sockets
  - launch lock + `daemon-info.json`
  - keeps PTYs alive across VS Code reloads
- Important thresholds:
  - control connect timeout: `3000ms`
  - daemon ready timeout: `10000ms`
  - owner heartbeat: `5000ms`
  - owner heartbeat timeout: `20000ms`
  - startup grace: `30000ms`
  - session attach ready timeout: `15000ms`
  - replay buffer: `8 MiB`
  - replay chunk size: `128 KiB`
- Replay model:
  - restored pane waits for `terminalReady`
  - daemon replays ring buffer
  - pending output queues during replay
  - pending output flushes after replay
- Presentation fallback:
  - per-session state files preserve title and agent metadata
  - disconnected snapshots can still show sidebar title/agent/status

## Workspace Panel and Startup

### Startup/bootstrap strategy

From `workspace_panel_startup_without_placeholder.md` and `workspace_panel_startup_without_loading_placeholder.md`:

- `openWorkspace` reveals sidebar before panel reveal
- If no sessions exist, it creates a session first
- If sessions exist, it refreshes workspace state first
- The loading placeholder was removed
- Initial render now comes from embedded bootstrap state:
  - `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- Panel manager buffers:
  - `latestMessage`
  - `latestRenderableMessage`
- Renderable messages are only:
  - `hydrate`
  - `sessionState`
- Replay order on `ready`:
  1. latest renderable state
  2. latest transient message if distinct
- One-shot `autoFocusRequest` is stripped before buffering/replay

### Panel focus hotkeys

From `workspace_panel_focus_hotkeys.md`:

- New context key: `vsmux.workspacePanelFocus`
- Synced from `panel.active && panel.visible`
- Cleared on hide/dispose/panel disposal
- Workspace/session/layout hotkeys now use:
  - `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`
- Directional focus hotkeys remain terminal-only:
  - `terminalFocus`

### Debug console suppression

From `workspace_debug_console_suppression.md`:

- `workspace/workspace-debug.ts` keeps `logWorkspaceDebug(enabled, _event, _payload)` signature
- Browser console logging is suppressed even when debug is enabled
- Debug events still flow through `workspaceDebugLog` to extension-side VSmux Debug output/file channel
- Regression test prevents events like `terminal.socketOpen` from reaching desktop console

## Focus, Pane Ordering, and Drag Semantics

### Focus ownership

Across `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, `terminal_titles_activity_and_sidebar_runtime.md`, and `workspace_sidebar_interaction_state.md`:

- `TerminalPane` emits activation intent only:
  - `onActivate("pointer")`
  - `onActivate("focusin")`
- `WorkspaceApp` is the single owner of stateful focus decisions
- Auto-focus guard: `400ms`
- During an active guard:
  - same guarded session may proceed
  - competing session activation is ignored
- T3 iframe focus messages use:
  - `type === "vsmuxT3Focus"`
- T3 iframe focus is ignored if:
  - pane hidden
  - blocked by auto-focus guard
  - already focused

### Visible pane ordering

From `workspace_focus_and_sidebar_drag_semantics.md`, `terminal_titles_activity_and_sidebar_runtime.md`, and `current_state.md`:

- Visible split-pane layout order comes from `activeGroup.snapshot.visibleSessionIds`
- `localPaneOrder` is only a temporary override within the currently visible set
- This preserves split-slot stability and avoids pane jumps caused by global ordering artifacts
- Reorder sync uses `syncPaneOrder`

### Sidebar drag semantics

From `workspace_focus_and_sidebar_drag_semantics.md`, `terminal_titles_activity_and_sidebar_runtime.md`, and `workspace_sidebar_interaction_state.md`:

- Sidebar reorder must never happen from click-like interactions
- Real pointer movement threshold: `8px`
- Additional drag timings:
  - startup interaction block: `1500ms`
  - non-touch drag distance: `6px`
  - touch drag activation: `250ms` delay, `5px` tolerance
  - session-card hold-to-drag: `130ms` delay, `12px` tolerance
- Sidebar reorder/move messages:
  - `syncSessionOrder`
  - `moveSessionToGroup`
  - `syncGroupOrder`

## Grouped Workspace State and Sleep/Wake

### Simple grouped workspace state

From `simple_grouped_session_workspace_state.md`:

- Core module: `shared/simple-grouped-session-workspace-state.ts`
- Test coverage: `shared/simple-grouped-session-workspace-state.test.ts`
- Normalization rules:
  - ensure at least one group exists
  - drop browser sessions
  - canonicalize session IDs from display IDs
  - repair duplicate generated display IDs
- Canonical ID rule:
  - `session-${formatSessionDisplayId(displayId ?? 0)}`
- Group/session behavior:
  - removing last session from active group keeps emptied group
  - active-group fallback prefers nearest previous non-empty group, then next
  - group-local `visibleSessionIds` are restored on group focus
  - split mode preserves visibility behavior on new session creation
  - moving a session activates destination group and focuses moved session
- Group creation limits respect `MAX_GROUP_COUNT`
- Snapshot equality uses JSON stringify comparison

### Sleep/wake support

From `workspace_session_sleep_wake_support.md`:

- Session records now persist `isSleeping`
- Sleeping sessions are excluded from focus and visible-split calculations
- Focusing a sleeping session implicitly wakes it
- Group sleep/wake toggles all sessions in group
- Sleep applies only to non-browser sessions/groups
- Sleeping a terminal session disposes live terminal/runtime surfaces but keeps resume metadata
- If sleeping empties the active group of awake sessions, active group falls back to another non-empty group

## Session Titles, Activity, and Sounds

### Title normalization and session-facing use

From `terminal_title_normalization_and_session_actions.md`:

- Canonical sanitizer: `normalizeTerminalTitle()`
- Leading status/progress glyphs stripped with:
  - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- Path-like titles starting with `~` or `/` are treated as non-visible
- Generated titles matching `^Session \d+$` are not primary visible titles
- Preferred title resolution:
  1. visible normalized terminal title
  2. visible user/session title
  3. otherwise undefined
- Persistence normalizes titles on parse and serialization
- Controller still keeps raw daemon `liveTitle` in memory for activity detection
- Rename/resume/fork/full reload now all prefer normalized visible titles

### Rename auto-summarization

From `session_rename_title_auto_summarization.md`:

- Summarize only when `title.trim().length > 25`
- Threshold: `25`
- Clamp target: `24`
- Prompt rules:
  - plain text only
  - 2–4 words preferred
  - no quotes/markdown/commentary
  - no ending punctuation
- Final output handling:
  - first non-empty line
  - strip full-response fences if fenced
  - remove wrapping quotes
  - collapse whitespace
  - strip trailing periods
  - whole-word truncation preferred before raw slice
- Provider details:
  - git text generation timeout: `180000ms`
  - Codex pinned to `gpt-5.4-mini` with high reasoning effort
  - Claude pinned to `haiku` with high effort

### Title-derived activity and completion sounds

From `terminal_titles_activity_and_completion_sounds.md` and `title_activity_and_sidebar_runtime.md`:

- Terminal titles are first-class presentation state from daemon snapshots
- Activity is title-driven for CLI agents
- Marker families:
  - Claude working: `⠐ ⠂ ·`
  - Claude idle: `✳ *`
  - Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini: `✦` working, `◇` idle
  - Copilot: `🤖` working, `🔔` idle/attention
- Claude/Codex require observed title transitions before spinner counts as working
- Claude/Codex stale-spinner timeout: `3000ms`
- Gemini/Copilot do not use stale-spinner guard
- Attention gating:
  - session must have worked for at least `3000ms` before attention can surface
- Completion sound:
  - delayed `1000ms`
  - embedded as data URLs
  - decoded/played via unlocked `AudioContext`
- High-frequency title/activity updates use targeted presentation patch messages instead of full rehydrates

## Sidebar Session Actions and Browser Empty State

### Resume, fork, reload, and rename flows

From `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, `default_agent_commands_overrides.md`, and `terminal_title_normalization_and_session_actions.md`:

- Copy resume support: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- Fork support: `codex` and `claude` only
- Full reload support: `codex` and `claude` only
- Browser sessions cannot rename, fork, copy resume, or full reload
- Fork flow:
  - sidebar posts `{ type: "forkSession", sessionId }`
  - controller validates session/group/title/command
  - creates sibling session in same group
  - reuses source agent metadata and launch metadata
  - reorders new session immediately after source
  - writes fork command
  - schedules delayed rename after `4000ms`
- Fork commands:
  - Codex: `codex fork '<title>'`
  - Claude: `claude --fork-session -r '<title>'`
- Rename for terminal sessions writes `/rename <title>` after backend rename
- Detached resume:
  - auto-exec for Codex/Claude when executable
  - prefill/guidance only for Gemini/Copilot/OpenCode and custom agents

### Default agent command overrides

From `default_agent_commands_overrides.md`:

- Setting: `VSmux.defaultAgentCommands`
- Scope: application
- Built-ins: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- Values are trimmed; empty strings normalize to `null`
- Sidebar default buttons use configured override only when no stored default-agent preference exists
- Stored explicit non-default commands remain authoritative
- Legacy stored stock commands are upgraded to configured aliases during resume/fork resolution
- Legacy string-only stored launches normalize to `{ agentId: "codex", command }`
- Built-in launch resolution excludes `t3`

### Sidebar presentation tweaks

From `sidebar_session_card_last_interaction_timestamps.md` and `sidebar_browsers_empty_state.md`:

- `.session-last-interaction-time` font size increased from:
  - `calc(10px * var(--sidebar-density-scale))`
  - to `calc(12px * var(--sidebar-density-scale))`
- Empty browser groups no longer render `.group-sessions`
- This removes extra gap beneath browser group headers
- Non-browser empty groups still render `No sessions` drop target
- A comment remains that browser empty placeholder may be restored later

## Browser and T3 Integration

### Workspace/browser integration

From `workspace_browser_t3_integration.md`:

- Browser group ID: `browser-tabs`
- Workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon: `media/icon.svg`
- Browser sidebar filtering excludes:
  - internal VSmux workspace tabs
  - T3-owned tabs
  - localhost `workspace` / `t3-embed` URLs
  - diff tabs and several non-browser labels
- Sidebar workspace groups render from authoritative `sessionIdsByGroup` to avoid transient `No sessions`

### T3 activity integration

From `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`, and references in other entries:

- Default T3 websocket URL: `ws://127.0.0.1:3774/ws`
- T3 activity monitor uses:
  - snapshot RPC: `orchestration.getSnapshot`
  - domain events subscription: `subscribeOrchestrationDomainEvents`
- Request timeout: `15000ms`
- Reconnect delay: `1500ms`
- Refresh debounce: `100ms`

### Managed T3 runtime upgrade model

From `t3_managed_runtime_upgrade_and_recovery.md`:

- Updated managed runtime is isolated on port `3774`
- Legacy runtime remains on `3773`
- Managed server entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Protocol requirements:
  - websocket route must be `/ws`
  - request IDs must be numeric strings like `"1"`
  - handle `Ping` with `Pong`
  - streaming subscriptions use `Chunk`, `Ack`, `Exit`
- Build script copies overlay into vendored upstream, rebuilds web assets, recreates `forks/t3code-embed/dist`, and prunes `.map` and `mockServiceWorker.js`
- Upgrade workflow should happen in an isolated worktree, then copy validated `upstream`, `overlay`, and `dist` back to main before reinstall

## Packaging and Extension Integration

### VSIX packaging and embed validation

From `vsix_packaging_and_t3_embed_validation.md`:

- Packaging script: `scripts/vsix.mjs`
- Modes:
  - `package`
  - `install`
- Build command: `pnpm run compile`
- Package command:
  - `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
- Install command:
  - `<vscodeCli> --install-extension <vsixPath> --force`
- Packaged assets include:
  - `forks/t3code-embed/dist/**`
  - `out/workspace/**`
  - `out/**`
  - `media/**`
- Validation rule: verify installed T3 embed asset hash under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js` before debugging webview behavior
- Documented mismatch:
  - refreshed worktree asset: `index-DCV3LG5L.js`
  - stale installed asset: `index-BbtZ0IEL.js`

### ai-devtools / chat-history integration

From `vsmux_ai_devtools_integration.md`:

- VSmux remains the single shipped extension host
- `activateChatHistory(context)` runs during extension activation before workspace controller setup
- `aiDevtools.conversations` is registered under existing `VSmuxSessions` sidebar container below `VSmux.sessions`
- Chat-history build output: `chat-history/dist`
- Assets packaged from:
  - `chat-history/dist`
  - `chat-history/media`
- Root extension build includes:
  - sidebar build
  - debug-panel build
  - workspace build
  - `chat-history:webview:build`
  - TypeScript compile
  - runtime dependency vendoring
- `ai-devtools.suspend` disposes the current panel, clears sidebar cache, and enters suspended state for memory release

## Agent Manager X Integration

### Bridge integration

From `agent_manager_x_bridge_integration.md`:

- New bridge client: `extension/agent-manager-x-bridge.ts`
- Endpoint: `ws://127.0.0.1:47652/vsmux`
- Controller owns one `AgentManagerXBridgeClient`
- Controller publishes an initial snapshot during `initialize()`
- Bridge publishes normalized workspace/session snapshots containing:
  - workspace metadata
  - per-session agent, alias, displayName
  - focus, visibility, running state
  - `kind`, `status`
  - optional `terminalTitle`, `threadId`
- Send rules:
  - latest snapshot exists
  - socket open
  - serialized payload changed
- Reconnect backoff:
  - starts `1000ms`
  - doubles to max `5000ms`
- Snapshots stay in memory only; not persisted to disk
- `focusSession` broker commands are only executed when `workspaceId` matches the latest snapshot workspace

### Direct focus path update

From `agent_manager_x_focus_path_without_sidebar_rehydration.md`:

- `focusSessionFromAgentManagerX` now focuses target session directly
- Broker-driven session jumps no longer force sidebar container open first
- This removes visible sidebar reload/re-hydration while preserving existing workspace focus behavior
- The broader `NativeTerminalWorkspaceController` remains the integration point for bridge, sidebar hydration, workspace panel, T3 monitoring, and lifecycle actions

## Key Entry Relationships for Drill-down

### Foundational architecture

- `context.md`
- `current_state.md`

### Runtime/persistence details

- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

### Focus/ordering/drag behavior

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging.md`
- `workspace_sidebar_interaction_state.md`
- `terminal_titles_activity_and_sidebar_runtime.md`

### Session/group state helpers

- `simple_grouped_session_workspace_state.md`
- `workspace_session_sleep_wake_support.md`

### Title/activity/sound semantics

- `terminal_title_normalization_and_session_actions.md`
- `session_rename_title_auto_summarization.md`
- `terminal_titles_activity_and_completion_sounds.md`
- `title_activity_and_sidebar_runtime.md`

### Session actions/configuration

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `default_agent_commands_overrides.md`

### UI polish

- `sidebar_browsers_empty_state.md`
- `sidebar_session_card_last_interaction_timestamps.md`
- `workspace_debug_console_suppression.md`

### Browser/T3/package integrations

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_ai_devtools_integration.md`

### Agent Manager X

- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`
