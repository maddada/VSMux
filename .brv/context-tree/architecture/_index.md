---
children_hash: 02ae471586985bfea0cfaee38891f63f11b6c248507cb6685511e04d76833b8b
compression_ratio: 0.7963468402267478
condensation_order: 2
covers: [context.md, terminal_workspace/_index.md]
covers_token_total: 4763
summary_level: d2
token_count: 3793
type: summary
---

# architecture / terminal_workspace

## Scope and role

This topic covers the VSmux terminal workspace architecture: frontend pane rendering, grouped workspace projection, sidebar session operations, per-workspace backend daemon behavior, reload persistence, and T3/browser integration. The domain contract is established in `context.md`, while `terminal_workspace/_index.md` is the main structural map and `current_state.md` is the primary source for current behavior.

## System shape

The current design centers on a few stable architectural choices referenced across `current_state.md` and most child entries:

- **Restty** is the terminal renderer.
- Terminal runtime identity is keyed by **`sessionId`**.
- Runtime reuse is **per session**, while daemon ownership is **per workspace**.
- Hidden connected panes stay **mounted and painted** rather than being recreated.
- `WorkspaceApp` owns **authoritative focus state**; panes report activation intent only.
- Visible pane order is derived from **`activeGroup.snapshot.visibleSessionIds`**.
- High-frequency UI state changes favor **targeted patch updates** over full rehydrates.
- Recovery after reload combines:
  - persisted grouped snapshot state,
  - detached daemon-held PTYs,
  - replay + reattach,
  - persisted disconnected metadata fallback.

Relevant core files repeatedly cited:

- `workspace/terminal-runtime-cache.ts`
- `workspace/terminal-pane.tsx`
- `workspace/workspace-app.tsx`
- `extension/native-terminal-workspace/controller.ts`
- `extension/daemon-terminal-workspace-backend.ts`

## Frontend runtime and pane lifecycle

`current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, `workspace_sidebar_interaction_state.md`, and `terminal_titles_activity_and_sidebar_runtime.md` describe the runtime lifecycle:

- PTY connect is delayed until appearance is applied, size is stable, and ready/connect sequencing completes.
- Stable size resolution waits up to **20 attempts** and requires **2 identical measurements**.
- Hidden panes skip redraw/maintenance after startup but remain alive.
- Bootstrap visuals end after the first successful canvas reveal.
- `releaseCachedTerminalRuntime()` detaches and decrements refs without destroying runtime state.
- `destroyCachedTerminalRuntime()` fully tears down transport, Restty, and cache entry.

Important thresholds:

- Auto-focus guard: **400 ms**
- Typing autoscroll: **4 printable keys within 450 ms**
- Scroll hysteresis: show **200 px**, hide **40 px**
- Scheduler probe: **50 ms** interval, **5000 ms** window
- Lag detection: overshoot **>= 1000 ms** within **10000 ms**
- Reconnect performance probe: **5000 ms**

Input mappings called out in `terminal_pane_runtime_thresholds_and_behaviors.md`:

- `Shift+Enter` → `\x1b[13;2u`
- macOS `Meta+ArrowLeft` → `\x01`
- macOS `Meta+ArrowRight` → `\x05`
- word navigation → `\x1bb` / `\x1bf`

## Focus, ordering, and drag semantics

`workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, `workspace_sidebar_interaction_state.md`, and `terminal_titles_activity_and_sidebar_runtime.md` define focus and ordering rules:

- `TerminalPane` emits focus intent from `pointer` / `focusin`.
- `WorkspaceApp` resolves actual focus ownership.
- `localPaneOrder` is only a temporary override within the current visible set.
- Passive split slots should remain stable during focus/split transitions.

Drag and reorder protections:

- Sidebar reorder must not trigger from click-like interactions.
- Actual reorder requires movement crossing **8 px**.
- Startup interaction block: **1500 ms**
- Session-card drag hold: **130 ms** with **12 px** tolerance
- Non-touch drag activation: **6 px**
- Touch activation: **250 ms** delay with **5 px** tolerance

Debugging-specific notes from `workspace_focus_debugging.md`:

- stale local pending focus is cleared when server focus disagrees,
- T3 iframe focus event type is **`vsmuxT3Focus`**,
- hidden panes and auto-focus-guarded panes ignore iframe focus,
- header drag suppresses pane activation during drag.

## Grouped workspace state model

`simple_grouped_session_workspace_state.md` is the base state-model entry, implemented in:

- `shared/simple-grouped-session-workspace-state.ts`
- `shared/simple-grouped-session-workspace-state.test.ts`

Canonical decisions:

- Normalization always ensures at least one group.
- Browser sessions are removed during normalization.
- Session IDs are canonicalized as `session-${formatSessionDisplayId(...)}`
- Duplicate display IDs are repaired before per-group normalization.
- Group-local `visibleSessionIds` are preserved and restored when returning to a group.
- New sessions use the **first free display ID**.
- Removing the last session from the active group preserves the empty group and falls back to the nearest populated group, preferring previous groups.
- Moving a session to another group activates the destination and focuses the moved session.
- Fullscreen stores/restores previous visible-count state.
- Group creation and “group from session” respect `MAX_GROUP_COUNT`.

## Sleep/wake extension

`workspace_session_sleep_wake_support.md` extends the grouped state model:

- Session records persist **`isSleeping`**.
- Sleeping sessions are excluded from awake focus and visible split calculations.
- Focusing a sleeping session wakes it implicitly.
- Group sleep/wake toggles affect all sessions in the group.
- Sleeping terminal sessions dispose live runtime surfaces but keep resume metadata.
- If the active group has no awake sessions after sleep, selection falls back to another non-empty group.

Referenced implementation files:

- `shared/simple-grouped-session-workspace-state.ts`
- `extension/session-grid-store.ts`
- `extension/native-terminal-workspace/controller.ts`
- `sidebar/sortable-session-card.tsx`
- `sidebar/session-group-section.tsx`

## Sidebar interaction and session operations

`workspace_sidebar_interaction_state.md` is the broad interaction contract. Workspace messages include:

- `focusSession`
- `syncPaneOrder`
- `syncGroupOrder`
- `syncSessionOrder`
- `moveSessionToGroup`

Session-card menus support rename, close, copy resume, and full reload, with capability gating based on agent/session type.

### Fork / resume / reload

`sidebar_session_fork_support.md` and `sidebar_fork_session_behavior.md` define the command matrix:

- Copy resume: **codex, claude, copilot, gemini, opencode**
- Fork: **codex, claude**
- Full reload: **codex, claude**
- Browser sessions support none of rename/fork/copy-resume/full-reload

Fork flow:

- UI posts `{ type: "forkSession", sessionId }`
- shared contract: `shared/session-grid-contract-sidebar.ts`
- dispatch: `extension/native-terminal-workspace/sidebar-message-dispatch.ts`
- controller creates sibling terminal session in same group, preserves icon/launch metadata, inserts after source, attaches backend, writes fork command, then schedules delayed rename.

Commands:

- Codex: `codex fork <preferred title>`
- Claude: `claude --fork-session -r <preferred title>`
- Delayed rename after **4000 ms**: `/rename fork <preferred title>`

Persisted launch metadata key:

- **`VSmux.sessionAgentCommands`**

Shell quoting rule:

- single-quoted arguments with embedded single-quote escaping.

### Rename title summarization

`session_rename_title_auto_summarization.md` adds long-title summarization:

- Direct apply only if `title.trim().length <= 25`
- Longer input routes through shared git text generation:
  - `extension/git/text-generation.ts`
  - `extension/git/text-generation-utils.ts`
- Progress UI:
  - title: **`VSmux`**
  - message: **`Generating session name...`**
- Sanitization rules:
  - first non-empty line,
  - strip wrapping quotes/backticks,
  - collapse whitespace,
  - trim,
  - remove trailing periods.
- Terminal sessions still send `/rename {resolvedTitle}` after state update.

Provider details:

- default provider: **codex gpt-5.4-mini** with high reasoning
- Claude provider: **Haiku** with high effort
- custom provider via **`VSmux.gitTextGenerationCustomCommand`**
- timeout: **180000 ms**

### Sidebar HUD/store selection fix

`sidebar_session_card_last_interaction_timestamps.md` captures a recurring UI-store rule:

- new HUD booleans like `showLastInteractionTime` must be selected via `useSidebarStore(useShallow(...))`,
- rendering must consume selected locals rather than direct store-path access,
- validated with `tsconfig.extension` typecheck and targeted `vp` tests.

## Titles, activity, and completion sounds

`title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md` define presentation state and activity inference:

- terminal titles are first-class daemon snapshot state,
- visible title precedence:
  1. manual title
  2. terminal title
  3. alias
- updates use targeted presentation patch messages.

Activity markers:

- Claude working: `⠐`, `⠂`, `·`
- Claude idle: `✳`, `*`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini working: `✦`, idle: `◇`
- Copilot working: `🤖`, idle/attention: `🔔`

Guardrails:

- Claude/Codex require observed title transitions before spinner-only working state is trusted.
- Claude/Codex stop counting as working if spinner stalls for **3 s**.
- Gemini/Copilot skip stale-spinner guarding.
- Attention appears only after at least **3 s** of prior working.
- Completion sounds are delayed **1 s**.

Sound delivery decision:

- audio is embedded as **data URLs**
- playback uses unlocked **AudioContext**
- avoids VS Code webview issues with fetch decode / delayed `HTMLAudio`.

Validation constraints in `title_activity_and_sidebar_runtime.md`:

- `setVisibleCount` only: **1, 2, 3, 4, 6, 9**
- `setViewMode`: **horizontal, vertical, grid**
- git actions: **commit, push, pr**

## Persistence across reloads

`terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md` describe the reload-resilience architecture:

1. `extension/session-grid-store.ts` persists grouped layout
2. detached per-workspace daemon keeps PTYs alive
3. restored webview reattaches and rebuilds Restty panes

Persistence key:

- **`VSmux.sessionGridSnapshot`**

Daemon/runtime details:

- daemon is per workspace, not tied to extension-host lifecycle
- token-authenticated `/control` and `/session` websocket upgrades
- reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION` and daemon reachability
- lock file: `daemon-launch.lock`
- metadata file: `daemon-info.json`
- debug log: `terminal-daemon-debug.log`

Key thresholds:

- control connect timeout: **3000 ms**
- daemon ready timeout: **10000 ms**
- stale launch lock: **30000 ms**
- heartbeat interval: **5000 ms**
- heartbeat timeout: **20000 ms**
- startup grace: **30000 ms**
- attach ready timeout: **15000 ms**
- replay buffer cap: **8 MiB**
- replay chunk size: **128 KiB**

Behavioral decisions:

- webview uses `retainContextWhenHidden: false`
- restored sessions reattach via terminal-ready handshake plus replay-before-live handoff
- pending attach queue buffers output during replay and flushes after replay
- persisted session-state files preserve title/agent metadata when daemon state is unavailable
- PTY name is `xterm-256color`
- `LANG` is normalized to `en_US.UTF-8` if absent or invalid

## T3 runtime, browser integration, and packaging

### Browser + T3 workspace integration

`workspace_browser_t3_integration.md` ties together:

- `extension/live-browser-tabs.ts`
- `extension/workspace-panel.ts`
- `extension/native-terminal-workspace/controller.ts`
- `extension/t3-activity-monitor.ts`
- `sidebar/sidebar-app.tsx`

Decisions:

- Browsers sidebar excludes internal VSmux/T3-owned tabs.
- Restored panel uses:
  - type **`vsmux.workspace`**
  - title **`VSmux`**
  - icon **`media/icon.svg`**
- Sidebar group rendering must use authoritative `sessionIdsByGroup` to avoid transient empty placeholders.
- T3 activity is sourced from live websocket monitoring, not assumed idle.

T3 activity endpoint:

- websocket: **`ws://127.0.0.1:3774/ws`**
- snapshot RPC: `orchestration.getSnapshot`
- event subscription: `subscribeOrchestrationDomainEvents`
- request timeout: **15000 ms**
- reconnect delay: **1500 ms**
- refresh debounce: **100 ms**

### Managed T3 runtime upgrade/recovery

`t3_managed_runtime_upgrade_and_recovery.md` documents the embedded runtime contract:

- managed runtime: **127.0.0.1:3774**
- legacy runtime reference: **127.0.0.1:3773**
- entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- websocket route must be **`/ws`**
- request IDs must be **numeric strings**
- ping/pong required
- streaming subscriptions use **Chunk / Ack / Exit**

Build/runtime details:

- `scripts/build-t3-embed.mjs` overlays vendored upstream, rebuilds web app, recreates `forks/t3code-embed/dist`, and prunes sourcemaps plus `mockServiceWorker.js`
- `T3CODE_WEB_SOURCEMAP=false`
- supervisor files: `supervisor.json`, `supervisor-launch.lock`
- startup/request timeout: **30000 ms**
- lease heartbeat: **30000 ms**
- grace period: **180000 ms**

Mixed-install recovery pattern:

- sync `forks/t3code-embed/upstream`, `overlay`, and `dist` from a known-good worktree,
- reinstall,
- restart managed 3774 runtime.

### VSIX packaging and embed validation

`vsix_packaging_and_t3_embed_validation.md` defines the packaging path:

- script: `scripts/vsix.mjs`
- modes: `package`, `install`
- optional flag: `--profile-build`
- build: `pnpm run compile`
- package: `vp exec vsce package --no-dependencies --skip-license --allow-unused-files-pattern --out <vsixPath>`
- install: `<vscodeCli> --install-extension <vsixPath> --force`

Package metadata:

- extension version: **2.5.0**
- VS Code engine: **^1.100.0**
- package manager: **pnpm@10.14.0**

Packaged assets include:

- `forks/t3code-embed/dist/**`
- `out/workspace/**`
- `out/**`
- `media/**`

Critical validation rule:

- verify installed T3 asset hash inside the actual VSIX before debugging webview behavior.
- Example mismatch in `vsix_packaging_and_t3_embed_validation.md`:
  - expected/refreshed: `index-DCV3LG5L.js`
  - stale installed: `index-BbtZ0IEL.js`

## Cross-entry patterns and drill-down map

The topic repeatedly reinforces these relationships:

- `current_state.md` is the architectural anchor.
- `simple_grouped_session_workspace_state.md` defines base grouped session semantics.
- `workspace_session_sleep_wake_support.md` layers awake/sleep behavior onto that base.
- `workspace_focus_and_sidebar_drag_semantics.md` and `workspace_focus_debugging.md` govern focus ownership and drag safety.
- `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, and `session_rename_title_auto_summarization.md` define sidebar action flows.
- `title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md` define title/activity/audio presentation behavior.
- `terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md` define reload survival and reattach.
- `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`, and `vsix_packaging_and_t3_embed_validation.md` cover T3 runtime operations, embed lifecycle, and packaged-asset correctness.
