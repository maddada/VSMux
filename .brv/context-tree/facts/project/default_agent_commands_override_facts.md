---
title: Default Agent Commands Override Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T21:27:13.389Z"
updatedAt: "2026-04-06T21:27:13.389Z"
---

## Raw Concept

**Task:**
Capture factual configuration and precedence details for VSmux.defaultAgentCommands and session command resolution.

**Changes:**

- Recorded the setting scope, defaults, normalization rules, and precedence behavior for built-in agent command overrides.

**Files:**

- extension/native-terminal-workspace/settings.ts
- shared/sidebar-agents.ts
- extension/sidebar-agent-preferences.ts
- extension/native-terminal-workspace-session-agent-launch.ts
- package.json

**Flow:**
configuration declared -> values normalized -> sidebar and session command resolution consume overrides

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry isolates the durable configuration and precedence rules introduced for built-in agent command overrides.

### Highlights

It captures the setting defaults, which built-ins are covered, and when configured aliases replace legacy stock commands.

### Rules

Configured overrides are only applied when normalization returns a non-empty trimmed string. Stored explicit commands remain authoritative. Legacy stock built-in commands may be upgraded to configured aliases during session action generation.

## Facts

- **default_agent_commands_setting**: VSmux.defaultAgentCommands is an application-scope object setting for built-in agents. [project]
- **default_agent_commands_defaults**: Built-in defaultAgentCommands entries default to null for t3, codex, copilot, claude, opencode, and gemini. [project]
- **default_agent_command_normalization**: Default agent command overrides are trimmed and empty strings normalize to null. [convention]
- **sidebar_default_agent_override_behavior**: Sidebar default agent buttons use configured default command overrides only when no stored default agent preference exists. [project]
- **session_agent_command_upgrade_behavior**: Session resume and fork command resolution upgrades legacy stock commands like codex and claude to configured aliases when the stored command exactly matches the built-in default command. [project]
- **stored_session_command_precedence**: Explicit non-default stored session commands are preserved exactly and are not replaced by configured default agent command overrides. [convention]
- **legacy_session_launch_normalization**: Legacy string-only stored session launches are normalized to agentId codex with the trimmed command. [project]
- **session_launch_supported_builtins**: Built-in session launch resolution supports codex, claude, copilot, gemini, and opencode, but not t3. [project]
