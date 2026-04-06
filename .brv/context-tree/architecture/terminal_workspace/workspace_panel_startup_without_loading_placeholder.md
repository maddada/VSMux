---
title: Workspace Panel Startup Without Loading Placeholder
tags: []
related: [architecture/terminal_workspace/context.md, facts/project/terminal_workspace_facts.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T11:16:18.394Z"
updatedAt: "2026-04-06T11:17:28.661Z"
---

## Raw Concept

**Task:**
Document workspace panel startup, bootstrap, buffered replay, autofocus, and lag reload behavior

**Changes:**

- Removed Loading VSmux workspace placeholder during startup
- Embedded latest renderable workspace state into webview HTML for first paint
- Separated renderable state buffering from transient message buffering
- Preserved one-shot autofocus semantics with duplicate-state protection
- Enabled automatic workarea reload on visible lag detection

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/workspace-panel.ts
- workspace/main.tsx
- workspace/workspace-app.tsx
- extension/workspace-panel.test.ts

**Flow:**
openWorkspace -> revealSidebar -> createSession or refreshWorkspacePanel -> workspacePanel.reveal -> webview bootstraps from latest renderable message -> ready -> replay renderable state -> replay transient message

**Timestamp:** 2026-04-06

**Patterns:**

- `window\.__VSMUX_WORKSPACE_BOOTSTRAP__` - Global bootstrap payload injected into workspace HTML
- `message\.type === "hydrate" || message\.type === "sessionState"` - Renderable workspace message guard

## Narrative

### Structure

Workspace startup spans controller-side sequencing in extension/native-terminal-workspace/controller.ts, panel buffering and HTML generation in extension/workspace-panel.ts, root bootstrap in workspace/main.tsx, and state application plus focus and lag handling in workspace/workspace-app.tsx. The design stores the latest renderable state separately from transient panel messages so a newly created or restored panel can paint immediately from HTML bootstrap and then receive ordered replay on ready.

### Dependencies

The panel depends on VS Code webview panel serialization, stripWorkspacePanelTransientFields from the shared workspace panel contract, and the workspace app consuming the injected bootstrap payload. Focus behavior also depends on extension-side focusSession handling and autoFocusRequest generation, while lag recovery depends on reloadWorkspacePanel message routing back through the controller.

### Highlights

Startup intentionally reveals the sidebar first and delays workspace panel reveal until a session exists or panel state has been refreshed, which removes the blank or loading placeholder on first open. Buffered replay always sends hydrate/sessionState before transient updates like terminalPresentationChanged, preserving a consistent first paint and avoiding stale terminal presentation races. Duplicate stable workspace states are ignored, but new autofocus requests still arm a 400ms guard so competing pane activations do not steal focus during sidebar-initiated autofocus. Visible lag detection triggers a one-shot automatic reload because AUTO_RELOAD_ON_LAG is enabled.

### Rules

Replay order is:

1. latest renderable state (`hydrate` or `sessionState`)
2. latest transient message if different

Treat `autoFocusRequest` as one-shot.
Do not replay one-shot autofocus requests after initial delivery.
Use a `400ms` guard to ignore conflicting pane activations during autofocus.

### Examples

User-visible strings preserved by this flow include "Workspace root element was not found.", "Terminal responsiveness looks degraded.", "The workarea detected delayed page timers. Reloading the workarea usually clears it.", "Reload Workarea", and "Dismiss". Tests cover duplicate restored panel disposal, reuse of restored panels on reveal, omission of replayed one-shot autofocus requests, HTML bootstrap embedding, and replaying renderable state before terminalPresentationChanged.

## Facts

- **workspace_open_order**: openWorkspace reveals the sidebar before revealing the workspace panel. [project]
- **workspace_open_no_sessions**: If no sessions exist, openWorkspace creates a session and then reveals the workspace panel. [project]
- **workspace_open_existing_sessions**: If sessions exist, openWorkspace refreshes the workspace panel, reveals it, and then refreshes the sidebar. [project]
- **workspace_panel_buffering**: WorkspacePanelManager buffers the latest stripped message and separately tracks the latest renderable message of type hydrate or sessionState. [project]
- **workspace_panel_replay_order**: Buffered replay posts the latest renderable state before any later transient message such as terminalPresentationChanged. [project]
- **workspace_bootstrap_global**: The workspace HTML bootstraps state through window.**VSMUX_WORKSPACE_BOOTSTRAP**. [project]
- **workspace_initial_render_source**: WorkspaceApp initializes its first render from the bootstrap payload instead of waiting for ready/postMessage. [project]
- **workspace_duplicate_state_handling**: Duplicate stable hydrate/sessionState messages are ignored unless they carry a new autoFocusRequest. [project]
- **workspace_autofocus_guard_ms**: The autofocus activation guard lasts 400ms. [project]
- **workspace_lag_auto_reload**: Visible-page lag detection auto-reloads the workspace panel once because AUTO_RELOAD_ON_LAG is true. [project]
- **workspace_supported_messages**: The webview accepts ready, workspaceDebugLog, reloadWorkspacePanel, focusSession, closeSession, fullReloadSession, syncPaneOrder, and syncSessionOrder messages. [project]
- **workspace_root_requirement**: The workspace root throws an error when #root is missing. [project]
