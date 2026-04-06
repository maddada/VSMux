---
title: Default Agent Commands Overrides
tags: []
related:
  [
    architecture/terminal_workspace/session_rename_title_auto_summarization.md,
    architecture/terminal_workspace/sidebar_session_fork_support.md,
    architecture/terminal_workspace/current_state.md,
    facts/project/terminal_workspace_runtime_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T21:27:13.388Z"
updatedAt: "2026-04-06T21:27:13.388Z"
---

## Raw Concept

**Task:**
Document VSmux.defaultAgentCommands configuration and how built-in agent command overrides affect sidebar buttons and session resume or fork actions.

**Changes:**

- Added application-scope VSmux.defaultAgentCommands setting with string or null values per built-in agent id.
- Normalized configured override values by trimming strings and converting empty values to null.
- Applied default command overrides to sidebar default buttons only when no stored default agent preference exists.
- Upgraded legacy stored stock session commands to configured aliases during resume and fork command resolution while preserving explicit non-default stored commands.
- Maintained backward compatibility for legacy string-only stored session launch values by treating them as codex launches.

**Files:**

- extension/native-terminal-workspace/settings.ts
- shared/sidebar-agents.ts
- extension/sidebar-agent-preferences.ts
- extension/native-terminal-workspace-session-agent-launch.ts
- package.json

**Flow:**
read VSmux.defaultAgentCommands -> normalize per built-in agent -> build sidebar buttons with override fallback when no stored default exists -> resolve session launch command -> replace stored stock built-in command with configured alias when applicable -> generate resume, fork, or detached resume text

**Timestamp:** 2026-04-06

**Patterns:**

- `[^a-z0-9]+` (flags: g) - Custom sidebar agent id slug generation replaces non-alphanumeric runs with hyphens
- `^-+|-+$` (flags: g) - Custom sidebar agent id slug generation trims leading and trailing hyphens

## Narrative

### Structure

The settings layer in extension/native-terminal-workspace/settings.ts defines DEFAULT_AGENT_COMMANDS as a record for built-in ids t3, codex, copilot, claude, opencode, and gemini, then exposes getDefaultAgentCommands() and getDefaultAgentCommand() to provide normalized overrides. shared/sidebar-agents.ts consumes these overrides when creating default sidebar buttons, while extension/sidebar-agent-preferences.ts passes stored agents, stored ordering, and current default command overrides into createSidebarAgentButtons(). extension/native-terminal-workspace-session-agent-launch.ts separately resolves built-in agent ids and upgrades only legacy stored stock commands to configured aliases before constructing resume, fork, copy-resume, and detached-resume command text.

### Dependencies

This behavior depends on the built-in agent catalog in shared/sidebar-agents.ts, persisted sidebar preferences from extension/sidebar-agent-preferences.ts, and VS Code configuration values declared in package.json under VSmux.defaultAgentCommands. Session launch resolution also depends on built-in command lookup helpers and icon or agent-id based built-in resolution logic, with shell quoting handled by quoteForSingleShellArgument() when session titles are appended.

### Highlights

Configured overrides let users remap stock built-in commands such as codex to x or claude to cw without breaking existing stored sessions that still contain the original stock command. Stored default sidebar agents and explicit custom commands continue to win, so only legacy stock values are automatically upgraded. The package.json schema declares the setting as application-scope and nullable per built-in agent, which keeps built-in defaults intact unless a non-empty override string is configured.

### Rules

getDefaultAgentCommands() reads VSmux.defaultAgentCommands.
Invalid/non-object candidates return null values per built-in agent.
normalizeDefaultAgentCommandValue(candidate, agentId):

- returns null if candidate is not an object
- returns null if value is not a string
- trims string values
- returns null for empty trimmed strings
  Default command overrides apply only when no stored default agent entry exists.
  Stored commands remain authoritative.
  If stored command exists and exactly equals the built-in stock command, and a configured default override exists, use configured override.
  If stored command exists and is a non-default explicit command, preserve it.
  If no stored command exists, prefer configured default override, then fallback to icon-based default command.
  Legacy string launch values normalize to { agentId: "codex", command: normalizedCommand }.
  Built-in session launch resolution supports codex, claude, copilot, gemini, and opencode; t3 is not included in this resolution union.

### Examples

Example 1: If VSmux.defaultAgentCommands.codex = "x" and a stored session launch command is "codex", resume uses "x resume" and fork uses "x fork <title>".
Example 2: If VSmux.defaultAgentCommands.claude = "cw" and the stored session launch command is "claude", resume uses "cw -r" and fork uses "cw --fork-session -r <title>".
Example 3: If a stored launch command is already a custom explicit command, it is preserved exactly and is not replaced.
Example 4: If no stored default agent exists in sidebar preferences, the sidebar button command uses the configured override; otherwise the stored command remains in effect.

## Facts

- **default_agent_commands_setting**: VSmux.defaultAgentCommands is an application-scope object setting for built-in agents. [project]
- **default_agent_commands_defaults**: Built-in defaultAgentCommands entries default to null for t3, codex, copilot, claude, opencode, and gemini. [project]
- **default_agent_command_normalization**: Default agent command overrides are trimmed and empty strings normalize to null. [convention]
- **sidebar_default_agent_override_behavior**: Sidebar default agent buttons use configured default command overrides only when no stored default agent preference exists. [project]
- **session_agent_command_upgrade_behavior**: Session resume and fork command resolution upgrades legacy stock commands like codex and claude to configured aliases when the stored command exactly matches the built-in default command. [project]
- **stored_session_command_precedence**: Explicit non-default stored session commands are preserved exactly and are not replaced by configured default agent command overrides. [convention]
- **legacy_session_launch_normalization**: Legacy string-only stored session launches are normalized to agentId codex with the trimmed command. [project]
- **session_launch_supported_builtins**: Built-in session launch resolution supports codex, claude, copilot, gemini, and opencode, but not t3. [project]
