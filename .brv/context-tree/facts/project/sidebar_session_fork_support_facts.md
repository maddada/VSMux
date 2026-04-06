---
title: Sidebar Session Fork Support Facts
tags: []
related: [architecture/terminal_workspace/sidebar_session_fork_support.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:39:08.442Z"
updatedAt: "2026-04-06T03:39:08.442Z"
---

## Raw Concept

**Task:**
Capture concrete implementation facts for sidebar session fork support.

**Changes:**

- Recorded fork commands, eligibility constraints, message names, file touch points, and user-visible validation text.

**Files:**

- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- extension/native-terminal-workspace-session-agent-launch.ts
- shared/session-grid-contract-sidebar.ts
- extension/native-terminal-workspace/sidebar-message-dispatch.ts

**Flow:**
single-pass RLM context review -> extract concrete facts -> dedup -> group by subject -> persist facts entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry groups 32 deduplicated implementation facts into 28 subject buckets for recall. It keeps exact commands, constants, file paths, and visible strings so the fork feature can be referenced without reopening the original implementation summary.

### Dependencies

These facts depend on the sidebar fork support changes documented in the terminal workspace architecture topic and mirror the same touched files and command semantics.

### Highlights

The stored facts capture forkSession contract changes, controller ordering behavior, command-builder specifics for Codex and Claude, the delayed rename step, and the exact eligibility and validation constraints.

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
