---
title: Workspace Panel Focus Hotkeys Facts
tags: []
related: [architecture/terminal_workspace/workspace_panel_focus_hotkeys.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T17:03:47.417Z"
updatedAt: "2026-04-06T17:03:47.417Z"
---

## Raw Concept

**Task:**
Record recall-oriented facts for the VSmux workspace panel focus hotkeys change.

**Changes:**

- Captured the new workspace panel focus context key.
- Captured the new hotkey when clause and retained terminal-only directional clause.
- Captured panel type and extension package metadata referenced by the change.

**Files:**

- extension/workspace-panel.ts
- extension/workspace-panel.test.ts
- package.json

**Flow:**
source change summary -> extract concrete configuration and behavior facts -> deduplicate by subject -> store in facts/project for recall

**Timestamp:** 2026-04-06

**Author:** maddada

## Narrative

### Structure

This fact entry isolates stable identifiers, when clauses, lifecycle conditions, and package metadata from the workspace panel focus hotkeys update so they can be recalled without reopening the full architecture note.

### Dependencies

The facts rely on package.json command and keybinding contributions plus WorkspacePanelManager behavior in extension/workspace-panel.ts and its corresponding tests.

### Highlights

Key retained values include vsmux.workspacePanelFocus, vsmux.workspace, the when clause !inputFocus || terminalFocus || vsmux.workspacePanelFocus, the terminal-only clause terminalFocus, version 2.6.0, and publisher maddada.

## Facts

- **workspace_panel_focus_context**: The workspace panel focus context key is vsmux.workspacePanelFocus. [project]
- **workspace_panel_focus_sync_condition**: Workspace panel focus context is synchronized from panel.active && panel.visible. [project]
- **workspace_panel_focus_clear_points**: Workspace panel focus context is cleared on hide, dispose, and panel disposal. [project]
- **workspace_panel_hotkey_when_clause**: Workspace/session/layout hotkeys use the when clause !inputFocus || terminalFocus || vsmux.workspacePanelFocus. [convention]
- **workspace_directional_focus_hotkeys_scope**: Directional focus hotkeys remain terminal-only with the when clause terminalFocus. [convention]
- **workspace_panel_type**: The workspace panel type is vsmux.workspace. [project]
- **extension_version**: The extension package version is 2.6.0. [project]
- **extension_publisher**: The extension publisher/author is maddada. [project]
