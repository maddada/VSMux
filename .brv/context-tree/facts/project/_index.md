---
children_hash: a61555d9645a23aef252c18e10972c2b50f2532e28bd86bfafc82af5280845ad
compression_ratio: 0.27700983426174264
condensation_order: 1
covers:
  [
    context.md,
    session_rename_title_auto_summarization_facts.md,
    sidebar_fork_session_behavior_facts.md,
    sidebar_session_card_last_interaction_timestamp_facts.md,
    sidebar_session_fork_support_facts.md,
    simple_grouped_session_workspace_state_facts.md,
    t3_managed_runtime_upgrade_facts.md,
    terminal_persistence_across_vs_code_reloads_facts.md,
    terminal_persistence_reload_facts.md,
    terminal_workspace_facts.md,
    terminal_workspace_runtime_facts.md,
    vsmux_packaging_and_embed_validation_facts.md,
    workspace_browser_t3_integration_facts.md,
    workspace_focus_and_drag_runtime_facts.md,
    workspace_focus_debugging_facts.md,
    workspace_session_sleep_wake_support_facts.md,
    workspace_sidebar_interaction_facts.md,
  ]
covers_token_total: 14541
summary_level: d1
token_count: 4028
type: summary
---

# project

## Overview

Concise project-fact index for the terminal workspace system, focused on stable implementation constants, capability matrices, storage keys, message types, file ownership, and lifecycle rules. The entries cluster around terminal runtime architecture, workspace/sidebar interaction semantics, persistence/daemon behavior, session/group state management, T3/browser integration, packaging/configuration, and rename/fork flows.

## Core Architecture Themes

- **Terminal workspace runtime**
  - `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_sidebar_interaction_facts.md`, and `workspace_focus_and_drag_runtime_facts.md` describe the active UI/runtime model.
  - **Renderer**: workspace terminals use **Restty**.
  - **Runtime identity/reuse**: terminal runtimes are cached **per `sessionId`**; reuse is invalidated by `renderNonce`.
  - **Release vs destroy**:
    - `releaseCachedTerminalRuntime(...)` removes the host only when refCount reaches 0, but does **not** destroy the runtime.
    - `destroyCachedTerminalRuntime(...)` fully destroys transport/Restty/host and removes the cache entry.
  - **Daemon scope**: backend terminal hosting is **per-workspace**, not global.
  - **Hidden pane strategy**: hidden connected panes remain mounted/painted behind the active pane rather than being redrawn on visibility flips.
  - **Projection/order model**:
    - visible pane order comes from `activeGroup.snapshot.visibleSessionIds`
    - `localPaneOrder` is only a temporary override within currently visible sessions
    - session projection flattens all group session arrays into the workspace

- **Focus and interaction ownership**
  - `workspace_focus_debugging_facts.md`, `terminal_workspace_runtime_facts.md`, and `workspace_sidebar_interaction_facts.md` agree on a central decision:
    - **`WorkspaceApp` owns authoritative focus decisions**
    - `TerminalPane` only emits activation intent
  - **Activation sources**:
    - `onActivate("pointer")` from pointer capture
    - `onActivate("focusin")` as fallback after `:focus-within`
  - **Guarding**:
    - `AUTO_FOCUS_ACTIVATION_GUARD_MS = 400`
    - `AUTO_RELOAD_ON_LAG = true`
  - **T3 focus integration**:
    - iframe focus message type is `vsmuxT3Focus`

## Runtime Thresholds and UI Rules

Referenced most heavily in `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, and `workspace_sidebar_interaction_facts.md`.

- **Sidebar/session drag thresholds**
  - reorder threshold: **8px**
  - startup interaction block: **1500ms**
  - non-touch drag distance: **6px**
  - touch drag activation: **250ms** delay, **5px** tolerance
  - session-card drag hold: **130ms** delay, **12px** tolerance

- **Terminal scroll/typing behavior**
  - scroll-to-bottom button:
    - show beyond **200px**
    - hide below **40px**
  - typing auto-scroll:
    - burst window **450ms**
    - trigger after **4 printable keystrokes**

- **Lag/probe behavior**
  - scheduler probe interval: **50ms**
  - probe window flush: **5000ms**
  - lag monitor window: **10000ms**
  - lag threshold: **1000ms** average overshoot
  - warning threshold: **250ms**
  - reconnect probes run for **5000ms**

- **Other runtime constants**
  - terminal size stabilization: up to **20 attempts**, returns after **2 identical measurements**
  - backend session polling: **500ms**
  - background session timeout: setting `VSmux.backgroundSessionTimeoutMinutes`, default **5 minutes**, `<= 0` disables timeout

## Persistence and Detached Daemon Model

Primary sources: `terminal_persistence_across_vs_code_reloads_facts.md` and `terminal_persistence_reload_facts.md`.

- **Three-part persistence architecture**
  - `SessionGridStore`
  - detached per-workspace terminal daemon
  - restored webview/Restty frontend

- **Workspace state**
  - grouped workspace snapshot key: **`VSmux.sessionGridSnapshot`**

- **Daemon implementation/storage**
  - per-workspace detached Node.js daemon
  - dependencies: `ws`, `@lydell/node-pty`
  - state directory prefix: `terminal-daemon-${workspaceId}`
  - metadata file: `daemon-info.json`
  - lock file: `daemon-launch.lock`
  - debug log: `terminal-daemon-debug.log`

- **Timeouts and lifecycle**
  - control connect timeout: **3000ms**
  - daemon ready timeout: **10000ms**
  - stale launch lock: **30000ms**
  - owner heartbeat interval: **5000ms**
  - owner heartbeat timeout: **20000ms**
  - owner startup grace: **30000ms**
  - idle shutdown timeout: **5 \* 60_000ms**
  - session attach ready timeout: **15000ms**

- **Replay and attach behavior**
  - history ring buffer limit: **8 _ 1024 _ 1024 bytes**
  - replay chunk size: **128 \* 1024 bytes**
  - restored webviews reattach via **`terminalReady` handshake**
  - output generated during replay is buffered in a **pending attach queue** and flushed after replay completes
  - restore flow:
    - reload
    - workspaceState restore
    - daemon reconnect
    - session reconnect
    - `terminalReady`
    - replay
    - pending output flush
    - active attachment

- **Protocol/auth/environment**
  - daemon uses token-authenticated WebSocket upgrades on **`/control`** and **`/session`**
  - requests expecting responses must include `requestId`
  - existing daemons are reused only when reachable and protocol version matches `TERMINAL_HOST_PROTOCOL_VERSION`
  - PTYs use terminal name `xterm-256color`
  - PTY env forces `LANG = en_US.UTF-8` when UTF-8 is missing

- **Fallback metadata**
  - persisted per-session state preserves title and agent metadata when live daemon data is unavailable
  - `buildSnapshot` merges live title/activity with persisted session state
  - `setBrowserSessionMetadata(...)` currently always returns `false`

## Workspace State Model and Group Semantics

Main source: `simple_grouped_session_workspace_state_facts.md`; complemented by `workspace_session_sleep_wake_support_facts.md`.

- **State model location**
  - implementation: `shared/simple-grouped-session-workspace-state.ts`
  - tests: `shared/simple-grouped-session-workspace-state.test.ts`

- **Normalization invariants**
  - undefined snapshot normalizes from `createDefaultGroupedSessionWorkspaceSnapshot()`
  - at least one group is always ensured via `createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE)`
  - display IDs normalized before per-group normalization
  - browser sessions are removed during normalization
  - canonical session IDs derive from display IDs via `session-${formatSessionDisplayId(displayId ?? 0)}`

- **Group/session behavior**
  - removing the last session from a group keeps the empty group present
  - fallback active group prefers the nearest previous non-empty group, then later groups
  - group-local `visibleSessionIds` are preserved/restored when switching active groups
  - if `visibleCount === 1`, normalized visible IDs become `[focusedSessionId]`
  - hidden-session focusing in split mode can swap visible sessions
  - new sessions claim the **first free display ID**
  - creating a session appends it to the active group, focuses it, and recomputes visibility
  - group indexing is **1-based**
  - T3 metadata updates only apply to `kind === "t3"` sessions and preserve identity
  - fullscreen stores `fullscreenRestoreVisibleCount` and restores it when exiting
  - syncing group order appends unlisted groups after requested order
  - moving a session activates the destination group and focuses the moved session
  - group creation is capped by `MAX_GROUP_COUNT`

- **Test-backed examples preserved in facts**
  - duplicate display IDs `["52","52"]` normalize to `["52","00"]`
  - first-free allocation fills gaps like `00, 02 -> 01`
  - canonicalized dragged sessions are removed correctly even when original `sessionId` mismatches display ID
  - creating/moving groups updates active group and focus as expected

## Sleep/Wake Semantics

From `workspace_session_sleep_wake_support_facts.md`.

- Session records persist an **`isSleeping`** flag.
- Sleeping sessions are excluded from focus and visible split calculations.
- Focusing a sleeping session wakes it by forcing `isSleeping = false`.
- Group sleep/wake toggles apply to all sessions in a group.
- Sleep actions apply only to **non-browser** sessions/groups.
- Sleeping a terminal session disposes the live surface/runtime but keeps the session card and resumable metadata.
- If sleeping leaves the active group without awake sessions, active-group fallback selects another non-empty group.
- Sidebar messages involved:
  - `setSessionSleeping`
  - `focusSession`
  - `setGroupSleeping`

## Sidebar Capability Matrix and Fork/Reload Behavior

Most detailed in `sidebar_session_fork_support_facts.md` and `sidebar_fork_session_behavior_facts.md`, with overlap in `workspace_focus_and_drag_runtime_facts.md` and `workspace_sidebar_interaction_facts.md`.

- **Capability matrix**
  - **Copy resume** supported for: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - **Fork** supported only for: `codex`, `claude`
  - **Full reload** supported only for: `codex`, `claude`
  - browser sessions cannot rename, fork, copy resume, or full reload from the sidebar

- **Fork flow**
  - sidebar context menu adds a **Fork** action for eligible terminal sessions
  - sidebar sends message `{ type: "forkSession", sessionId }`
  - controller creates a sibling terminal session in the same group directly after the source session
  - forked sessions reuse source metadata from:
    - `sidebarAgentIconBySessionId`
    - `sessionAgentLaunchBySessionId`
  - delayed rename constant: **`FORK_RENAME_DELAY_MS = 4000`**
  - after delay, controller sends `/rename fork <preferred title>`

- **Fork command builders**
  - Codex: `codex fork <preferred title>`
  - Claude: `claude --fork-session -r <preferred title>`
  - `buildForkAgentCommand(...)` returns `undefined` when `agentId`, `agentCommand`, or `forkTitle` is missing
  - single-shell-argument quoting uses single quotes with escaped embedded single quotes

- **Eligibility and user-facing rule**
  - requires existing session, non-browser session, supported agent, terminal source session, source group, visible preferred title, and a command from `buildForkAgentCommand(...)`
  - visible validation error:
    - `"Fork is only available for Codex and Claude sessions that have a visible title."`

- **Reload/resume behavior**
  - full reload restarts the terminal session and replays the generated resume command
  - detached resume executes immediately for `codex` and `claude`, but only suggests commands for `gemini`, `opencode`, and `copilot`
  - session agent launches are persisted in workspace state key **`VSmux.sessionAgentCommands`**

## Rename and Title Auto-Summarization

Source: `session_rename_title_auto_summarization_facts.md`.

- Session rename titles are summarized only when `title.trim().length > 25`.
- Short titles are applied directly after trimming.
- During generation, VS Code shows progress:
  - title: **`VSmux`**
  - message: **`Generating session name...`**
- If provider is `custom` and `VSmux.gitTextGenerationCustomCommand` is empty, rename aborts with a configuration error.
- Terminal session renames still dispatch **`/rename {title}`** after storing the resolved title.
- Generation timeout: **180000ms**
- Provider command defaults:
  - codex: `codex -m gpt-5.4-mini -c model_reasoning_effort="high" exec -`
  - claude: `claude --model haiku --effort high -p <prompt>`
  - custom commands support placeholders `{prompt}` and `{outputFile}`
- Generated title sanitization:
  - first non-empty line
  - remove wrapping quotes/backticks
  - collapse whitespace
  - trim
  - remove trailing periods

## Sidebar Store/Selector Rule

Source: `sidebar_session_card_last_interaction_timestamp_facts.md`.

- A runtime regression occurred in `sidebar/sortable-session-card.tsx` by reading `state.hud.showLastInteractionTimeOnSessionCards` directly in render instead of selecting it into local scope.
- Structural rule:
  - new HUD booleans in sortable session cards must be added to the existing `useSidebarStore(useShallow(...))` selector before being passed to children
- Verification for the fix used:
  - `tsconfig.extension` typecheck
  - targeted `vp` tests

## Browser and T3 Integration

Source: `workspace_browser_t3_integration_facts.md` and `t3_managed_runtime_upgrade_facts.md`.

- **Browser integration**
  - browser sidebar excludes internal VSmux workspace and T3-owned tabs
  - workspace panel restoration identity:
    - panel type: `vsmux.workspace`
    - title: `VSmux`
  - local resource roots:
    - `out/workspace`
    - `forks/t3code-embed/dist`
  - `retainContextWhenHidden = false`
  - workspace groups render from authoritative `sessionIdsByGroup` payload

- **T3 activity/runtime**
  - T3 activity is websocket-backed via `T3ActivityMonitor`
  - monitor responds to `Ping` with `pong`
  - refreshes are debounced on domain-event chunks
  - focus acknowledgement uses completion-marker-aware `acknowledgeThread`

- **Managed runtime upgrade invariants**
  - updated embedded client must talk to runtime on **`127.0.0.1:3774`**
  - legacy migration note keeps `npx --yes t3 runtime` associated with **`127.0.0.1:3773`**
  - real websocket endpoint is **`/ws`**
  - Effect RPC request IDs are **numeric strings**, not UUIDs
  - managed runtime source entrypoint:
    - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - mixed-install recovery requires syncing tested worktree copies of upstream, overlay, and dist into main

## Packaging, Activation, and Extension Metadata

Source: `vsmux_packaging_and_embed_validation_facts.md`.

- **Extension identity**
  - display name: `VSmux - T3code & Agent CLIs Manager`
  - publisher: `maddada`
  - repository: `https://github.com/maddada/VSmux.git`
  - main entry: `./out/extension/extension.js`
  - icon: `media/VSmux-marketplace-icon.png`

- **Containers/views**
  - Activity Bar container: `VSmuxSessions`
  - primary view: `VSmux.sessions`
  - secondary sidebar container: `VSmuxSessionsSecondary`

- **Activation events**
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`

- **Dependency/config facts**
  - pnpm overrides:
    - `vite -> npm:@voidzero-dev/vite-plus-core@latest`
    - `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
  - patched dependency:
    - `restty@0.1.35` via `patches/restty@0.1.35.patch`
  - `VSmux.gitTextGenerationProvider` defaults to `codex`, supports `codex`, `claude`, `custom`
  - `VSmux.sendRenameCommandOnSidebarRename` defaults to `true`

## Input and Terminal Key Mappings

Captured in `workspace_sidebar_interaction_facts.md`.

- `Shift+Enter` sends raw terminal input `\x1b[13;2u`
- On macOS:
  - `Meta+ArrowLeft -> \x01`
  - `Meta+ArrowRight -> \x05`
  - `Alt+ArrowLeft -> \x1bb`
  - `Alt+ArrowRight -> \x1bf`
- On non-mac control navigation:
  - `Ctrl+ArrowLeft -> \x1bb`
  - `Ctrl+ArrowRight -> \x1bf`

## Drill-Down Map

- **Terminal runtime/current state**: `terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`
- **Workspace/sidebar interaction thresholds**: `workspace_sidebar_interaction_facts.md`, `workspace_focus_and_drag_runtime_facts.md`
- **Persistence/daemon**: `terminal_persistence_across_vs_code_reloads_facts.md`, `terminal_persistence_reload_facts.md`
- **Workspace snapshot/group model**: `simple_grouped_session_workspace_state_facts.md`
- **Sleep/wake behavior**: `workspace_session_sleep_wake_support_facts.md`
- **Fork/reload/sidebar capability rules**: `sidebar_session_fork_support_facts.md`, `sidebar_fork_session_behavior_facts.md`
- **Rename/title generation**: `session_rename_title_auto_summarization_facts.md`
- **Sidebar selector regression rule**: `sidebar_session_card_last_interaction_timestamp_facts.md`
- **Browser/T3 integration**: `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_facts.md`
- **Packaging/config metadata**: `vsmux_packaging_and_embed_validation_facts.md`
- **Focus debugging API/constants**: `workspace_focus_debugging_facts.md`
