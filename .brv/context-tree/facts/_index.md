---
children_hash: 51c5e48ddced58e64a7a148acdc1c964ba67c1d571f40cf86b0c168f24be655e
compression_ratio: 0.7743332573512651
condensation_order: 2
covers: [context.md, project/_index.md]
covers_token_total: 4387
summary_level: d2
token_count: 3397
type: summary
---

# facts / project

## Scope

Project-facts domain for quick-recall repository invariants: technology choices, storage keys, lifecycle rules, thresholds, message types, extension metadata, and capability matrices. Long-form rationale lives in architecture entries; this level summarizes stable facts and where to drill down.

## Main fact clusters

### Terminal workspace runtime

From `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, `workspace_focus_and_drag_runtime_facts.md`.

- Workspace terminals render with **Restty**.
- Cached runtimes are keyed by **`sessionId`**; reuse is invalidated by **`renderNonce`**.
- Runtime lifecycle distinguishes:
  - `releaseCachedTerminalRuntime(...)`: releases host when refcount hits 0, but keeps runtime alive.
  - `destroyCachedTerminalRuntime(...)`: destroys transport, Restty, host, and cache entry.
- Backend terminal hosting is **per-workspace**, not global.
- Hidden connected panes stay mounted behind the active pane rather than being recreated.
- Visible pane order follows `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only a temporary local override.
- Projection logic flattens grouped session arrays into workspace session projection.

### Focus ownership and activation

From `workspace_focus_debugging_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`.

- **`WorkspaceApp` is the authoritative owner of focus decisions**.
- `TerminalPane` emits activation intent only.
- Activation signals:
  - `onActivate("pointer")`
  - `onActivate("focusin")`
- Focus/runtime guards:
  - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
  - `AUTO_RELOAD_ON_LAG = true`
- T3 iframe focus message type: **`vsmuxT3Focus`**.

### Interaction thresholds and terminal behavior

From `terminal_workspace_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`.

- Drag/reorder thresholds:
  - reorder: **8px**
  - startup interaction block: **1500ms**
  - non-touch drag: **6px**
  - touch activation: **250ms** delay, **5px** tolerance
  - session-card hold: **130ms** delay, **12px** tolerance
- Scroll/typing:
  - scroll-to-bottom button shows after **200px**, hides below **40px**
  - typing auto-scroll uses **450ms** burst window and **4 printable keystrokes**
- Lag/probe constants:
  - probe interval **50ms**
  - probe flush **5000ms**
  - lag window **10000ms**
  - lag threshold **1000ms**
  - warning threshold **250ms**
  - reconnect probes **5000ms**
- Other constants:
  - terminal size stabilization: up to **20 attempts**, return after **2 identical measurements**
  - backend session polling: **500ms**
  - `VSmux.backgroundSessionTimeoutMinutes` default **5 minutes**, `<= 0` disables timeout

### Persistence and detached daemon model

From `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`.

- Persistence architecture has 3 parts:
  - `SessionGridStore`
  - detached per-workspace terminal daemon
  - restored webview/Restty frontend
- Workspace snapshot key: **`VSmux.sessionGridSnapshot`**.
- Daemon files/state:
  - state dir prefix `terminal-daemon-${workspaceId}`
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`
- Daemon deps: `ws`, `@lydell/node-pty`.
- Lifecycle constants:
  - control connect **3000ms**
  - daemon ready **10000ms**
  - stale launch lock **30000ms**
  - owner heartbeat **5000ms**
  - heartbeat timeout **20000ms**
  - startup grace **30000ms**
  - idle shutdown **5 \* 60_000ms**
  - session attach ready **15000ms**
- Replay/attach:
  - ring buffer **8 _ 1024 _ 1024 bytes**
  - replay chunk **128 \* 1024 bytes**
  - reattach uses **`terminalReady`**
  - pending output is buffered until replay completes
- Protocol/environment:
  - token-authenticated WebSocket upgrades on **`/control`** and **`/session`**
  - response-bearing requests require `requestId`
  - daemon reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION`
  - PTY term name `xterm-256color`
  - PTY env forces `LANG=en_US.UTF-8` when needed
- `buildSnapshot` merges live and persisted metadata; `setBrowserSessionMetadata(...)` currently always returns `false`.

### Grouped workspace state and normalization

From `simple_grouped_session_workspace_state_facts.md`.

- Core implementation: `shared/simple-grouped-session-workspace-state.ts`
- Tests: `shared/simple-grouped-session-workspace-state.test.ts`
- Undefined state normalizes from `createDefaultGroupedSessionWorkspaceSnapshot()`.
- At least one group always exists via `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`.
- Browser sessions are removed during normalization.
- Canonical session IDs derive from display IDs as:
  - `session-${formatSessionDisplayId(displayId ?? 0)}`
- Key group/session rules:
  - empty groups are retained when last session is removed
  - fallback active group prefers nearest previous non-empty group
  - `visibleSessionIds` are preserved per group
  - if `visibleCount === 1`, visible IDs normalize to `[focusedSessionId]`
  - hidden-session focus in split mode may swap visible sessions
  - new sessions claim first free display ID
  - creating a session appends to active group, focuses it, recomputes visibility
  - group indexing is **1-based**
  - T3 metadata updates only affect `kind === "t3"`
  - fullscreen persists `fullscreenRestoreVisibleCount`
  - syncing order appends unlisted groups after requested order
  - moving a session activates destination group and focuses moved session
  - group creation is capped by `MAX_GROUP_COUNT`
- Preserved normalization examples include duplicate display ID repair and gap-filling allocation.

### Sleep/wake behavior

From `workspace_session_sleep_wake_support_facts.md`.

- Session records store **`isSleeping`**.
- Sleeping sessions are excluded from focus and split visibility calculations.
- Focusing a sleeping session wakes it by forcing `isSleeping = false`.
- `setSessionSleeping`, `focusSession`, and `setGroupSleeping` are key sidebar messages.
- Sleep/wake applies only to **non-browser** sessions/groups.
- Sleeping a terminal disposes live surface/runtime but preserves card and resumable metadata.
- If an active group loses all awake sessions, fallback selects another non-empty group.

### Sidebar capability matrix, fork, and reload

From `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`.

- Copy resume supported for: **`codex`, `claude`, `copilot`, `gemini`, `opencode`**
- Fork supported only for: **`codex`, `claude`**
- Full reload supported only for: **`codex`, `claude`**
- Browser sessions cannot rename, fork, copy resume, or full reload from sidebar.
- Fork flow:
  - sidebar sends `{ type: "forkSession", sessionId }`
  - controller inserts sibling terminal session in same group after source
  - fork copies agent metadata from `sidebarAgentIconBySessionId` and `sessionAgentLaunchBySessionId`
  - delayed rename uses **`FORK_RENAME_DELAY_MS = 4000`**
  - post-delay command: `/rename fork <preferred title>`
- Fork command builders:
  - `codex fork <preferred title>`
  - `claude --fork-session -r <preferred title>`
  - `buildForkAgentCommand(...)` returns `undefined` if `agentId`, `agentCommand`, or `forkTitle` is missing
- User-visible validation:
  - `"Fork is only available for Codex and Claude sessions that have a visible title."`
- Resume/reload:
  - full reload restarts terminal and replays resume command
  - detached resume executes immediately for `codex` and `claude`
  - `gemini`, `opencode`, `copilot` only get suggested commands
  - persisted launch key: **`VSmux.sessionAgentCommands`**

### Rename and title auto-summarization

From `session_rename_title_auto_summarization_facts.md`.

- Auto-summarization only runs when `title.trim().length > 25`.
- Short titles are trimmed and applied directly.
- Progress UI:
  - title: **`VSmux`**
  - message: **`Generating session name...`**
- If provider is `custom` and `VSmux.gitTextGenerationCustomCommand` is empty, rename fails with config error.
- Terminal rename still dispatches **`/rename {title}`** after storing resolved title.
- Generation timeout: **180000ms**
- Default provider commands:
  - `codex -m gpt-5.4-mini -c model_reasoning_effort="high" exec -`
  - `claude --model haiku --effort high -p <prompt>`
- Custom command placeholders: `{prompt}`, `{outputFile}`
- Generated titles are sanitized to first non-empty line, stripped of wrapping quotes/backticks, whitespace-collapsed, trimmed, and trailing periods removed.

### Sidebar selector regression rule

From `sidebar_session_card_last_interaction_timestamp_facts.md`.

- `sidebar/sortable-session-card.tsx` had a regression from reading `state.hud.showLastInteractionTimeOnSessionCards` directly in render.
- Rule: new HUD booleans for sortable session cards must be added to the existing `useSidebarStore(useShallow(...))` selector before passing to children.
- Fix verification used `tsconfig.extension` typecheck and targeted `vp` tests.

### Browser and T3 integration

From `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`.

- Browser sidebar excludes internal VSmux workspace and T3-owned tabs.
- Workspace panel identity:
  - type `vsmux.workspace`
  - title `VSmux`
- Local resource roots:
  - `out/workspace`
  - `forks/t3code-embed/dist`
- `retainContextWhenHidden = false`
- Workspace groups render from authoritative `sessionIdsByGroup`.
- T3 runtime/activity:
  - websocket-backed via `T3ActivityMonitor`
  - responds to `Ping` with `pong`
  - refresh is debounced on domain-event chunks
  - focus ack uses completion-marker-aware `acknowledgeThread`
- Managed runtime upgrade invariants:
  - current embedded client target: **`127.0.0.1:3774`**
  - legacy `npx --yes t3 runtime`: **`127.0.0.1:3773`**
  - websocket endpoint: **`/ws`**
  - Effect RPC request IDs are **numeric strings**
  - runtime entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - mixed-install recovery requires syncing upstream, overlay, and dist worktree copies into main

### Packaging, activation, and config metadata

From `vsmux_packaging_and_embed_validation_facts.md`.

- Extension identity:
  - display name: **`VSmux - T3code & Agent CLIs Manager`**
  - publisher: **`maddada`**
  - repository: `https://github.com/maddada/VSmux.git`
  - main: `./out/extension/extension.js`
  - icon: `media/VSmux-marketplace-icon.png`
- Views/containers:
  - `VSmuxSessions`
  - `VSmux.sessions`
  - `VSmuxSessionsSecondary`
- Activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`
- Dependency/config facts:
  - pnpm override `vite -> npm:@voidzero-dev/vite-plus-core@latest`
  - pnpm override `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
  - patched `restty@0.1.35` via `patches/restty@0.1.35.patch`
  - `VSmux.gitTextGenerationProvider` default `codex`, supports `codex`, `claude`, `custom`
  - `VSmux.sendRenameCommandOnSidebarRename` default `true`

### Input and terminal key mappings

From `workspace_sidebar_interaction_facts.md`.

- `Shift+Enter -> \x1b[13;2u`
- macOS:
  - `Meta+ArrowLeft -> \x01`
  - `Meta+ArrowRight -> \x05`
  - `Alt+ArrowLeft -> \x1bb`
  - `Alt+ArrowRight -> \x1bf`
- non-mac:
  - `Ctrl+ArrowLeft -> \x1bb`
  - `Ctrl+ArrowRight -> \x1bf`

## Cross-entry relationships

- `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, and `workspace_focus_and_drag_runtime_facts.md` jointly define runtime ownership, pane visibility behavior, thresholds, and focus semantics.
- `terminal_persistence_across_vs_code_reloads_facts.md` and `terminal_persistence_reload_facts.md` define the detached-daemon persistence contract and replay/reattach flow.
- `simple_grouped_session_workspace_state_facts.md` and `workspace_session_sleep_wake_support_facts.md` define snapshot normalization plus sleep-aware visibility/focus behavior.
- `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`, and `session_rename_title_auto_summarization_facts.md` connect sidebar actions, agent command generation, delayed rename, and title generation.
- `workspace_browser_t3_integration_facts.md` and `t3_managed_runtime_upgrade_facts.md` connect workspace webview identity with T3 runtime transport and upgrade invariants.
- `sidebar_session_card_last_interaction_timestamp_facts.md` is a local UI-state rule that protects the sidebar card rendering model.

## Drill-down guide

- Runtime and lifecycle: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`
- Interaction thresholds and focus: `workspace_sidebar_interaction_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_focus_debugging_facts.md`
- Persistence/daemon: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`
- Workspace state/group normalization: `simple_grouped_session_workspace_state_facts.md`
- Sleep/wake: `workspace_session_sleep_wake_support_facts.md`
- Sidebar fork/reload capabilities: `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`
- Rename/title generation: `session_rename_title_auto_summarization_facts.md`
- Sidebar selector invariant: `sidebar_session_card_last_interaction_timestamp_facts.md`
- Browser/T3 integration: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`
- Extension packaging/config: `vsmux_packaging_and_embed_validation_facts.md`
