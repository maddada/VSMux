---
title: Agent Manager X Bridge Integration Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T12:27:54.267Z"
updatedAt: "2026-04-06T12:27:54.267Z"
---

## Raw Concept

**Task:**
Capture project facts for the Agent Manager X bridge integration in VSmux

**Changes:**

- Recorded broker URL, reconnect rules, snapshot persistence behavior, and controller integration facts

**Files:**

- extension/agent-manager-x-bridge.ts
- extension/native-terminal-workspace/controller.ts

**Flow:**
bridge connects -> publishes snapshots -> broker sends focusSession -> controller focuses session

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry isolates stable implementation details for the live Agent Manager X bridge so they can be recalled independently of the larger terminal workspace architecture topic.

### Dependencies

The facts depend on the bridge client implementation and its controller wiring in the native terminal workspace subsystem.

### Highlights

Includes endpoint, handshake timeout, reconnect backoff, snapshot send conditions, focusSession gating, ping handling, and initialization behavior.

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
