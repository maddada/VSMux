---
title: Simple Grouped Session Workspace State
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_focus_and_sidebar_drag_semantics.md,
    architecture/terminal_workspace/workspace_sidebar_interaction_state.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:30:09.385Z"
updatedAt: "2026-04-06T03:30:09.385Z"
---

## Raw Concept

**Task:**
Document the simple grouped session workspace state module, covering snapshot normalization, group and session lifecycle mutations, active-group fallback, visible-session handling, and test-verified invariants.

**Changes:**

- Documented fallback activation that retains emptied groups and switches to the nearest non-empty group, preferring previous groups.
- Documented normalization rules that drop browser sessions, repair duplicate display IDs, and canonicalize session IDs from display IDs.
- Documented per-group visible-session restoration during group focus and split-mode focus behavior.
- Documented group creation, session movement, fullscreen restoration, and T3 metadata update semantics.

**Files:**

- shared/simple-grouped-session-workspace-state.ts
- shared/simple-grouped-session-workspace-state.test.ts

**Flow:**
normalize grouped snapshot -> locate active or owning group -> apply group or session mutation -> recompute focus and visibleSessionIds -> normalize final snapshot -> compare snapshots for changed state

**Timestamp:** 2026-04-06

## Narrative

### Structure

shared/simple-grouped-session-workspace-state.ts implements the simplified grouped terminal workspace state model around GroupedSessionWorkspaceSnapshot. The module exposes lookup helpers, focus operations, rename and metadata updates, session and group removal, visible-count and fullscreen toggles, reordering APIs, session moves between groups, and helpers for creating empty groups or groups derived from an existing session. The paired test file, shared/simple-grouped-session-workspace-state.test.ts, verifies the module's key invariants and behavior examples.

### Dependencies

The implementation depends on session-grid-contract helpers and types including createDefaultGroupedSessionWorkspaceSnapshot, createDefaultSessionGridSnapshot, createSessionRecord, clampVisibleSessionCount, formatSessionDisplayId, getOrderedSessions, getSessionNumberFromSessionId, getSlotPosition, DEFAULT_MAIN_GROUP_ID, DEFAULT_MAIN_GROUP_TITLE, MAX_GROUP_COUNT, T3SessionMetadata, TerminalViewMode, and VisibleSessionCount. It also depends on claimNextSessionDisplayId and normalizeWorkspaceSessionDisplayIds from grouped-session-workspace-state-helpers, and syncSessionOrderInSnapshot from session-grid-state.

### Highlights

Normalization guarantees a usable workspace by ensuring at least one group exists, dropping browser sessions, canonicalizing session IDs from display IDs, and repairing duplicate generated display IDs. Removing the last session from the active group does not delete the group; instead, the module preserves that emptied group and activates the nearest other non-empty group, preferring earlier groups before later ones so a populated workarea is shown. Group switching restores each group's remembered visibleSessionIds, moving a session activates and focuses the destination group, and creating a new session preserves split mode while surfacing the new session in the active group. Tests also verify that T3 metadata updates preserve session identity and that dragged sessions with mismatched legacy IDs are still removed correctly after canonicalization.

### Rules

normalizeSimpleGroupedSessionWorkspaceSnapshot(snapshot): use createDefaultGroupedSessionWorkspaceSnapshot() when snapshot is undefined; prepare groups with prepareGroupForDisplayIdNormalization; ensure at least one group exists; normalize display IDs before per-group normalization; keep activeGroupId when it still exists, otherwise fall back to the first normalized group; compute nextGroupNumber, nextSessionDisplayId, and nextSessionNumber from normalized groups.
normalizeGroupSnapshot(snapshot): drop browser sessions; order sessions with getOrderedSessions(...); canonicalize each session ID with withCanonicalSessionId; reassign column, row, and slotIndex from getSlotPosition(index); preserve focusedSessionId only if the canonicalized target still exists, otherwise use the first session ID; set visibleCount to 1 when there are no sessions, otherwise clamp it; keep fullscreenRestoreVisibleCount only when visibleCount === 1; default viewMode to "grid"; normalize visibleSessionIds with getNormalizedVisibleIds(...).
getNormalizedVisibleIds(sessions, visibleCount, focusedSessionId, currentVisibleSessionIds): return [] if no focused session or no sessions; return [focusedSessionId] if visibleCount === 1; deduplicate and filter visible IDs to existing sessions; ensure the focused session is included; fill remaining slots from session order; if there are too many IDs, keep passive visible IDs up to visibleCount - 1 and append the focused session last.
removeSessionInSimpleWorkspace(snapshot, sessionId): remove the session from its owning group, visibleSessionIds, and focusedSessionId if needed; when the removed session was in the active group and the group becomes empty, compute fallbackActiveGroupId with getFallbackActiveGroupId(snapshotWithoutSession, owningGroup.groupId); keep the emptied group in groups.
getFallbackActiveGroupId(snapshot, emptiedGroupId): choose the nearest previous non-empty group first, then the next non-empty group, and fall back to the emptied group ID when no populated groups exist.
createCanonicalSessionId(displayId): return session-${formatSessionDisplayId(displayId ?? 0)}.
createSessionInSimpleWorkspace(snapshot, options?): use the active group only, allocate the next display ID with claimNextSessionDisplayId(normalizedSnapshot), create the session, canonicalize its ID, append it, set focusedSessionId to the new session, and recompute visibleSessionIds.
moveSessionToGroupInSimpleWorkspace(snapshot, sessionId, groupId, targetIndex?): require different source and target groups, remove the session from the source group, insert it into the target group, focus the moved session, recompute target visible sessions, set activeGroupId to the target group, and normalize the final snapshot.
createGroupFromSessionInSimpleWorkspace(snapshot, sessionId): abort when the source group is missing or groups.length >= MAX_GROUP_COUNT; create a one-session active group with visibleCount 1 and title Group ${nextGroupNumber}; remove the session from the source group; append the new group; increment nextGroupNumber.
createGroupInSimpleWorkspace(snapshot): abort when groups.length >= MAX_GROUP_COUNT; append createEmptyGroup(nextGroupId, Group ${nextGroupNumber}), activate it, and increment nextGroupNumber.

### Examples

Normalization example: duplicate generated display IDs ["52", "52"] are repaired to ["52", "00"], aliases become ["52", "00"], and session IDs canonicalize to sessionIdForDisplay("52") and sessionIdForDisplay("00"). Fallback example: closing the active group's last session can set activeGroupId to DEFAULT_MAIN_GROUP_ID while the previous group keeps visibleSessionIds [sessionIdForDisplay(1), sessionIdForDisplay(0)] and focusedSessionId sessionIdForDisplay(0), and the emptied group remains with sessions === []. Forward fallback example: if previous groups are empty, removing the last session from group-2 can switch activeGroupId to "group-3" with visibleSessionIds [sessionIdForDisplay(2), sessionIdForDisplay(1)] and focusedSessionId sessionIdForDisplay(1). Split-mode creation example: after creating one session, setting visibleCount to 2, and creating a second session, the active group shows visibleSessionIds [sessionIdForDisplay(0), sessionIdForDisplay(1)] and focusedSessionId sessionIdForDisplay(1). Canonical drag example: a dragged session with displayId "04" and mismatched original sessionId sessionIdForDisplay("00") can still be moved into a new group using sessionIdForDisplay("04") after canonicalization.

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
