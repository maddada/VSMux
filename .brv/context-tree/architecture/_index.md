---
children_hash: aca5e8cc87bcb31e1c81fca5d125dbbd80b07ba9f279a1787125193845c6e662
compression_ratio: 0.6866331898613104
condensation_order: 2
covers:
  [chat_history/_index.md, context.md, git_text_generation/_index.md, terminal_workspace/_index.md]
covers_token_total: 8364
summary_level: d2
token_count: 5743
type: summary
---

# architecture

Structural overview of the VSmux architecture knowledge base across three main areas: `terminal_workspace`, `chat_history`, and `git_text_generation`. The domain centers on extension-host/webview splits, persistent terminal runtime management, browser/T3 integration, AI session workflows, and provider-driven text generation.

## Domain scope

From `context.md`:

- Focuses on terminal workspace frontend behavior, workspace projection/state, backend daemon behavior, and adjacent UI/runtime contracts.
- Includes rendering, pane lifecycle, runtime caching, sidebar/workspace message flow, pane ordering, detached backend state, and persisted session presentation.
- Excludes unrelated editor features and generic terminal usage instructions.

## Topic map

- `terminal_workspace` — primary runtime architecture for terminal sessions, workspace panel, sidebar, persistence, T3/browser integration, packaging, and external bridge integrations.
- `chat_history` — conversation viewer/search/resume architecture and the VSmux Search rename/package namespace.
- `git_text_generation` — built-in provider command construction and result parsing for commit messages, PR text, and session title generation.

## Cross-topic architecture patterns

### 1. Webview + extension-host split

Shared across `terminal_workspace`, `chat_history`, and `git_text_generation`:

- UI/webview layers manage presentation, local interaction, and message posting.
- Extension-host/controller layers own validation, command execution, PTY/runtime lifecycle, and external integrations.
- Runtime-sensitive state is centralized in controller-style owners rather than individual components.

Examples:

- `chat_history/src/webview/App.tsx` and `ConversationSearchBar.tsx` pair with `chat-history/src/extension/extension.ts`.
- `terminal_workspace` uses `WorkspaceApp`/panel-side state with `NativeTerminalWorkspaceController` as the main stateful owner.
- `git_text_generation` keeps provider command building and shell execution in `extension/git/text-generation-utils.ts` and `extension/git/text-generation.ts`.

### 2. Stable identity + lightweight replay

A repeated architectural decision is to preserve stable identifiers and replay just enough state:

- Terminal runtimes are cached by `sessionId` in `terminal_workspace/current_state.md`.
- Visible ordering is driven by `activeGroup.snapshot.visibleSessionIds`, with only temporary local overrides.
- Workspace startup replays buffered renderable messages rather than showing placeholder UI.
- Chat viewer search avoids indexed app state and relies on browser-native `window.find`.
- Agent Manager X bridge snapshots are emitted only when serialized payloads actually change.

### 3. Persistent/disconnected-friendly presentation

Across `terminal_workspace` and `chat_history`:

- Detached/backend-aware systems preserve enough metadata to keep UI useful during reconnects or suspension.
- Per-session persisted state retains titles/agent metadata even if daemon state is unavailable.
- Hidden terminal panes remain mounted rather than recreated.
- Viewer lifecycle in `chat_history` intentionally does not retain hidden context (`retainContextWhenHidden: false`), favoring simpler reconstruction over hidden-state persistence.

## terminal_workspace

`terminal_workspace/_index.md` is the foundational topic and the architectural hub for the rest of the domain.

### Core runtime model

From `current_state.md`, `terminal_pane_runtime_thresholds_and_behaviors.md`, and related entries:

- Renderer: `Restty`
- Runtime cache key: `sessionId`
- Runtime identity invalidation: `renderNonce`
- Hidden panes remain mounted and painted behind the active pane.
- PTY attach flow:
  1. apply appearance
  2. wait for stable size
  3. call `markTerminalReady(cols, rows)`
  4. connect or reattach PTY
- Stable size heuristic:
  - up to 20 attempts
  - completes after 2 identical measurements
- Lifecycle split:
  - `releaseCachedTerminalRuntime()` detaches without destroying
  - `destroyCachedTerminalRuntime()` fully destroys runtime and transport

This establishes a “preserve expensive runtime, swap presentation ownership carefully” design.

### Persistence and detached daemon architecture

From `terminal_persistence_across_reloads.md` and `terminal_persistence_across_vs_code_reloads.md`:

- Persistence uses a 3-part architecture:
  1. `extension/session-grid-store.ts`
  2. detached per-workspace daemon
  3. restored webview with `Restty` renderers
- Layout persistence key: `VSmux.sessionGridSnapshot`
- Daemon is per-workspace, not per extension host.
- Daemon uses token-authenticated `/control` and `/session` sockets.
- PTYs survive VS Code reloads.
- Replay model:
  - pane waits for `terminalReady`
  - daemon replays ring buffer
  - pending output queues during replay
  - pending output flushes afterward
- Important thresholds retained:
  - control connect timeout: `3000ms`
  - daemon ready timeout: `10000ms`
  - owner heartbeat: `5000ms`
  - owner timeout: `20000ms`
  - startup grace: `30000ms`
  - session attach ready timeout: `15000ms`
  - replay buffer: `8 MiB`
  - replay chunk size: `128 KiB`

Related drill-down:

- `current_state.md`
- `terminal_persistence_across_reloads.md`
- `terminal_persistence_across_vs_code_reloads.md`

### Workspace startup and panel bootstrap

From `workspace_panel_startup_without_placeholder.md` and `workspace_panel_startup_without_loading_placeholder.md`:

- Placeholder loading UI was removed.
- Initial render is driven by embedded bootstrap state:
  - `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- `openWorkspace` reveals sidebar before panel reveal.
- If no sessions exist, a session is created first.
- If sessions exist, workspace state is refreshed first.
- Panel-side buffering preserves:
  - `latestMessage`
  - `latestRenderableMessage`
- Only `hydrate` and `sessionState` are treated as renderable messages.
- Ready replay order:
  1. latest renderable state
  2. latest transient message if distinct
- One-shot `autoFocusRequest` is stripped before replay.

This links closely to focus behavior and reduced startup flicker in:

- `workspace_panel_focus_hotkeys.md`
- `workspace_focus_debugging.md`

### Focus, ordering, and drag ownership

From `workspace_focus_and_sidebar_drag_semantics.md`, `workspace_sidebar_interaction_state.md`, `terminal_titles_activity_and_sidebar_runtime.md`, and `current_state.md`:

- `WorkspaceApp` is the single owner of stateful focus decisions.
- `TerminalPane` emits activation intent only:
  - `onActivate("pointer")`
  - `onActivate("focusin")`
- Auto-focus guard window: `400ms`
- T3 iframe focus messages use `type === "vsmuxT3Focus"` and are ignored when hidden, blocked by guard, or already focused.
- Visible split-pane order comes from `activeGroup.snapshot.visibleSessionIds`.
- `localPaneOrder` is only a temporary override.
- Reorder sync uses `syncPaneOrder`.

Sidebar drag semantics are intentionally strict:

- No reorder on click-like interactions.
- Main movement threshold: `8px`
- Additional thresholds/timings:
  - startup interaction block: `1500ms`
  - non-touch drag distance: `6px`
  - touch drag activation: `250ms` delay, `5px` tolerance
  - hold-to-drag: `130ms` delay, `12px` tolerance
- Sidebar move/reorder messages:
  - `syncSessionOrder`
  - `moveSessionToGroup`
  - `syncGroupOrder`

Related entries:

- `workspace_focus_and_sidebar_drag_semantics.md`
- `workspace_focus_debugging.md`
- `workspace_sidebar_interaction_state.md`

### Grouped state and sleep/wake

From `simple_grouped_session_workspace_state.md` and `workspace_session_sleep_wake_support.md`:

- Core state helper: `shared/simple-grouped-session-workspace-state.ts`
- Browser sessions are dropped from grouped terminal normalization.
- At least one group is always ensured.
- Canonical session ID rule:
  - `session-${formatSessionDisplayId(displayId ?? 0)}`
- Duplicate generated display IDs are repaired.
- Active-group fallback prefers nearest previous non-empty group, then next.
- Group-local `visibleSessionIds` are restored on group focus.
- Moving a session activates the destination group and focuses the moved session.
- Group limits respect `MAX_GROUP_COUNT`.

Sleep/wake adds session lifecycle semantics:

- `isSleeping` persists on session records.
- Sleeping sessions are excluded from focus and visible-split calculations.
- Focusing a sleeping session wakes it.
- Group sleep/wake toggles operate on non-browser sessions/groups only.
- Sleeping a terminal session disposes live runtime surfaces but preserves resume metadata.

### Session titles, activity, and sounds

This cluster spans:

- `terminal_title_normalization_and_session_actions.md`
- `session_rename_title_auto_summarization.md`
- `terminal_titles_activity_and_completion_sounds.md`
- `title_activity_and_sidebar_runtime.md`

Key title rules:

- Canonical sanitizer: `normalizeTerminalTitle()`
- Leading glyph stripping pattern:
  - `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- Path-like titles beginning with `~` or `/` are not visible titles.
- Generated `Session N` titles are not primary visible titles.
- Preferred title resolution:
  1. normalized visible terminal title
  2. visible user/session title
  3. otherwise `undefined`

Auto-summarization rules:

- Trigger only when `title.trim().length > 25`
- Threshold: `25`
- Clamp target: `24`
- Output prefers 2–4 words, plain text, no quotes/markdown/commentary, no trailing punctuation
- Result processing:
  - first non-empty line
  - strip fences
  - strip wrapping quotes
  - collapse whitespace
  - strip trailing periods
  - prefer whole-word truncation

Provider details here differ from low-effort git text generation:

- timeout: `180000ms`
- Codex: `gpt-5.4-mini` with high reasoning effort
- Claude: `haiku` with high effort

Activity/sound model:

- Activity is title-driven for CLI agents.
- Marker families preserved:
  - Claude working: `⠐ ⠂ ·`
  - Claude idle: `✳ *`
  - Codex working: `⠸ ⠴ ⠼ ⠧ ⠦ ⠏ ⠋ ⠇ ⠙ ⠹`
  - Gemini: `✦` working, `◇` idle
  - Copilot: `🤖` working, `🔔` idle/attention
- Claude/Codex require observed title transitions before spinner implies working.
- Stale-spinner timeout for Claude/Codex: `3000ms`
- Attention requires at least `3000ms` of prior work.
- Completion sound delay: `1000ms`
- High-frequency updates use targeted presentation patch messages instead of full rehydrates.

### Session actions and agent command configuration

From `sidebar_session_fork_support.md`, `sidebar_fork_session_behavior.md`, `default_agent_commands_overrides.md`, and title/session action entries:

Support matrix:

- Copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- Fork: `codex`, `claude`
- Full reload: `codex`, `claude`
- Browser sessions cannot rename, fork, copy resume, or full reload

Fork flow:

1. sidebar posts `{ type: "forkSession", sessionId }`
2. controller validates session/group/title/command
3. creates sibling in same group
4. reuses source agent and launch metadata
5. inserts new session after source
6. writes fork command
7. schedules delayed rename after `4000ms`

Fork commands:

- Codex: `codex fork '<title>'`
- Claude: `claude --fork-session -r '<title>'`

Agent override configuration:

- Setting: `VSmux.defaultAgentCommands`
- Built-ins: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- Empty strings normalize to `null`
- Stored explicit non-default commands remain authoritative
- Legacy stock commands are upgraded to configured aliases during resume/fork resolution
- Built-in launch resolution excludes `t3`

### Browser, T3, packaging, and external integrations

This integration cluster includes:

- `workspace_browser_t3_integration.md`
- `t3_managed_runtime_upgrade_and_recovery.md`
- `vsix_packaging_and_t3_embed_validation.md`
- `vsmux_ai_devtools_integration.md`
- `agent_manager_x_bridge_integration.md`
- `agent_manager_x_focus_path_without_sidebar_rehydration.md`

Browser/T3 facts:

- Browser group ID: `browser-tabs`
- Workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon: `media/icon.svg`
- Default T3 websocket URL: `ws://127.0.0.1:3774/ws`
- T3 monitor uses:
  - `orchestration.getSnapshot`
  - `subscribeOrchestrationDomainEvents`
- Request timeout: `15000ms`
- Reconnect delay: `1500ms`
- Refresh debounce: `100ms`

Managed T3 runtime upgrade model:

- Managed runtime: port `3774`
- Legacy runtime: port `3773`
- Entrypoint:
  - `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- Protocol requirements:
  - websocket route `/ws`
  - numeric string request IDs such as `"1"`
  - `Ping` / `Pong`
  - streaming frames `Chunk`, `Ack`, `Exit`
- Upgrade should be validated in an isolated worktree before copying `upstream`, `overlay`, and `dist` back.

Packaging facts:

- Script: `scripts/vsix.mjs`
- Modes: `package`, `install`
- Build command: `pnpm run compile`
- `vsce package` is invoked with `--no-dependencies --skip-license --allow-unused-files-pattern`
- Packaged assets include `forks/t3code-embed/dist/**`, `out/workspace/**`, `out/**`, `media/**`
- Installed embed asset hash should be verified under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js`

AI DevTools / chat-history integration:

- Single shipped extension host remains VSmux.
- `activateChatHistory(context)` runs before workspace controller setup.
- `aiDevtools.conversations` is registered under `VSmuxSessions`.
- Chat-history build output: `chat-history/dist`
- `ai-devtools.suspend` disposes the panel, clears sidebar cache, and suspends for memory release.

Agent Manager X bridge:

- Bridge client: `extension/agent-manager-x-bridge.ts`
- Endpoint: `ws://127.0.0.1:47652/vsmux`
- Controller owns one `AgentManagerXBridgeClient`
- Publishes normalized workspace/session snapshots with metadata, visibility, running state, `kind`, `status`, optional `terminalTitle`, and `threadId`
- Sends only when latest snapshot exists, socket is open, and payload changed
- Reconnect backoff: `1000ms` doubling to `5000ms`
- Direct focus path update removed sidebar-first rehydration during broker-driven focus jumps

## chat_history

`chat_history/_index.md` covers the conversation viewer, browser-native search, resume-session bridge, and rename into VSmux Search.

### Viewer/search/resume architecture

From `viewer_search_and_resume_actions.md`:

- Webview UI and search bar live in:
  - `chat-history/src/webview/App.tsx`
  - `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- Extension-host message handling and terminal launch live in:
  - `chat-history/src/extension/extension.ts`

Search model:

- Uses browser-native `window.find`
- Cmd/Ctrl+F opens custom find bar
- Enter = next
- Shift+Enter = previous
- Escape = close
- Search wraps around
- Query changes reset selection/scroll state
- Explicit status exists for empty query and failed match

Resume contract:

- Webview posts `resumeSession`
- Payload includes:
  - `source`
  - `sessionId`
  - optional `cwd`
- Resume is enabled only when session metadata can be parsed from conversation JSONL/file path
- Source inference:
  - `/.codex/`, `/.codex-profiles/` → `Codex`
  - `/.claude/`, `/.claude-profiles/` → `Claude`
- Resume commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- Session IDs are shell-quoted with `quoteShellLiteral`
- Terminal naming: `AI DevTools Resume (<source>)`

Additional viewer decisions:

- Parsing failures become normalized `x-error` records.
- Viewer panel uses `retainContextWhenHidden: false`.

### VSmux Search rename/package layer

From `vsmux_search_rename.md`:

Renamed identifiers:

- command namespace: `VSmuxSearch.*`
- view ID: `VSmuxSearch.conversations`
- view label: `VSmux Search`
- panel type: `vsmuxSearchViewer`

Packaging/runtime facts:

- package name: `vsmux-search-vscode`
- display name: `VSmux Search`
- publisher: `vsmux-search`
- version: `1.1.0`
- activity bar container ID: `vsmux-search`
- activation event: `onView:VSmuxSearch.conversations`

Behavior preserved under rename:

- sidebar scans/loads conversation folders
- supports refresh/reload
- current-vs-all scope toggle
- recent-only vs all-time filtering
- viewer opening
- optional terminal resume
- markdown export

Time filtering rule:

- recent-only cutoff: `Date.now() - 7 * 24 * 60 * 60 * 1000`
- applies only when `!this._showAllTime && !this._filterText`

Export behavior:

- filename: `vsmux-search-export-${sessionId}.md`
- branded with VSMUX-SEARCH tags
- preserves metadata and message categories
- groups Chrome MCP tools into option keys
- unknown tools are included by default

### Relationship to terminal_workspace

`chat_history` depends on broader workspace/session infrastructure:

- Resume launches terminals into the same broader runtime ecosystem documented in `terminal_workspace/current_state.md`.
- Integration is explicitly connected to:
  - `architecture/terminal_workspace/current_state`
  - `architecture/terminal_workspace/workspace_browser_t3_integration`

## git_text_generation

`git_text_generation/_index.md` captures provider-backed text generation for commit messages, PR content, and generated session titles.

### Core implementation and flow

Primary files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

Execution flow from `low_effort_provider_settings.md`:

1. build prompt
2. append output instructions
3. build provider shell command
4. run shell command
5. read output file or stdout
6. parse and sanitize result
7. return commit message, PR content, or session title

Custom command behavior:

- Supports `{outputFile}` and `{prompt}` expansion
- If `{prompt}` is absent, quoted prompt is appended automatically
- Output may come from temp file or stdout

### Provider settings and defaults

Built-in providers are intentionally low-effort as of `2026-04-06`:

- Codex:
  - `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
  - model `gpt-5.4-mini`
  - stdin transport through trailing `exec -`
- Claude:
  - `exec claude --model haiku --effort low -p ...`
  - model `haiku`
  - effort `low`
  - prompt transport via CLI `-p`
- Default provider:
  - `VSmux.gitTextGenerationProvider = codex`

Config keys:

- `VSmux.gitTextGenerationProvider`
- `VSmux.gitTextGenerationCustomCommand`

Dependency links:

- `runShellCommand` from `./process`
- temp helpers `mkdtemp`, `readFile`, `rm`
- shell quoting from `../agent-shell-integration-utils`
- title length dependency on `GENERATED_SESSION_TITLE_MAX_LENGTH`

### Parsing, constraints, and preserved patterns

Error/parse rules:

- Empty outputs are fatal for commit messages, PR content, and session titles.
- Non-zero provider exits are wrapped with provider-specific text from `describeGitTextGenerationSettings`.
- Session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`.
- Tested title behavior remains under 25 chars.

Preserved patterns:

- conventional commit subject:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- fenced output stripping:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- patch file path extraction:
  - `^diff --git a\/(.+?) b\/(.+)$`
- safe unquoted shell args:
  - `^[a-z0-9._-]+$`

Prompt constraints by artifact type:

- Commit messages:
  - conventional commit type required
  - short lowercase specific scope
  - imperative summary `<= 40` chars
  - `3 to 8` concise bullets when meaningful
- PR content:
  - concise specific title
  - markdown body
  - short concrete `Summary` and `Testing`
- Session titles:
  - `2 to 4` words
  - specific/scannable
  - no quotes, markdown, commentary, trailing punctuation

### Relationship to terminal_workspace

`git_text_generation` intersects directly with `terminal_workspace/session_rename_title_auto_summarization.md`:

- shared concern: generated session titles
- `git_text_generation` documents low-effort provider defaults for general git text generation
- `terminal_workspace` documents high-effort provider settings and truncation/sanitization behavior for rename auto-summarization

## Important cross-entry relationships

### Session lifecycle cluster

Most operational behavior converges in `terminal_workspace`:

- `chat_history` resume actions feed terminal creation/resume flows.
- `git_text_generation` session-title generation feeds rename and presentation behavior.
- Title normalization, activity derivation, fork/reload/resume actions, and daemon persistence all meet in `terminal_workspace`.

Relevant drill-down:

- `terminal_workspace/current_state.md`
- `terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `terminal_workspace/sidebar_fork_session_behavior.md`
- `chat_history/viewer_search_and_resume_actions.md`
- `git_text_generation/low_effort_provider_settings.md`

### Branding and packaging cluster

Two packaging/branding surfaces coexist:

- `chat_history/vsmux_search_rename.md` — standalone VSmux Search package/view/command rename
- `terminal_workspace/vsmux_ai_devtools_integration.md` and `vsix_packaging_and_t3_embed_validation.md` — integrated VSmux extension packaging, asset inclusion, and embed validation

### Runtime efficiency cluster

A consistent pattern across the domain is minimizing unnecessary rebuild/repaint/re-hydration:

- hidden panes stay mounted
- startup uses embedded bootstrap instead of placeholders
- high-frequency title/activity changes use patch messages
- broker-driven focus no longer opens sidebar first
- browser-native `window.find` replaces custom search indexing
- bridge snapshots emit only on changed serialized state

## Drill-down guide

### For core architecture

- `terminal_workspace/current_state.md`
- `terminal_workspace/context.md`

### For persistence/runtime contracts

- `terminal_workspace/terminal_persistence_across_reloads.md`
- `terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `terminal_workspace/terminal_pane_runtime_thresholds_and_behaviors.md`

### For focus/order/sidebar behavior

- `terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
- `terminal_workspace/workspace_sidebar_interaction_state.md`
- `terminal_workspace/workspace_panel_focus_hotkeys.md`

### For title/session semantics

- `terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `terminal_workspace/session_rename_title_auto_summarization.md`
- `terminal_workspace/terminal_titles_activity_and_completion_sounds.md`

### For browser/T3/package integration

- `terminal_workspace/workspace_browser_t3_integration.md`
- `terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md`
- `terminal_workspace/vsix_packaging_and_t3_embed_validation.md`
- `terminal_workspace/vsmux_ai_devtools_integration.md`

### For conversation viewer/search/resume

- `chat_history/viewer_search_and_resume_actions.md`
- `chat_history/vsmux_search_rename.md`

### For provider command generation

- `git_text_generation/low_effort_provider_settings.md`
