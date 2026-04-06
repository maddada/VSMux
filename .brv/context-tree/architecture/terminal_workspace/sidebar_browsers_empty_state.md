---
title: Sidebar Browsers Empty State
tags: []
keywords: []
importance: 60
recency: 1
maturity: draft
updateCount: 2
createdAt: "2026-04-06T12:22:48.077Z"
updatedAt: "2026-04-06T20:22:17.759Z"
---

## Raw Concept

**Task:**
Document the sidebar browser-group empty-state rendering behavior that removes the extra layout gap below browser group headers.

**Changes:**

- Added shouldRenderGroupSessions guard based on browser-group status and orderedSessionIds length
- Empty browser groups no longer render the .group-sessions wrapper
- Preserved non-browser empty drop target rendering with No sessions state
- Retained a comment noting that the browser empty placeholder may be restored later

**Files:**

- sidebar/session-group-section.tsx

**Flow:**
render group header -> evaluate isBrowserGroup and orderedSessionIds.length -> render .group-sessions only when allowed -> preserve non-browser empty drop target behavior

**Timestamp:** 2026-04-06

**Patterns:**

- `const shouldRenderGroupSessions = !isBrowserGroup || orderedSessionIds.length > 0;` - Determines whether the sidebar group should render the .group-sessions container.

## Narrative

### Structure

The sidebar session-group section now computes a shouldRenderGroupSessions boolean before rendering the group body. Browser groups use that guard to skip the entire .group-sessions container when they have zero orderedSessionIds, while non-browser groups continue through the existing empty-state branch.

### Dependencies

This behavior depends on the group classification via isBrowserGroup, the orderedSessionIds collection, and the existing drag-and-drop attributes on group-sessions and group-empty-drop-target nodes. The rendering change is localized to sidebar/session-group-section.tsx and keeps existing SortableSessionCard and drop-target semantics intact for non-empty groups.

### Highlights

The change removes the extra visual gap caused by the parent .group grid reserving space for an empty .group-sessions container under browser headers. Non-browser groups still show the No sessions empty drop target, and the source keeps an inline comment that the browser-specific empty placeholder could be restored in the future.

### Examples

Example behavior: an empty Browsers group now renders only its header with no placeholder body, while an empty non-browser group still renders a drop target containing the text No sessions.

## Facts

- **browser_group_empty_rendering**: Empty browser sidebar groups do not render the .group-sessions container when they have no sessions. [project]
- **browser_group_layout_gap_fix**: Suppressing .group-sessions for empty browser groups prevents the parent .group grid from leaving an extra gap below the header. [project]
- **non_browser_group_empty_state**: Non-browser groups still render a No sessions empty drop target when empty. [project]
- **browser_empty_placeholder_future_option**: A comment remains in sidebar/session-group-section.tsx indicating the browser empty placeholder may be restored later. [project]
