---
title: Workspace Panel Startup Without Loading Placeholder Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:16:18.404Z"
updatedAt: "2026-04-06T11:16:18.404Z"
---

## Raw Concept

**Task:**
Capture factual statements about workspace panel startup bootstrap behavior, replay ordering, duplicate suppression, and lag reload handling.

**Changes:**

- Added project facts for workspace panel startup without loading placeholder

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/workspace-panel.ts
- workspace/main.tsx
- workspace/workspace-app.tsx
- extension/workspace-panel.test.ts

**Flow:**
extract facts from RLM context -> dedup -> group by subject -> upsert project facts topic

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry stores discrete recall-friendly statements about controller sequencing, buffered renderable state, ready replay order, bootstrap globals, duplicate suppression, autofocus exceptions, lag reload guards, and tested guarantees.

### Dependencies

The facts depend on the current controller, panel manager, workspace webview, and workspace panel tests described in the curated source context.

### Highlights

Stored facts cover the precise startup order for empty and existing-session cases, renderable message types, bootstrap script behavior, duplicate-state suppression logic, constants, visible-only lag reload, and replay-order tests.

## Facts

- **workspace_open_order**: openWorkspace reveals the sidebar before either creating a session or refreshing the workspace panel. [project]
- **workspace_open_no_sessions**: When no sessions exist, openWorkspace executes revealSidebar, createSession, workspacePanel.reveal, then returns. [project]
- **workspace_open_existing_sessions**: When sessions already exist, openWorkspace executes revealSidebar, refreshWorkspacePanel, workspacePanel.reveal, then refreshSidebar. [project]
- **workspace_renderable_message_types**: WorkspaceRenderableMessage is defined as WorkspacePanelHydrateMessage or WorkspacePanelSessionStateMessage. [project]
- **workspace_buffered_messages**: WorkspacePanelManager preserves both latestMessage and latestRenderableMessage. [project]
- **workspace_message_buffering**: postMessage strips transient fields before storing the latest message. [project]
- **workspace_renderable_buffering**: If the buffered message is renderable, postMessage also updates latestRenderableMessage. [project]
- **workspace_message_buffering_without_panel**: If no panel exists, postMessage buffers the message instead of sending it to the webview immediately. [project]
- **workspace_ready_replay_order**: Ready replay posts latestRenderableMessage first and then posts latestMessage only if it differs from latestRenderableMessage. [project]
- **workspace_bootstrap_global**: New workspace panel HTML can embed a bootstrap message in window.**VSMUX_WORKSPACE_BOOTSTRAP**. [project]
- **workspace_bootstrap_serialization**: The bootstrap script serializes the buffered renderable message with JSON.stringify and escapes < as \u003c. [project]
- **workspace_initial_state_source**: WorkspaceApp initializes serverState from getInitialWorkspaceState, which reads window.**VSMUX_WORKSPACE_BOOTSTRAP**. [project]
- **workspace_ready_handshake**: WorkspaceApp posts a ready message to the extension after registering message listeners. [project]
- **workspace_terminal_presentation_update**: terminalPresentationChanged updates the matching terminal pane snapshot and terminalTitle without replacing the whole workspace state. [project]
- **workspace_destroy_runtime**: destroyTerminalRuntime messages clear cached terminal runtimes by session cache key. [project]
- **workspace_duplicate_suppression**: Stable workspace state deduplication compares JSON signatures of stripWorkspacePanelTransientFields(message). [project]
- **workspace_autofocus_exception**: A duplicate stable workspace state is still applied when it carries a new autoFocusRequest.requestId. [project]
- **workspace_autofocus_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400 milliseconds. [project]
- **workspace_auto_reload_on_lag**: AUTO_RELOAD_ON_LAG is true. [project]
- **workspace_lag_reload_visibility**: Lag-triggered reloadWorkspacePanel is only posted when the document visibility state is visible. [project]
- **workspace_lag_reload_guard**: If AUTO_RELOAD_ON_LAG is disabled or a lag auto reload was already requested, lag detection does not request another reload. [project]
- **workspace_empty_shell**: When no workspace state exists, the app renders an empty workspace-shell workspace-shell-empty main element. [project]
- **workspace_empty_group_text**: When the active group has zero visible panes, the app renders the text No sessions in this group. [project]
- **workspace_test_autofocus_replay**: Tests verify that one-shot autofocus requests are not replayed after the initial post. [project]
- **workspace_test_bootstrap_html**: Tests verify that the latest workspace state is embedded into newly created panel HTML. [project]
- **workspace_test_replay_order**: Tests verify that ready replay sends the latest workspace state before a buffered terminalPresentationChanged message. [project]
- **workspace_test_coverage**: Workspace panel tests also cover restored panel reuse, disposal of duplicate restored panels, and forwarding of closeSession, fullReloadSession, syncPaneOrder, reloadWorkspacePanel, and legacy syncSessionOrder messages. [project]
