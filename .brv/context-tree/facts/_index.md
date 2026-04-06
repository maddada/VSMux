---
children_hash: 8ca6cb114ca219506a6c41f24e252fc45f71cac0a5ee0e91b3396d45850b932b
compression_ratio: 0.6373066767257639
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 5302
summary_level: d2
token_count: 3379
type: summary
---

# Facts Domain Structural Summary

## Domain Role

The `facts` domain stores quick-recall repository facts rather than long-form architecture. In `facts/project`, entries capture stable constants, support matrices, message contracts, runtime endpoints, file paths, packaging metadata, and behavioral invariants across VSmux terminal workspace, sidebar flows, chat-history, T3 runtime, and git text generation.

## Main Fact Areas

### Terminal workspace runtime and focus model

Drill down: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_focus_debugging_facts.md`, `workspace_sidebar_interaction_facts.md`

- Terminal rendering is built around **Restty**, with runtime reuse keyed by `sessionId` and invalidation via `renderNonce`.
- Runtime lifecycle distinguishes:
  - `releaseCachedTerminalRuntime` for refcount-based host release without full teardown
  - `destroyCachedTerminalRuntime` for full transport/runtime/host/cache destruction
- `WorkspaceApp` is the focus authority; `TerminalPane` emits activation from `onActivate("pointer")` and `onActivate("focusin")`.
- Important runtime thresholds include:
  - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
  - backend polling `500 ms`
  - scheduler probe `50 ms`
  - lag threshold `1000 ms`, warning threshold `250 ms`
  - reconnect probe window `5000 ms`, monitor window `10000 ms`
- Hidden connected panes stay mounted; visibility changes should not force redraw.
- Pane order is derived from `activeGroup.snapshot.visibleSessionIds`, with `localPaneOrder` only as a temporary override.
- Focus debugging preserves the `vsmuxT3Focus` event and activation sources `focusin | pointer`.

### Sidebar interaction, drag, and command capability rules

Drill down: `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `sidebar_browsers_empty_state_facts.md`

- Sidebar drag/reorder rules use explicit thresholds:
  - reorder `8 px`
  - startup interaction block `1500 ms`
  - drag activation `6 px`
  - touch activation `250 ms` with `5 px` tolerance
  - card drag hold `130 ms` with `12 px` tolerance
- Reorder contracts include `syncGroupOrder`, `moveSessionToGroup`, and `syncSessionOrder`.
- Browser group empty-state behavior in `sidebar/session-group-section.tsx` distinguishes:
  - browser groups by `group?.kind === "browser"`
  - browser add action `type: "openBrowser"`
  - non-browser add action `type: "createSessionInGroup"` with `groupId`
- Visible browser counts are fixed to `1, 2, 3, 4, 6, 9`.
- Capability matrix recurs across entries:
  - resume/copy-resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - full reload: `codex`, `claude`

### Fork, resume, reload, and rename behavior

Drill down: `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, `session_rename_title_auto_summarization_facts.md`, `viewer_search_and_resume_actions_facts.md`

- Forking is limited to **Codex** and **Claude** terminal sessions; browser sessions cannot fork.
- Fork dispatch chain is explicit:
  - sidebar posts `{ type: "forkSession", sessionId }`
  - `SidebarToExtensionMessage` includes `forkSession`
  - `SidebarMessageHandlers` exposes `forkSession: (sessionId: string) => Promise<void>`
- Fork placement keeps the new session in the same group immediately after the source session.
- Provider-specific commands:
  - Codex: `codex fork <preferred title>`
  - Claude: `claude --fork-session -r <preferred title>`
  - delayed rename: `/rename fork <preferred title>`
  - `FORK_RENAME_DELAY_MS = 4000`
- Full reload restarts a session and replays its generated resume command.
- Detached resume behavior differs by provider:
  - immediate execution: `codex`, `claude`
  - suggested command only: `gemini`, `opencode`, `copilot`
- Rename/title summarization facts:
  - threshold `SESSION_RENAME_SUMMARY_THRESHOLD = 25`
  - output max length `24`
  - prompts require plain text, no quotes/markdown/commentary, ideally `2–4` words
  - title models: Codex `gpt-5.4-mini` with high reasoning effort; Claude `haiku` with high effort
- Chat-history viewer resume/search:
  - `Cmd/Ctrl+F` opens custom find bar using native `window.find`
  - Enter / Shift+Enter / Escape drive navigation and close
  - resume requires inferred source plus `sessionId`
  - source inference maps `/.codex/` and `/.codex-profiles/` to Codex, `/.claude/` and `/.claude-profiles/` to Claude
  - resume commands run `claude --resume <sessionId>` or `codex resume <sessionId>`

### Workspace startup, bootstrap, and panel lifecycle

Drill down: `workspace_panel_startup_bootstrap_facts.md`, `workspace_panel_startup_without_loading_placeholder_facts.md`, `workspace_panel_startup_without_placeholder_facts.md`, `workspace_panel_focus_hotkeys_facts.md`, `workspace_browser_t3_integration_facts.md`

- `openWorkspace` always reveals the sidebar first.
- Startup branches:
  - no sessions: `revealSidebar -> createSession -> workspacePanel.reveal`
  - existing sessions: `revealSidebar -> refreshWorkspacePanel -> workspacePanel.reveal -> refreshSidebar`
- Buffering separates `latestMessage` from `latestRenderableMessage`; renderable messages are `hydrate` and `sessionState`.
- If no panel exists, messages buffer instead of posting immediately.
- Replay ordering preserves correctness by posting `latestRenderableMessage` before `latestMessage`.
- Bootstrap state is injected via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`.
- Duplicate stable-state suppression uses stripped-message JSON signatures, except when a new `autoFocusRequest.requestId` appears.
- Panel metadata is stable:
  - type `vsmux.workspace`
  - title `VSmux`
  - `retainContextWhenHidden = false`
  - local resource roots include `out/workspace` and `forks/t3code-embed/dist`
- Focus hotkeys use context key `vsmux.workspacePanelFocus`; composite keybinding condition is `!inputFocus || terminalFocus || vsmux.workspacePanelFocus`.

### Persistence across reloads and detached terminal daemon

Drill down: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`

- Persistence architecture combines:
  - `SessionGridStore`
  - detached per-workspace terminal daemon
  - restored webview with Restty renderers
- Workspace layout persists under `VSmux.sessionGridSnapshot`.
- Per-workspace daemon uses `ws` and `@lydell/node-pty`; storage prefix is `terminal-daemon-${workspaceId}`.
- Key daemon files:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`
- Operational constants include:
  - control connect `3000 ms`
  - daemon ready `10000 ms`
  - stale launch lock `30000 ms`
  - heartbeat `5000 ms`
  - owner timeout `20000 ms`
  - startup grace `30000 ms`
  - idle shutdown `5 * 60_000 ms`
  - attach ready timeout `15000 ms`
- Replay/history rules:
  - ring buffer `8 * 1024 * 1024` bytes
  - replay chunks `128 * 1024` bytes
  - restored webviews use a `terminalReady` handshake
  - replay output is buffered until replay completion
- WebSocket upgrades on `/control` and `/session` require token auth.
- Daemon reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION`.
- PTY environment normalization sets `xterm-256color` and forces `LANG=en_US.UTF-8` when needed.

### Grouped workspace state and sleep/wake semantics

Drill down: `simple_grouped_session_workspace_state_facts.md`, `workspace_session_sleep_wake_support_facts.md`

- Core model lives in `shared/simple-grouped-session-workspace-state.ts` with tests in `shared/simple-grouped-session-workspace-state.test.ts`.
- Normalization guarantees at least one group using `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`.
- Browser sessions are dropped during `normalizeGroupSnapshot`.
- Canonical IDs derive from display IDs as `session-${formatSessionDisplayId(displayId ?? 0)}`.
- State rules:
  - empty groups persist after last-session removal
  - fallback active group prefers prior non-empty group, then later groups
  - group-local `visibleSessionIds` are restored on group switches
  - moved sessions activate/focus destination groups
  - focus indexing is 1-based
  - T3 metadata updates only affect `kind === "t3"` sessions
- Equality is `JSON.stringify(left) === JSON.stringify(right)`.
- Sleep/wake overlays add `isSleeping`:
  - sleeping sessions are excluded from focus and visible split calculations
  - focusing a sleeping session wakes it
  - group sleep/wake applies to all sessions in the group
  - sleep is limited to non-browser sessions/groups
  - sleeping disposes live runtime/surface but preserves card and resumable metadata
  - sidebar messages include `setSessionSleeping`, `focusSession`, `setGroupSleeping`

### Agent Manager X bridge and focus path

Drill down: `agent_manager_x_bridge_integration_facts.md`, `agent_manager_x_focus_path_without_sidebar_rehydration_facts.md`

- VSmux connects to Agent Manager X at `ws://127.0.0.1:47652/vsmux`.
- `AgentManagerXBridgeClient` uses:
  - handshake timeout `3000 ms`
  - reconnect backoff from `1000 ms` to `5000 ms`
  - per-message deflate disabled
- Snapshots are in-memory only and sent only when a latest snapshot exists, the socket is open, and the serialized snapshot changed.
- `NativeTerminalWorkspaceController` constructs the bridge and publishes a snapshot during `initialize()`.
- Broker-driven `focusSession` now focuses directly without opening the sidebar first, eliminating sidebar rehydration/reload artifacts.
- Related controller constants include:
  - `DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = ws://127.0.0.1:3774/ws`
  - `COMMAND_TERMINAL_EXIT_POLL_MS = 250`
  - `COMPLETION_SOUND_CONFIRMATION_DELAY_MS = 1000`
  - `FORK_RENAME_DELAY_MS = 4000`
  - `SIMPLE_BROWSER_OPEN_COMMAND = simpleBrowser.api.open`

### Git text generation provider configuration

Drill down: `git_text_generation_low_effort_provider_facts.md`

- `VSmux.gitTextGenerationProvider` defaults to `codex`.
- Supported enum: `codex | claude | custom`.
- Low-effort built-ins:
  - Codex: `gpt-5.4-mini` with `model_reasoning_effort="low"`
  - Claude: `haiku` with `--effort low`
- Runtime behavior:
  - timeout `180000 ms`
  - Codex uses stdin prompt delivery and disables interactive shell mode
  - custom commands may write via temp file or stdout
- The low-effort provider update intentionally preserved user-edited numeric rename/session limits.

### T3 runtime, browser integration, packaging, and AI DevTools

Drill down: `t3_managed_runtime_upgrade_facts.md`, `workspace_browser_t3_integration_facts.md`, `vsmux_packaging_and_embed_validation_facts.md`, `vsmux_ai_devtools_integration_facts.md`

- Managed T3 runtime moved to `127.0.0.1:3774`; legacy `npx --yes t3 runtime` remains tied to `127.0.0.1:3773`.
- Actual websocket endpoint is `/ws`; Effect RPC IDs are numeric strings, not UUIDs.
- Managed runtime entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`.
- Mixed-install recovery requires syncing `upstream`, `overlay`, and `dist` from a tested refresh worktree.
- Browser/T3 integration rules:
  - browser sidebar excludes internal VSmux workspace and T3-owned tabs
  - groups render from authoritative `sessionIdsByGroup`
  - T3 activity is websocket-backed through `T3ActivityMonitor`
  - monitor responds to `Ping` with `pong` and debounces domain-event refreshes
- Packaging facts:
  - display name `VSmux - T3code & Agent CLIs Manager`
  - publisher `maddada`
  - main `./out/extension/extension.js`
  - icon `media/VSmux-marketplace-icon.png`
  - Activity Bar container/view `VSmuxSessions` / `VSmux.sessions`
  - secondary container `VSmuxSessionsSecondary`
  - activation events `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`
  - patched dependency `restty@0.1.35` via `patches/restty@0.1.35.patch`
  - pnpm overrides replace `vite` and `vitest` with `@voidzero-dev` variants
- AI DevTools facts:
  - VSmux is the only shipped extension host
  - `aiDevtools.conversations` is registered under `VSmuxSessions`
  - chat-history output path is `chat-history/dist`
  - assets resolve from `chat-history/dist` and `chat-history/media`
  - extension TS target `ES2024`
  - chat-history target `es2020` in `iife`
  - `ai-devtools.suspend` disposes the panel, clears sidebar cache, and marks suspended state
  - version `2.6.0`, VS Code engine `^1.100.0`, package manager `pnpm@10.14.0`

### Small presentation tweaks

Drill down: `sidebar_session_card_last_interaction_timestamp_facts.md`

- A focused CSS-only change in `sidebar/styles/session-cards.css` right-aligns `.session-last-interaction-time`.
- Session card row structure remains unchanged.

## Cross-Cutting Patterns

- **Per-workspace scoping** is a core design choice across daemon persistence, workspace snapshots, and Agent Manager X bridge behavior.
- **Replay over retention** is intentional: `retainContextWhenHidden = false`, so both workspace and viewer rely on bootstrap/replay instead of hidden webview state.
- **Authoritative data sources over local heuristics** recur in pane ordering, group rendering, and workspace focus routing.
- **Explicit capability matrices** are maintained for fork/reload/resume behavior rather than inferred dynamically.
- **Focus correctness and anti-flicker behavior** unify the domain: 400 ms focus guards, renderable-first replay ordering, direct focus routing, and duplicate state suppression.
- **Shell-safe agent command construction** appears repeatedly in fork/resume flows and chat-history resume handling.
