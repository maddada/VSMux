---
children_hash: 19e5d083f59a682410021e74dfd7a531c979553ef920a71219e554c93ed5c80e
compression_ratio: 0.19452697419859266
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration_facts.md,
    agent_manager_x_focus_path_without_sidebar_rehydration_facts.md,
    context.md,
    default_agent_commands_override_facts.md,
    git_text_generation_low_effort_provider_facts.md,
    session_rename_title_auto_summarization_facts.md,
    sidebar_browsers_empty_state_facts.md,
    sidebar_fork_session_behavior_facts.md,
    sidebar_session_card_last_interaction_timestamp_facts.md,
    sidebar_session_fork_support_facts.md,
    simple_grouped_session_workspace_state_facts.md,
    t3_managed_runtime_upgrade_facts.md,
    terminal_persistence_across_vs_code_reloads_facts.md,
    terminal_persistence_reload_facts.md,
    terminal_title_normalization_facts.md,
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    viewer_search_and_resume_actions_facts.md,
    vsmux_ai_devtools_integration_facts.md,
    vsmux_packaging_and_embed_validation_facts.md,
    vsmux_search_rename_facts.md,
    workspace_browser_t3_integration_facts.md,
    workspace_debug_console_suppression_facts.md,
    workspace_focus_and_drag_runtime_facts.md,
    workspace_focus_debugging_facts.md,
    workspace_panel_focus_hotkeys_facts.md,
    workspace_panel_startup_bootstrap_facts.md,
    workspace_panel_startup_without_loading_placeholder_facts.md,
    workspace_panel_startup_without_placeholder_facts.md,
    workspace_session_sleep_wake_support_facts.md,
    workspace_sidebar_interaction_facts.md,
  ]
covers_token_total: 25580
summary_level: d1
token_count: 4976
type: summary
---

# Project Facts Summary

## Scope

The `facts/project` topic is a recall-oriented layer for stable implementation details across VSmux terminal workspace, sidebar behavior, Agent Manager X, T3/embed packaging, chat-history viewer/search, and git/session title generation. It emphasizes exact constants, file ownership, message types, storage keys, support matrices, and precedence rules rather than broader architecture.

## Major Clusters

### 1. Terminal workspace runtime, persistence, and startup

Core entries: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `terminal_persistence_reload_facts.md`, `terminal_persistence_across_vs_code_reloads_facts.md`, `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_session_sleep_wake_support_facts.md`

- Renderer/runtime:
  - Workspace terminal renderer is **Restty**.
  - Runtime cache is keyed by `sessionId`; `releaseCachedTerminalRuntime` removes host DOM when refCount reaches 0 without full destruction, while `destroyCachedTerminalRuntime` tears down transport + Restty + cache entry.
  - Hidden connected panes remain mounted/painted; active redraws are avoided on visibility flips.
- Persistence architecture:
  - Layout persists in VS Code `workspaceState` under `VSmux.sessionGridSnapshot`.
  - PTYs stay alive via a **detached per-workspace Node.js daemon** using `ws` and `@lydell/node-pty`.
  - Daemon state dir prefix: `terminal-daemon-${workspaceId}`.
  - Files: `daemon-info.json`, `daemon-launch.lock`, `terminal-daemon-debug.log`.
- Timeouts and thresholds:
  - Control connect timeout: **3000 ms**
  - Daemon ready timeout: **10000 ms**
  - Launch lock stale threshold: **30000 ms**
  - Owner heartbeat interval/timeout: **5000 / 20000 ms**
  - Startup grace: **30000 ms**
  - Idle shutdown default: **5 minutes**
  - Session attach readiness timeout: **15000 ms**
  - Ring buffer: **8 _ 1024 _ 1024 bytes**
  - Replay chunk size: **128 \* 1024 bytes**
- Restoration/replay:
  - Restore flow is `reload -> workspaceState restore -> daemon reconnect -> session reconnect -> terminalReady -> replay -> pending output flush -> active attachment`.
  - Reattached webviews use a `terminalReady` handshake before replay activation.
  - Pending daemon output is buffered during replay and flushed afterward.
  - Session fallback metadata preserves title/agent info when live daemon state is unavailable.
- Workspace panel startup:
  - `openWorkspace` reveals the sidebar first.
  - Empty-state path: reveal sidebar -> create session -> reveal workspace panel.
  - Existing sessions path: reveal sidebar -> refresh workspace panel -> reveal panel -> refresh sidebar.
  - Buffered renderable messages are `hydrate` and `sessionState`.
  - `WorkspacePanelManager` tracks `latestMessage` and `latestRenderableMessage` separately.
  - New panel HTML can bootstrap initial state via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`.
  - Replay order prioritizes renderable state before transient messages like `terminalPresentationChanged`.
  - Duplicate stable-state suppression uses JSON signatures after stripping transient fields, except fresh `autoFocusRequest.requestId` values still apply.
- Sleep/wake:
  - Session snapshots persist `isSleeping`.
  - Sleeping sessions are excluded from focus and split visibility calculations.
  - Focusing a sleeping session wakes it.
  - Sleep applies only to non-browser sessions/groups and disposes live runtime/surface while preserving resumable metadata.

### 2. Workspace focus, pane ordering, drag semantics, and debugging

Core entries: `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_panel_focus_hotkeys_facts.md`, `workspace_debug_console_suppression_facts.md`

- Focus ownership and activation:
  - `WorkspaceApp` is authoritative for terminal focus; `TerminalPane` emits activation intent.
  - Activation sources are `"pointer"` and `"focusin"`.
  - Auto-focus guard: **400 ms** (`AUTO_FOCUS_ACTIVATION_GUARD_MS`).
  - T3 iframe focus event type: `vsmuxT3Focus`.
- Pane ordering:
  - Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`.
  - `localPaneOrder` is only a temporary override inside currently visible sessions.
  - Session projection flattens all group session arrays into the workspace.
- Drag/reorder thresholds:
  - Sidebar reorder threshold: **8 px**
  - Startup interaction block: **1500 ms**
  - Non-touch drag activation distance: **6 px**
  - Touch drag activation: **250 ms** delay, **5 px** tolerance
  - Session-card drag hold: **130 ms**, **12 px** tolerance
- Lag and scroll behavior:
  - `AUTO_RELOAD_ON_LAG` is true.
  - Lag probes: 50 ms interval, 5000 ms probe window, 10000 ms monitor window, 1000 ms lag threshold, 250 ms warning threshold.
  - Scroll-to-bottom shows at >200 px from bottom and hides below 40 px.
  - Typing auto-scroll triggers after 4 printable keystrokes in a 450 ms burst window.
- Debug logging:
  - `workspace_debug_console_suppression_facts.md` records that `logWorkspaceDebug(enabled, _event, _payload)` is effectively a no-op shim for browser-console output; reconnect-related debug events stay out of browser console while extension-side capture remains possible.
- Hotkeys:
  - New panel focus context key: `vsmux.workspacePanelFocus`.
  - Workspace/session/layout hotkeys use `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`.
  - Directional focus remains terminal-only with `terminalFocus`.

### 3. Grouped workspace-state model and session identity rules

Core entry: `simple_grouped_session_workspace_state_facts.md`

- File anchors:
  - Implementation: `shared/simple-grouped-session-workspace-state.ts`
  - Tests: `shared/simple-grouped-session-workspace-state.test.ts`
- Normalization behavior:
  - Missing snapshot defaults through `createDefaultGroupedSessionWorkspaceSnapshot()`.
  - Ensures at least one group, defaulting to `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`.
  - Normalizes display IDs before per-group normalization.
  - Browser sessions are removed during normalization.
  - Session IDs canonicalize to `session-${formatSessionDisplayId(displayId ?? 0)}`.
- Behavioral rules:
  - Empty groups are retained after last-session removal.
  - Fallback active group prefers nearest previous non-empty group.
  - Group-local `visibleSessionIds` are preserved/restored per active group.
  - New sessions take the **first free display ID**.
  - Group indexing is 1-based.
  - `setT3SessionMetadataInSimpleWorkspace` only updates `kind === t3`.
  - Fullscreen state stores/restores `fullscreenRestoreVisibleCount`.
  - Group creation and “group from session” abort at `MAX_GROUP_COUNT`.
  - Snapshot equality uses `JSON.stringify(left) === JSON.stringify(right)`.
- Test-backed examples are retained here for drill-down, including duplicate display ID repair, fallback selection, move focus, split visibility, canonical drag removal, and T3 metadata identity preservation.

### 4. Terminal titles, rename, resume, fork, and agent command resolution

Core entries: `terminal_title_normalization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `default_agent_commands_override_facts.md`, `session_rename_title_auto_summarization_facts.md`

- Title normalization and persistence:
  - `normalizeTerminalTitle` trims and strips leading status/progress glyphs using:
    - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
  - `getVisibleTerminalTitle` returns `undefined` for normalized titles beginning with `~` or `/`.
  - Preferred title precedence: visible terminal title -> visible primary session title -> undefined.
  - Persisted state normalizes title values on parse and serialize.
  - Persisted status values allowed: `idle`, `working`, `attention`; default `idle`.
  - Session-state file writes are atomic temp-file-then-rename.
- Rename and summarization:
  - Generated session rename titles only summarize when `title.trim().length > 25`.
  - Threshold constant: **25**
  - Max generated title length: **24**
  - Prompt rules require plain text only, no quotes/markdown/commentary/ending punctuation; 2–4 words preferred.
  - Truncation prefers whole words and falls back to slicing.
  - Models:
    - Codex: `gpt-5.4-mini` with **high** reasoning effort for session-title generation
    - Claude: `haiku` with **high** effort
- Sidebar fork/reload/copy-resume support matrix:
  - Copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - Fork: `codex`, `claude`
  - Full reload: `codex`, `claude`
  - Browser sessions cannot rename/fork/copy-resume/full-reload from sidebar menus.
- Fork implementation:
  - Sidebar posts `{ type: "forkSession", sessionId: string }`.
  - Dispatch contract includes `forkSession: (sessionId: string) => Promise<void>`.
  - Controller creates sibling session immediately after source in same group.
  - Source metadata is reused from `sidebarAgentIconBySessionId` and `sessionAgentLaunchBySessionId`.
  - Commands:
    - Codex: `codex fork <preferred title>`
    - Claude: `claude --fork-session -r <preferred title>`
  - Rename follow-up: `/rename fork <preferred title>` after `FORK_RENAME_DELAY_MS = 4000`.
  - Exact validation message: `"Fork is only available for Codex and Claude sessions that have a visible title."`
- Resume/copy-resume behavior:
  - Codex default/numeric titled resume may collapse to `codex resume`.
  - Claude titled resume uses `claude -r 'TITLE'`.
  - Gemini and Opencode copied resume output provide guided list/ID instructions.
  - Detached resume auto-executes for Codex/Claude; Gemini/Copilot/Opencode are prefills only.
  - If launch metadata is missing but icon is Codex, detached resume falls back to Codex resume with title.
- Default agent command overrides:
  - Setting: `VSmux.defaultAgentCommands`
  - Scope: application-level object setting
  - Built-in keys default to `null`: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
  - Normalization trims strings; empty becomes `null`
  - Sidebar default buttons use configured overrides only when no stored preference exists.
  - Stored explicit commands remain authoritative.
  - Legacy stock built-ins may upgrade to configured aliases if the stored command exactly equals the original built-in default.
  - Built-in session launch support covers `codex`, `claude`, `copilot`, `gemini`, `opencode`, but not `t3`.

### 5. Sidebar visual/rendering rules

Core entries: `sidebar_browsers_empty_state_facts.md`, `sidebar_session_card_last_interaction_timestamp_facts.md`

- Browser-group empty rendering:
  - Empty browser groups do **not** render `.group-sessions`, preventing extra grid gap below header.
  - Non-browser empty groups still render the “No sessions” drop target.
  - A source comment notes browser placeholders may be restored later.
- Session-card timestamp styling:
  - `.session-last-interaction-time` changed from `calc(10px * var(--sidebar-density-scale))` to `calc(12px * var(--sidebar-density-scale))`.
  - Right alignment and card layout were preserved.

### 6. Agent Manager X integration

Core entries: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

- Bridge connection:
  - Local broker URL: `ws://127.0.0.1:47652/vsmux`
  - Handshake timeout: **3000 ms**
  - `perMessageDeflate` disabled
  - Reconnect backoff: starts at **1000 ms**, doubles to cap at **5000 ms**
  - Snapshots are memory-only, not persisted to disk
  - Snapshots publish only when latest snapshot exists, socket is open, and serialized payload changed
  - Incoming ping messages are ignored
- Controller integration:
  - `NativeTerminalWorkspaceController` constructs `AgentManagerXBridgeClient` and logs through `logVSmuxDebug`
  - Controller `initialize()` publishes an initial Agent Manager X snapshot
  - `focusSession` is applied only when incoming `workspaceId` matches latest snapshot workspaceId
- Focus-path refinement:
  - `focusSessionFromAgentManagerX` now focuses target sessions directly without forcing sidebar container open first
  - This avoids visible sidebar reload/re-hydration artifacts while preserving existing workspace focus behavior
  - Related constants preserved in this entry:
    - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
    - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
    - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
    - `FORK_RENAME_DELAY_MS = 4000`
    - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### 7. T3/browser/workspace integration

Core entries: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`

- Browser/T3/workspace integration:
  - Browser sidebar excludes internal VSmux workspace and T3-owned tabs.
  - Workspace panel identity: type `vsmux.workspace`, title `VSmux`.
  - Local resource roots: `out/workspace`, `forks/t3code-embed/dist`.
  - `retainContextWhenHidden` is false for workspace panel.
  - T3 activity is websocket-backed through `T3ActivityMonitor`.
  - T3 monitor responds to Ping with `pong` and debounces refreshes on domain-event chunks.
  - Workspace groups trust authoritative `sessionIdsByGroup` payloads.
  - T3 focus acknowledgement uses completion-marker-aware `acknowledgeThread`.
- Managed runtime upgrade invariants:
  - Updated embedded runtime endpoint: `127.0.0.1:3774`
  - Legacy `npx --yes t3 runtime` notes refer to `127.0.0.1:3773`
  - Real websocket endpoint is `/ws`
  - Effect RPC request IDs are numeric strings, not UUIDs
  - Managed runtime entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - Mixed-install recovery requires syncing upstream, overlay, and dist from tested worktree into main

### 8. Packaging, extension identity, and search/viewer integration

Core entries: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`, `viewer_search_and_resume_actions_facts.md`

- Extension/package identity:
  - Display name: **VSmux - T3code & Agent CLIs Manager**
  - Publisher: `maddada`
  - Main entry: `./out/extension/extension.js`
  - Repository: `https://github.com/maddada/VSmux.git`
  - Icon: `media/VSmux-marketplace-icon.png`
  - Version: **2.6.0**
  - VS Code engine: `^1.100.0`
  - Package manager: `pnpm@10.14.0`
- Containers and activation:
  - Primary Activity Bar container: `VSmuxSessions`
  - Primary view: `VSmux.sessions`
  - Secondary container: `VSmuxSessionsSecondary`
  - Activation events: `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`
- Dependency/package overrides:
  - `vite -> npm:@voidzero-dev/vite-plus-core@latest`
  - `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
  - `restty@0.1.35` patched via `patches/restty@0.1.35.patch`
- AI DevTools/chat-history integration:
  - VSmux remains the only shipped extension host.
  - Registers `aiDevtools.conversations` under `VSmuxSessions`, below `VSmux.sessions`.
  - Build pipeline includes `chat-history:webview:build`; outputs go to `chat-history/dist`.
  - Assets resolve from `chat-history/dist` and `chat-history/media`.
  - Extension TS compile scope includes `extension`, `shared`, and `chat-history/src/extension`.
  - Chat-history webview uses Tailwind CLI + esbuild; target `es2020`, bundle format `iife`.
  - Viewer/panel memory efficiency uses `retainContextWhenHidden: false`.
  - `ai-devtools.suspend` disposes current panel, clears sidebar provider cache, and marks suspended state.
- VSmux Search rename:
  - Search view id: `VSmuxSearch.conversations`
  - Search view label: `VSmux Search`
  - Standalone package: `vsmux-search-vscode`
  - Standalone publisher: `vsmux-search`
  - Activity bar container id: `vsmux-search`
  - Viewer panel type: `vsmuxSearchViewer`
  - Export prefix: `vsmux-search-export-`
  - Recent conversation cutoff: **7 days**
  - Filter debounce: **150 ms**
  - Unknown tools are exported by default if not mapped to an option key
- Conversation viewer search/resume:
  - Search shortcut: `Cmd/Ctrl+F`
  - Uses browser-native `window.find`
  - Keyboard controls: Enter next, Shift+Enter previous, Escape close
  - Resume button enables only when source is inferred from `filePath` and a `sessionId` is parsed
  - Source inference:
    - `/.codex/`, `/.codex-profiles/` -> Codex
    - `/.claude/`, `/.claude-profiles/` -> Claude
  - Resume message contract includes `source`, `sessionId`, optional `cwd`
  - CLI commands:
    - Claude: `claude --resume <sessionId>`
    - Codex: `codex resume <sessionId>`
  - Shell-safe quoting uses `quoteShellLiteral`
  - Resume terminal name format: `AI DevTools Resume (<source>)`
  - Invalid JSONL/schema lines become `x-error` records

### 9. Git text generation provider settings

Core entry: `git_text_generation_low_effort_provider_facts.md`

- Setting: `VSmux.gitTextGenerationProvider`
- Default provider: `codex`
- Supported values: `codex`, `claude`, `custom`
- Built-ins:
  - Codex uses `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude uses `haiku` with `--effort low`
- Runtime behavior:
  - Timeout: **180000 ms**
  - Codex provider uses stdin input and disables interactive shell mode
  - Custom commands may output via temp file or stdout
- Related invariants:
  - Numeric session rename limits were intentionally preserved during this provider update

## Cross-Cutting Patterns

- **Per-workspace architecture** is dominant:
  - daemon lifetime, Agent Manager X snapshot gating, and workspace panel restoration all key off workspace identity.
- **Memory efficiency / low-retention webviews** recur:
  - workspace panel, viewer panel, and chat-history integration all use `retainContextWhenHidden: false`.
- **Stable exact constants** are heavily preserved across entries:
  - 400 ms focus guard
  - 1500 ms sidebar startup block
  - 8 px reorder threshold
  - 3000 ms WebSocket/control timeout
  - 10000 ms daemon ready timeout
  - 4000 ms fork rename delay
- **Precedence rules** are a core design pattern:
  - preferred session title selection
  - persisted presentation state resolution
  - agent command override precedence
  - startup replay ordering of renderable vs transient workspace messages
- **Support matrices** are explicit and repeated:
  - Copy resume: Codex/Claude/Copilot/Gemini/Opencode
  - Fork/full reload: Codex/Claude only
  - Browser sessions are excluded from many sidebar terminal actions

## Drill-Down Guide

- Workspace runtime and thresholds: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`
- Persistence and restoration: `terminal_persistence_reload_facts.md`, `terminal_persistence_across_vs_code_reloads_facts.md`
- Startup/bootstrap/replay: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`
- Session/group state model: `simple_grouped_session_workspace_state_facts.md`
- Titles, resume, fork, rename: `terminal_title_normalization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `session_rename_title_auto_summarization_facts.md`, `default_agent_commands_override_facts.md`
- Agent Manager X: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`
- T3/browser/embed: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`
- Packaging/search/chat-history: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`, `viewer_search_and_resume_actions_facts.md`
- Git text generation: `git_text_generation_low_effort_provider_facts.md`
