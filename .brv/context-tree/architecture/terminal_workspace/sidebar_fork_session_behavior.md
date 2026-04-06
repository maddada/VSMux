---
title: Sidebar Fork Session Behavior
tags: []
related:
  [
    architecture/terminal_workspace/workspace_sidebar_interaction_state.md,
    architecture/terminal_workspace/terminal_titles_activity_and_sidebar_runtime.md,
    facts/project/terminal_workspace_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:40:45.455Z"
updatedAt: "2026-04-06T03:40:45.455Z"
---

## Raw Concept

**Task:**
Document sidebar-driven terminal session fork, resume command, full reload, and context-menu behavior for the native terminal workspace.

**Changes:**

- Documented controller flow for sidebar fork session creation and delayed rename scheduling.
- Captured sidebar context-menu capability matrix for copy resume, fork, full reload, rename, and T3 thread ID actions.
- Recorded persisted session agent launch metadata behavior and command generation rules for built-in and custom agents.

**Files:**

- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- extension/native-terminal-workspace-session-agent-launch.ts

**Flow:**
sidebar context menu or command -> controller validates session kind and capabilities -> create/restart/rename/copy command action -> backend writeText or clipboard/update side effects -> sidebar and workspace refresh

**Timestamp:** 2026-04-06

**Patterns:**

- `/\/rename\s+.+/` - Terminal rename command emitted after session rename for terminal sessions.
- `'${value.replaceAll("'", "'\"'\"'")}'` - Single-shell-argument quoting strategy used for fork and resume titles.

## Narrative

### Structure

NativeTerminalWorkspaceController coordinates sidebar actions, workspace panel messages, session ordering, persisted agent-launch metadata, and terminal backend commands. SortableSessionCard exposes the sidebar UI affordances and message posts for rename, fork, copy resume, full reload, close, and T3 thread ID, while native-terminal-workspace-session-agent-launch.ts centralizes command generation and persistence rules.

### Dependencies

Fork, full reload, and resume command generation depend on stored or default agent command resolution, preferred session title resolution, terminal session availability, and workspace group ordering. The controller also depends on SessionGridStore, DaemonTerminalWorkspaceBackend, T3ActivityMonitor, WorkspacePanelManager, and VS Code workspace state persistence.

### Highlights

Forking is limited to Codex and Claude sessions with a visible preferred title, inherits agent icon and stored launch metadata, inserts the new session immediately after the source, sends the fork command, and schedules a delayed rename after 4 seconds. Copy resume supports Codex, Claude, Copilot, Gemini, and OpenCode, while full reload is limited to Codex and Claude and performs restart plus resume replay.

### Rules

Fork is only available for Codex and Claude sessions that have a visible title.
Full reload is only available for Codex and Claude sessions.
No resume command is available for this session.
Commit title cannot be empty.
Browser sessions cannot rename, fork, copy resume, or full reload and use the close label "Close".
Non-browser sessions use the terminate label "Terminate".
Context menu disables drag while open.

### Examples

Codex resume command: <command> resume '<title>'.
Claude resume command: <command> -r '<title>'.
Codex fork command: <command> fork '<title>'.
Claude fork command: <command> --fork-session -r '<title>'.
Gemini detached resume suggestion: <command> -r .
OpenCode detached resume suggestion: <command> -s .
Copilot detached resume suggestion: <command> --resume .

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
