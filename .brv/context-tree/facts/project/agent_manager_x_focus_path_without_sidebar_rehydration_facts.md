---
title: Agent Manager X Focus Path Without Sidebar Rehydration Facts
tags: []
related:
  [
    architecture/terminal_workspace/agent_manager_x_focus_path_without_sidebar_rehydration.md,
    architecture/terminal_workspace/agent_manager_x_bridge_integration.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T16:57:19.254Z"
updatedAt: "2026-04-06T16:57:19.254Z"
---

## Raw Concept

**Task:**
Capture project facts for the Agent Manager X focus-path adjustment in the native terminal workspace controller

**Changes:**

- Recorded direct-focus behavior for Agent Manager X session jumps
- Recorded preserved workspace behavior and eliminated sidebar re-hydration artifact
- Recorded controller file path and selected timing/command constants

**Files:**

- extension/native-terminal-workspace/controller.ts

**Flow:**
implementation change identified -> behavior facts extracted -> project facts stored for later recall

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry isolates recall-friendly statements from the broader controller summary so the implementation decision and key constants can be retrieved quickly without scanning the full architectural narrative.

### Dependencies

The facts refer to the native terminal workspace controller and its Agent Manager X bridge integration. They complement the architectural topic rather than replacing controller flow documentation.

### Highlights

Key recall points are the direct session focus path, preserved workspace behavior, eliminated sidebar reload/re-hydration, the implementation file path, and selected controller constants used by surrounding flows.

## Facts

- **agent_manager_x_focus_behavior**: The Agent Manager X focus path in VSmux was adjusted so broker-driven session jumps no longer force the sidebar container open first. [project]
- **focus_session_from_agent_manager_x**: focusSessionFromAgentManagerX now focuses the target session directly. [project]
- **sidebar_reload_behavior**: The change avoids visible sidebar reload and re-hydration when clicking VSmux sessions from Agent Manager X. [project]
- **workspace_focus_behavior**: Existing workspace focus behavior is preserved after the Agent Manager X focus adjustment. [project]
- **controller_file**: The implementation is documented in extension/native-terminal-workspace/controller.ts. [project]
- **default_t3_activity_websocket_url**: DEFAULT_T3_ACTIVITY_WEBSOCKET_URL is ws://127.0.0.1:3774/ws. [environment]
- **command_terminal_exit_poll_ms**: COMMAND_TERMINAL_EXIT_POLL_MS is 250. [project]
- **completion_sound_confirmation_delay_ms**: COMPLETION_SOUND_CONFIRMATION_DELAY_MS is 1000. [project]
- **fork_rename_delay_ms**: FORK_RENAME_DELAY_MS is 4000. [project]
- **simple_browser_open_command**: SIMPLE_BROWSER_OPEN_COMMAND is simpleBrowser.api.open. [project]
