---
title: Workspace Panel Focus Hotkeys
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
    architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T17:03:47.417Z"
updatedAt: "2026-04-06T17:03:47.417Z"
---

## Raw Concept

**Task:**
Scope VSmux workspace hotkeys so session, group, and layout shortcuts remain active while the VSmux workspace panel is focused, including T3 iframe sessions.

**Changes:**

- Added the workspace panel focus context key vsmux.workspacePanelFocus.
- Synchronized focus context from webview panel active and visible lifecycle state.
- Updated workspace hotkey when clauses to allow activation while the workspace panel is focused.
- Added tests covering focus-context set and clear behavior.

**Files:**

- extension/workspace-panel.ts
- extension/workspace-panel.test.ts
- package.json

**Flow:**
workspace panel reveal or restore -> configure panel -> sync active && visible state into setContext(vsmux.workspacePanelFocus) -> keybindings evaluate new when clause -> clear context on hide or disposal

**Timestamp:** 2026-04-06

**Patterns:**

- `!inputFocus || terminalFocus || vsmux.workspacePanelFocus` - When-clause used by workspace session, group, and layout hotkeys so they also fire while the VSmux workspace panel has focus.
- `terminalFocus` - When-clause retained for directional focus keybindings that should only run from terminals.

## Narrative

### Structure

WorkspacePanelManager now carries a panelFocusContext boolean alongside latestMessage, latestRenderableMessage, and the active panel reference. It registers the vsmux.workspace serializer, adopts restored panels, configures view-state listeners, and replays buffered renderable state before non-renderable messages. The workspace panel webview still uses the VSmux bootstrap script injection and local resource roots for out/workspace and forks/t3code-embed/dist.

### Dependencies

This behavior depends on VS Code webview panel lifecycle signals, the setContext command, and package.json keybinding when clauses. The focused-state bridge is relevant to T3 iframe sessions because the webview panel can own focus while workspace-level shortcuts still need to work.

### Highlights

The new context key is vsmux.workspacePanelFocus and is driven by panel.active && panel.visible. It is explicitly cleared on hide, manager dispose, and panel disposal to avoid stale focus state. Tests verify that setContext is called with true when the panel becomes active and visible and false when it loses focus, while preserving existing buffering and restored-panel behavior.

### Rules

Workspace/session/layout shortcuts use the exact when clause "!inputFocus || terminalFocus || vsmux.workspacePanelFocus". Directional focus shortcuts continue using the exact when clause "terminalFocus" only.

### Examples

Examples include VSmux.createSession on ctrl+alt+n / cmd+alt+n, VSmux.focusGroup1..4 on ctrl+alt+shift+1..4 / cmd+alt+shift+1..4, VSmux.focusSessionSlot 1..9 on ctrl+alt+1..9 / cmd+alt+1..9, and layout commands such as VSmux.showOne, showTwo, showThree, showFour, showSix, and showNine.

## Facts

- **workspace_panel_focus_context**: The workspace panel focus context key is vsmux.workspacePanelFocus. [project]
- **workspace_panel_focus_sync_condition**: Workspace panel focus context is synchronized from panel.active && panel.visible. [project]
- **workspace_panel_focus_clear_points**: Workspace panel focus context is cleared on hide, dispose, and panel disposal. [project]
- **workspace_panel_hotkey_when_clause**: Workspace/session/layout hotkeys use the when clause !inputFocus || terminalFocus || vsmux.workspacePanelFocus. [convention]
- **workspace_directional_focus_hotkeys_scope**: Directional focus hotkeys remain terminal-only with the when clause terminalFocus. [convention]
- **workspace_panel_type**: The workspace panel type is vsmux.workspace. [project]
- **extension_version**: The extension package version is 2.6.0. [project]
- **extension_publisher**: The extension publisher/author is maddada. [project]
