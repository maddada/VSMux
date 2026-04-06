---
title: Workspace Session Sleep Wake Support
tags: []
related:
  [
    architecture/terminal_workspace/simple_grouped_session_workspace_state.md,
    architecture/terminal_workspace/workspace_sidebar_interaction_state.md,
    architecture/terminal_workspace/workspace_session_sleep_wake_support.md,
  ]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:55:10.641Z"
updatedAt: "2026-04-06T03:55:53.307Z"
---

## Raw Concept

**Task:**
Document sleep and wake support for grouped terminal workspace sessions and session groups

**Changes:**

- Added persisted isSleeping state to session records
- Excluded sleeping sessions from awake focus and visible split calculations
- Added single-session and group sleep wake workspace mutation APIs
- Added sidebar context menu actions for sleeping and waking sessions and groups
- Disposed terminal runtime surfaces when sessions are put to sleep while preserving resume metadata

**Files:**

- shared/simple-grouped-session-workspace-state.ts
- extension/session-grid-store.ts
- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- sidebar/session-group-section.tsx

**Flow:**
sidebar sleep or wake action -> controller setSessionSleeping or setGroupSleeping -> session grid store mutation and persistence -> sleeping terminal surfaces disposed or focus-based wake path executed -> sidebar and workspace state refreshed

**Timestamp:** 2026-04-06

## Narrative

### Structure

Sleep and wake behavior spans the shared grouped workspace snapshot logic, the persisted session grid store, the native terminal workspace controller, and sidebar UI menu actions. The shared workspace state now treats awake sessions as the source of truth for focus, visible session normalization, active session counts, and active-group fallback decisions.

### Dependencies

Controller behavior depends on shared mutation helpers in shared/simple-grouped-session-workspace-state.ts and persisted snapshot updates in extension/session-grid-store.ts. UI sleep controls are limited to non-browser sessions and groups, and sleeping terminal sessions additionally depend on controller disposal of live backend surfaces while keeping persisted session metadata for later resume or reattach.

### Highlights

Session records now persist isSleeping. Focusing a sleeping session implicitly wakes it. Group sleep and wake actions toggle all member sessions. Sleeping does not remove session or group records, but sleeping sessions no longer participate in focus or visible split calculations. If sleep empties the active group of awake sessions, selection falls back to another non-empty group.

### Rules

Sleep applies only to non-browser sessions/groups in controller and UI flows. Sleeping does not delete session/group records. Sleeping removes sessions from awake/focus/visible calculations. Waking can occur implicitly by focusing a sleeping session. Group sleep/wake toggles all sessions in the group. If a sleep action empties the active group of awake sessions, active group selection falls back to another non-empty group.

### Examples

Shared APIs include setSessionSleepingInSimpleWorkspace(snapshot, sessionId, sleeping) and setGroupSleepingInSimpleWorkspace(snapshot, groupId, sleeping). Sidebar session cards post { type: "setSessionSleeping", sessionId, sleeping } and still post { type: "focusSession", sessionId } for sleeping focused sessions so focus can wake them. Group sections post { type: "setGroupSleeping", groupId, sleeping } and render Sleep or Wake based on whether all sessions are sleeping.

## Facts

- **session_sleep_flag**: Session records persist an isSleeping flag in grouped workspace state. [project]
- **sleep_visibility_rules**: Sleeping sessions are excluded from focus and visible split calculations. [project]
- **focus_wakes_sleeping_session**: Focusing a sleeping session wakes it by forcing isSleeping to false. [project]
- **group_sleep_toggle**: Group sleep and wake toggles apply to all sessions in a group. [project]
- **sleep_scope**: Sleep actions apply only to non-browser sessions and groups in UI and controller flows. [project]
- **terminal_sleep_runtime_behavior**: Sleeping a terminal session disposes its live surface or runtime without deleting the session card or persisted resume metadata. [project]
- **active_group_sleep_fallback**: If a sleep action leaves the active group with no awake sessions, the active group falls back to another non-empty group. [project]
- **sleep_sidebar_messages**: Sidebar session cards post setSessionSleeping and focusSession messages, and group sections post setGroupSleeping messages. [project]
