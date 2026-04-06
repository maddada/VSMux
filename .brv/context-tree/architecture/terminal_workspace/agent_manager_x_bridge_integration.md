---
title: Agent Manager X Bridge Integration
tags: []
related:
  [
    architecture/terminal_workspace/context.md,
    architecture/terminal_workspace/vsmux_ai_devtools_integration.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T12:27:54.266Z"
updatedAt: "2026-04-06T12:27:54.266Z"
---

## Raw Concept

**Task:**
Document the live Agent Manager X WebSocket bridge added to VSmux and its controller integration

**Changes:**

- Added extension/agent-manager-x-bridge.ts with AgentManagerXBridgeClient WebSocket client
- Connected the extension to a local Agent Manager X broker at ws://127.0.0.1:47652/vsmux
- Published normalized workspace and session snapshots over the bridge
- Accepted focusSession broker commands and routed them into workspace focus behavior
- Integrated bridge construction, logging, disposal, and initial snapshot publishing into NativeTerminalWorkspaceController
- Kept bridge snapshots in memory without disk persistence

**Files:**

- extension/agent-manager-x-bridge.ts
- extension/native-terminal-workspace/controller.ts

**Flow:**
controller initialize -> construct AgentManagerXBridgeClient -> connect to ws://127.0.0.1:47652/vsmux -> publish normalized workspaceSnapshot when state changes -> receive focusSession command -> validate workspaceId/sessionId -> focus session in VSmux UI

**Timestamp:** 2026-04-06

**Patterns:**

- `^ws://127\.0\.0\.1:47652/vsmux$` - Local WebSocket endpoint for Agent Manager X bridge

## Narrative

### Structure

The bridge lives in extension/agent-manager-x-bridge.ts and defines snapshot/session message types, WebSocket lifecycle management, reconnect behavior, inbound command handling, and binary message normalization. NativeTerminalWorkspaceController owns a single AgentManagerXBridgeClient instance, adds it to controller disposables, publishes an initial snapshot during initialize(), and routes broker-driven focus requests into controller focus logic.

### Dependencies

Depends on the ws WebSocket client, VS Code disposable lifecycle, normalized workspace/session state from the terminal workspace controller, and logVSmuxDebug for bridge event diagnostics. Command execution depends on the incoming focusSession payload matching the current latest snapshot workspaceId so that broker commands only affect the active workspace identity.

### Highlights

The bridge publishes AgentManagerXWorkspaceSnapshotMessage payloads containing workspace metadata plus per-session agent, alias, displayName, focus, visibility, running state, kind, status, and optional terminalTitle/threadId fields. Snapshots are sent only when the socket is open and the serialized payload changed, which prevents duplicate publishes while still replaying the latest snapshot after reconnect. Reconnect starts at 1000ms and doubles until capped at 5000ms; open events reset the backoff and clear the last sent snapshot cache before resending if possible.

### Rules

Snapshot is sent only when: a latest snapshot exists; socket state is WebSocket.OPEN; serialized snapshot differs from lastSentSerializedSnapshot. On socket open: reset reconnect delay to 1000ms; clear lastSentSerializedSnapshot; send latest snapshot if possible. focusSession is executed only when: parsed JSON is valid; workspaceId and sessionId are strings; incoming workspaceId matches latestSnapshot?.workspaceId. ping messages are ignored. dispose() marks client disposed, clears reconnect timer, and closes the socket. getWorkspaceName(workspacePath) trims the path, returns "Workspace" if empty, otherwise path.basename(trimmedPath) || trimmedPath.

### Examples

Published snapshot type: { type: "workspaceSnapshot", updatedAt, workspaceId, workspaceName, workspacePath, sessions }. Session shape includes agent, alias, displayName, isFocused, isRunning, isVisible, kind: "terminal" | "t3", lastActiveAt, sessionId, status: "idle" | "working" | "attention", and optional terminalTitle/threadId. Logged events include agentManagerXBridge.connecting, agentManagerXBridge.open, agentManagerXBridge.close, agentManagerXBridge.error, and agentManagerXBridge.snapshotSent.

## Facts

- **agent_manager_x_bridge_url**: The VS Code extension connects to a local WebSocket broker at ws://127.0.0.1:47652/vsmux. [project]
- **agent_manager_x_handshake_timeout_ms**: AgentManagerXBridgeClient uses a 3000ms handshake timeout for the WebSocket connection. [project]
- **agent_manager_x_per_message_deflate**: AgentManagerXBridgeClient disables per-message deflate for the WebSocket connection. [project]
- **agent_manager_x_reconnect_backoff**: Reconnect backoff starts at 1000ms and doubles up to a 5000ms cap. [project]
- **agent_manager_x_snapshot_persistence**: Bridge snapshots are kept in memory and are not persisted to disk. [project]
- **agent_manager_x_snapshot_send_rule**: Workspace snapshots are only sent when a latest snapshot exists, the socket is open, and the serialized snapshot changed. [project]
- **agent_manager_x_ping_behavior**: Incoming ping messages are ignored by the bridge. [project]
- **agent_manager_x_focus_workspace_match**: focusSession is executed only when the incoming workspaceId matches the latest snapshot workspaceId. [project]
- **agent_manager_x_controller_integration**: NativeTerminalWorkspaceController constructs AgentManagerXBridgeClient and routes logs through logVSmuxDebug. [project]
- **agent_manager_x_initialize_publish**: Controller initialization publishes an Agent Manager X snapshot during initialize(). [project]
