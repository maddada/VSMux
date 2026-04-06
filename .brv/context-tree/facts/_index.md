---
children_hash: 6cc18051c8c7faeb019a8b1b1793ba7025225e3fb5ed032b94656a7874c03227
compression_ratio: 0.6826205641492266
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 5495
summary_level: d2
token_count: 3751
type: summary
---

# Facts Domain Structural Summary

## Purpose and Scope

The `facts` domain is the repository’s quick-recall layer for stable, concrete implementation details: technology choices, config defaults, invariants, thresholds, storage keys, support matrices, and exact behavioral rules. It complements `architecture/*` by preserving concise factual statements rather than long-form narratives.

Primary aggregated topic: `project/_index.md`

## Main Knowledge Clusters in `facts/project`

### 1. Terminal workspace runtime, persistence, and startup

Drill-down entries:

- `terminal_workspace_facts.md`
- `terminal_workspace_runtime_facts.md`
- `terminal_persistence_reload_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`
- `workspace_panel_startup_bootstrap_facts.md`
- `workspace_panel_startup_without_loading_placeholder_facts.md`
- `workspace_panel_startup_without_placeholder_facts.md`
- `workspace_session_sleep_wake_support_facts.md`

Key facts:

- Workspace terminal rendering uses **Restty**.
- PTY/session lifetime is backed by a detached per-workspace Node daemon using `ws` and `@lydell/node-pty`.
- Layout persistence is stored in VS Code `workspaceState` under `VSmux.sessionGridSnapshot`.
- Runtime caching is keyed by `sessionId`; teardown distinguishes cached-host release vs full runtime destruction.
- Restore/replay sequence is consistent across reloads: state restore -> daemon reconnect -> session reconnect -> `terminalReady` handshake -> replay -> pending-output flush.
- Workspace startup behavior preserves explicit ordering between sidebar reveal, session creation/panel reveal, and replay of renderable vs transient messages.
- Sleep/wake support preserves resumable metadata while excluding sleeping sessions from focus and split visibility.

Representative constants:

- Control/handshake timeout: **3000 ms**
- Daemon ready timeout: **10000 ms**
- Launch lock stale threshold: **30000 ms**
- Session attach readiness timeout: **15000 ms**
- Owner heartbeat interval/timeout: **5000 / 20000 ms**
- Idle shutdown: **5 minutes**
- Ring buffer: **8 _ 1024 _ 1024 bytes**
- Replay chunk size: **128 \* 1024 bytes**

### 2. Workspace focus, pane ordering, drag semantics, and debug behavior

Drill-down entries:

- `workspace_focus_and_drag_runtime_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `workspace_focus_debugging_facts.md`
- `workspace_panel_focus_hotkeys_facts.md`
- `workspace_debug_console_suppression_facts.md`

Key relationships:

- `WorkspaceApp` is the authority for terminal focus; `TerminalPane` emits activation intent.
- Focus activation distinguishes `"pointer"` and `"focusin"` sources.
- Visible pane order comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is a temporary visible-session override only.
- Drag/reorder semantics are threshold-driven and differ for touch vs non-touch.
- Debug logging is intentionally suppressed in the browser console through a no-op `logWorkspaceDebug(enabled, _event, _payload)` shim, while extension-side logging can still capture events.
- Hotkey routing now includes the panel focus context key `vsmux.workspacePanelFocus`.

Representative constants:

- `AUTO_FOCUS_ACTIVATION_GUARD_MS`: **400 ms**
- Sidebar reorder threshold: **8 px**
- Startup interaction block: **1500 ms**
- Non-touch drag activation: **6 px**
- Touch drag: **250 ms** delay, **5 px** tolerance
- Session-card drag hold: **130 ms**, **12 px** tolerance
- Lag probes and warning/threshold windows are explicitly defined in `workspace_focus_and_drag_runtime_facts.md`.

### 3. Grouped workspace-state model and session identity normalization

Drill-down entry:

- `simple_grouped_session_workspace_state_facts.md`

File anchors:

- `shared/simple-grouped-session-workspace-state.ts`
- `shared/simple-grouped-session-workspace-state.test.ts`

Core structural rules:

- Missing state defaults through `createDefaultGroupedSessionWorkspaceSnapshot()`.
- At least one group is always ensured via `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`.
- Browser sessions are removed during normalization.
- Session IDs canonicalize to `session-${formatSessionDisplayId(displayId ?? 0)}`.
- Empty groups are retained after last-session removal.
- Active-group fallback prefers the nearest previous non-empty group.
- New sessions receive the first free display ID.
- Group indexing is 1-based.
- `setT3SessionMetadataInSimpleWorkspace` mutates only `kind === t3`.
- Snapshot equality is strict string equality via `JSON.stringify(left) === JSON.stringify(right)`.

This entry is the canonical facts source for group/session identity, normalization, fullscreen restore behavior, visible-session preservation, and group-count limits.

### 4. Titles, renaming, fork/resume, and agent command resolution

Drill-down entries:

- `terminal_title_normalization_facts.md`
- `sidebar_session_fork_support_facts.md`
- `sidebar_fork_session_behavior_facts.md`
- `session_rename_title_auto_summarization_facts.md`
- `default_agent_commands_override_facts.md`

Key patterns:

- Title processing is normalized before persistence and display decisions.
- `normalizeTerminalTitle` strips leading progress/status glyphs using the regex:
  `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- `getVisibleTerminalTitle` hides normalized titles starting with `~` or `/`.
- Preferred title precedence is:
  visible terminal title -> visible primary session title -> `undefined`
- Persisted status values are constrained to `idle`, `working`, `attention`, defaulting to `idle`.
- Session-state writes use atomic temp-file-then-rename semantics.

Rename/summarization:

- Auto-summarization runs only when `title.trim().length > 25`.
- Threshold constant: **25**
- Max generated title length: **24**
- Prompt contract requires plain text only, no quotes/markdown/commentary/ending punctuation, with 2–4 words preferred.
- Models:
  - Codex: `gpt-5.4-mini` with high reasoning effort
  - Claude: `haiku` with high effort

Fork/resume support matrix:

- Copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- Fork: `codex`, `claude`
- Full reload: `codex`, `claude`
- Browser sessions are excluded from rename/fork/copy-resume/full-reload sidebar actions.

Fork implementation details:

- Sidebar message: `{ type: "forkSession", sessionId: string }`
- Dispatch contract: `forkSession: (sessionId: string) => Promise<void>`
- Commands:
  - `codex fork <preferred title>`
  - `claude --fork-session -r <preferred title>`
- Delayed rename command: `/rename fork <preferred title>` after `FORK_RENAME_DELAY_MS = 4000`
- Validation string is preserved exactly in `sidebar_fork_session_behavior_facts.md`.

Default command overrides:

- Setting key: `VSmux.defaultAgentCommands`
- Built-in keys: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- Empty strings normalize to `null`
- Stored explicit commands override configured defaults
- Legacy built-ins may upgrade only if the stored value exactly matches the original stock default

### 5. Sidebar rendering and card metadata presentation

Drill-down entries:

- `sidebar_browsers_empty_state_facts.md`
- `sidebar_session_card_last_interaction_timestamp_facts.md`

Key UI invariants:

- Empty browser groups do not render `.group-sessions`, preventing extra grid gap below the header.
- Non-browser empty groups still render the “No sessions” drop target.
- Timestamp styling changed from `calc(10px * var(--sidebar-density-scale))` to `calc(12px * var(--sidebar-density-scale))` while preserving alignment/layout.

### 6. Agent Manager X integration and focus-path behavior

Drill-down entries:

- `agent_manager_x_bridge_integration_facts.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

Bridge facts:

- Broker URL: `ws://127.0.0.1:47652/vsmux`
- Handshake timeout: **3000 ms**
- `perMessageDeflate` is disabled
- Reconnect backoff: **1000 ms** doubling to **5000 ms**
- Snapshots are memory-only and publish only when snapshot exists, socket is open, and payload changed
- Incoming ping messages are ignored

Controller relationships:

- `NativeTerminalWorkspaceController` constructs `AgentManagerXBridgeClient`
- Initial snapshot publishes during `initialize()`
- `focusSession` only applies when incoming `workspaceId` matches latest snapshot workspaceId`

Focus refinement:

- `focusSessionFromAgentManagerX` now focuses target sessions directly without opening/re-hydrating the sidebar container first, removing visible reload artifacts.

Also preserved in this cluster:

- `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
- `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
- `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
- `FORK_RENAME_DELAY_MS = 4000`
- `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### 7. T3/browser/workspace integration and managed runtime upgrade

Drill-down entries:

- `workspace_browser_t3_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`

Workspace/browser/T3 facts:

- Sidebar browser listings exclude internal VSmux workspace and T3-owned tabs.
- Workspace panel identity is fixed as type `vsmux.workspace`, title `VSmux`.
- Local resource roots include `out/workspace` and `forks/t3code-embed/dist`.
- `retainContextWhenHidden` is `false` for the workspace panel.
- T3 activity uses websocket-backed `T3ActivityMonitor`.
- Group state trusts authoritative `sessionIdsByGroup` payloads.
- T3 focus acknowledgement is completion-marker-aware through `acknowledgeThread`.

Managed runtime upgrade invariants:

- Current embedded runtime endpoint: `127.0.0.1:3774`
- Legacy note: `127.0.0.1:3773`
- Real websocket endpoint: `/ws`
- Effect RPC request IDs are numeric strings, not UUIDs
- Managed runtime entrypoint:
  `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Mixed-install recovery requires syncing upstream, overlay, and dist from a tested worktree.

### 8. Packaging, extension identity, search, viewer, and chat-history integration

Drill-down entries:

- `vsmux_packaging_and_embed_validation_facts.md`
- `vsmux_ai_devtools_integration_facts.md`
- `vsmux_search_rename_facts.md`
- `viewer_search_and_resume_actions_facts.md`

Extension/package identity:

- Display name: `VSmux - T3code & Agent CLIs Manager`
- Publisher: `maddada`
- Main: `./out/extension/extension.js`
- Repository: `https://github.com/maddada/VSmux.git`
- Icon: `media/VSmux-marketplace-icon.png`
- Version: **2.6.0**
- VS Code engine: `^1.100.0`
- Package manager: `pnpm@10.14.0`

Activation/container structure:

- Primary Activity Bar container: `VSmuxSessions`
- Primary view: `VSmux.sessions`
- Secondary container: `VSmuxSessionsSecondary`
- Activation events include `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`

Dependency/package overrides:

- `vite -> npm:@voidzero-dev/vite-plus-core@latest`
- `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
- `restty@0.1.35` patched by `patches/restty@0.1.35.patch`

AI DevTools/chat-history integration:

- VSmux remains the only shipped extension host.
- `aiDevtools.conversations` is registered under `VSmuxSessions`, below `VSmux.sessions`.
- Build output lives in `chat-history/dist`; assets resolve from `chat-history/dist` and `chat-history/media`.
- Extension TS compilation includes `extension`, `shared`, and `chat-history/src/extension`.
- Chat-history webview targets `es2020` and `iife`.
- Viewer/panel memory efficiency uses `retainContextWhenHidden: false`.
- `ai-devtools.suspend` disposes the panel, clears sidebar provider cache, and marks suspended state.

VSmux Search:

- View id: `VSmuxSearch.conversations`
- Label: `VSmux Search`
- Standalone package: `vsmux-search-vscode`
- Publisher: `vsmux-search`
- Container id: `vsmux-search`
- Viewer panel type: `vsmuxSearchViewer`
- Export prefix: `vsmux-search-export-`
- Recent conversation cutoff: **7 days**
- Filter debounce: **150 ms**

Conversation viewer search/resume:

- Search shortcut: `Cmd/Ctrl+F`
- Uses browser-native `window.find`
- Resume is enabled only when source can be inferred from `filePath` and a `sessionId` can be parsed
- Source inference:
  - `/.codex/`, `/.codex-profiles/` -> Codex
  - `/.claude/`, `/.claude-profiles/` -> Claude
- Resume message includes `source`, `sessionId`, optional `cwd`
- CLI resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Shell-safe quoting uses `quoteShellLiteral`
- Invalid JSONL/schema lines become `x-error` records

### 9. Git text generation provider configuration

Drill-down entry:

- `git_text_generation_low_effort_provider_facts.md`

Key facts:

- Setting key: `VSmux.gitTextGenerationProvider`
- Supported values: `codex`, `claude`, `custom`
- Default provider: `codex`
- Built-in provider behavior:
  - Codex: `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude: `haiku` with `--effort low`
- Runtime timeout: **180000 ms**
- Codex provider uses stdin input and disables interactive shell mode
- Custom commands may emit via temp file or stdout
- Numeric session rename limits were intentionally preserved during this provider update

## Cross-Cutting Design Patterns

Across `project/_index.md`, the dominant preserved patterns are:

- **Per-workspace identity and gating** for daemon lifetime, snapshot publication, reconnect logic, and focus application
- **Low-retention webviews** using `retainContextWhenHidden: false` across workspace, viewer, and chat-history surfaces
- **Strict precedence rules** for titles, persisted state, startup replay ordering, and default-vs-stored agent commands
- **Exact support matrices and exclusion rules** for fork/resume/reload/browser-session behavior
- **Stable constants as first-class knowledge**, especially timeouts, thresholds, debounce windows, and delay values

## Drill-Down Map

- Runtime/persistence/startup: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `terminal_persistence_reload_facts.md`, `terminal_persistence_across_vs_code_reloads_facts.md`
- Focus/drag/hotkeys/debug: `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_panel_focus_hotkeys_facts.md`
- Group/session normalization: `simple_grouped_session_workspace_state_facts.md`
- Titles/fork/resume/commands: `terminal_title_normalization_facts.md`, `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `session_rename_title_auto_summarization_facts.md`, `default_agent_commands_override_facts.md`
- Agent Manager X: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`
- T3/browser/runtime upgrade: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`
- Packaging/search/viewer/chat-history: `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`, `vsmux_search_rename_facts.md`, `viewer_search_and_resume_actions_facts.md`
- Git text generation: `git_text_generation_low_effort_provider_facts.md`
