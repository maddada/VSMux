---
children_hash: 7f990eac692cda73fff5117ce90cfc18e1ae81a218abf0f2a2c592aa4c21429a
compression_ratio: 0.5268978132535129
condensation_order: 3
covers: [architecture/_index.md, facts/_index.md, terminal-workspace-current-state.md]
covers_token_total: 12027
summary_level: d3
token_count: 6337
type: summary
---

# Knowledge Structure Overview

This knowledge set is organized into three complementary layers:

- `architecture/_index.md` — long-form architectural decisions and cross-topic relationships
- `facts/_index.md` — compact quick-recall invariants, constants, support matrices, and config defaults
- `terminal-workspace-current-state.md` — current implementation snapshot for terminal workspace behavior

Together they describe the VSmux system around terminal workspace runtime management, chat-history/search/resume, git-backed text generation, packaging/integration surfaces, and exact operational constraints.

## Top-Level Domains

### `architecture`

Primary narrative architecture domain covering:

- `terminal_workspace`
- `chat_history`
- `git_text_generation`

Core recurring patterns across these topics:

- webview/UI layer for presentation, extension/controller layer for authority and runtime ownership
- stable identifiers with lightweight replay instead of rebuilding state
- disconnected-friendly UI that preserves enough metadata for useful reload/reconnect behavior
- low-retention webviews where `retainContextWhenHidden: false` is often preferred to avoid stale/bad state

See:

- `architecture/context.md`
- `architecture/terminal_workspace/_index.md`
- `architecture/chat_history/_index.md`
- `architecture/git_text_generation/_index.md`

### `facts`

Quick-reference facts layer, mainly aggregated under `facts/project/_index.md`, preserving:

- constants and thresholds
- support/exclusion matrices
- config keys and defaults
- exact regexes and command formats
- packaging and identity details
- implementation invariants

This mirrors the architecture domain but in compressed factual form.

### `terminal-workspace-current-state.md`

A focused current-state narrative for the workspace terminal subsystem. It overlaps heavily with `architecture/terminal_workspace/*` and `facts/project/*`, but emphasizes implemented behavior and lessons learned.

---

# Major Knowledge Clusters

## 1. Terminal workspace runtime and pane model

Primary entries:

- `architecture/terminal_workspace/current_state.md`
- `terminal-workspace-current-state.md`
- `facts/project/terminal_workspace_facts.md`
- `facts/project/terminal_workspace_runtime_facts.md`

Key structural decisions:

- Frontend renderer is `restty`/`Restty`, not xterm.
- Terminal frontend runtimes are cached per `sessionId` in `workspace/terminal-runtime-cache.ts`.
- Cache invalidation is generation-based via `renderNonce`.
- Session removal must explicitly destroy runtime so recycled `sessionId` values cannot inherit old transcripts.
- Sessions from all groups are projected into the workspace so cross-group switching keeps terminals warm.
- Inactive panes remain mounted behind the active pane in the same layout slot, avoiding reconnect/replay and reducing visual instability.
- Visible split ordering comes from `activeGroup.snapshot.visibleSessionIds`; `localPaneOrder` is only a temporary override for optimistic reorder UX.

Important relationship:

- `terminal-workspace-current-state.md` is effectively the current implementation-focused condensation of the broader `architecture/terminal_workspace/current_state.md` cluster.

## 2. Persistence, detached daemon, and replay/reconnect lifecycle

Primary entries:

- `architecture/terminal_workspace/terminal_persistence_across_reloads.md`
- `architecture/terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `facts/project/terminal_persistence_reload_facts.md`
- `facts/project/terminal_persistence_across_vs_code_reloads_facts.md`

Core architecture:

- Persistence uses a three-part model:
  - extension-side layout/session state
  - detached per-workspace daemon
  - restored webview/workspace with terminal renderers
- Layout persistence key: `VSmux.sessionGridSnapshot`
- Daemon is per-workspace, not global.
- PTYs survive VS Code reloads.
- Restore sequence consistently follows:
  - state restore
  - daemon reconnect
  - session reconnect
  - `terminalReady` handshake
  - ring-buffer replay
  - pending-output flush

Important constants retained across summaries/facts:

- control connect timeout: `3000ms`
- daemon ready timeout: `10000ms`
- owner heartbeat: `5000ms`
- owner timeout: `20000ms`
- startup/launch stale threshold or grace: `30000ms`
- attach ready timeout: `15000ms`
- ring buffer: `8 MiB`
- replay chunk size: `128 KiB`

Current-state nuance from `terminal-workspace-current-state.md`:

- sidebar-listed terminal sessions should remain alive while VS Code is running, even when sidebar/workarea are closed
- if a live daemon PTY exists, VSmux must reattach rather than run a resume command
- persisted state stores `agentName`, `agentStatus`, and `title` so cold-start sidebar presentation remains useful without a live daemon

## 3. Workspace startup, bootstrap, and recovery behavior

Primary entries:

- `architecture/terminal_workspace/workspace_panel_startup_without_placeholder.md`
- `architecture/terminal_workspace/workspace_panel_startup_without_loading_placeholder.md`
- `facts/project/workspace_panel_startup_bootstrap_facts.md`
- `facts/project/workspace_panel_startup_without_loading_placeholder_facts.md`
- `facts/project/workspace_panel_startup_without_placeholder_facts.md`
- `terminal-workspace-current-state.md`

Key decisions:

- placeholder loading UI was removed
- startup uses embedded bootstrap state via `window.__VSMUX_WORKSPACE_BOOTSTRAP__`
- `openWorkspace` reveals sidebar before panel reveal
- if no sessions exist, create one before showing the panel; otherwise refresh state first
- panel-side buffering preserves:
  - `latestMessage`
  - `latestRenderableMessage`
- only `hydrate` and `sessionState` are treated as renderable messages
- replay order prioritizes latest renderable state, then latest transient message if distinct
- one-shot `autoFocusRequest` is stripped before replay

Recovery and lag handling from `terminal-workspace-current-state.md`:

- scheduler-lag recovery exists for terminal panes
- lag detector is currently only active when `debuggingMode` is enabled
- threshold is average timer overshoot of at least `1000ms` during the first 10 seconds while visible/focused
- `AUTO_RELOAD_ON_LAG` is enabled
- auto reload is limited to once per workarea boot
- focus is restored by preserving the last active `sessionId` through `reloadWorkspacePanel`
- dormant reload notice UI remains as fallback if auto reload is disabled

## 4. Focus ownership, pane ordering, drag semantics, and hotkeys

Primary entries:

- `architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
- `architecture/terminal_workspace/workspace_sidebar_interaction_state.md`
- `architecture/terminal_workspace/workspace_focus_debugging.md`
- `architecture/terminal_workspace/workspace_panel_focus_hotkeys.md`
- `facts/project/workspace_focus_and_drag_runtime_facts.md`
- `facts/project/workspace_sidebar_interaction_facts.md`
- `facts/project/workspace_focus_debugging_facts.md`
- `facts/project/workspace_panel_focus_hotkeys_facts.md`

Core ownership model:

- `WorkspaceApp` is the authoritative owner of focus decisions.
- `TerminalPane` only emits activation intent such as:
  - `onActivate("pointer")`
  - `onActivate("focusin")`
- app-level state decides whether to send `focusSession`.

Key thresholds and interaction rules:

- auto-focus guard: `400ms`
- sidebar reorder should not happen on ordinary clicking
- reorder requires real pointer movement crossing threshold
- primary reorder threshold: `8px`
- startup interaction block: `1500ms`
- non-touch drag activation: `6px`
- touch drag activation: `250ms` delay with `5px` tolerance
- hold-to-drag: `130ms` delay with `12px` tolerance

Debug/console behavior:

- browser console debug logging is intentionally suppressed via a no-op `logWorkspaceDebug(enabled, _event, _payload)` shim
- extension-side logging may still capture events
- panel focus routing includes context key `vsmux.workspacePanelFocus`

Current-state reinforcement:

- the explicit lesson is to keep sidebar reorder behind proof of actual pointer movement, not drag-library inference alone

## 5. Grouped workspace state and session identity normalization

Primary entries:

- `architecture/terminal_workspace/simple_grouped_session_workspace_state.md`
- `facts/project/simple_grouped_session_workspace_state_facts.md`

Canonical file anchors:

- `shared/simple-grouped-session-workspace-state.ts`
- `shared/simple-grouped-session-workspace-state.test.ts`

Structural rules preserved:

- at least one group always exists
- browser sessions are removed from grouped terminal normalization
- session IDs canonicalize to `session-${formatSessionDisplayId(displayId ?? 0)}`
- duplicate generated display IDs are repaired
- active-group fallback prefers nearest previous non-empty group, then next
- new sessions get the first free display ID
- group indexing is 1-based
- visible session IDs are restored on group focus
- destination group becomes active when moving a session
- group count is bounded by `MAX_GROUP_COUNT`
- equality check is strict `JSON.stringify(left) === JSON.stringify(right)`

This cluster is the canonical source for normalization and identity invariants that the workspace runtime depends on.

## 6. Sleep/wake, visibility, and runtime preservation

Primary entries:

- `architecture/terminal_workspace/workspace_session_sleep_wake_support.md`
- `facts/project/workspace_session_sleep_wake_support_facts.md`

Key rules:

- `isSleeping` persists on session records
- sleeping sessions are excluded from focus and visible split calculations
- focusing a sleeping session wakes it
- group sleep/wake ignores browser sessions
- sleeping terminal sessions dispose live runtime surfaces but preserve resume metadata

This fits the broader “preserve expensive identity/state, release presentation when possible” pattern seen throughout terminal workspace.

## 7. Titles, activity detection, sounds, and rename auto-summarization

Primary entries:

- `architecture/terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `architecture/terminal_workspace/session_rename_title_auto_summarization.md`
- `architecture/terminal_workspace/terminal_titles_activity_and_completion_sounds.md`
- `architecture/terminal_workspace/title_activity_and_sidebar_runtime.md`
- `facts/project/terminal_title_normalization_facts.md`
- `facts/project/session_rename_title_auto_summarization_facts.md`

Title normalization and precedence:

- canonical sanitizer: `normalizeTerminalTitle()`
- leading glyph stripping regex:
  `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+`
- path-like titles beginning with `~` or `/` are hidden from visible-title selection
- generated `Session N` titles are not preferred visible titles
- precedence:
  - visible terminal title
  - visible user/session title
  - `undefined`

Auto-summarization contract:

- trigger only when `title.trim().length > 25`
- threshold: `25`
- max/clamp length: `24`
- output should be 2–4 words, plain text, no quotes, no markdown, no commentary, no trailing punctuation
- result cleanup strips fences, wrapping quotes, extra whitespace, trailing periods, and prefers whole-word truncation

Provider split to note:

- terminal rename auto-summarization uses high-effort settings:
  - Codex: `gpt-5.4-mini` with high reasoning effort
  - Claude: `haiku` with high effort
- this is intentionally distinct from low-effort git text generation defaults in `git_text_generation`

Activity/sound model:

- activity is title-driven for CLI agents
- marker families are preserved for Claude, Codex, Gemini, and Copilot
- Claude/Codex require observed title transitions before spinner implies working
- stale spinner timeout: `3000ms`
- attention requires at least `3000ms` of prior work
- completion sound delay: `1000ms`
- high-frequency title/activity updates use patch messages instead of full rehydrates

## 8. Session actions, forking, resume, reload, and default command overrides

Primary entries:

- `architecture/terminal_workspace/sidebar_session_fork_support.md`
- `architecture/terminal_workspace/sidebar_fork_session_behavior.md`
- `architecture/terminal_workspace/default_agent_commands_overrides.md`
- `facts/project/sidebar_session_fork_support_facts.md`
- `facts/project/sidebar_fork_session_behavior_facts.md`
- `facts/project/default_agent_commands_override_facts.md`

Support matrix:

- Copy resume: `codex`, `claude`, `copilot`, `gemini`, `opencode`
- Fork: `codex`, `claude`
- Full reload: `codex`, `claude`
- Browser sessions cannot rename, fork, copy resume, or full reload

Fork flow:

1. sidebar posts `{ type: "forkSession", sessionId }`
2. controller validates source session/group/title/command
3. creates sibling in same group
4. reuses agent and launch metadata
5. inserts new session after source
6. writes fork command
7. schedules delayed rename after `4000ms`

Fork commands:

- `codex fork '<title>'`
- `claude --fork-session -r '<title>'`

Default command override rules:

- setting: `VSmux.defaultAgentCommands`
- built-ins: `t3`, `codex`, `copilot`, `claude`, `opencode`, `gemini`
- empty string normalizes to `null`
- stored explicit commands override configured defaults
- legacy stock commands may upgrade only when stored value exactly matches prior stock default
- built-in launch resolution excludes `t3`

Relationship:

- chat-history resume and workspace reattach semantics intersect here; resume commands should only run when backend recreation truly happened

## 9. Browser/T3/workspace integration and managed runtime upgrade

Primary entries:

- `architecture/terminal_workspace/workspace_browser_t3_integration.md`
- `architecture/terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md`
- `facts/project/workspace_browser_t3_integration_facts.md`
- `facts/project/t3_managed_runtime_upgrade_facts.md`

Core workspace/browser/T3 facts:

- browser group ID: `browser-tabs`
- workspace panel identity:
  - type: `vsmux.workspace`
  - title: `VSmux`
  - icon/resource roots include `media/icon.svg`, `out/workspace`, `forks/t3code-embed/dist`
- default T3 websocket URL: `ws://127.0.0.1:3774/ws`
- T3 monitor uses `orchestration.getSnapshot` and `subscribeOrchestrationDomainEvents`
- request timeout: `15000ms`
- reconnect delay: `1500ms`
- refresh debounce: `100ms`
- sidebar browser listings exclude internal VSmux workspace and T3-owned tabs
- group state trusts authoritative `sessionIdsByGroup` payloads
- T3 focus acknowledgement is completion-marker-aware through `acknowledgeThread`

Managed runtime upgrade invariants:

- managed runtime port: `3774`
- legacy runtime port: `3773`
- entrypoint:
  `forks/t3code-embed/upstream/apps/server/src/bin.ts`
- protocol requires:
  - websocket route `/ws`
  - numeric string request IDs
  - `Ping` / `Pong`
  - streaming frames `Chunk`, `Ack`, `Exit`
- mixed-install recovery requires syncing tested `upstream`, `overlay`, and `dist` back from an isolated worktree

## 10. Packaging, extension identity, and AI DevTools integration

Primary entries:

- `architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md`
- `architecture/terminal_workspace/vsmux_ai_devtools_integration.md`
- `facts/project/vsmux_packaging_and_embed_validation_facts.md`
- `facts/project/vsmux_ai_devtools_integration_facts.md`

VSmux package/extension identity:

- display name: `VSmux - T3code & Agent CLIs Manager`
- publisher: `maddada`
- main: `./out/extension/extension.js`
- repository: `https://github.com/maddada/VSmux.git`
- icon: `media/VSmux-marketplace-icon.png`
- version: `2.6.0`
- VS Code engine: `^1.100.0`
- package manager: `pnpm@10.14.0`

Activation/container structure:

- primary Activity Bar container: `VSmuxSessions`
- primary view: `VSmux.sessions`
- secondary container: `VSmuxSessionsSecondary`
- activation events include `onStartupFinished`, `onView:VSmux.sessions`, `onWebviewPanel:vsmux.workspace`

Packaging/build decisions:

- packaging script: `scripts/vsix.mjs`
- modes: `package`, `install`
- build command: `pnpm run compile`
- `vsce package` uses `--no-dependencies --skip-license --allow-unused-files-pattern`
- packaged assets include `forks/t3code-embed/dist/**`, `out/workspace/**`, `out/**`, `media/**`
- installed embed asset hash should be verified under `~/.vscode/extensions/.../forks/t3code-embed/dist/assets/index-*.js`

AI DevTools/chat-history integration:

- VSmux is the single shipped extension host
- `activateChatHistory(context)` runs before workspace controller setup
- `aiDevtools.conversations` is registered under `VSmuxSessions`
- chat-history build output: `chat-history/dist`
- `ai-devtools.suspend` disposes panel, clears sidebar cache, and marks suspended state for memory release

## 11. Chat history viewer, search, resume, and VSmux Search rename

Primary entries:

- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `architecture/chat_history/vsmux_search_rename.md`
- `facts/project/viewer_search_and_resume_actions_facts.md`
- `facts/project/vsmux_search_rename_facts.md`

Viewer/search architecture:

- webview UI:
  - `chat-history/src/webview/App.tsx`
  - `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- extension logic:
  - `chat-history/src/extension/extension.ts`
- search uses browser-native `window.find`
- `Cmd/Ctrl+F` opens custom search bar
- Enter/Shift+Enter drive next/previous match
- Escape closes search
- search wraps around
- query changes reset selection/scroll state
- explicit status exists for empty query and failed match
- invalid JSONL/schema lines normalize to `x-error` records
- viewer panel uses `retainContextWhenHidden: false`

Resume contract:

- webview posts `resumeSession`
- payload includes `source`, `sessionId`, optional `cwd`
- resume only enabled when source can be inferred and session metadata parsed
- source inference:
  - `/.codex/`, `/.codex-profiles/` -> `Codex`
  - `/.claude/`, `/.claude-profiles/` -> `Claude`
- commands:
  - `claude --resume <sessionId>`
  - `codex resume <sessionId>`
- session IDs are shell-quoted with `quoteShellLiteral`
- terminal name for resumed terminal: `AI DevTools Resume (<source>)`

VSmux Search rename/package layer:

- command namespace: `VSmuxSearch.*`
- view ID: `VSmuxSearch.conversations`
- view label: `VSmux Search`
- panel type: `vsmuxSearchViewer`
- standalone package: `vsmux-search-vscode`
- publisher: `vsmux-search`
- version: `1.1.0`
- activity bar container: `vsmux-search`
- activation event: `onView:VSmuxSearch.conversations`

Export/filter behavior:

- export filename: `vsmux-search-export-${sessionId}.md`
- preserves metadata and message categories
- groups Chrome MCP tools into option keys
- unknown tools are included by default
- recent-only cutoff is 7 days and only applies when no all-time mode and no filter text are active
- filter debounce in facts layer: `150ms`

Relationship to workspace:

- resume launches into the same terminal/session runtime architecture described in `terminal_workspace/current_state.md` and `workspace_browser_t3_integration.md`

## 12. Git text generation provider architecture

Primary entries:

- `architecture/git_text_generation/low_effort_provider_settings.md`
- `facts/project/git_text_generation_low_effort_provider_facts.md`

Primary files:

- `extension/git/text-generation-utils.ts`
- `extension/git/text-generation.ts`
- `extension/git/text-generation.test.ts`
- `package.json`

Execution flow:

1. build prompt
2. append output instructions
3. build provider shell command
4. run shell command
5. read output from temp file or stdout
6. parse and sanitize
7. return commit message, PR content, or session title

Provider/default configuration:

- setting key: `VSmux.gitTextGenerationProvider`
- custom command setting: `VSmux.gitTextGenerationCustomCommand`
- supported providers: `codex`, `claude`, `custom`
- default provider: `codex`
- runtime timeout: `180000ms`

Built-in provider defaults are intentionally low-effort as of `2026-04-06`:

- Codex:
  - `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
- Claude:
  - `exec claude --model haiku --effort low -p ...`

Preserved parsing/prompt rules:

- empty output is fatal
- non-zero exits are wrapped with provider-specific diagnostics
- session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`
- tested title behavior remains under 25 chars
- preserved regexes include:
  - conventional commit subject:
    `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
  - fenced output stripping:
    `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
  - patch file path extraction:
    `^diff --git a\/(.+?) b\/(.+)$`
  - safe unquoted shell args:
    `^[a-z0-9._-]+$`

Artifact-specific prompt constraints:

- commit messages: conventional type, short lowercase scope, imperative summary `<= 40` chars, `3 to 8` bullets when meaningful
- PR content: concise title plus markdown `Summary` and `Testing`
- session titles: `2 to 4` words, specific/scannable, no quotes/markdown/commentary/trailing punctuation

Cross-topic relationship:

- `git_text_generation/low_effort_provider_settings.md` covers general git text generation defaults
- `terminal_workspace/session_rename_title_auto_summarization.md` covers a separate high-effort path for workspace rename auto-summarization

---

# Cross-Cutting Patterns

## Stable identity + minimal replay

Repeated across `terminal_workspace`, `chat_history`, and bridge integrations:

- cache by stable identifiers like `sessionId`
- replay only enough buffered state to restore UX
- emit updates only when serialized payload changes
- avoid unnecessary full rehydration

Referenced in:

- `architecture/terminal_workspace/current_state.md`
- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `facts/project/agent_manager_x_bridge_integration_facts.md`

## Centralized authority, event-oriented children

Common ownership split:

- child UI components emit intent
- controllers/app-level owners decide state transitions, focus, runtime lifecycle, and external effects

Examples:

- `WorkspaceApp` vs `TerminalPane`
- chat-history webview vs `chat-history/src/extension/extension.ts`
- `NativeTerminalWorkspaceController` owning daemon/T3/bridge integrations

## Low-retention webviews for resilience

A strong design choice across workspace and viewer surfaces:

- `retainContextWhenHidden: false` is used to prefer reconstruction over retaining stale state
- applies to workspace panels, chat-history viewer, and related surfaces

Referenced in:

- `terminal-workspace-current-state.md`
- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `facts/project/vsmux_ai_devtools_integration_facts.md`

## Exact thresholds and support matrices as first-class knowledge

The facts layer systematically preserves:

- timeouts and debounce windows
- drag/focus thresholds
- support matrices for fork/resume/reload
- exact command forms, config keys, regexes, and package identities

This makes `facts/project/_index.md` the fastest drill-down target for implementation constants.

---

# Drill-Down Guide

## For terminal runtime architecture

- `architecture/terminal_workspace/current_state.md`
- `terminal-workspace-current-state.md`
- `facts/project/terminal_workspace_facts.md`
- `facts/project/terminal_workspace_runtime_facts.md`

## For persistence and reload semantics

- `architecture/terminal_workspace/terminal_persistence_across_reloads.md`
- `architecture/terminal_workspace/terminal_persistence_across_vs_code_reloads.md`
- `facts/project/terminal_persistence_reload_facts.md`
- `facts/project/terminal_persistence_across_vs_code_reloads_facts.md`

## For focus, pane ordering, and sidebar interaction

- `architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md`
- `architecture/terminal_workspace/workspace_sidebar_interaction_state.md`
- `facts/project/workspace_focus_and_drag_runtime_facts.md`
- `facts/project/workspace_sidebar_interaction_facts.md`

## For titles, activity, rename, and session actions

- `architecture/terminal_workspace/terminal_title_normalization_and_session_actions.md`
- `architecture/terminal_workspace/session_rename_title_auto_summarization.md`
- `architecture/terminal_workspace/terminal_titles_activity_and_completion_sounds.md`
- `facts/project/terminal_title_normalization_facts.md`
- `facts/project/session_rename_title_auto_summarization_facts.md`
- `facts/project/sidebar_fork_session_behavior_facts.md`

## For browser/T3 and packaging

- `architecture/terminal_workspace/workspace_browser_t3_integration.md`
- `architecture/terminal_workspace/t3_managed_runtime_upgrade_and_recovery.md`
- `architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md`
- `facts/project/workspace_browser_t3_integration_facts.md`
- `facts/project/t3_managed_runtime_upgrade_facts.md`
- `facts/project/vsmux_packaging_and_embed_validation_facts.md`

## For chat-history search/resume and VSmux Search

- `architecture/chat_history/viewer_search_and_resume_actions.md`
- `architecture/chat_history/vsmux_search_rename.md`
- `facts/project/viewer_search_and_resume_actions_facts.md`
- `facts/project/vsmux_search_rename_facts.md`

## For git provider command generation

- `architecture/git_text_generation/low_effort_provider_settings.md`
- `facts/project/git_text_generation_low_effort_provider_facts.md`
