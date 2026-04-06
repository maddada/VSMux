---
title: Workspace Panel Startup Without Placeholder Facts
tags: []
related: [architecture/terminal_workspace/workspace_panel_startup_without_placeholder.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:16:55.522Z"
updatedAt: "2026-04-06T11:16:55.522Z"
---

## Raw Concept

**Task:**
Capture factual statements for workspace panel startup without placeholder behavior.

**Changes:**

- Recorded constants, message types, replay ordering, test coverage, and involved files.

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/workspace-panel.ts
- workspace/main.tsx
- workspace/workspace-app.tsx
- extension/workspace-panel.test.ts

**Flow:**
RLM context -> manual fact extraction -> dedup -> group by subject -> store companion facts entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

Stored 25 deduplicated facts across 25 subjects for recall of workspace startup behavior.

### Dependencies

Facts align with the architecture topic entry and reference the same controller, panel manager, app bootstrap, and test files.

### Highlights

Preserves exact constants, message names, bootstrap global name, replay ordering, and test guarantees.

## Facts

- **open_workspace_order**: openWorkspace reveals the sidebar before any session creation or workspace panel reveal. [project]
- **open_workspace_empty_state**: If no sessions exist, openWorkspace creates a session and then reveals the workspace panel. [project]
- **open_workspace_existing_sessions**: If sessions already exist, openWorkspace refreshes the workspace panel before reveal and refreshes the sidebar afterward. [project]
- **workspace_panel_message_buffers**: WorkspacePanelManager stores latestMessage and latestRenderableMessage separately. [project]
- **workspace_renderable_messages**: Renderable workspace messages are limited to hydrate and sessionState. [project]
- **workspace_message_buffering**: When no panel exists, postMessage buffers the stripped message instead of posting it to a webview. [project]
- **workspace_html_bootstrap_source**: configurePanel injects latestRenderableMessage into getWorkspaceHtml for HTML bootstrap. [project]
- **workspace_bootstrap_global**: Workspace HTML bootstrap writes window.**VSMUX_WORKSPACE_BOOTSTRAP** with the serialized renderable state. [project]
- **workspace_replay_order**: Buffered replay posts latestRenderableMessage first and latestMessage second when they are distinct. [project]
- **terminal_presentation_replay_reason**: The replay ordering preserves correctness for terminalPresentationChanged updates. [project]
- **workspace_initial_state_source**: WorkspaceApp initializes serverState from window.**VSMUX_WORKSPACE_BOOTSTRAP**. [project]
- **workspace_ready_handshake**: The webview still posts a ready message even though first render no longer depends on waiting for it. [project]
- **workspace_duplicate_state_suppression**: Duplicate stable state messages are ignored unless autoFocusRequest.requestId is new. [project]
- **workspace_empty_shell_condition**: When no workspaceState exists, WorkspaceApp renders an empty workspace-shell element. [project]
- **workspace_auto_focus_guard_ms**: AUTO_FOCUS_ACTIVATION_GUARD_MS is 400. [project]
- **workspace_auto_reload_on_lag**: AUTO_RELOAD_ON_LAG is true. [project]
- **workspace_panel_type**: WORKSPACE_PANEL_TYPE is vsmux.workspace. [project]
- **workspace_panel_title**: WORKSPACE_PANEL_TITLE is VSmux. [project]
- **workspace_retain_context_hidden**: retainContextWhenHidden is false for the workspace webview panel. [project]
- **workspace_local_resource_roots**: Workspace panel localResourceRoots include out/workspace and forks/t3code-embed/dist. [project]
- **workspace_root_missing_error**: The workspace root element missing case throws Workspace root element was not found. [project]
- **workspace_duplicate_restored_panel_test**: Tests verify duplicate restored workspace panels are disposed. [project]
- **workspace_restored_panel_reuse_test**: Tests verify restored panels are reused on reveal without creating a new panel. [project]
- **workspace_autofocus_no_replay_test**: Tests verify one-shot autoFocusRequest fields are not replayed after the initial post. [project]
- **workspace_bootstrap_replay_test**: Tests verify sessionState is embedded in panel HTML and replayed before terminalPresentationChanged. [project]
