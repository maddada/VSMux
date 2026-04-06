---
title: Sidebar Fork Session Behavior Facts
tags: []
related: [architecture/terminal_workspace/sidebar_fork_session_behavior.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:40:45.456Z"
updatedAt: "2026-04-06T03:40:45.456Z"
---

## Raw Concept

**Task:**
Store factual recall items for sidebar fork, resume, full reload, and session agent launch behavior.

**Changes:**

- Added support matrix facts for copy resume, fork, and full reload.
- Added storage key, delay constant, and rename command facts.
- Added detached resume execution policy and browser session restriction facts.

**Files:**

- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- extension/native-terminal-workspace-session-agent-launch.ts

**Flow:**
source code behavior -> extracted factual statements -> facts/project recall entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry isolates the support matrix, persisted key names, command-generation behaviors, and UI restrictions described by the sidebar fork session implementation.

### Dependencies

Facts depend on the native terminal workspace controller, sortable session card UI, and session-agent-launch helper module.

### Highlights

The key recall items are that only Codex and Claude can fork or full reload, copy resume supports five agent types, and session launch metadata is persisted in workspace state under VSmux.sessionAgentCommands.

## Facts

- **sidebar_copy_resume_support**: Sidebar copy resume support is available for codex, claude, copilot, gemini, and opencode sessions. [project]
- **sidebar_fork_support**: Sidebar fork support is restricted to codex and claude sessions. [project]
- **sidebar_full_reload_support**: Sidebar full reload support is restricted to codex and claude sessions. [project]
- **fork_session_flow**: Forking creates a sibling terminal session, sends the fork command, and schedules a delayed rename. [project]
- **fork_rename_delay_ms**: FORK_RENAME_DELAY_MS is 4000 milliseconds. [project]
- **session_agent_commands_storage_key**: Session agent launches are persisted under workspace state key VSmux.sessionAgentCommands. [project]
- **browser_session_sidebar_restrictions**: Browser sessions cannot rename, fork, copy resume, or full reload from the sidebar context menu. [convention]
- **sidebar_close_labels**: Non-browser sessions use the context menu close label Terminate while browser sessions use Close. [convention]
- **full_reload_flow**: Full reload restarts the terminal session and replays the generated resume command. [project]
- **terminal_rename_command**: Rename for terminal sessions writes /rename <title> into the terminal after backend rename. [project]
- **detached_resume_execution_policy**: Detached resume actions execute immediately for codex and claude, but only suggest commands for gemini, opencode, and copilot. [project]
- **single_shell_argument_quoting**: Shell titles are quoted for single shell arguments using single-quote wrapping with embedded single-quote escaping. [project]
