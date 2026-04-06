---
title: Simple Grouped Session Workspace State Facts
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:30:09.388Z"
updatedAt: "2026-04-06T03:30:09.388Z"
---

## Raw Concept

**Task:**
Capture project facts for the simple grouped session workspace state implementation and tests.

**Changes:**

- Recorded exported behavior and normalization invariants for simple grouped workspace state.
- Recorded active-group fallback, visible-session, fullscreen, and canonical ID rules.
- Recorded test-verified examples for session creation, group creation, moves, and T3 metadata updates.

**Files:**

- shared/simple-grouped-session-workspace-state.ts
- shared/simple-grouped-session-workspace-state.test.ts

**Flow:**
extract implementation and test facts from RLM context -> deduplicate -> group by subject -> persist as project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry stores 35 deduplicated factual statements grouped into 35 subjects. The facts span module location, normalization behavior, fallback rules, visible-session management, movement and creation semantics, and concrete test examples.

### Dependencies

The facts depend on the grouped terminal workspace state model and the contract/helper utilities it imports from session-grid-contract, grouped-session-workspace-state-helpers, and session-grid-state.

### Highlights

Most important recall items are that emptied active groups are retained, fallback prefers previous populated groups, browser sessions are stripped during normalization, session IDs are canonicalized from display IDs, new sessions claim the first free display ID, and destination groups become active and focused after session moves.

## Facts

- **simple_grouped_workspace_state_file**: The simple grouped workspace state implementation lives in shared/simple-grouped-session-workspace-state.ts. [project]
- **simple_grouped_workspace_state_test_file**: The test coverage for simple grouped workspace state lives in shared/simple-grouped-session-workspace-state.test.ts. [project]
- **normalize_snapshot_default_behavior**: normalizeSimpleGroupedSessionWorkspaceSnapshot uses createDefaultGroupedSessionWorkspaceSnapshot() when the input snapshot is undefined. [project]
- **normalize_snapshot_minimum_group**: Snapshot normalization ensures at least one group exists and creates createEmptyGroup(DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE) when needed. [project]
- **display_id_normalization_order**: Snapshot normalization runs normalizeWorkspaceSessionDisplayIds(groups) before per-group normalization. [project]
- **browser_sessions_removed**: normalizeGroupSnapshot drops sessions whose kind is browser. [project]
- **canonical_session_id_pattern**: Session IDs are canonicalized from display IDs using session-${formatSessionDisplayId(displayId ?? 0)}. [project]
- **empty_group_retention**: removeSessionInSimpleWorkspace keeps the emptied group in groups after removing its last session. [project]
- **fallback_active_group_priority**: When an active group becomes empty, getFallbackActiveGroupId prefers the nearest previous non-empty group before later groups. [convention]
- **group_local_visible_sessions**: Group-local visibleSessionIds are preserved and restored when switching active groups. [project]
- **single_visible_session_rule**: getNormalizedVisibleIds returns [focusedSessionId] when visibleCount === 1. [project]
- **empty_visible_sessions_rule**: getNormalizedVisibleIds returns [] when there is no focused session or no sessions. [project]
- **split_focus_visibility_swap**: Focusing a hidden session in split mode can replace the currently visible focused session with the newly focused session. [project]
- **first_free_display_id_allocation**: createSessionInSimpleWorkspace allocates the first free display ID instead of duplicating or wrapping display IDs. [project]
- **new_session_focus_behavior**: New session creation appends the session to the active group, focuses it, and recomputes visibleSessionIds. [project]
- **group_indexing_scheme**: focusGroupByIndexInSimpleWorkspace uses 1-based group indexing. [project]
- **t3_metadata_update_rule**: setT3SessionMetadataInSimpleWorkspace only updates sessions whose kind is t3 and preserves session identity. [project]
- **fullscreen_restore_behavior**: toggleFullscreenSessionInSimpleWorkspace stores fullscreenRestoreVisibleCount when entering fullscreen from split mode and restores it when leaving fullscreen. [project]
- **group_reorder_append_rule**: syncGroupOrderInSimpleWorkspace appends any unlisted existing groups after the requested order. [project]
- **move_session_destination_focus**: moveSessionToGroupInSimpleWorkspace activates the destination group, focuses the moved session, and recomputes target visible sessions. [project]
- **create_group_from_session_limit**: createGroupFromSessionInSimpleWorkspace aborts when groups.length >= MAX_GROUP_COUNT. [project]
- **create_empty_group_limit**: createGroupInSimpleWorkspace aborts when groups.length >= MAX_GROUP_COUNT. [project]
- **group_from_session_shape**: createGroupFromSessionInSimpleWorkspace creates a one-session active group with visibleCount 1 and title Group ${nextGroupNumber}. [project]
- **empty_group_creation_shape**: createGroupInSimpleWorkspace appends an empty active group created with createEmptyGroup(nextGroupId, `Group ${nextGroupNumber}`). [project]
- **snapshot_equality_method**: areSnapshotsEqual compares snapshots using JSON.stringify(left) === JSON.stringify(right). [project]
- **duplicate_display_id_repair_example**: Tests verify that duplicate generated display IDs ["52", "52"] normalize to ["52", "00"]. [project]
- **remove_session_previous_group_fallback_example**: Tests verify that closing the active group's last session can switch activeGroupId to DEFAULT_MAIN_GROUP_ID while the emptied group remains present. [project]
- **remove_session_next_group_fallback_example**: Tests verify that if previous groups are empty, removing the last session from group-2 can switch activeGroupId to group-3. [project]
- **group_focus_restore_example**: Tests verify that focusing group-2 restores visibleSessionIds [sessionIdForDisplay(2), sessionIdForDisplay(3)] and focusedSessionId sessionIdForDisplay(2). [project]
- **move_session_focus_example**: Tests verify that moving sessionIdForDisplay(1) into group-2 makes group-2 active and focuses sessionIdForDisplay(1). [project]
- **create_session_split_visibility_example**: Tests verify that creating a second session while visibleCount is 2 keeps split mode and surfaces visibleSessionIds [sessionIdForDisplay(0), sessionIdForDisplay(1)]. [project]
- **first_free_display_id_example**: Tests verify that when existing display IDs are 00 and 02, the next created session gets display ID 01, alias 01, and session ID sessionIdForDisplay("01"). [project]
- **t3_metadata_identity_example**: Tests verify that updating T3 metadata from pending-project/pending-thread to project-123/thread-456 keeps the same sessionId. [project]
- **canonical_drag_removal_example**: Tests verify that createGroupFromSessionInSimpleWorkspace removes a canonicalized dragged session from the source group even when the original sessionId mismatches the displayId. [project]
- **create_group_example**: Tests verify that createGroupInSimpleWorkspace appends group-2 as the active group and increments nextGroupNumber to 3. [project]
