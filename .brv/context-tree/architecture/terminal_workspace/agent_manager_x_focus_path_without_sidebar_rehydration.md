---
title: Agent Manager X Focus Path Without Sidebar Rehydration
tags: []
related:
  [
    architecture/terminal_workspace/agent_manager_x_bridge_integration.md,
    architecture/terminal_workspace/current_state.md,
    facts/project/agent_manager_x_bridge_integration_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T16:57:19.253Z"
updatedAt: "2026-04-06T16:57:19.253Z"
---

## Raw Concept

**Task:**
Document the Agent Manager X to VSmux focus path adjustment and the surrounding NativeTerminalWorkspaceController responsibilities

**Changes:**

- Adjusted Agent Manager X focus path so broker-driven session jumps no longer force the sidebar container open first
- focusSessionFromAgentManagerX now focuses the target session directly
- Preserved existing workspace focus behavior while avoiding visible sidebar reload and re-hydration

**Files:**

- extension/native-terminal-workspace/controller.ts

**Flow:**
Agent Manager X focus request -> focusSessionFromAgentManagerX -> target session focused directly -> workspace focus preserved -> no forced sidebar container open/re-hydration

**Timestamp:** 2026-04-06

## Narrative

### Structure

NativeTerminalWorkspaceController coordinates backend session state, sidebar hydration, workspace panel updates, T3 activity monitoring, session lifecycle actions, git HUD actions, and the Agent Manager X bridge. The documented change lives in controller.ts and specifically refines the bridge-driven focus path rather than the broader sidebar or workspace initialization model.

### Dependencies

The controller depends on DaemonTerminalWorkspaceBackend, SessionGridStore, SessionSidebarViewProvider, WorkspacePanelManager, T3RuntimeManager, T3ActivityMonitor, WorkspaceAssetServer, and AgentManagerXBridgeClient. Focus behavior also interacts with workspace auto-focus requests, detached terminal reattachment logic, and sidebar refresh/hydrate paths.

### Highlights

Broker-driven Agent Manager X session jumps now go straight to the target VSmux session instead of opening the sidebar container first. This removes the visible sidebar reload/re-hydration artifact while keeping existing workspace focus behavior intact. The same controller also preserves command ids, timing constants, lifecycle entry points, and user-facing error/info messages for rename, fork, reload, git, and T3 session flows.

### Rules

Error/info messages preserved:

- "Git text generation is set to custom, but VSmux.gitTextGenerationCustomCommand is empty."
- "No resume command is available for this session."
- "Fork is only available for Codex and Claude sessions that have a visible title."
- "Full reload is only available for Codex and Claude sessions."
- "Thread ID is required."

### Examples

Examples captured in the context include DEFAULT_T3_ACTIVITY_WEBSOCKET_URL = "ws://127.0.0.1:3774/ws", SIMPLE_BROWSER_OPEN_COMMAND = "simpleBrowser.api.open", TERMINAL_SCROLL_TO_BOTTOM_COMMAND = "workbench.action.terminal.scrollToBottom", and TOGGLE_MAXIMIZE_EDITOR_GROUP_COMMAND = "workbench.action.toggleMaximizeEditorGroup". The focusSession flow also records sidebar-origin auto-focus enqueueing and detached terminal reattach handling.

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
