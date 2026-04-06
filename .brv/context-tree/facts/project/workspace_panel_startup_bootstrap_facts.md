---
title: Workspace Panel Startup Bootstrap Facts
tags: []
related: [architecture/terminal_workspace/workspace_panel_startup_without_loading_placeholder.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:17:28.662Z"
updatedAt: "2026-04-06T11:17:28.662Z"
---

## Raw Concept

**Task:**
Store key recall facts for workspace panel startup and bootstrap behavior

**Changes:**

- Added startup ordering facts
- Added bootstrap transport facts
- Added autofocus and lag reload facts
- Added pane reload and order sync facts

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/workspace-panel.ts
- workspace/main.tsx
- workspace/workspace-app.tsx
- extension/workspace-panel.test.ts

**Flow:**
controller startup -> panel buffer/bootstrap -> app first render -> ready replay -> focus and lag handling

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry isolates the most reusable project facts from the workspace panel bootstrap implementation so they can be recalled without reopening the broader architecture note. It covers opening order, bootstrap transport, replay order, autofocus timing, lag recovery, and message contract specifics.

### Dependencies

These facts depend on the controller, workspace panel manager, workspace app, and test suite remaining aligned on the same message contract and replay semantics.

### Highlights

The most important operational details are that the sidebar opens first, bootstrap state is injected into HTML, replay order prioritizes renderable state, autofocus uses a 400ms guard, and lag auto-reload is enabled.

## Facts

- **workspace_open_order**: openWorkspace reveals the sidebar first. [project]
- **workspace_bootstrap_global**: The workspace bootstrap payload is stored on window.**VSMUX_WORKSPACE_BOOTSTRAP**. [project]
- **workspace_renderable_messages**: Renderable buffered messages are hydrate and sessionState. [project]
- **workspace_buffered_replay_order**: Buffered replay sends renderable state before transient state. [project]
- **workspace_autofocus_guard_ms**: Auto-focus guard duration is 400ms. [project]
- **workspace_lag_auto_reload**: AUTO_RELOAD_ON_LAG is true. [project]
- **workspace_order_sync_messages**: WorkspacePanel webview supports syncPaneOrder and legacy syncSessionOrder. [project]
- **workspace_reload_message_by_pane_kind**: Terminal pane reload uses fullReloadSession while non-terminal pane reload uses reloadWorkspacePanel. [project]
