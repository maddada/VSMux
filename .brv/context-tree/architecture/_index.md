---
children_hash: 410f5f69c93aa048ca43c3ef8e388b312fcb65b1116f65d0eeca1c53fb0824e3
compression_ratio: 0.6364087301587301
condensation_order: 2
covers:
  [chat_history/_index.md, context.md, git_text_generation/_index.md, terminal_workspace/_index.md]
covers_token_total: 8064
summary_level: d2
token_count: 5132
type: summary
---

# architecture

Architectural knowledge for VSmux centers on three related areas: the `terminal_workspace` runtime and UI model, `chat_history` viewer/search/resume behavior, and `git_text_generation` provider-driven text synthesis. The domain scope is terminal workspace rendering, pane lifecycle, runtime caching, workspace message handling, and backend daemon/session persistence; it excludes unrelated editor features and generic terminal usage.

## Domain structure

- `context.md` defines the domain as the architectural source of truth for:
  - terminal workspace frontend behavior
  - workspace projection/grouping logic
  - backend daemon and persisted session behavior
- Main drill-down topics:
  - `terminal_workspace/_index.md`
  - `chat_history/_index.md`
  - `git_text_generation/_index.md`

## 1) terminal_workspace

Primary architectural surface for runtime behavior, focus/order control, persistence, sidebar capabilities, browser/T3 integration, packaging, and Agent Manager X connectivity.

### Core ownership model

From `terminal_workspace/_index.md`:

- `WorkspaceApp` is the authoritative owner of focus and visible ordering decisions.
- `TerminalPane` owns runtime readiness, activation intent, and rendering coordination.
- `shared/simple-grouped-session-workspace-state.ts` centralizes grouped workspace normalization and invariants.
- Backend/controller layers coordinate sidebar hydration, daemon-backed session state, panel replay, T3 monitoring, and bridge integration.

### Runtime and pane lifecycle

Key references:

- `current_state.md`
- `terminal_pane_runtime_thresholds_and_behaviors.md`
- `workspace_sidebar_interaction_state.md`

Important decisions and behaviors:

- Restty is the workspace renderer.
- Cached runtime identity is stable per `sessionId`; cache invalidation uses `renderNonce`.
- `releaseCachedTerminalRuntime()` detaches DOM/host without destruction.
- `destroyCachedTerminalRuntime()` destroys transport, Restty instance, and cache entry.
- Hidden connected panes remain mounted behind the active pane.
- PTY attach/connect waits for:
  1. appearance applied
  2. stable size resolution
  3. terminal-ready sequencing
- Stable sizing requires up to 20 attempts and 2 identical measurements.

Operational thresholds preserved in `terminal_pane_runtime_thresholds_and_behaviors.md`:

- auto-focus guard: `400ms`
- typing autoscroll trigger: `4` printable keystrokes within `450ms`
- scroll-to-bottom show/hide: `>200px` / `<40px`
- scheduler probe interval/window/warn: `50ms` / `5000ms` / `250ms`
- lag detection: average overshoot `>=1000ms` within `10000ms`, only when visible and focused

Keyboard mappings retained:

- `Shift+Enter` → `\x1b[13;2u`
- macOS `Meta+ArrowLeft` → `\x01`
- macOS `Meta+ArrowRight` → `\x05`
- word nav → `\x1bb` / `\x1bf`

### Focus, ordering, and drag semantics

Key references:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `terminal_titles_activity_and_sidebar_runtime.md`
- `workspace_focus_debugging.md`

Structural rules:

- `TerminalPane` emits activation via `onActivate("pointer")` and fallback `onActivate("focusin")`.
- `WorkspaceApp` decides whether to ignore, visually focus, or post `vscode.postMessage({ type: "focusSession" })`.
- T3 iframe-originated focus uses `vsmuxT3Focus`.
- Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`, not from filtering global pane order.
- `localPaneOrder` is only a temporary visible-pane override.

Sidebar/drag thresholds:

- reorder activates only after `8px` meaningful movement
- startup interaction block: `1500ms`
- hold-to-drag: `130ms` with `12px` tolerance
- non-touch drag activation: `6px`
- touch drag activation: `250ms` with `5px` tolerance

Debugging pattern:

- stale local focus requests are cleared when server focus supersedes them
- focus-ignore and header-drag paths are explicitly instrumented in `workspace_focus_debugging.md`

### Grouped workspace state

Primary reference:

- `simple_grouped_session_workspace_state.md`

Canonical model:

- implementation: `shared/simple-grouped-session-workspace-state.ts`
- tests: `shared/simple-grouped-session-workspace-state.test.ts`

Normalization and lifecycle rules:

- undefined snapshots fall back to `createDefaultGroupedSessionWorkspaceSnapshot()`
- at least one group always exists
- browser sessions are removed during normalization
- canonical session IDs are generated as `session-${formatSessionDisplayId(displayId ?? 0)}`
- duplicate display IDs are repaired pre-normalization
- removing the last session from the active group preserves the empty group and chooses nearest non-empty fallback, preferring previous groups
- group-local `visibleSessionIds` are preserved across focus changes
- new sessions append to active group and become focused
- moved sessions activate destination group and become focused
- group creation respects `MAX_GROUP_COUNT`
- fullscreen preserves/restores `fullscreenRestoreVisibleCount`
- snapshot equality currently uses `JSON.stringify(left) === JSON.stringify(right)`

### Persistence and reload recovery

Key references:

- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

Three-part persistence architecture:

1. `SessionGridStore` persists grouped layout in VS Code `workspaceState`
2. detached per-workspace terminal daemon keeps PTYs alive
3. restored webviews rebuild panes and reattach via replay

Preserved facts:

- persistence key: `VSmux.sessionGridSnapshot`
- daemon is detached Node.js, per workspace, independent of webview/extension-host lifecycle
- websocket endpoints: `/control` and `/session`
- reuse requires protocol version match and reachability
- PTY terminal name: `xterm-256color`
- `LANG` is normalized to `en_US.UTF-8` if needed

Operational limits:

- control connect timeout: `3000ms`
- daemon ready timeout: `10000ms`
- launch lock stale threshold: `30000ms`
- owner heartbeat interval/timeout: `5000ms` / `20000ms`
- startup grace: `30000ms`
- session attach ready timeout: `15000ms`
- ring buffer cap: `8 MiB`
- replay chunk size: `128 KiB`

Replay contract:

- `terminalReady` handshake
- replay buffer
- pending attach queue
- live promotion

### Panel startup and first paint

Key references:

- `workspace_panel_startup_without_placeholder.md`
- `workspace_panel_startup_without_loading_placeholder.md`

Architectural decisions:

- old loading placeholder was removed
- `openWorkspace` now reveals sidebar first, ensures session/state readiness, then reveals the workspace panel
- `WorkspacePanelManager` buffers:
  - latest stripped message
  - latest renderable message (`hydrate` or `sessionState`)
- bootstrap payload is injected via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- on `ready`, replay order is:
  1. latest renderable state
  2. latest transient message if distinct
- one-shot `autoFocusRequest` is stripped from replay
- `retainContextWhenHidden: false` remains intentional
- visible lag can trigger one automatic workarea reload

### Titles, activity, and completion signals

Key references:

- `terminal_titles_activity_and_completion_sounds.md`
- `title_activity_and_sidebar_runtime.md`
- `session_rename_title_auto_summarization.md`

Title precedence:

1. manual user title
2. terminal title
3. alias

Activity derivation:

- implemented by `extension/session-title-activity.ts`
- Claude/Codex require observed title transitions before spinner counts as working
- Claude/Codex stop counting as working after `3s` stale spinner
- Gemini/Copilot use simpler marker detection

Marker mapping:

- Claude working: `⠐`, `⠂`, `·`
- Claude idle: `✳`, `*`
- Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
- Gemini: `✦` working, `◇` idle
- Copilot: `🤖` working, `🔔` idle/attention

Attention/sound behavior:

- attention requires at least `3000ms` of prior working
- completion confirmation delay: `1000ms`
- sounds are embedded as data URLs and decoded with `AudioContext`

Rename summarization links into `git_text_generation`:

- short titles `<= 25` chars are returned trimmed
- longer titles use provider-backed summarization
- summaries clamp to `24` chars with whole-word preference
- implementation spans:
  - `extension/native-terminal-workspace/session-title-generation.ts`
  - `extension/git/text-generation.ts`
  - `extension/git/text-generation-utils.ts`

### Sidebar actions and browser-group behavior

Key references:

- `workspace_sidebar_interaction_state.md`
- `sidebar_fork_session_behavior.md`
- `sidebar_session_fork_support.md`
- `sidebar_browsers_empty_state.md`
- `sidebar_session_card_last_interaction_timestamps.md`

Capability matrix:

- copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- fork: `codex`, `claude`
- full reload: `codex`, `claude`

Fork flow:

- sidebar posts `{ type: "forkSession", sessionId }`
- controller validates source session/group/title/command
- creates sibling session in same group
- reuses agent metadata
- inserts immediately after source
- writes fork command
- schedules delayed rename

Fork command details:

- `FORK_RENAME_DELAY_MS = 4000`
- Codex: `codex fork <preferred title>`
- Claude: `claude --fork-session -r <preferred title>`
- delayed rename pattern: `/rename fork <preferred title>`

Browser-group rules:

- browser sidebar group ID: `browser-tabs`
- empty browser groups keep drop target container but suppress `"No browsers"` placeholder
- browser groups suppress sorting, focus-on-click, context menu, rename, visible-count changes, and sleep
- add button posts `{ type: "openBrowser" }`
- browser sessions cannot rename, fork, copy resume, or full reload
- `.session-last-interaction-time` became right-aligned in `sidebar/styles/session-cards.css`

### Sleep/wake behavior

Primary reference:

- `workspace_session_sleep_wake_support.md`

Rules:

- session records persist `isSleeping`
- sleeping sessions are excluded from focus and visible split calculations
- focusing a sleeping session wakes it
- group toggles sleep/wake all sessions in a group
- sleeping terminal sessions dispose live runtime/surfaces while keeping resume metadata
- if active group has no awake sessions after sleep, fallback selects another non-empty group

Messages:

- `{ type: "setSessionSleeping", sessionId, sleeping }`
- `{ type: "setGroupSleeping", groupId, sleeping }`

### Browser, T3, packaging, and Agent Manager X integration

Key references:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`
- `vsmux_ai_devtools_integration.md`

#### Browser/T3 integration

- internal VSmux/T3-owned tabs are excluded from the Browsers sidebar group
- exclusions include:
  - `WORKSPACE_PANEL_TYPE`
  - `T3_PANEL_TYPE`
  - `viewType` starting with `vsmux.`
  - localhost `/workspace` and `/t3-embed` URLs
- workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon: `media/icon.svg`

T3 activity integration:

- default websocket URL: `ws://127.0.0.1:3774/ws`
- RPC: `orchestration.getSnapshot`
- subscription: `subscribeOrchestrationDomainEvents`
- request timeout: `15000ms`
- reconnect delay: `1500ms`
- refresh debounce: `100ms`

Managed runtime upgrade:

- new managed runtime: port `3774`
- legacy runtime: port `3773`
- entrypoint: `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- protocol requirements:
  - websocket route `/ws`
  - numeric-string request IDs matching `^\d+$`
  - `Ping` → `Pong`
  - stream via `Chunk`, `Ack`, `Exit`

Packaging validation:

- package/install workflow runs through `scripts/vsix.mjs`
- installed T3 asset hash must be checked under installed extension path
- documented drift example:
  - refreshed worktree asset: `index-DCV3LG5L.js`
  - stale installed asset: `index-BbtZ0IEL.js`

#### Agent Manager X bridge

- bridge client: `extension/agent-manager-x-bridge.ts`
- controller integration point: `NativeTerminalWorkspaceController`
- websocket endpoint: `ws://127.0.0.1:47652/vsmux`

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

Bridge rules:

- latest snapshot is memory-only, not persisted
- publish requires:
  - latest snapshot exists
  - socket is `WebSocket.OPEN`
  - serialized payload changed
- reconnect backoff: `1000ms` to `5000ms`
- handshake timeout: `3000ms`
- `ping` is ignored
- `focusSession` requires matching `workspaceId`

Focus-path refinement:

- Agent Manager X jumps now use `focusSessionFromAgentManagerX`
- this avoids reopening sidebar container and prevents sidebar rehydration while preserving focus behavior

#### AI DevTools / chat-history integration

- VSmux remains the single shipped VS Code extension host
- AI DevTools is embedded through the `chat-history` package
- activation entry: `chat-history/src/extension/extension.ts`
- contribution point: `aiDevtools.conversations` under `VSmuxSessions`

Build/package facts:

- dedicated webview output in `chat-history/dist`
- package assets include `chat-history/dist` and `chat-history/media`
- root build includes `chat-history:webview:build`
- viewer suspend path `ai-devtools.suspend` disposes panel, clears sidebar cache, and enters suspended state
- recorded build facts include extension version `2.6.0`, TS target `ES2024`, and chat-history bundle target `es2020` IIFE

### Cross-cutting patterns

Repeated across `terminal_workspace` entries:

- authoritative state split between `WorkspaceApp`, `TerminalPane`, shared grouped-state module, and controller
- bootstrap + buffer-and-replay startup instead of retained hidden webview state
- targeted patching for high-frequency title/activity updates rather than full rehydrate
- per-workspace runtime isolation:
  - PTY daemon
  - managed T3 runtime on `127.0.0.1:3774`
  - Agent Manager X bridge on `ws://127.0.0.1:47652/vsmux`
- intentional non-persistence for some UI state:
  - Agent Manager X snapshots are memory-only
  - webviews use `retainContextWhenHidden: false`

## 2) chat_history

Architectural overview of the conversation viewer’s search UX and session resume flow.

Primary reference:

- `viewer_search_and_resume_actions.md`

### Scope and ownership split

- Main files:
  - `chat-history/src/webview/App.tsx`
  - `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
  - `chat-history/src/webview/components/ui/input.tsx`
  - `chat-history/src/extension/extension.ts`
- Webview owns:
  - parsed conversation loading
  - search state
  - keyboard shortcuts
  - resume metadata derivation
  - posting `resumeSession` and refresh messages
- Extension host owns:
  - panel creation
  - JSONL loading
  - `resumeSession` validation
  - terminal creation
  - provider-specific resume command execution

### Search architecture

- Search uses browser-native `window.find`, not a custom app-level index.
- Search bar opens on `Cmd/Ctrl+F`.
- Controls: input, previous, next, close.
- Keyboard rules:
  - `Enter` → next
  - `Shift+Enter` → previous
  - `Escape` → close
- Search wraps around and resets selection/scroll on query change.
- Explicit states exist for empty query and no match.

Architectural decision:

- rely on browser selection/find behavior rather than duplicate indexing logic in the webview.

### Resume-session contract

Webview-to-extension messages:

- `{ command: "ready" }`
- `{ command: "refreshConversation", filePath }`
- `{ command: "resumeSession", cwd, sessionId, source }`

Gating rules:

- Resume only enables when `sessionId` is extracted from parsed conversation entries.
- Resume also requires provider `source` inference from `filePath`.
- optional `cwd` is preserved into terminal launch.

### Source inference and command mapping

Provider inference:

- `/.codex/` and `/.codex-profiles/` → Codex
- `/.claude/` and `/.claude-profiles/` → Claude

Terminal execution:

- terminal name: `AI DevTools Resume (<source>)`
- Claude command: `claude --resume <sessionId>`
- Codex command: `codex resume <sessionId>`
- session IDs are shell-quoted with `quoteShellLiteral`

### Data/parsing and lifecycle constraints

- parsed JSONL entries provide `sessionId`, possible `cwd`, and enough metadata for resume enablement
- invalid JSONL/schema parse failures are surfaced as `x-error` records
- viewer panel uses `retainContextWhenHidden: false`

Relationships:

- directly intersects with `terminal_workspace/current_state.md`
- also connects to `terminal_workspace/workspace_browser_t3_integration.md`

## 3) git_text_generation

Architectural topic for provider-specific shell command construction, prompt transport, output parsing, and low-effort defaults for commit messages, PR content, and session titles.

Primary reference:

- `low_effort_provider_settings.md`

### Implementation surface

Core files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

Relationship:

- linked to `terminal_workspace/session_rename_title_auto_summarization.md` because session-title generation reuses this stack.

### End-to-end generation flow

- build prompt
- append output instructions
- build provider shell command
- run shell command
- read stdout or output file
- parse and sanitize result
- return commit message, PR content, or session title

Custom command behavior:

- supports `{outputFile}` and `{prompt}` expansion
- if `{prompt}` is missing, quoted prompt is appended automatically

### Built-in provider decisions

As of `2026-04-06`, built-in providers are pinned to low-effort settings.

Codex:

- `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
- model: `gpt-5.4-mini`
- prompt transport: stdin via trailing `exec -`

Claude:

- `exec claude --model haiku --effort low -p ...`
- model: `haiku`
- effort: `low`
- prompt transport: CLI `-p`

Default configuration:

- `VSmux.gitTextGenerationProvider = codex`

Metadata/configuration notes:

- package descriptions were updated to describe low-effort built-in providers
- user-edited numeric session rename generation limits were preserved

### Dependencies and public interfaces

Dependencies:

- `runShellCommand` from `./process`
- temp filesystem helpers: `mkdtemp`, `readFile`, `rm`
- shell quoting from `../agent-shell-integration-utils`
- `GENERATED_SESSION_TITLE_MAX_LENGTH` from terminal workspace session-title generation

Configuration keys:

- `VSmux.gitTextGenerationProvider`
- `VSmux.gitTextGenerationCustomCommand`

Public API outputs:

- commit messages
- PR content
- session titles

### Parsing rules and constraints

Error behavior:

- empty outputs are fatal for commit messages, PR content, and session titles
- non-zero exits are wrapped with provider-specific error text from `describeGitTextGenerationSettings`
- session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tested title behavior remains under 25 characters

Preserved pattern rules:

- conventional commit subject:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch file extraction:
  - `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  - `^[a-z0-9._-]+$`

### Prompt/output requirements by artifact

Commit messages:

- conventional commit type required
- short lowercase specific scope
- imperative summary `<= 40` characters
- body `3 to 8` concise bullet points when meaningful
- no code fences or commentary

PR content:

- concise specific title
- markdown body
- short concrete `Summary` and `Testing`
- no code fences or commentary

Session titles:

- prefer `2 to 4` words
- specific and scannable
- plain text only
- no quotes, markdown, commentary, or trailing punctuation
- must fit tested `<25` character behavior and clamp under `GENERATED_SESSION_TITLE_MAX_LENGTH + 1`

## Key relationships across topics

- `chat_history` resume execution depends on terminal behavior documented in `terminal_workspace/current_state.md`.
- `git_text_generation` session-title generation is reused by `terminal_workspace/session_rename_title_auto_summarization.md`.
- `terminal_workspace` includes embedded AI DevTools/chat-history integration via `vsmux_ai_devtools_integration.md`.
- The domain consistently favors:
  - explicit ownership boundaries
  - detached/runtime-isolated processes
  - message-based coordination
  - bootstrap/replay instead of hidden webview retention
  - targeted state patching over full rehydration
