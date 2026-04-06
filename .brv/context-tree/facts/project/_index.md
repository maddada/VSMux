---
children_hash: b73bfe858e2fa41b3f36f0635cce8eab059cbeb361389e3f4a9a3cd6d355d207
compression_ratio: 0.21674456228653605
condensation_order: 1
covers:
  [
    agent_manager_x_bridge_integration_facts.md,
    agent_manager_x_focus_path_without_sidebar_rehydration_facts.md,
    context.md,
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
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    viewer_search_and_resume_actions_facts.md,
    vsmux_ai_devtools_integration_facts.md,
    vsmux_packaging_and_embed_validation_facts.md,
    workspace_browser_t3_integration_facts.md,
    workspace_focus_and_drag_runtime_facts.md,
    workspace_focus_debugging_facts.md,
    workspace_panel_focus_hotkeys_facts.md,
    workspace_panel_startup_bootstrap_facts.md,
    workspace_panel_startup_without_loading_placeholder_facts.md,
    workspace_panel_startup_without_placeholder_facts.md,
    workspace_session_sleep_wake_support_facts.md,
    workspace_sidebar_interaction_facts.md,
  ]
covers_token_total: 22252
summary_level: d1
token_count: 4823
type: summary
---

# Project Facts Domain Summary

## Scope

This `facts/project` topic captures stable implementation facts, constants, message contracts, support matrices, and packaging/runtime decisions across VSmux terminal workspace, sidebar, chat-history viewer, T3 integration, and git text generation. It complements architecture entries by isolating exact values and file touchpoints for quick recall.

## Major Fact Clusters

### 1. Terminal workspace runtime, focus, and pane behavior

Core entries: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_sidebar_interaction_facts.md`

- The workspace terminal renderer is **Restty**, with runtime cache keys stable per `sessionId`; runtimes are reused per session and invalidated by `renderNonce`.
- `releaseCachedTerminalRuntime` removes the host only when `refCount === 0` without destroying transport/runtime; `destroyCachedTerminalRuntime` fully destroys transport, Restty, host, and cache entry.
- `WorkspaceApp` is the authority for focus; `TerminalPane` emits activation intent from:
  - `onActivate("pointer")` via pointer capture
  - `onActivate("focusin")` only after `:focus-within`
- Key timing/runtime constants:
  - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
  - backend polling every `500 ms`
  - stable terminal size waits up to `20` attempts and returns after `2` identical measurements
  - reconnect performance probes run for `5000 ms`
- Hidden connected panes remain mounted/painted behind the active pane; visibility flips should not trigger redraws.
- Visible split-pane ordering comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only a temporary override within those visible IDs.
- Lag detection and auto-scroll rules recur across entries:
  - scheduler probe interval `50 ms`
  - probe window `5000 ms`
  - monitor window `10000 ms`
  - lag threshold `1000 ms`
  - warning threshold `250 ms`
  - typing auto-scroll: `4` printable keystrokes in `450 ms`
  - scroll-to-bottom button shows beyond `200 px`, hides below `40 px`
- Focus debugging preserves the iframe event type `vsmuxT3Focus` and activation source set `focusin | pointer`.

### 2. Sidebar drag, interaction, and session command capability rules

Core entries: `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `sidebar_browsers_empty_state_facts.md`

- Sidebar drag/reorder behavior is governed by several thresholds:
  - reorder threshold: `8 px`
  - startup interaction block: `1500 ms`
  - non-touch drag activation distance: `6 px`
  - touch activation: `250 ms` delay with `5 px` tolerance
  - session-card drag hold: `130 ms` with `12 px` tolerance
- Reorder-related sidebar message types include:
  - `syncGroupOrder`
  - `moveSessionToGroup`
  - `syncSessionOrder`
- Browser-group empty state logic lives in `sidebar/session-group-section.tsx`:
  - browser detection: `group?.kind === "browser"`
  - add action for browser groups posts `type: "openBrowser"`
  - non-browser add action posts `type: "createSessionInGroup"` with `groupId`
  - visible count options: `1, 2, 3, 4, 6, 9`
- Capability/support matrices are consistent across multiple entries:
  - resume/copy-resume supports `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - full reload supports only `codex` and `claude`

### 3. Session fork, resume, reload, and rename behaviors

Core entries: `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `session_rename_title_auto_summarization_facts.md`, `viewer_search_and_resume_actions_facts.md`

- Fork support is restricted to **Codex** and **Claude** terminal sessions; browser sessions cannot fork.
- Fork message/dispatch chain:
  - sidebar posts `{ type: "forkSession", sessionId }`
  - `SidebarToExtensionMessage` includes this variant
  - `SidebarMessageHandlers` includes `forkSession: (sessionId: string) => Promise<void>`
  - `sidebar-message-dispatch` routes the message to the handler
- Fork placement and command rules:
  - new terminal session is created in the same group directly after the source session
  - source agent metadata is reused from `sidebarAgentIconBySessionId` and `sessionAgentLaunchBySessionId`
  - Codex fork command: `codex fork <preferred title>`
  - Claude fork command: `claude --fork-session -r <preferred title>`
  - delayed rename uses `/rename fork <preferred title>`
  - `FORK_RENAME_DELAY_MS = 4000`
- Validation requirements for forking include source existence, non-browser session, visible title, terminal source, existing source group, and successful `buildForkAgentCommand`.
- Full reload restarts the session and replays the generated resume command.
- Detached resume policy differs by provider:
  - immediate execution for `codex` and `claude`
  - command suggestion only for `gemini`, `opencode`, `copilot`
- Session rename/title summarization:
  - summarized only when `title.trim().length > 25`
  - threshold constant: `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
  - output max length: `24`
  - truncation prefers whole words, then slices if needed
  - sanitization clamps to `24` chars
  - prompt requires plain text only, no quotes/markdown/commentary/ending punctuation, and prefers `2–4` words
- Provider models for generated titles:
  - Codex: `gpt-5.4-mini` with **high** reasoning effort
  - Claude: `haiku` with **high** effort
- Viewer search and resume in chat-history:
  - custom find bar opens on `Cmd/Ctrl+F`
  - search uses native `window.find`
  - Enter/Shift+Enter/Escape drive next/previous/close behavior
  - Resume button is enabled only when both source and `sessionId` are inferred
  - source inference maps:
    - `/.codex/`, `/.codex-profiles/` → Codex
    - `/.claude/`, `/.claude-profiles/` → Claude
  - resume message contract includes `source`, `sessionId`, optional `cwd`
  - extension opens terminal `AI DevTools Resume (<source>)` and runs:
    - `claude --resume <sessionId>`
    - `codex resume <sessionId>`

### 4. Workspace startup/bootstrap and panel lifecycle

Core entries: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_panel_focus_hotkeys_facts.md`, `workspace_browser_t3_integration_facts.md`

- `openWorkspace` reveals the sidebar first in all documented startup variants.
- Branching startup behavior:
  - no sessions: `revealSidebar -> createSession -> workspacePanel.reveal`
  - existing sessions: `revealSidebar -> refreshWorkspacePanel -> workspacePanel.reveal -> refreshSidebar`
- Workspace panel buffering separates:
  - `latestMessage`
  - `latestRenderableMessage`
- Renderable message types are `hydrate` and `sessionState`.
- If no panel exists, messages are buffered instead of posted immediately.
- Replay/bootstrap ordering:
  - replay posts `latestRenderableMessage` first
  - then `latestMessage` if distinct
  - this preserves correctness for `terminalPresentationChanged`
- HTML bootstrap injects state into `window.__VSMUX_WORKSPACE_BOOTSTRAP__`; `WorkspaceApp` reads initial state from it.
- Duplicate stable workspace state suppression uses JSON signatures of stripped/transient-free messages, except when a new `autoFocusRequest.requestId` is present.
- Workspace panel metadata is consistent across entries:
  - panel type: `vsmux.workspace`
  - title: `VSmux`
  - `retainContextWhenHidden = false`
  - local resource roots include `out/workspace` and `forks/t3code-embed/dist`
- Workspace panel focus hotkeys introduce context key `vsmux.workspacePanelFocus`, synchronized from `panel.active && panel.visible`, cleared on hide/dispose.
- Workspace/session/layout hotkeys use:
  - `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`
- Directional focus hotkeys remain terminal-only with:
  - `terminalFocus`

### 5. Terminal persistence across reloads and daemon lifecycle

Core entries: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`

- Persistence architecture is a 3-part system:
  - `SessionGridStore`
  - detached per-workspace terminal daemon
  - restored webview with Restty renderers
- Workspace layout persists under `workspaceState` key:
  - `VSmux.sessionGridSnapshot`
- Per-workspace daemon behavior:
  - Node.js daemon keeps PTYs alive across extension reloads
  - uses `ws` and `@lydell/node-pty`
  - global storage dir prefix: `terminal-daemon-${workspaceId}`
- Files/artifacts:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`
- Timings:
  - control connect timeout `3000 ms`
  - daemon ready timeout `10000 ms`
  - stale launch lock after `30000 ms`
  - owner heartbeat every `5000 ms`
  - owner timeout `20000 ms`
  - startup grace `30000 ms`
  - idle shutdown default `5 * 60_000 ms`
  - session attach ready timeout `15000 ms`
- Replay/history:
  - ring buffer cap `8 * 1024 * 1024` bytes
  - replay chunks `128 * 1024` bytes
  - restored webviews reattach using a `terminalReady` handshake
  - output during replay is buffered and flushed after replay completes
- Authentication/protocol rules:
  - daemon WebSocket upgrades on `/control` and `/session` require token auth
  - daemon reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION` and reachability
  - requests expecting responses must include `requestId`
- Fallback metadata path:
  - per-session state files preserve title and agent metadata when live daemon data is unavailable
  - `buildSnapshot` merges live title/activity with persisted state
- PTY environment normalization:
  - terminal name `xterm-256color`
  - `LANG` forced to `en_US.UTF-8` when missing/non-UTF-8

### 6. Grouped workspace state model and sleep/wake semantics

Core entries: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`

- `shared/simple-grouped-session-workspace-state.ts` defines normalized grouped workspace behavior, with tests in `shared/simple-grouped-session-workspace-state.test.ts`.
- Normalization rules:
  - default snapshot comes from `createDefaultGroupedSessionWorkspaceSnapshot()`
  - ensures at least one group using `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`
  - normalizes display IDs before per-group normalization
  - drops browser sessions during `normalizeGroupSnapshot`
  - canonical session IDs are generated from display IDs: `session-${formatSessionDisplayId(displayId ?? 0)}`
- State management patterns:
  - empty groups are retained after removing the last session
  - fallback active group prefers nearest previous non-empty group, then later groups
  - group-local `visibleSessionIds` are preserved/restored on group switches
  - destination groups become active/focused after moves
  - first free display ID is allocated for new sessions
  - fullscreen stores/restores `fullscreenRestoreVisibleCount`
  - group indexing for focus is 1-based
  - T3 metadata updates only apply to `kind === "t3"` sessions and preserve identity
- Equality method uses `JSON.stringify(left) === JSON.stringify(right)`.
- Sleep/wake overlay on this model:
  - sessions persist `isSleeping`
  - sleeping sessions are excluded from focus and visible split calculations
  - focusing a sleeping session wakes it
  - group sleep/wake applies to all sessions in the group
  - sleep applies only to non-browser sessions/groups
  - sleeping disposes the live runtime/surface but keeps the session card and resumable metadata
  - if active group becomes fully asleep, focus falls back to another non-empty group
  - sidebar posts `setSessionSleeping`, `focusSession`, and `setGroupSleeping`

### 7. Agent Manager X bridge and focus path

Core entries: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

- VSmux connects to local Agent Manager X broker at:
  - `ws://127.0.0.1:47652/vsmux`
- `AgentManagerXBridgeClient` settings:
  - handshake timeout `3000 ms`
  - per-message deflate disabled
  - reconnect backoff starts at `1000 ms`, doubles to max `5000 ms`
- Snapshot behavior:
  - snapshots are in-memory only, not persisted
  - sent only when a latest snapshot exists, socket is open, and serialized snapshot changed
  - incoming `ping` messages are ignored
- Controller integration:
  - `NativeTerminalWorkspaceController` constructs the bridge client
  - bridge logs route through `logVSmuxDebug`
  - initialization publishes an Agent Manager X snapshot during `initialize()`
- Focus routing change:
  - broker-driven `focusSession` now focuses the target session directly
  - it no longer opens the sidebar container first
  - this avoids visible sidebar reload/re-hydration artifacts
  - workspace focus behavior is otherwise preserved
- Related constants surfaced in the same controller file:
  - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
  - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
  - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
  - `FORK_RENAME_DELAY_MS = 4000`
  - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### 8. Git text generation provider configuration

Core entries: `git_text_generation_low_effort_provider_facts.md`, related values also repeated in packaging/integration entries

- `VSmux.gitTextGenerationProvider` defaults to `codex`.
- Supported provider enum: `codex | claude | custom`
- Built-in low-effort provider configs:
  - Codex uses `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude uses `haiku` with `--effort low`
- Runtime behavior:
  - timeout `180000 ms`
  - Codex uses stdin prompt delivery and disables interactive shell mode
  - custom commands may write to temp file or stdout
- The low-effort provider update intentionally preserved user-edited numeric session rename limits.

### 9. T3 runtime, browser integration, and embed/packaging invariants

Core entries: `t3_managed_runtime_upgrade_facts.md`, `workspace_browser_t3_integration_facts.md`, `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`

- Managed T3 runtime facts:
  - updated runtime endpoint: `127.0.0.1:3774`
  - legacy `npx --yes t3 runtime` remains associated with `127.0.0.1:3773`
  - real websocket endpoint is `/ws`
  - Effect RPC IDs are numeric strings, not UUIDs
  - managed runtime source entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - mixed-install recovery requires syncing `upstream`, `overlay`, and `dist` from a tested refresh worktree
- Browser/workspace/T3 integration:
  - browser sidebar excludes internal VSmux workspace and T3-owned tabs
  - workspace panel identity remains `vsmux.workspace` / `VSmux`
  - T3 activity is websocket-backed via `T3ActivityMonitor`
  - monitor responds to `Ping` with `pong` and debounces refreshes on domain-event chunks
  - workspace groups render from authoritative `sessionIdsByGroup`
- Packaging/extension metadata:
  - display name: `VSmux - T3code & Agent CLIs Manager`
  - publisher: `maddada`
  - main entry: `./out/extension/extension.js`
  - icon: `media/VSmux-marketplace-icon.png`
  - Activity Bar container/view: `VSmuxSessions` / `VSmux.sessions`
  - secondary container: `VSmuxSessionsSecondary`
  - activation events: `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`
  - patched dependency: `restty@0.1.35` via `patches/restty@0.1.35.patch`
  - pnpm overrides replace `vite` and `vitest` with `@voidzero-dev` variants
- AI DevTools integration facts:
  - VSmux remains the only shipped extension host
  - `aiDevtools.conversations` is registered under `VSmuxSessions`
  - chat-history webview build outputs to `chat-history/dist`
  - assets resolve from `chat-history/dist` and `chat-history/media`
  - extension TS target is `ES2024`; chat-history webview target is `es2020` in `iife`
  - `ai-devtools.suspend` disposes current panel, clears sidebar provider cache, and marks suspended state for memory release
  - extension version repeatedly documented as `2.6.0`
  - VS Code engine requirement: `^1.100.0`
  - package manager: `pnpm@10.14.0`

### 10. Small UI/presentation adjustments

Core entry: `sidebar_session_card_last_interaction_timestamp_facts.md`

- A narrow CSS-only presentation change in `sidebar/styles/session-cards.css` right-aligns `.session-last-interaction-time`.
- Card row structure remains unchanged; only timestamp alignment changed.

## Cross-Cutting Patterns

- **Per-workspace scoping** is a recurring architectural decision:
  - detached PTY daemon is per workspace
  - Agent Manager X focus/snapshot logic is workspace-aware
  - workspace state persists under `VSmux.sessionGridSnapshot`
- **Memory-conscious webview policy** repeats across workspace and chat-history:
  - `retainContextWhenHidden = false`
  - bootstrap/replay is used instead of relying on hidden webview retention
- **Focus and replay correctness** is a major theme:
  - 400 ms focus guard appears across workspace runtime, bootstrap, debugging, and hotkey entries
  - replay ordering always prioritizes renderable state before transient updates
  - one-shot autofocus requests are exempt from duplicate suppression
- **Capability matrices** are intentionally explicit and reused:
  - fork/full reload: `codex`, `claude`
  - copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- **Shell-safe command construction** appears in multiple areas:
  - fork/resume commands quote values for single shell arguments
  - chat-history resume uses `quoteShellLiteral`
- **Authoritative UI data sources** are preferred over local heuristics:
  - workspace pane order derives from active group snapshot
  - workspace groups render from authoritative `sessionIdsByGroup`
  - bridge focus is gated on matching `workspaceId`

## Drill-Down Guide

- For runtime/pane/focus constants: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_focus_debugging_facts.md`
- For persistence/daemon lifecycle: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`
- For startup/bootstrap and panel lifecycle: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_panel_focus_hotkeys_facts.md`
- For fork/resume/reload/rename flows: `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `session_rename_title_auto_summarization_facts.md`, `viewer_search_and_resume_actions_facts.md`
- For grouped state and sleep/wake semantics: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`
- For Agent Manager X integration: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`
- For T3/embed/packaging/integration: `t3_managed_runtime_upgrade_facts.md`, `workspace_browser_t3_integration_facts.md`, `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`
- For targeted UI tweaks: `sidebar_browsers_empty_state_facts.md`, `sidebar_session_card_last_interaction_timestamp_facts.md`
