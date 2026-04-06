---
title: Sidebar Browsers Empty State
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T12:22:48.077Z"
updatedAt: "2026-04-06T12:23:55.546Z"
---

## Raw Concept

**Task:**
Document browser-group empty-state behavior in the sidebar session group section

**Changes:**

- Removed the rendered "No browsers" empty placeholder for browser groups
- Kept the empty browser-group drop target container for drag and drop support
- Left the old browser placeholder commented with a note for possible restoration later
- Preserved browser-group specific interaction restrictions and add-button behavior

**Files:**

- sidebar/session-group-section.tsx

**Flow:**
render group -> detect browser group -> if empty render drop target only for browser groups -> otherwise render normal empty state or session cards -> route add action to openBrowser for browser groups

**Timestamp:** 2026-04-06

**Patterns:**

- `group\?\.kind === "browser"` - Detects whether the group is a browser group
- `type: "openBrowser"` - Sidebar message used when add is clicked for a browser group
- `type: "createSessionInGroup"` - Sidebar message used when add creates a regular session in a non-browser group
- `type: "renameGroup"` - Sidebar message type for group rename interactions
- `type: "focusGroup"` - Sidebar message type for focusing a group
- `type: "setVisibleCount"` - Sidebar message type for visible session count updates
- `type: "closeGroup"` - Sidebar message type for closing a group
- `type: "setGroupSleeping"` - Sidebar message type for sleeping or waking a group
- `type: "sidebarDebugLog"` - Sidebar message type for debug logging

## Narrative

### Structure

The sidebar group renderer in sidebar/session-group-section.tsx checks isBrowserGroup using group?.kind === "browser". When a group has sessions it maps orderedSessionIds to SortableSessionCard. When the group is empty, browser groups render only the group-empty-drop-target wrapper while non-browser groups render the same wrapper plus a visible "No sessions" placeholder.

### Dependencies

The empty-state behavior depends on orderedSessionIds, groupDropPosition, isGroupDropTarget, and sessionDragIndicator to preserve drag/drop behavior. Browser-group interaction rules also depend on message dispatch through the vscode webview bridge for actions such as openBrowser and createSessionInGroup.

### Highlights

This change intentionally removes the visible "No browsers" copy without removing drop semantics. The old placeholder remains commented in the JSX with a note that it may be restored later. Browser groups continue to opt out of sorting, focus-on-click, context menus, rename, visible-count changes, and sleep actions while the add button opens a browser instead of creating a regular session.

### Rules

Browser groups no longer render the "No browsers" empty placeholder. Keep the empty drop target container so drag/drop still works. Leave the old placeholder commented with a note that it may be restored later. Rename / visible-count / sleep actions are blocked for browser groups.

### Examples

Example empty browser-group rendering: <div className="group-empty-drop-target" data-drop-position={groupDropPosition} data-drop-target={String(isGroupDropTarget)}>{/_ We may want to restore the empty browser placeholder later. _/}{/_ <div className="group-empty-state">No browsers</div> _/}</div>. Example add-button branching: if (isBrowserGroup) { vscode.postMessage({ type: "openBrowser" }); return; } vscode.postMessage({ groupId: group.groupId, type: "createSessionInGroup" });

## Facts

- **browser_group_empty_state**: Browser groups no longer render the "No browsers" empty placeholder. [project]
- **browser_group_drop_target**: Browser groups keep an empty drop target container so drag and drop still works. [project]
- **browser_group_condition**: The browser group condition is group?.kind === "browser". [project]
- **browser_group_sorting**: Group sorting is disabled for browser groups. [project]
- **browser_group_focus_click**: Clicking a browser group does not focus the group. [project]
- **browser_group_context_menu**: Browser groups suppress the context menu. [project]
- **browser_group_add_action**: The add button opens a browser for browser groups instead of creating a session. [project]
- **browser_group_restricted_actions**: Rename, visible-count, and sleep actions are blocked for browser groups. [project]
- **visible_session_count_options**: Visible session count options are [1, 2, 3, 4, 6, 9]. [project]
