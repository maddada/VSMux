---
children_hash: f60099387d0ea96d90affd4719e287249916a554842ae7d03656b7fdecb5a2b1
compression_ratio: 0.1322485931000734
condensation_order: 1
covers:
  [
    context.md,
    current_state.md,
    session_rename_title_auto_summarization.md,
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
    workspace_browser_t3_integration.md,
    workspace_focus_and_sidebar_drag_semantics.md,
    workspace_focus_debugging.md,
    workspace_session_sleep_wake_support.md,
    workspace_sidebar_interaction_state.md,
  ]
covers_token_total: 32696
summary_level: d1
token_count: 4324
type: summary
---

# terminal_workspace

## Overview

The `terminal_workspace` topic captures the current architecture for VSmux terminal workspaces: session-based Restty runtime reuse, stable split-pane rendering, grouped workspace state, sidebar-driven session operations, reload persistence, and T3-backed browser/activity integration. The central current-state model is in `current_state.md`, with drill-down entries covering pane runtime behavior, sidebar semantics, persistence, T3 embed/runtime, and session title/activity systems.

## Core Architecture

- `context.md` and `current_state.md` define the main architecture:
  - User-facing terminal renderer is **Restty**
  - Runtime cache key is **`sessionId`**
  - Cached runtimes are reused across mount/visibility changes and invalidated by render nonce changes
  - Hidden connected panes remain **mounted and painted** behind the active pane instead of being recreated
  - Workspace projection now includes **sessions from all groups**, not just active panes
  - Backend is a **per-workspace daemon** that renews managed session leases
  - When daemon state is unavailable, UI falls back to **persisted disconnected snapshots** preserving title/agent metadata
- Key files repeatedly referenced across entries:
  - `workspace/terminal-runtime-cache.ts`
  - `workspace/terminal-pane.tsx`
  - `workspace/workspace-app.tsx`
  - `extension/native-terminal-workspace/controller.ts`
  - `extension/daemon-terminal-workspace-backend.ts`

## Frontend Runtime and Pane Lifecycle

- `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`, and `terminal_titles_activity_and_sidebar_runtime.md` align on these runtime decisions:
  - PTY connection waits for:
    1. appearance application
    2. stable terminal size
    3. ready/connect sequencing
  - Stable size waits up to **20 attempts** and resolves after **2 identical measurements**
  - Hidden panes should remain painted and skip redraw/maintenance work after PTY startup
  - Startup visuals are bootstrap-only and stop after first successful canvas reveal
  - `releaseCachedTerminalRuntime()` detaches DOM / lowers refcount without destroying the runtime
  - `destroyCachedTerminalRuntime()` fully destroys transport, Restty, and cache entry
- Important thresholds from `current_state.md` and `terminal_pane_runtime_thresholds_and_behaviors.md`:
  - Auto-focus guard: **400 ms**
  - Typing autoscroll: **4 printable keys within 450 ms**
  - Scroll-to-bottom hysteresis: show at **200 px**, hide at **40 px**
  - Scheduler probe: **50 ms** interval, **5000 ms** probe window
  - Lag detection: average overshoot **>= 1000 ms** within **10000 ms**
  - Reconnect performance probe window: **5000 ms**
- Keyboard/input mappings in `terminal_pane_runtime_thresholds_and_behaviors.md` and `workspace_sidebar_interaction_state.md`:
  - `Shift+Enter` → `\x1b[13;2u`
  - macOS `Meta+ArrowLeft` → `\x01`
  - macOS `Meta+ArrowRight` → `\x05`
  - Word navigation: `\x1bb` / `\x1bf`

## Focus Ownership, Pane Ordering, and Drag Semantics

- `terminal_titles_activity_and_sidebar_runtime.md`, `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_sidebar_interaction_state.md`, and `workspace_focus_debugging.md` all reinforce the same design:
  - `TerminalPane` emits activation **intent only** (`pointer` / `focusin`)
  - `WorkspaceApp` is the **single owner** of authoritative focus decisions
  - Visible split-pane order comes from **`activeGroup.snapshot.visibleSessionIds`**
  - `localPaneOrder` is only a **temporary override within currently visible sessions**
  - Passive split slots should remain stable during focus/split changes
- Drag/reorder semantics:
  - Sidebar reorder must never happen from click-like interactions
  - Reorder requires real pointer movement crossing **8 px**
  - Sidebar startup blocks interactions for **1500 ms**
  - Session-card drag hold is **130 ms** with **12 px** tolerance
  - Non-touch drag activation uses **6 px**
  - Touch drag activation uses **250 ms** delay with **5 px** tolerance
- `workspace_focus_debugging.md` adds debugging-specific rules:
  - stale pending local focus is cleared when server-reported focus differs
  - T3 iframe focus message type is **`vsmuxT3Focus`**
  - hidden panes and auto-focus-guarded panes ignore T3 iframe focus
  - header drag suppresses pane activation during drag

## Grouped Workspace State Model

- `simple_grouped_session_workspace_state.md` defines the canonical grouped snapshot behavior in:
  - `shared/simple-grouped-session-workspace-state.ts`
  - `shared/simple-grouped-session-workspace-state.test.ts`
- Key state-model decisions:
  - Normalization ensures at least one group exists
  - Browser sessions are dropped during normalization
  - Session IDs are canonicalized from display IDs using `session-${formatSessionDisplayId(...)}`
  - Duplicate display IDs are repaired before per-group normalization
  - Group-local `visibleSessionIds` are preserved and restored on group focus
  - Creating a new session uses the **first free display ID**
  - Removing the last session from the active group keeps the emptied group and falls back to the nearest populated group, preferring previous groups
  - Moving a session to another group activates the destination group and focuses the moved session
  - Fullscreen stores and restores prior visible-count state
  - Group creation and group-from-session respect `MAX_GROUP_COUNT`
- This entry is the base model that later sleep/wake behavior extends.

## Session Sleep/Wake Support

- `workspace_session_sleep_wake_support.md` extends grouped workspace behavior:
  - Session records persist **`isSleeping`**
  - Sleeping sessions are excluded from awake focus and visible split calculations
  - Focusing a sleeping session implicitly wakes it
  - Group sleep/wake toggles all sessions in the group
  - Sleeping terminal sessions dispose live runtime surfaces but preserve resume metadata
  - If sleep leaves the active group with no awake sessions, active-group selection falls back to another non-empty group
- Relevant files:
  - `shared/simple-grouped-session-workspace-state.ts`
  - `extension/session-grid-store.ts`
  - `extension/native-terminal-workspace/controller.ts`
  - `sidebar/sortable-session-card.tsx`
  - `sidebar/session-group-section.tsx`

## Sidebar Interaction and Session Operations

### General interaction state

- `workspace_sidebar_interaction_state.md` is the broad interaction summary:
  - Workspace messages include `focusSession`, `syncPaneOrder`, `syncGroupOrder`, `syncSessionOrder`, `moveSessionToGroup`
  - Session-card context menu supports actions like rename, close, copy resume, and full reload
  - Capability gating is agent/session-kind specific
- `sidebar_session_card_last_interaction_timestamps.md` documents a regression/fix pattern:
  - New HUD booleans like `showLastInteractionTime` must be selected through `useSidebarStore(useShallow(...))`
  - Render code must use selected locals, not unscoped direct store paths
  - Verified with `tsconfig.extension` typecheck and targeted `vp` tests

### Fork / resume / full reload

- `sidebar_session_fork_support.md` and `sidebar_fork_session_behavior.md` describe the sidebar command matrix and controller flow.
- Supported actions:
  - Copy resume: **codex, claude, copilot, gemini, opencode**
  - Fork: **codex, claude only**
  - Full reload: **codex, claude only**
  - Browser sessions cannot rename, fork, copy resume, or full reload
- Fork architecture:
  - UI posts `{ type: "forkSession", sessionId }`
  - Shared contract updated in `shared/session-grid-contract-sidebar.ts`
  - Dispatch handled in `extension/native-terminal-workspace/sidebar-message-dispatch.ts`
  - Controller creates sibling terminal session in same group, reuses icon/launch metadata, reorders after source, attaches backend, writes fork command, and schedules delayed rename
- Fork commands:
  - Codex: `codex fork <preferred title>`
  - Claude: `claude --fork-session -r <preferred title>`
  - Delayed rename after **4000 ms**: `/rename fork <preferred title>`
- Session agent launch metadata persists under workspace state key:
  - **`VSmux.sessionAgentCommands`**
- Shell quoting rule:
  - single-quoted argument with embedded single-quote escaping

### Session rename title summarization

- `session_rename_title_auto_summarization.md` documents auto-summarization for long user rename input:
  - Summarization triggers only when `title.trim().length > 25`
  - Short titles are applied directly after trimming
  - Long-title generation uses the shared git text-generation stack from:
    - `extension/git/text-generation.ts`
    - `extension/git/text-generation-utils.ts`
  - Progress UI: title **`VSmux`**, message **`Generating session name...`**
  - Resolved titles are sanitized:
    - first non-empty line
    - strip wrapping quotes/backticks
    - collapse whitespace
    - trim
    - remove trailing periods
  - Terminal sessions still issue `/rename {resolvedTitle}` after storing title
- Provider/config details:
  - Default provider command uses **codex gpt-5.4-mini** with high reasoning effort
  - Claude provider uses **Haiku** with high effort
  - Custom provider requires `VSmux.gitTextGenerationCustomCommand`
  - Command timeout is **180000 ms**

## Terminal Titles, Activity, and Completion Sounds

- `title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md` describe the title/activity pipeline:
  - Terminal titles are first-class presentation state from daemon snapshots
  - Visible title precedence:
    1. manual title
    2. terminal title
    3. alias
  - Title/activity updates use **targeted presentation patch messages**, not full rehydrates
- Agent-specific activity detection:
  - Claude working markers: `⠐`, `⠂`, `·`
  - Claude idle markers: `✳`, `*`
  - Codex working markers: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini: working `✦`, idle `◇`
  - Copilot: working `🤖`, idle/attention `🔔`
- Guardrails:
  - Claude/Codex require observed title transitions before spinner implies working
  - Claude/Codex stop counting as working if spinner stops changing for **3 s**
  - Gemini/Copilot do not use the stale-spinner guard
  - Attention only surfaces after at least **3 s** of prior working
  - Completion sounds are delayed by **1 s**
- Sound delivery:
  - Sounds are embedded as **data URLs**
  - Playback uses unlocked **AudioContext**
  - This avoids unreliable fetch-based decode and delayed `HTMLAudio` restrictions in VS Code webviews
- Related sidebar/runtime validation details in `title_activity_and_sidebar_runtime.md`:
  - `setVisibleCount` accepts only **1, 2, 3, 4, 6, 9**
  - `setViewMode` accepts **horizontal, vertical, grid**
  - git actions accept **commit, push, pr**

## Persistence Across VS Code Reloads

- `terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md` cover the same persistence system from different angles.
- Architecture:
  1. `extension/session-grid-store.ts` persists grouped layout
  2. detached per-workspace daemon keeps PTYs alive
  3. restored webview reattaches and rebuilds Restty panes
- Persistence key:
  - **`VSmux.sessionGridSnapshot`**
- Daemon/runtime details:
  - per-workspace daemon, not tied to extension-host lifecycle
  - token-authenticated `/control` and `/session` websocket upgrades
  - reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION` and reachability
  - launch lock file: `daemon-launch.lock`
  - daemon metadata file: `daemon-info.json`
  - debug log: `terminal-daemon-debug.log`
- Thresholds:
  - control connect timeout: **3000 ms**
  - daemon ready timeout: **10000 ms**
  - launch lock stale threshold: **30000 ms**
  - owner heartbeat interval: **5000 ms**
  - owner heartbeat timeout: **20000 ms**
  - startup grace: **30000 ms**
  - attach ready timeout: **15000 ms**
  - replay buffer cap: **8 MiB**
  - replay chunk size: **128 KiB**
- Key decisions:
  - webview uses `retainContextWhenHidden: false`
  - restored sessions reattach via terminal-ready handshake and replay-before-live switch
  - pending attach queue buffers output during replay and flushes after replay completes
  - persisted session-state files preserve title/agent metadata when daemon data is unavailable
  - PTY terminal name is `xterm-256color`
  - `LANG` is normalized to `en_US.UTF-8` if missing/non-UTF-8

## T3 Runtime, Browser Integration, and Packaging

### Workspace browser + T3 integration

- `workspace_browser_t3_integration.md` defines integration among:
  - `extension/live-browser-tabs.ts`
  - `extension/workspace-panel.ts`
  - `extension/native-terminal-workspace/controller.ts`
  - `extension/t3-activity-monitor.ts`
  - `sidebar/sidebar-app.tsx`
- Key decisions:
  - Browsers sidebar excludes internal VSmux/T3-owned tabs
  - Restored workspace panel uses:
    - panel type **`vsmux.workspace`**
    - title **`VSmux`**
    - icon **`media/icon.svg`**
  - Sidebar group rendering uses authoritative `sessionIdsByGroup` to avoid transient "No sessions" placeholders
  - T3 activity comes from live websocket monitoring rather than always-idle assumptions
- T3 activity endpoint and RPCs:
  - websocket URL: **`ws://127.0.0.1:3774/ws`**
  - snapshot RPC: `orchestration.getSnapshot`
  - domain-event subscription: `subscribeOrchestrationDomainEvents`
  - request timeout: **15000 ms**
  - reconnect delay: **1500 ms**
  - refresh debounce: **100 ms**

### Managed T3 runtime upgrade/recovery

- `t3_managed_runtime_upgrade_and_recovery.md` documents the embedded T3 runtime model:
  - managed updated runtime runs on **127.0.0.1:3774**
  - legacy runtime referenced in docs is **127.0.0.1:3773**
  - managed entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
  - websocket route must be **`/ws`**
  - request IDs must be **numeric strings**
  - Ping must be answered with Pong
  - streaming subscriptions use **Chunk / Ack / Exit**
- Build/runtime details:
  - `scripts/build-t3-embed.mjs` copies overlay into vendored upstream, rebuilds web app, recreates `forks/t3code-embed/dist`, and prunes sourcemaps / `mockServiceWorker.js`
  - `T3CODE_WEB_SOURCEMAP=false`
  - supervisor state files include `supervisor.json` and `supervisor-launch.lock`
  - startup/request timeout: **30000 ms**
  - lease heartbeat: **30000 ms**
  - grace period: **180000 ms**
- Recovery pattern after mixed install:
  - sync `forks/t3code-embed/upstream`, `overlay`, and `dist` from tested worktree into main
  - reinstall
  - restart managed 3774 runtime

### VSIX packaging and embed validation

- `vsix_packaging_and_t3_embed_validation.md` describes the extension packaging workflow:
  - script: `scripts/vsix.mjs`
  - modes: `package`, `install`
  - optional flag: `--profile-build`
  - build command: `pnpm run compile`
  - package command: `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
  - install command: `<vscodeCli> --install-extension <vsixPath> --force`
- Package metadata:
  - extension version: **2.5.0**
  - VS Code engine: **^1.100.0**
  - package manager: **pnpm@10.14.0**
- Packaged assets include:
  - `forks/t3code-embed/dist/**`
  - `out/workspace/**`
  - `out/**`
  - `media/**`
- Validation rule:
  - verify installed T3 asset hash in installed VSIX before debugging webview behavior
  - documented mismatch example:
    - refreshed worktree hash: `index-DCV3LG5L.js`
    - stale installed hash: `index-BbtZ0IEL.js`

## Key Cross-Cutting Patterns

Across `current_state.md` and most drill-down entries, several architectural rules repeat and define the current implementation:

- **Per-session runtime identity** and **per-workspace daemon scope**
- **Visible pane order from active group state**, not global filtering
- **Hidden pane freezing** instead of redraw/destruction on visibility changes
- **WorkspaceApp** owns authoritative focus decisions; panes emit intent only
- **Sidebar reorder requires real movement**, avoiding click-induced mutations
- **Targeted patch updates** are preferred over full rehydrates for high-frequency UI changes
- **Persistence-first reconstruction**: workspace snapshots, daemon ring-buffer replay, and persisted session metadata together restore UI state across reloads

## Suggested Drill-Down Map

- Start with `current_state.md` for the overall architecture
- State model: `simple_grouped_session_workspace_state.md`, `workspace_session_sleep_wake_support.md`
- Pane/runtime details: `terminal_pane_runtime_thresholds_and_behaviors.md`
- Focus/ordering/drag: `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, `workspace_sidebar_interaction_state.md`
- Sidebar operations: `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, `session_rename_title_auto_summarization.md`, `sidebar_session_card_last_interaction_timestamps.md`
- Titles/activity/audio: `title_activity_and_sidebar_runtime.md`, `terminal_titles_activity_and_completion_sounds.md`
- Persistence/reload lifecycle: `terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`
- T3/embed/package lifecycle: `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`, `vsix_packaging_and_t3_embed_validation.md`
