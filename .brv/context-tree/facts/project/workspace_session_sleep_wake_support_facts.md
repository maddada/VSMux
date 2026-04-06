---
title: Workspace Session Sleep Wake Support Facts
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:55:10.642Z"
updatedAt: "2026-04-06T03:55:53.309Z"
---

## Raw Concept

**Task:**
Capture project facts about terminal workspace session and group sleep wake behavior

**Changes:**

- Recorded persisted session sleep state and wake on focus semantics
- Recorded terminal runtime disposal semantics for sleeping sessions
- Recorded sidebar sleep wake command messages and fallback behavior

**Files:**

- shared/simple-grouped-session-workspace-state.ts
- extension/session-grid-store.ts
- extension/native-terminal-workspace/controller.ts
- sidebar/sortable-session-card.tsx
- sidebar/session-group-section.tsx

**Flow:**
extract implementation facts -> deduplicate by subject -> store in facts/project for recall

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact entry captures implementation-level facts about how terminal workspace sessions and groups enter and leave sleeping state.

### Dependencies

These facts depend on the grouped workspace snapshot model, controller lifecycle handling, persisted store updates, and sidebar command wiring.

### Highlights

The most important facts are persisted isSleeping state, wake-on-focus semantics, non-browser-only scope, and disposal of live terminal runtime while retaining resumable metadata.

## Facts

- **session_sleep_flag**: Session records persist an isSleeping flag in grouped workspace state. [project]
- **sleep_visibility_rules**: Sleeping sessions are excluded from focus and visible split calculations. [project]
- **focus_wakes_sleeping_session**: Focusing a sleeping session wakes it by forcing isSleeping to false. [project]
- **group_sleep_toggle**: Group sleep and wake toggles apply to all sessions in a group. [project]
- **sleep_scope**: Sleep actions apply only to non-browser sessions and groups in UI and controller flows. [project]
- **terminal_sleep_runtime_behavior**: Sleeping a terminal session disposes its live surface or runtime without deleting the session card or persisted resume metadata. [project]
- **active_group_sleep_fallback**: If a sleep action leaves the active group with no awake sessions, the active group falls back to another non-empty group. [project]
- **sleep_sidebar_messages**: Sidebar session cards post setSessionSleeping and focusSession messages, and group sections post setGroupSleeping messages. [project]
