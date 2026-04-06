---
children_hash: 726cc8c03c3157d749a413d4f3c7a92ea1689da1c836a0b25e76e849b68b1d04
compression_ratio: 0.47353244078269824
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 9710
summary_level: d3
token_count: 4598
type: summary
---

# Terminal Workspace Structural Summary

## Scope

These entries describe the VSmux terminal workspace as a coordinated frontend/runtime/persistence system. The main architectural map is in `architecture/_index.md`, with stable quick-recall invariants in `facts/_index.md`, and the most current implementation snapshot in `terminal-workspace-current-state.md`.

## Core architectural model

Across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`, the workspace is built around a few durable decisions:

- Terminal rendering uses `restty`, not xterm.
- Frontend terminal runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- Runtime reuse is per session; backend daemon ownership is per workspace.
- Hidden connected panes remain mounted and painted behind the active pane instead of being recreated.
- `WorkspaceApp` is the authoritative focus owner; `TerminalPane` only emits activation intent.
- Visible split ordering comes from `activeGroup.snapshot.visibleSessionIds`, with `localPaneOrder` as a temporary optimistic override only.
- Reload recovery combines persisted grouped layout, detached daemon PTYs, replay/reattach, and persisted session metadata fallback.

Primary implementation files repeatedly referenced:

- `workspace/terminal-runtime-cache.ts`
- `workspace/terminal-pane.tsx`
- `workspace/workspace-app.tsx`
- `extension/native-terminal-workspace/controller.ts`
- `extension/daemon-terminal-workspace-backend.ts`

## Frontend runtime and pane lifecycle

`terminal-workspace-current-state.md` and the drill-downs referenced by `architecture/_index.md` define the runtime lifecycle:

- Cache invalidation is generation-based via `renderNonce`.
- Session removal sends `destroyTerminalRuntime` so a recycled `sessionId` cannot inherit old transcript state.
- Pane projection includes terminal sessions from all groups so cross-group switching keeps terminals warm.
- Inactive panes stay mounted in the same `grid-area`; active pane is layered above via `z-index`.
- Hidden panes skip redraw work after PTY connect, avoiding hidden-pane reflow and transcript/tail instability.
- Bootstrap visuals are gated by persisted runtime state (`bootstrapVisualsComplete`) so startup-only surface treatment does not rerun.

Lifecycle split:

- `releaseCachedTerminalRuntime(...)`: detach/release host but keep runtime alive.
- `destroyCachedTerminalRuntime(...)`: destroy transport, Restty, host, and cache entry.

Key thresholds and behaviors called out across `architecture/_index.md` and `facts/_index.md`:

- terminal size stabilization: up to 20 attempts, requires 2 identical measurements
- auto-focus guard: 400 ms
- scheduler probe: 50 ms interval, 5000 ms window
- lag window: 10000 ms
- lag threshold: 1000 ms overshoot
- reconnect probe: 5000 ms
- backend session polling: 500 ms

## Focus, ordering, and drag semantics

The focus/ordering contract is consistent across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- `workspace/terminal-pane.tsx` emits activation intent from pointer capture and `focusin`.
- `workspace/workspace-app.tsx` owns actual focus policy, focus visuals, and whether to send `focusSession`.
- Split layout order must remain slot-stable when focus changes within a split.
- Passive surfaced panes should not jump because of unrelated global order changes.

Drag/reorder protections:

- Clicking sidebar session cards should focus only, not reorder.
- Reorder requires actual pointer movement crossing 8 px.
- Startup interaction block: 1500 ms.
- Session-card drag hold: 130 ms with 12 px tolerance.
- Non-touch drag activation: 6 px.
- Touch drag activation: 250 ms delay with 5 px tolerance.
- T3 iframe focus event type is `vsmuxT3Focus`.

`workspace_focus_debugging.md` and `workspace_focus_debugging_facts.md` are the drill-downs for stale local focus cleanup, iframe focus handling, and drag suppression during header drags.

## Grouped workspace state model

`simple_grouped_session_workspace_state.md` and `simple_grouped_session_workspace_state_facts.md` define the canonical grouped-state semantics:

- Implementation: `shared/simple-grouped-session-workspace-state.ts`
- Tests: `shared/simple-grouped-session-workspace-state.test.ts`
- Undefined state normalizes from `createDefaultGroupedSessionWorkspaceSnapshot()`.
- At least one group always exists.
- Browser sessions are removed during normalization.
- Canonical session IDs use `session-${formatSessionDisplayId(...)}`
- Duplicate display IDs are repaired before per-group normalization.
- New sessions take the first free display ID.
- Group-local `visibleSessionIds` are preserved/restored.
- If `visibleCount === 1`, visible IDs normalize to `[focusedSessionId]`.
- Removing the last session preserves the empty group and falls back to the nearest populated group, preferring previous groups.
- Moving a session to another group activates the destination and focuses the moved session.
- Fullscreen stores `fullscreenRestoreVisibleCount`.
- Group creation is capped by `MAX_GROUP_COUNT`.
- Group indexing is 1-based.

This grouped-state model is the base layer that other entries extend.

## Sleep/wake extension

`workspace_session_sleep_wake_support.md` and `workspace_session_sleep_wake_support_facts.md` layer sleep-aware behavior onto the grouped model:

- Session records persist `isSleeping`.
- Sleeping sessions are excluded from awake focus and split visibility calculations.
- Focusing a sleeping session wakes it.
- Group sleep/wake toggles affect all non-browser sessions in the group.
- Sleeping terminal sessions dispose live runtime surfaces but preserve card and resumable metadata.
- If the active group has no awake sessions, selection falls back to another non-empty group.

Related files referenced in the architecture summary:

- `shared/simple-grouped-session-workspace-state.ts`
- `extension/session-grid-store.ts`
- `extension/native-terminal-workspace/controller.ts`
- `sidebar/sortable-session-card.tsx`
- `sidebar/session-group-section.tsx`

## Persistence, daemon model, and reload recovery

`terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`, `terminal_persistence_reload_facts.md`, and `terminal_persistence_across_vs_code_reloads_facts.md` define the detached-daemon persistence contract:

Three-part architecture:

- `SessionGridStore`
- detached per-workspace terminal daemon
- restored webview/Restty frontend

Persistence and daemon details:

- workspace snapshot key: `VSmux.sessionGridSnapshot`
- daemon state dir prefix: `terminal-daemon-${workspaceId}`
- files: `daemon-info.json`, `daemon-launch.lock`, `terminal-daemon-debug.log`
- daemon deps include `ws` and `@lydell/node-pty`
- token-authenticated WebSocket upgrades on `/control` and `/session`
- daemon reuse requires matching `TERMINAL_HOST_PROTOCOL_VERSION`
- PTY name: `xterm-256color`
- `LANG` normalized to `en_US.UTF-8` if needed

Replay/reattach behavior:

- restored sessions reattach via terminal-ready handshake
- replay happens before live handoff
- pending output is buffered until replay completes
- replay ring buffer cap: 8 MiB
- replay chunk size: 128 KiB
- attach-ready timeout: 15000 ms

Lifecycle thresholds:

- control connect timeout: 3000 ms
- daemon ready timeout: 10000 ms
- stale launch lock: 30000 ms
- heartbeat interval: 5000 ms
- heartbeat timeout: 20000 ms
- startup grace: 30000 ms
- idle shutdown: 5 \* 60_000 ms

`terminal-workspace-current-state.md` adds the key semantic distinction:

- `createOrAttach` returns `didCreateSession`
- if a live daemon PTY exists, VSmux reattaches
- resume commands run only when the backend terminal was truly recreated

It also records the user-facing policy that sidebar-listed terminal sessions should remain alive while VS Code is running, with `VSmux.backgroundSessionTimeoutMinutes` defaulting to 5 minutes and `<= 0` disabling timeout.

## Persisted terminal presentation state

The current-state entry adds a cold-start correctness rule:

- Persisted session state stores `agentName`, `agentStatus`, and `title` in `extension/session-state-file.ts`.
- `extension/terminal-daemon-session-state.ts` preserves the last known agent/title unless better live data exists.
- This ensures the sidebar can still show agent and title even when daemon state is unavailable after reload.

## Sidebar interactions and capability matrix

`workspace_sidebar_interaction_state.md` and `workspace_sidebar_interaction_facts.md` define the workspace/sidebar messaging surface:

Message types include:

- `focusSession`
- `syncPaneOrder`
- `syncGroupOrder`
- `syncSessionOrder`
- `moveSessionToGroup`
- sleep/wake actions such as `setSessionSleeping`, `focusSession`, `setGroupSleeping`

Session-card menu capabilities are refined by:

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- their `_facts.md` counterparts

Capability matrix:

- Copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- Fork: `codex`, `claude`
- Full reload: `codex`, `claude`
- Browser sessions support none of rename/fork/copy-resume/full-reload

Persisted launch metadata key:

- `VSmux.sessionAgentCommands`

## Fork, resume, and reload behavior

The fork flow defined in `sidebar_fork_session_behavior.md` and `sidebar_fork_session_behavior_facts.md` is:

- UI posts `{ type: "forkSession", sessionId }`
- contract lives in `shared/session-grid-contract-sidebar.ts`
- dispatch goes through `extension/native-terminal-workspace/sidebar-message-dispatch.ts`
- controller creates a sibling terminal session in the same group
- it preserves icon/launch metadata, inserts after source, attaches backend, writes the fork command, then schedules delayed rename

Fork commands:

- `codex fork <preferred title>`
- `claude --fork-session -r <preferred title>`

Delayed rename:

- `FORK_RENAME_DELAY_MS = 4000`
- rename command: `/rename fork <preferred title>`

Supporting rules:

- shell quoting uses single-quoted arguments with embedded single-quote escaping
- `buildForkAgentCommand(...)` returns `undefined` if `agentId`, `agentCommand`, or `forkTitle` is missing
- visible validation message: “Fork is only available for Codex and Claude sessions that have a visible title.”

Reload/resume distinctions:

- full reload restarts terminal and replays resume command
- detached resume executes immediately for `codex` and `claude`
- `gemini`, `opencode`, and `copilot` receive suggested commands only

## Rename title auto-summarization

`session_rename_title_auto_summarization.md` and `session_rename_title_auto_summarization_facts.md` define rename/title generation:

- Direct apply only when `title.trim().length <= 25`
- Longer titles route through:
  - `extension/git/text-generation.ts`
  - `extension/git/text-generation-utils.ts`

Progress UI:

- title: `VSmux`
- message: `Generating session name...`

Provider/config behavior:

- default provider: codex using `gpt-5.4-mini` with high reasoning
- Claude provider: Haiku with high effort
- custom provider uses `VSmux.gitTextGenerationCustomCommand`
- if provider is `custom` and command is empty, rename fails with config error
- generation timeout: 180000 ms

Default commands preserved in `facts/_index.md`:

- `codex -m gpt-5.4-mini -c model_reasoning_effort="high" exec -`
- `claude --model haiku --effort high -p <prompt>`

Sanitization:

- first non-empty line
- strip wrapping quotes/backticks
- collapse whitespace
- trim
- remove trailing periods

Terminal sessions still dispatch `/rename {resolvedTitle}` after state update.

## Titles, activity inference, and completion sounds

`title_activity_and_sidebar_runtime.md` and `terminal_titles_activity_and_completion_sounds.md` define presentation state:

- terminal titles are first-class daemon snapshot state
- visible title precedence:
  1. manual title
  2. terminal title
  3. alias
- updates are sent as targeted presentation patch messages

Activity markers by agent:

- Claude working: `⠐`, `⠂`, `·`; idle: `✳`, `*`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini working: `✦`, idle: `◇`
- Copilot working: `🤖`, idle/attention: `🔔`

Guardrails:

- Claude/Codex require observed title transitions before spinner-only activity is trusted
- Claude/Codex stop counting as working if spinner stalls for 3 s
- Gemini/Copilot skip stale-spinner guarding
- attention appears only after at least 3 s of prior working
- completion sounds are delayed 1 s

Audio delivery decision:

- embedded data URLs
- playback via unlocked `AudioContext`
- avoids VS Code webview issues with fetch/decode or delayed `HTMLAudio`

Validation constraints captured in `title_activity_and_sidebar_runtime.md`:

- `setVisibleCount`: only `1, 2, 3, 4, 6, 9`
- `setViewMode`: `horizontal`, `vertical`, `grid`
- git actions: `commit`, `push`, `pr`

## Browser and T3 integration

`workspace_browser_t3_integration.md`, `workspace_browser_t3_integration_facts.md`, `t3_managed_runtime_upgrade_and_recovery.md`, and `t3_managed_runtime_upgrade_facts.md` define browser/T3 integration:

Workspace/browser integration:

- browser sidebar excludes internal VSmux and T3-owned tabs
- restored panel identity:
  - type `vsmux.workspace`
  - title `VSmux`
  - icon `media/icon.svg`
- local resource roots include `out/workspace` and `forks/t3code-embed/dist`
- sidebar groups must render from authoritative `sessionIdsByGroup`
- `retainContextWhenHidden = false`

T3 activity transport:

- websocket `ws://127.0.0.1:3774/ws`
- snapshot RPC: `orchestration.getSnapshot`
- event subscription: `subscribeOrchestrationDomainEvents`
- request timeout: 15000 ms
- reconnect delay: 1500 ms
- refresh debounce: 100 ms

Managed runtime invariants:

- current embedded runtime target: `127.0.0.1:3774`
- legacy runtime: `127.0.0.1:3773`
- runtime entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- websocket route must be `/ws`
- Effect RPC request IDs must be numeric strings
- ping/pong required
- streaming subscriptions use `Chunk / Ack / Exit`

Mixed-install recovery pattern from `t3_managed_runtime_upgrade_and_recovery.md`:

- sync `upstream`, `overlay`, and `dist` from a known-good worktree
- reinstall
- restart managed 3774 runtime

## Packaging and install validation

`vsix_packaging_and_t3_embed_validation.md` and `vsmux_packaging_and_embed_validation_facts.md` cover packaging metadata and validation:

Packaging flow:

- script: `scripts/vsix.mjs`
- modes: `package`, `install`
- optional flag: `--profile-build`
- build: `pnpm run compile`
- package command uses `vsce package --no-dependencies --skip-license --allow-unused-files-pattern`
- install uses the VS Code CLI with `--install-extension ... --force`

Extension/package metadata:

- display name: `VSmux - T3code & Agent CLIs Manager`
- publisher: `maddada`
- repository: `https://github.com/maddada/VSmux.git`
- main: `./out/extension/extension.js`
- icon: `media/VSmux-marketplace-icon.png`
- version: `2.5.0`
- VS Code engine: `^1.100.0`
- package manager: `pnpm@10.14.0`

Activation/views:

- `onStartupFinished`
- `onView:VSmux.sessions`
- `onWebviewPanel:vsmux.workspace`
- views/containers include `VSmuxSessions`, `VSmux.sessions`, `VSmuxSessionsSecondary`

Packaged assets include:

- `forks/t3code-embed/dist/**`
- `out/workspace/**`
- `out/**`
- `media/**`

Critical validation rule:

- verify installed T3 asset hash inside the actual VSIX before debugging webview issues
- example mismatch noted in `vsix_packaging_and_t3_embed_validation.md`:
  - expected/refreshed: `index-DCV3LG5L.js`
  - stale installed: `index-BbtZ0IEL.js`

## Config, dependency, and input invariants

From `facts/_index.md`:

Dependency/config facts:

- pnpm override `vite -> npm:@voidzero-dev/vite-plus-core@latest`
- pnpm override `vitest -> npm:@voidzero-dev/vite-plus-test@latest`
- patched `restty@0.1.35` via `patches/restty@0.1.35.patch`
- `VSmux.gitTextGenerationProvider` default `codex`, supports `codex`, `claude`, `custom`
- `VSmux.sendRenameCommandOnSidebarRename` default `true`

Terminal key mappings:

- `Shift+Enter -> \x1b[13;2u`
- macOS:
  - `Meta+ArrowLeft -> \x01`
  - `Meta+ArrowRight -> \x05`
  - `Alt+ArrowLeft -> \x1bb`
  - `Alt+ArrowRight -> \x1bf`
- non-mac:
  - `Ctrl+ArrowLeft -> \x1bb`
  - `Ctrl+ArrowRight -> \x1bf`

## Current-state emphasis

`terminal-workspace-current-state.md` is the highest-value implementation snapshot and sharpens the architectural intent:

- keep one stable Restty runtime/transport per terminal session
- keep terminals warm across same-group and cross-group switching
- avoid hidden-pane reflow because it causes transcript/tail instability
- preserve slot stability inside visible splits
- centralize pane activation through `WorkspaceApp`
- prevent resurrecting old content when a closed session’s `sessionId` is later reused
- when `debuggingMode` is enabled, startup scheduler lag can trigger auto reload once per workarea boot
- lag-triggered reload preserves focus on the last active terminal session
- if auto reload is disabled, dormant reload-notice UI remains fallback recovery surface
- sidebar-listed terminal sessions should stay alive while VS Code is running
- if daemon PTY is live, reattach rather than resume
- if daemon is unavailable, sidebar still shows persisted agent/title state

## Drill-down map

- Architectural overview: `architecture/_index.md`
- Facts overview: `facts/_index.md`
- Current implementation snapshot: `terminal-workspace-current-state.md`
- Group state model: `simple_grouped_session_workspace_state.md`, `simple_grouped_session_workspace_state_facts.md`
- Sleep/wake layer: `workspace_session_sleep_wake_support.md`, `workspace_session_sleep_wake_support_facts.md`
- Focus/drag semantics: `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_focus_debugging.md`, corresponding facts entries
- Sidebar actions: `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, `session_rename_title_auto_summarization.md`
- Persistence/daemon recovery: `terminal_persistence_across_reloads.md`, `terminal_persistence_across_vs_code_reloads.md`
- Titles/activity/audio: `title_activity_and_sidebar_runtime.md`, `terminal_titles_activity_and_completion_sounds.md`
- Browser/T3 integration: `workspace_browser_t3_integration.md`, `t3_managed_runtime_upgrade_and_recovery.md`
- Packaging/install validation: `vsix_packaging_and_t3_embed_validation.md`
