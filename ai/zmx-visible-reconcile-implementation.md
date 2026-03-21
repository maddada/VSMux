# Zmx Visible Session Reconcile: Current Implementation

This document explains the current implementation of visible-session reconciliation for the zmx-backed terminal workspace.

It describes the code as it exists today, centered on these files:

- `shared/session-grid-reconcile-plan.ts`
- `extension/zmx-terminal-workspace-backend.ts`

This is the implementation that runs when the active group changes, when a hidden session is focused, when a visible session is closed and another one backfills into view, and when the user reorders sessions in the sidebar.

## Goals

The current implementation is trying to solve one specific UX problem:

- avoid tearing down every visible terminal when only part of the visible set changed
- preserve unchanged visible terminals in place
- reduce layout jitter when a hidden session replaces one visible session
- keep the logic deterministic and testable

The implementation does **not** currently try to retarget a single existing VS Code terminal process from one zmx session to another in place. Instead, it minimizes churn by:

- keeping unchanged projections alive
- attaching new terminals only for changed slots
- disposing outgoing terminals only after incoming ones have been attached

That is a large improvement over the old full-rebuild path, while staying compatible with the current zmx terminal-launch model.

## Terminology

- `snapshot`: the target `SessionGridSnapshot` for the active group
- `visibleSessionIds`: the ordered list of sessions that should currently be shown in editor groups
- `projection`: a live VS Code terminal currently attached to a zmx session
- `slot`: the index inside `visibleSessionIds`
- `shape`: the editor layout structure implied by visible count plus view mode

## High-Level Flow

When the backend receives a new target snapshot, it does this:

1. Save the previous visible snapshot.
2. Build a pure reconcile plan from `previousSnapshot -> nextSnapshot`.
3. If the layout shape changed, do a full rebuild.
4. If the current editor state cannot be trusted, do a full rebuild.
5. Otherwise, apply the incremental plan:
   - keep unchanged slots as-is
   - create incoming projections for changed slots first
   - dispose outgoing projections after the incoming ones exist
   - focus the final target session

The entry point for that is `reconcileVisibleTerminals()` in `extension/zmx-terminal-workspace-backend.ts`.

## The Pure Planner

The planner lives in `shared/session-grid-reconcile-plan.ts`.

Its job is intentionally narrow:

- it does not touch VS Code APIs
- it does not know about terminals or zmx processes
- it only compares two visible layouts and describes the minimal slot-level change set

### Planner Input

The planner takes:

- `currentSnapshot | undefined`
- `nextSnapshot`

### Planner Output

The planner returns one of two strategies:

### `rebuild`

Returned when:

- there is no current visible layout
- the requested layout shape changed

Today, shape is considered changed when:

- `viewMode` changed
- or the row layout implied by visible count changed

Examples:

- `vertical` with 2 visible sessions -> `grid` with 4 visible sessions
- `horizontal` with 3 visible sessions -> `grid` with 3 visible sessions
- `grid` with 4 visible sessions -> `grid` with 6 visible sessions

### `incremental`

Returned when the layout shape is stable.

The incremental plan contains:

- `unchangedSlots`
- `changedSlots`
- `incomingSlots`
- `outgoingSlots`
- `movedSessions`
- `hasChanges`

These fields are pure descriptions of the slot transition.

### Why `movedSessions` Exists

`movedSessions` is included so the reconcile result preserves intent explicitly.

Even though the backend currently applies the plan through incoming/outgoing attachments rather than a dedicated in-place move primitive, `movedSessions` still matters because it captures:

- which sessions remained visible
- which slot they moved from
- which slot they moved to

That makes the algorithm easier to reason about and easier to evolve later.

## Incremental Backend Execution

The incremental backend path lives in `reconcileVisibleTerminalsIncrementally()` inside `extension/zmx-terminal-workspace-backend.ts`.

The execution order is deliberate.

### 1. Validate that incremental reconcile is safe

Before using the incremental path, the backend checks:

- a previous snapshot exists
- the number of tracked projections still matches the previous visible set
- every previously visible session still has a tracked projection
- the current editor layout still matches the previous visible layout

If any of these checks fail, the backend falls back to the full rebuild path.

This protects the incremental logic from running against a stale or already-drifted editor state.

### 2. Snapshot outgoing projections

Before creating anything new, the backend captures the current terminal projection object for every outgoing slot.

That matters because some sessions may be both:

- outgoing from one slot
- incoming into another slot

In those cases, a new projection for the same session will replace the tracked projection entry, so the backend needs the original terminal object saved ahead of time in order to dispose it later.

### 3. Create incoming projections first

For every incoming slot, the backend creates a new VS Code terminal attached to the target zmx session and places it in the target editor group.

This is the core UX improvement.

Instead of:

- disposing the old visible terminal first
- leaving an empty group behind
- then creating the replacement

the current implementation does:

- attach the replacement first
- let it land in the target group
- then remove the outgoing terminal

That reduces resizing and visible layout thrash.

### 4. Dispose outgoing projections second

After incoming projections exist, the backend disposes the outgoing terminals that were captured before the transition started.

This is done by terminal reference, not just by session id.

That is important because a moved session can temporarily have:

- one old terminal still attached to the old slot
- one new terminal already attached to the new slot

Disposing by reference avoids accidentally deleting the newly tracked projection.

### 5. Focus the final target session

At the end of reconcile, the backend focuses:

- `snapshot.focusedSessionId`
- or the first visible session if no explicit focused session is present

## Why This Helps The Reported Cases

### Hidden session activation

Example:

- current visible: `[Harbor, Golden]`
- next visible: `[Harbor, River]`

Old behavior:

- dispose `Harbor`
- dispose `Golden`
- rebuild layout
- create `Harbor`
- create `River`

Current behavior:

- keep `Harbor` untouched
- create `River` in slot 1
- dispose `Golden`

That is the exact class of churn reduction this change is meant to provide.

### Closing a visible session

Example:

- current visible: `[A, B, C]`
- close `B`
- next visible becomes `[A, C, D]`

Current behavior:

- keep `A`
- attach `C` into its new slot
- attach `D` into the new tail slot
- dispose outgoing `B`
- dispose the old `C` projection

So the backend only touches the slots that actually changed.

### Reordering sessions in the sidebar

Example:

- current visible: `[A, B, C, D]`
- next visible: `[A, C, B, D]`

Current behavior:

- keep `A`
- keep `D`
- create incoming `C` at slot 1
- create incoming `B` at slot 2
- dispose old `B`
- dispose old `C`

This is still attachment-based rather than a true in-place retarget or editor-tab move, but it avoids rebuilding the whole visible workspace.

## Full Rebuild Path

The full rebuild path still exists and is still important.

It is used when:

- there is no current layout to diff against
- the requested layout shape changed
- or the current editor state cannot be trusted for incremental reconcile

The rebuild path does this:

1. Dispose all current projections.
2. Apply the requested editor layout with `applyEditorLayout(...)`.
3. Create a fresh projection for each visible session in slot order.
4. Focus the final target session.

This remains the correct path for structural layout changes.

## Why Renames Still Rebuild

Visible session renames still go through the rebuild path intentionally.

Reason:

- the planner only compares slot/session placement
- it does not treat terminal title changes as a slot reconcile concern
- the current backend updates visible terminal tabs by recreating those projections

So renaming a visible session is still handled as a rebuild of the visible projections, even if the visible session ids did not change.

## Important Constraint: No True In-Place Retarget Yet

The current implementation still does **not** do this:

- take one already-running VS Code terminal process
- detach it from zmx session `A`
- reattach that same terminal process to zmx session `B`

Why not:

- the current terminal launch model starts the VS Code terminal directly with the zmx attach command
- that makes safe in-place retargeting a separate architectural change

So the current system should be understood as:

- minimal-churn projection replacement
- not true terminal-process reuse across different sessions

That said, unchanged sessions **are** preserved, which is the most important immediate UX win.

## Tests

The planner has dedicated unit tests in `shared/session-grid-reconcile-plan.test.ts`.

The tests cover:

- missing-current-layout rebuild
- hidden-session replacement while preserving unchanged slots
- kill/backfill with minimal changed slots
- reorder behavior with preserved unchanged slots
- no-op incremental reconcile
- layout-shape rebuild
- view-mode-change rebuild

These tests are intentionally written against the pure planner so the transition logic stays easy to verify independently of VS Code terminal behavior.

## Files To Read Together

If you want to understand the current implementation end-to-end, read these in order:

1. `shared/session-grid-reconcile-plan.ts`
2. `shared/session-grid-reconcile-plan.test.ts`
3. `extension/zmx-terminal-workspace-backend.ts`

That gives you:

- the state transition model
- the expected planner behavior
- the concrete terminal-side application logic

## Summary

The current implementation improves visible-session UX by introducing a pure reconcile planner plus an incremental zmx backend path that preserves unchanged visible terminals and only reattaches the slots that actually changed. It is intentionally conservative: if the layout shape changed or the current editor state looks unreliable, it falls back to the existing rebuild path.
