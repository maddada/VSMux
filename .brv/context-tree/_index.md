---
children_hash: b697b9edf35c17cf00269bbd26931a84ba546303105238a2309e86f563736ff6
compression_ratio: 0.520416478044364
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 11045
summary_level: d3
token_count: 5748
type: summary
---

# Structural Summary

## Top-level knowledge areas

The provided entries compress into three complementary layers:

- `architecture/_index.md`: long-form architectural source of truth for terminal workspace runtime/UI, chat-history viewer/resume behavior, and git text generation.
- `facts/_index.md`: quick-recall constants, message contracts, file paths, thresholds, endpoints, and capability matrices that mirror the architecture layer.
- `terminal-workspace-current-state.md`: implementation-oriented snapshot of the current terminal workspace model, especially runtime caching, focus ownership, pane projection, reload recovery, daemon lifetime, and reattach-vs-resume semantics.

Together they describe a system centered on a per-workspace terminal runtime with explicit ownership boundaries, replay-based webview restoration, detached backend processes, and provider-specific command execution.

---

## 1) Terminal workspace architecture and current state

Primary drill-down:

- `architecture/terminal_workspace/_index.md`
- `terminal-workspace-current-state.md`
- Fact mirrors in `facts/project/terminal_workspace_facts.md`, `terminal_workspace_runtime_facts.md`, `workspace_focus_and_drag_runtime_facts.md`, `workspace_panel_startup_*`, `terminal_persistence_*`, `simple_grouped_session_workspace_state_facts.md`

### Core ownership model

Key architectural split repeated across `architecture/_index.md` and `terminal-workspace-current-state.md`:

- `WorkspaceApp` is the authoritative owner of focus decisions and visible ordering policy.
- `TerminalPane` emits activation intent (`onActivate("pointer")`, `onActivate("focusin")`) and manages runtime readiness / rendering coordination.
- Shared normalization and grouped layout invariants live in `shared/simple-grouped-session-workspace-state.ts`.
- Controller/backend layers coordinate session state, sidebar hydration, daemon reattach/replay, T3 monitoring, and Agent Manager X publishing.

This same ownership split is reflected in facts entries like:

- `workspace_focus_debugging_facts.md`
- `workspace_sidebar_interaction_facts.md`
- `workspace_focus_and_drag_runtime_facts.md`

### Runtime model and terminal caching

Shared facts across `architecture/_index.md` and `terminal-workspace-current-state.md`:

- Frontend renderer is `restty`, not xterm.
- Runtime cache lives in `workspace/terminal-runtime-cache.ts`.
- Cache key is stable per `sessionId`.
- Invalidation is generation-based through `renderNonce`.
- `releaseCachedTerminalRuntime()` detaches host/DOM without full teardown.
- `destroyCachedTerminalRuntime()` destroys transport, `Restty` instance, and cache entry.
- Controller explicitly destroys runtime when a terminal session is removed so a recycled `sessionId` cannot inherit old transcript state.

Important behavioral consequence:

- terminal panes stay warm across session switches instead of replaying/recreating the frontend runtime.

### Pane projection, switching, and visible order

Core pattern from `terminal-workspace-current-state.md` plus `architecture/terminal_workspace/current_state.md`-derived summaries:

- Workspace projects terminal sessions from all groups, not only the active group.
- Inactive connected panes stay mounted behind the active pane in the same layout slot.
- Hidden panes are mainly suppressed through stacking / pointer-event control, not by full remount.
- Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`.
- `localPaneOrder` is only a temporary optimistic override for visible panes.

Architectural intent:

- instant switching without reconnect
- stable slot assignment during focus changes
- avoidance of hidden-pane reflow that can alter wrapping / transcript tail visibility

These rules are reinforced in:

- `simple_grouped_session_workspace_state.md`
- `workspace_focus_and_sidebar_drag_semantics.md`
- `terminal_workspace_facts.md`

### Focus routing and activation semantics

Across architecture and facts:

- `TerminalPane` emits activation from pointer capture and `focusin`.
- `WorkspaceApp` decides whether to ignore, visually focus, or send `vscode.postMessage({ type: "focusSession" })`.
- T3-originated focus is tracked through `vsmuxT3Focus`.
- Stale local focus requests are cleared when server focus supersedes them.
- Focus path was refined for Agent Manager X jumps so direct focus no longer reopens the sidebar first.

Relevant drill-down:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`
- corresponding facts entries in `facts/project/*`

### Runtime thresholds and interaction constants

Repeated between `architecture/_index.md` and `facts/_index.md`:

- auto-focus guard: `400ms`
- reorder activation after meaningful move: `8px`
- startup interaction block: `1500ms`
- hold-to-drag: `130ms` with `12px` tolerance
- non-touch drag activation: `6px`
- touch activation: `250ms` with `5px` tolerance
- scheduler probe interval/window/warn: `50ms` / `5000ms` / `250ms`
- lag threshold: average overshoot `>=1000ms` within `10000ms`
- completion confirmation delay: `1000ms`
- fork rename delay: `4000ms`

Keyboard mappings preserved in architecture:

- `Shift+Enter` → `\x1b[13;2u`
- macOS `Meta+ArrowLeft` → `\x01`
- macOS `Meta+ArrowRight` → `\x05`
- word nav → `\x1bb` / `\x1bf`

### Grouped workspace state and normalization

Canonical implementation:

- `shared/simple-grouped-session-workspace-state.ts`
- tests in `shared/simple-grouped-session-workspace-state.test.ts`

Normalization / invariants summarized in both architecture and facts:

- undefined snapshots fall back to `createDefaultGroupedSessionWorkspaceSnapshot()`
- at least one group always exists
- browser sessions are removed during normalization
- canonical IDs use `session-${formatSessionDisplayId(displayId ?? 0)}`
- duplicate display IDs are repaired before normalization
- group-local `visibleSessionIds` persist across focus changes
- moved sessions activate and focus the destination group
- removing the last session preserves the empty group and picks nearest non-empty fallback, preferring prior groups
- equality uses `JSON.stringify(left) === JSON.stringify(right)`

### Sleep/wake semantics

From `workspace_session_sleep_wake_support.md` and mirrored facts:

- session state persists `isSleeping`
- sleeping sessions are excluded from focus and visible split calculations
- focusing a sleeping session wakes it
- group-level sleep/wake toggles all sessions in the group
- sleeping terminal sessions dispose runtime/surface but retain resumable metadata
- browser sessions/groups are excluded from sleep support
- message contracts:
  - `{ type: "setSessionSleeping", sessionId, sleeping }`
  - `{ type: "setGroupSleeping", groupId, sleeping }`

### Panel startup, bootstrap, and replay

From `workspace_panel_startup_without_placeholder.md`, `workspace_panel_startup_without_loading_placeholder.md`, and fact mirrors:

- old loading placeholder was removed
- `openWorkspace` reveals sidebar first, then ensures session/state readiness, then reveals panel
- `WorkspacePanelManager` buffers:
  - latest stripped message
  - latest renderable message (`hydrate` / `sessionState`)
- bootstrap payload is injected through `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- replay ordering is renderable state first, then transient state if distinct
- one-shot `autoFocusRequest` is stripped from replay
- duplicate stable-state suppression uses stripped-message signatures
- `retainContextWhenHidden: false` is intentional

Cross-cutting pattern:

- replay/rehydration is preferred over hidden-webview retention.

### Lag recovery and workarea resilience

Strongly emphasized in `terminal-workspace-current-state.md`:

- scheduler-lag detector currently runs only when `debuggingMode` is enabled
- detector uses `terminal.schedulerWindow` during first 10 seconds after workarea boot
- threshold is average timer overshoot `>=1000ms` while pane is visible and document focused
- auto reload is controlled by `AUTO_RELOAD_ON_LAG`
- reload is limited to once per workarea boot
- reload preserves focus by carrying `sessionId` through `reloadWorkspacePanel` with auto-focus source `reload`
- dormant reload notice UI remains fallback if auto reload is disabled

### Persistence and detached terminal daemon

Main references:

- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`
- fact mirrors in `terminal_persistence_*`

Three-part persistence model:

1. `SessionGridStore` persists grouped layout in VS Code `workspaceState`
2. detached per-workspace daemon keeps PTYs alive
3. recreated webviews rebuild panes and reattach via replay

Important persisted/runtime facts:

- workspace snapshot key: `VSmux.sessionGridSnapshot`
- per-workspace daemon, not global
- daemon storage prefix: `terminal-daemon-${workspaceId}`
- key files:
  - `daemon-info.json`
  - `daemon-launch.lock`
  - `terminal-daemon-debug.log`
- websocket endpoints: `/control` and `/session`
- protocol/version match is required for daemon reuse
- PTY uses `xterm-256color`
- `LANG` normalized to `en_US.UTF-8` when needed

Key constants:

- control connect timeout: `3000ms`
- daemon ready timeout: `10000ms`
- stale launch lock: `30000ms`
- heartbeat: `5000ms`
- owner timeout: `20000ms`
- startup grace: `30000ms`
- idle shutdown: `5 * 60_000 ms`
- attach ready timeout: `15000ms`
- ring buffer: `8 MiB`
- replay chunk size: `128 KiB`

Replay contract:

- `terminalReady` handshake
- replay buffer
- pending attach queue
- live promotion

### Reattach vs resume contract

A key current-state distinction:

- `createOrAttach` includes `didCreateSession`
- if live daemon PTY exists, behavior is reattach
- resume command must run only when backend terminal was truly recreated

This connects terminal persistence with viewer resume and sidebar reload flows.

### Sidebar behavior, drag safety, and session capabilities

From architecture and facts:

- ordinary clicking should never mutate order
- reorder requires actual pointer movement crossing threshold for the same interaction
- capability matrix:
  - copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
  - fork: `codex`, `claude`
  - full reload: `codex`, `claude`
- browser sessions cannot rename, fork, copy resume, full reload, or sleep
- browser group ID is `browser-tabs`
- empty browser groups keep drop target container but suppress `"No browsers"` placeholder
- add browser action posts `{ type: "openBrowser" }`

Fork contract:

- sidebar posts `{ type: "forkSession", sessionId }`
- controller validates source session/group/title/command
- sibling session is created in same group after source
- provider-specific fork commands:
  - `codex fork <preferred title>`
  - `claude --fork-session -r <preferred title>`
- delayed rename pattern: `/rename fork <preferred title>`

### Titles, activity, and completion behavior

From architecture topic files plus fact mirrors:

Title precedence:

1. manual user title
2. terminal title
3. alias

Activity system:

- implemented by `extension/session-title-activity.ts`
- Claude/Codex require observed title transitions before spinner implies work
- stale spinner timeout: `3s`
- Gemini/Copilot use simpler marker detection

Marker mapping:

- Claude working: `⠐`, `⠂`, `·`
- Claude idle: `✳`, `*`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini: `✦` working, `◇` idle
- Copilot: `🤖` working, `🔔` idle/attention

Attention/sound rules:

- attention requires `3000ms` prior working
- completion confirmation delay `1000ms`
- sounds are embedded as data URLs and decoded via `AudioContext`

### Browser, T3 runtime, packaging, and Agent Manager X

Main drill-down:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `agent_manager_x_bridge_integration.md`
- `vsmux_ai_devtools_integration.md`

#### Browser/T3 integration

- internal VSmux/T3-owned tabs are excluded from Browsers sidebar
- exclusions include:
  - `WORKSPACE_PANEL_TYPE`
  - `T3_PANEL_TYPE`
  - `viewType` starting with `vsmux.`
  - localhost `/workspace` and `/t3-embed` URLs
- workspace panel identity:
  - type `vsmux.workspace`
  - title `VSmux`
  - icon `media/icon.svg`

#### Managed T3 runtime

- managed runtime uses port `3774`
- legacy runtime uses port `3773`
- websocket endpoint `/ws`
- entrypoint `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- protocol rules include numeric-string IDs matching `^\d+$`, `Ping`/`Pong`, and stream messages `Chunk`, `Ack`, `Exit`
- T3 activity monitor uses `orchestration.getSnapshot`, `subscribeOrchestrationDomainEvents`, `15000ms` timeout, `1500ms` reconnect, `100ms` debounce

#### Agent Manager X bridge

- websocket endpoint: `ws://127.0.0.1:47652/vsmux`
- bridge client: `extension/agent-manager-x-bridge.ts`
- controller integration point: `NativeTerminalWorkspaceController`
- publish only occurs if latest snapshot exists, socket is open, and serialized payload changed
- snapshots are memory-only, not persisted
- reconnect backoff: `1000ms` → `5000ms`
- handshake timeout: `3000ms`
- direct focus path avoids sidebar rehydration artifacts

Published snapshot fields include:

- `agent`
- `alias`
- `displayName`
- `isFocused`
- `isRunning`
- `isVisible`
- `kind`
- `status`
- optional `terminalTitle`
- optional `threadId`

#### Packaging / extension metadata

From facts:

- display name: `VSmux - T3code & Agent CLIs Manager`
- publisher: `maddada`
- main: `./out/extension/extension.js`
- icon: `media/VSmux-marketplace-icon.png`
- activity containers/views:
  - `VSmuxSessions`
  - `VSmux.sessions`
  - `VSmuxSessionsSecondary`
- activation events:
  - `onStartupFinished`
  - `onView:VSmux.sessions`
  - `onWebviewPanel:vsmux.workspace`
- patched dependency: `restty@0.1.35` via `patches/restty@0.1.35.patch`
- `pnpm` overrides replace `vite` / `vitest` with `@voidzero-dev` variants

---

## 2) Chat-history viewer architecture

Primary drill-down:

- `architecture/chat_history/_index.md`
- `viewer_search_and_resume_actions.md`
- fact mirror: `viewer_search_and_resume_actions_facts.md`

### Ownership split

Main files:

- `chat-history/src/webview/App.tsx`
- `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- `chat-history/src/webview/components/ui/input.tsx`
- `chat-history/src/extension/extension.ts`

Responsibilities:

Webview owns:

- parsed conversation loading
- search state
- keyboard shortcuts
- resume metadata derivation
- posting `resumeSession` / refresh messages

Extension host owns:

- panel creation
- JSONL loading
- `resumeSession` validation
- terminal creation
- provider-specific resume command execution

### Search architecture

Architectural choice:

- use native browser `window.find` rather than custom indexing/search state engine

Behavior:

- open with `Cmd/Ctrl+F`
- controls: input, previous, next, close
- keyboard:
  - `Enter` → next
  - `Shift+Enter` → previous
  - `Escape` → close
- query changes reset selection/scroll
- explicit empty-query and no-match states exist

### Resume-session contract

Webview-to-extension messages:

- `{ command: "ready" }`
- `{ command: "refreshConversation", filePath }`
- `{ command: "resumeSession", cwd, sessionId, source }`

Enablement rules:

- resume is enabled only when parsed conversation entries expose `sessionId`
- provider `source` must be inferred from `filePath`
- optional `cwd` is preserved into terminal launch

Provider inference:

- `/.codex/`, `/.codex-profiles/` → Codex
- `/.claude/`, `/.claude-profiles/` → Claude

Execution:

- terminal name `AI DevTools Resume (<source>)`
- Claude: `claude --resume <sessionId>`
- Codex: `codex resume <sessionId>`
- session IDs are quoted with `quoteShellLiteral`

Lifecycle constraints:

- invalid JSONL/schema parse failures surface as `x-error`
- viewer uses `retainContextWhenHidden: false`

Relationship to other topics:

- resume behavior depends on terminal semantics in `terminal-workspace-current-state.md`
- AI DevTools embedding is documented in `vsmux_ai_devtools_integration.md`

---

## 3) Git text generation architecture

Primary drill-down:

- `architecture/git_text_generation/_index.md`
- `low_effort_provider_settings.md`
- fact mirror: `git_text_generation_low_effort_provider_facts.md`

### Implementation surface

Core files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

Direct relationship:

- session title generation in terminal workspace reuses this stack via `session_rename_title_auto_summarization.md`

### Generation pipeline

End-to-end flow:

- build prompt
- append output instructions
- build provider shell command
- execute shell command
- read stdout or output file
- parse/sanitize result
- return commit message, PR content, or session title

Custom command support:

- placeholders `{outputFile}` and `{prompt}`
- if `{prompt}` missing, quoted prompt is appended automatically

### Provider configuration and defaults

Config keys:

- `VSmux.gitTextGenerationProvider`
- `VSmux.gitTextGenerationCustomCommand`

Supported provider enum:

- `codex | claude | custom`

Default:

- `VSmux.gitTextGenerationProvider = codex`

Built-in low-effort providers as of `2026-04-06`:

- Codex: `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
- Claude: `exec claude --model haiku --effort low -p ...`

Important note:

- low-effort provider changes preserved user-edited numeric rename/session limits

### Dependencies and interfaces

Dependencies referenced in architecture:

- `runShellCommand` from `./process`
- temp fs helpers `mkdtemp`, `readFile`, `rm`
- shell quoting from `../agent-shell-integration-utils`
- `GENERATED_SESSION_TITLE_MAX_LENGTH` from terminal workspace title generation

Public outputs:

- commit messages
- PR content
- session titles

### Parsing rules and artifact requirements

Preserved patterns:

- conventional commit subject: `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping: `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch file extraction: `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args: `^[a-z0-9._-]+$`

Constraints:

- empty outputs are fatal
- non-zero exits get provider-specific wrapped errors
- session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tested title behavior remains under 25 chars

Artifact-specific requirements:

Commit messages:

- conventional commit type required
- short lowercase specific scope
- imperative summary `<= 40` chars
- `3–8` concise bullet points when meaningful
- no code fences/commentary

PR content:

- concise specific title
- markdown body
- short concrete `Summary` and `Testing`
- no code fences/commentary

Session titles:

- `2–4` words
- plain text only
- no quotes, markdown, trailing punctuation, or commentary
- should fit tested `<25`-character behavior

---

## 4) Facts domain role and compression strategy

Primary drill-down:

- `facts/_index.md`
- `facts/project/_index.md`

The `facts` domain acts as a high-density recall layer for the same architecture:

- stable constants
- timeouts and thresholds
- capability matrices
- message shapes
- endpoint URLs
- file paths
- panel metadata
- packaging facts
- provider mappings
- CSS/UI micro-adjustments

Examples of fact-focused drill-down entries:

- `workspace_panel_startup_bootstrap_facts.md`
- `agent_manager_x_bridge_integration_facts.md`
- `t3_managed_runtime_upgrade_facts.md`
- `vsmux_packaging_and_embed_validation_facts.md`
- `sidebar_session_card_last_interaction_timestamp_facts.md`

It is structurally aligned with architecture rather than independent: nearly every architecture topic has a corresponding fact sheet preserving exact constants and contracts.

---

## 5) Cross-entry patterns and relationships

### Shared architectural decisions

Repeated across `architecture/_index.md`, `facts/_index.md`, and `terminal-workspace-current-state.md`:

- explicit ownership boundaries (`WorkspaceApp`, `TerminalPane`, controller, grouped-state module)
- per-workspace scoping for daemon, snapshots, runtime caches, and bridge behavior
- replay/bootstrap over retained hidden webviews (`retainContextWhenHidden: false`)
- authoritative data sources over local heuristics
- direct message-based coordination between webview and extension host
- targeted patch/update behavior instead of broad rehydration where possible

### Major integration links

- `chat_history` resume flow depends on terminal reattach/resume semantics in `terminal-workspace-current-state.md`
- `git_text_generation` is reused by `session_rename_title_auto_summarization.md`
- `vsmux_ai_devtools_integration.md` links AI DevTools/chat-history into the VSmux extension/runtime
- Agent Manager X focus and snapshot publishing integrate with the same terminal workspace controller
- T3 runtime and browser exclusion rules feed into workspace sidebar rendering and focus behavior

### Key system-wide invariants

Across the entries, the most stable invariants are:

- terminal frontend runtime should remain warm and reusable per `sessionId`
- hidden/inactive panes should remain mounted to avoid transcript/reflow churn
- visible pane ordering must be derived from active-group visible IDs
- sidebar order should only mutate on proven drag interaction
- detached per-workspace daemon is the source of terminal liveness across reloads
- if live PTY exists, reattach; do not resume
- browser/T3-owned internal tabs must not pollute normal browser/sidebar flows
- provider-specific command execution is explicit and capability-gated, not inferred loosely

---

## Drill-down map

### For terminal runtime, focus, and persistence

- `architecture/terminal_workspace/_index.md`
- `terminal-workspace-current-state.md`
- `terminal_workspace_facts.md`
- `terminal_persistence_across_vs_code_reloads_facts.md`

### For startup/replay/panel behavior

- `workspace_panel_startup_without_placeholder.md`
- `workspace_panel_startup_without_loading_placeholder.md`
- `workspace_panel_startup_bootstrap_facts.md`

### For group state, order, and sleep/wake

- `simple_grouped_session_workspace_state.md`
- `simple_grouped_session_workspace_state_facts.md`
- `workspace_session_sleep_wake_support.md`

### For sidebar capabilities, fork/resume/reload

- `sidebar_session_fork_support.md`
- `sidebar_fork_session_behavior.md`
- `viewer_search_and_resume_actions.md`
- matching `*_facts.md` entries

### For T3 / Agent Manager X / packaging

- `t3_managed_runtime_upgrade_and_recovery.md`
- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_ai_devtools_integration.md`

### For text generation and session title synthesis

- `git_text_generation/_index.md`
- `low_effort_provider_settings.md`
- `session_rename_title_auto_summarization.md`
- `git_text_generation_low_effort_provider_facts.md`
