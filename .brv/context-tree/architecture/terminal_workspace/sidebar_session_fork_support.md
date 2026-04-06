---
title: Sidebar Session Fork Support
tags: []
related:
  [
    architecture/terminal_workspace/workspace_sidebar_interaction_state.md,
    architecture/terminal_workspace/terminal_titles_activity_and_sidebar_runtime.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:39:08.440Z"
updatedAt: "2026-04-06T03:39:08.440Z"
---

## Raw Concept

**Task:**
Add sidebar session fork support for eligible Codex and Claude terminal sessions in the terminal workspace sidebar.

**Changes:**

- Added a Fork context-menu action to sidebar session cards.
- Added forkSession to the shared sidebar message contract and dispatch path.
- Implemented controller-side session fork creation, metadata reuse, session reordering, backend attach, command write, and delayed rename.
- Added buildForkAgentCommand for Codex and Claude-specific fork command generation.
- Preserved existing resume and copy-resume builders alongside the new fork flow.

**Files:**

- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- extension/native-terminal-workspace-session-agent-launch.ts
- shared/session-grid-contract-sidebar.ts
- extension/native-terminal-workspace/sidebar-message-dispatch.ts

**Flow:**
sidebar context menu -> post forkSession -> controller validates source session, group, title, and command -> focus source group -> create session -> copy agent metadata -> reorder after source if needed -> persist launch state -> refresh sidebar -> attach backend -> write fork command -> schedule delayed rename

**Timestamp:** 2026-04-06

**Patterns:**

- `^forkSession$` - Sidebar message type for fork requests
- `^codex fork .+$` - Codex fork command format
- `^claude --fork-session -r .+$` - Claude fork command format
- `^/rename fork .+$` - Delayed rename command format after forking

## Narrative

### Structure

Fork support is implemented across the sidebar UI, the shared sidebar message contract, the sidebar dispatch layer, the terminal workspace controller, and the session agent launch helper. The UI computes canForkSession only for non-browser sessions backed by Codex or Claude, exposes a Fork menu item with IconGitFork, and posts a forkSession message. The controller validates terminal-session eligibility, creates a new session in the same group, preserves source launch and icon metadata, and explicitly reorders the new session so it appears immediately after the source when store creation order does not already match that requirement.

### Dependencies

The implementation depends on existing sidebar agent icon tracking, stored agent launch metadata, title resolution via getPreferredSessionTitle and resolveResumeTitle, shell-safe quoting through quoteForSingleShellArgument, workspace store focus/create/sync methods, and backend createOrAttachSession plus writeText. It also relies on the shared SidebarToExtensionMessage union and SidebarMessageHandlers typing so UI dispatch and extension handling stay aligned.

### Highlights

Codex forks execute `codex fork <preferred title>` and Claude forks execute `claude --fork-session -r <preferred title>`. The controller schedules a delayed `/rename fork <preferred title>` using `FORK_RENAME_DELAY_MS = 4_000`. The user-visible validation error is preserved exactly as "Fork is only available for Codex and Claude sessions that have a visible title." Existing resume and copy-resume behaviors remain intact, with copy resume still supporting Codex, Claude, Copilot, Gemini, and Opencode.

### Rules

Fork available only when:

- session exists
- session is not a browser session
- `supportsFork(session)` is true
- agent icon is `codex` or `claude`
- source session is a terminal session
- source group exists
- preferred visible title exists
- `buildForkAgentCommand(...)` returns a command

Full reload remains limited to `codex` or `claude`.
Copy resume supports `codex`, `claude`, `copilot`, `gemini`, `opencode`.

### Examples

The sidebar posts `{ sessionId: session.sessionId, type: "forkSession" }` from the context menu. `supportsFork(session)` is implemented as `session.agentIcon === "codex" || session.agentIcon === "claude"`. The dispatch layer handles `case "forkSession":` by awaiting `handlers.forkSession(message.sessionId)`.

## Facts

- **fork_ui_action**: A sidebar session-card context-menu action named Fork was added for Codex and Claude terminal sessions. [project]
- **fork_message_type**: The sidebar posts a forkSession message when a fork is requested. [project]
- **fork_session_position**: The controller creates a new terminal session in the same group directly after the source session. [project]
- **fork_metadata_reuse_icon**: Forked sessions reuse source agent metadata from sidebarAgentIconBySessionId. [project]
- **fork_metadata_reuse_launch**: Forked sessions reuse source agent metadata from sessionAgentLaunchBySessionId. [project]
- **codex_fork_command**: Codex fork commands use the format codex fork <preferred title>. [project]
- **claude_fork_command**: Claude fork commands use the format claude --fork-session -r <preferred title>. [project]
- **fork_rename_command**: After a short delay, the controller sends /rename fork <preferred title>. [project]
- **fork_validation_location**: Validation and dispatch for forking live in the sidebar message contract. [project]
- **fork_test_coverage**: Tests cover fork command building and sidebar message routing. [project]
- **fork_rename_delay_ms**: FORK_RENAME_DELAY_MS is set to 4_000 in extension/native-terminal-workspace/controller.ts. [project]
- **fork_supported_agents**: supportsFork(session) returns true only when session.agentIcon is codex or claude. [project]
- **fork_browser_exclusion**: The sidebar context menu does not allow fork for browser sessions. [project]
- **fork_menu_sizing**: The sidebar menu sizing logic includes canForkSession when computing context menu height. [project]
- **fork_menu_icon**: The Fork menu item uses IconGitFork from @tabler/icons-react. [project]
- **fork_builder_validation**: buildForkAgentCommand returns undefined when agentId, agentCommand, or forkTitle is missing. [project]
- **fork_builder_codex_impl**: buildForkAgentCommand returns `${agentCommand} fork ${quotedForkTitle}` for Codex. [project]
- **fork_builder_claude_impl**: buildForkAgentCommand returns `${agentCommand} --fork-session -r ${quotedForkTitle}` for Claude. [project]
- **shell_quote_helper**: quoteForSingleShellArgument wraps the value in single quotes and escapes embedded single quotes. [project]
- **stored_session_agent_launch_fields**: StoredSessionAgentLaunch contains agentId and command fields. [project]
- **sidebar_contract_fork_variant**: SidebarToExtensionMessage now includes a { type: "forkSession", sessionId: string } variant. [project]
- **sidebar_dispatch_handler**: SidebarMessageHandlers includes forkSession: (sessionId: string) => Promise<void>. [project]
- **sidebar_dispatch_case**: sidebar-message-dispatch handles the forkSession case by calling handlers.forkSession(message.sessionId). [project]
- **fork_eligibility_rules**: Fork is available only when the session exists, is not a browser session, supportsFork(session) is true, the agent icon is codex or claude, the source session is terminal, the source group exists, a preferred visible title exists, and buildForkAgentCommand returns a command. [convention]
- **full_reload_supported_agents**: Full reload remains limited to codex or claude. [project]
- **copy_resume_supported_agents**: Copy resume supports codex, claude, copilot, gemini, and opencode. [project]
- **fork_user_visible_error**: The user-visible fork validation error is "Fork is only available for Codex and Claude sessions that have a visible title." [project]
- **fork_file**: Fork support touches extension/native-terminal-workspace/controller.ts. [project]
- **fork_file**: Fork support touches sidebar/sortable-session-card.tsx. [project]
- **fork_file**: Fork support touches extension/native-terminal-workspace-session-agent-launch.ts. [project]
- **fork_file**: Fork support touches shared/session-grid-contract-sidebar.ts. [project]
- **fork_file**: Fork support touches extension/native-terminal-workspace/sidebar-message-dispatch.ts. [project]
