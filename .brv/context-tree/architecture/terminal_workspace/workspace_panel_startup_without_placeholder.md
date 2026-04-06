---
title: Workspace Panel Startup Without Placeholder
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_focus_debugging.md,
    facts/project/terminal_workspace_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:16:55.521Z"
updatedAt: "2026-04-06T11:16:55.521Z"
---

## Raw Concept

**Task:**
Document workspace panel startup flow that avoids the loading placeholder by bootstrapping renderable state and replaying buffered messages in a safe order.

**Changes:**

- openWorkspace refreshes or creates a session before revealing the workspace panel
- WorkspacePanelManager caches renderable state separately from transient messages
- Workspace HTML embeds buffered renderable state through a bootstrap script
- Buffered replay sends renderable state before terminalPresentationChanged updates
- One-shot autoFocusRequest values are stripped before buffering to prevent replay
- Tests cover restored panel adoption, replay ordering, and HTML bootstrap embedding

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/workspace-panel.ts
- workspace/main.tsx
- workspace/workspace-app.tsx
- extension/workspace-panel.test.ts

**Flow:**
openWorkspace -> revealSidebar -> createSession or refreshWorkspacePanel -> reveal panel -> HTML embeds latest renderable state -> WorkspaceApp initializes from bootstrap -> webview posts ready -> extension replays renderable state then transient updates

**Timestamp:** 2026-04-06

**Patterns:**

- `window\.__VSMUX_WORKSPACE_BOOTSTRAP__` - Global variable used to inject initial workspace state into HTML before the app module loads
- `message\.type === "hydrate" || message\.type === "sessionState"` - Predicate that identifies replayable renderable workspace messages

## Narrative

### Structure

The change spans the native terminal workspace controller, the WorkspacePanelManager webview host, and the React workspace app. The controller now ensures a usable session exists or that workspace state has been refreshed before the panel is revealed. The panel manager tracks both the last stripped message and the last renderable state, while configurePanel injects the latest renderable message directly into the generated webview HTML.

### Dependencies

The behavior depends on extension/native-terminal-workspace/controller.ts coordinating panel reveal timing, extension/workspace-panel.ts handling buffering and restore adoption, and workspace/workspace-app.tsx reading the bootstrap global during initial React state setup. The panel still relies on acquireVsCodeApi, ready-message replay, enabled scripts, and local resources from out/workspace and forks/t3code-embed/dist. Correct transient replay also depends on stripWorkspacePanelTransientFields removing one-shot autofocus data before buffering.

### Highlights

This startup path avoids the prior Loading VSmux workspace placeholder because the first paint can use embedded hydrate or sessionState data immediately. Replay ordering is explicitly designed so terminalPresentationChanged lands after a valid pane model exists. Duplicate stable state messages are suppressed, but a new autoFocusRequest.requestId remains allowed as a one-shot exception. Test coverage preserves duplicate restored panel disposal, restored panel reuse, bootstrap embedding, forwarded webview messages, and replay order correctness.

### Rules

Do not reveal the workspace panel before a session exists or before the latest workspace state is refreshed. Embed the latest renderable workspace state directly into webview HTML. Buffer renderable state separately from transient messages. On webview ready, replay renderable state before transient updates. Do not replay one-shot autoFocusRequest fields after initial delivery. Preserve restore and reveal behavior for serialized VS Code webview panels.

### Examples

When there are no session records, openWorkspace performs revealSidebar, createSession, and workspacePanel.reveal without an intermediate placeholder path. When sessionState is buffered before terminalPresentationChanged, the panel HTML includes a bootstrap payload containing type sessionState and sessionId session-1, and the ready replay sends sessionState first and terminalPresentationChanged second. Lag handling uses AUTO_FOCUS_ACTIVATION_GUARD_MS = 400 and AUTO_RELOAD_ON_LAG = true to trigger reloadWorkspacePanel when visible lag is detected.

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
