---
title: Sidebar Browsers Empty State Facts
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T12:22:48.078Z"
updatedAt: "2026-04-06T12:23:55.548Z"
---

## Raw Concept

**Task:**
Store project facts for sidebar browser-group empty-state behavior

**Changes:**

- Recorded browser-group sidebar UI behavior facts
- Captured add-button message routing and visible count constants

**Files:**

- sidebar/session-group-section.tsx

**Flow:**
identify browser-group conditions and actions -> store as recallable project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry isolates concrete implementation details from the sidebar browser-group empty-state change so they can be recalled without re-reading the architecture topic.

### Highlights

It records the file location, browser-group detection expression, message types for add-button actions, and the preserved visible-count constants.

## Facts

- **sidebar_browser_empty_state_file**: The implementation file is sidebar/session-group-section.tsx. [project]
- **browser_group_kind_check**: Browser group detection uses group?.kind === "browser". [project]
- **browser_group_add_message**: Browser groups emit type: "openBrowser" when the add button is used. [project]
- **non_browser_group_add_message**: Non-browser groups emit type: "createSessionInGroup" with the groupId when the add button is used. [project]
- **visible_count_options**: Visible session count options are 1, 2, 3, 4, 6, and 9. [project]
