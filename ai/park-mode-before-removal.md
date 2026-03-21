# Park Mode Before Removal

## Summary

Before removal, "park mode" was an experimental zmx-only feature controlled by the setting `VSmux.experimentalParkHiddenZmxTerminalsInPanel`.

When enabled, VSmux stopped disposing hidden VS Code terminal editors during visible-layout changes. Instead, it tried to keep those hidden session terminals alive in the bottom terminal panel and move them back into editor groups when they became visible again.

The goal was to reduce flicker and avoid recreating VS Code terminals while switching visible sessions.

## Files That Implemented It

- `package.json`
- `README.md`
- `extension/native-terminal-workspace.ts`
- `extension/zmx-terminal-workspace-backend.ts`
- `extension/terminal-workspace-helpers.ts`
- `shared/session-grid-parked-terminal-plan.ts`
- `shared/session-grid-parked-terminal-plan.test.ts`
- `extension/zmx-terminal-workspace-backend.test.ts`

## Setting Surface

The feature was exposed through:

- `VSmux.experimentalParkHiddenZmxTerminalsInPanel`

It defaulted to `false`.

The controller in `extension/native-terminal-workspace.ts` listened for configuration changes to that setting and immediately re-ran terminal reconciliation so the workspace switched between the normal recreate-based mode and the parked-terminal mode without requiring a reload.

## Projection Model

Park mode changed the zmx backend’s projection model.

Normally, a `SessionProjection` only needed to represent a visible terminal editor. During park mode, the projection also tracked whether a session terminal was currently:

- in an editor group
- parked in the bottom terminal panel

That meant `SessionProjection` carried a `location` field with one of:

- `{ type: "editor", visibleIndex }`
- `{ type: "panel" }`

This allowed the backend to keep a session terminal instance alive even when it was not visible in the editor area.

## Reconcile Entry Point

`extension/zmx-terminal-workspace-backend.ts` branched inside `reconcileVisibleTerminals(...)`.

With park mode disabled:

- it used the normal reconcile path
- unchanged visible terminals could be reused incrementally
- changed visible terminals were recreated as fresh VS Code terminals attached with `zmx attach`

With park mode enabled:

- it called `reconcileVisibleTerminalsWithParkedProjections(...)`

That parked-mode path first made sure every tracked session had a live projection, creating missing terminals in the panel when necessary.

## Parked Projection Creation

`ensureParkedProjections(...)` created missing terminals in panel location instead of editor location.

Each parked terminal used the same zmx attach shell path as the normal editor terminal path, but its VS Code location was `TerminalLocation.Panel`.

This meant hidden sessions stayed alive as actual VS Code terminals in the bottom panel instead of being disposed.

## Planner

The parked-mode planner lived in `shared/session-grid-parked-terminal-plan.ts`.

Its purpose was to convert:

- the previous visible session ids
- the next visible session ids

into one of two strategies:

- `transfer`
- `rebuild`

### Transfer Strategy

The transfer strategy produced ordered step lists such as:

- `promote`: move a parked panel terminal up into an editor slot
- `demote`: move a visible editor terminal down into the panel

The initial version tried to minimize visible jitter by promoting the incoming session before demoting the outgoing one.

Later, this planner was tightened so that only no-op layouts stayed on the transfer path. Any visible-slot mutation that required replacing an occupied slot was downgraded to `rebuild`, because the actual VS Code move primitives were not reliable enough to guarantee slot-stable in-place replacement.

### Rebuild Strategy

The rebuild strategy was used when:

- there was no current visible layout
- the layout shape changed
- later, any occupied-slot transfer was considered unsupported

In rebuild mode, park mode still reused existing terminals. It did not recreate them, but it did rebuild the editor layout by moving visible terminals out, applying layout, and moving the target terminals back in.

## Backend Transfer Flow

`applyParkedTerminalTransferPlan(...)` executed the planner’s ordered steps.

For each step:

- `promote` called `moveProjectionToEditor(...)`
- `demote` called `moveProjectionToPanel(...)`

After all steps, the backend focused the intended visible session.

This was the intended minimal-action path for hidden-session activation and similar same-shape transitions.

## Backend Rebuild Flow

`reconcileVisibleTerminalsByMovingParkedProjections(...)` was the fallback path.

Its sequence was:

1. Move all current editor projections down into the panel.
2. Apply the requested editor layout shape.
3. Move the next visible sessions from panel back into editor slots.
4. Focus the intended visible session.

Unlike the normal non-park path, this rebuild did not dispose the hidden session terminals. It only moved them between the panel and editor area.

## Panel and Editor Move Helpers

The park-mode backend added explicit helpers:

- `moveProjectionToEditor(sessionId, visibleIndex)`
- `moveProjectionToPanel(sessionId)`

The editor move helper went through several iterations:

- initially it activated the terminal in the panel and then called `moveToEditor`
- later it focused the target editor group before moving the terminal
- later still it aligned the moved editor into the intended slot by checking the active group’s `viewColumn` and shifting the active editor left or right when VS Code created an adjacent extra group

Those fixes were attempts to make panel-to-editor moves deterministic.

## Active Panel Selection Preservation

Because moving terminals between editor and panel could change the active panel selection, the backend also added logic to:

- snapshot the currently selected panel terminal before reconciliation
- restore that panel terminal selection afterward when possible

This tried to prevent visible-session switches from unexpectedly changing which hidden terminal tab was selected in the panel.

## Rename Handling

Normal zmx rename handling rebuilt visible terminal projections so the editor tab title updated.

Park mode added a special rename path:

- if the renamed session was parked in the panel, recreate it in panel location
- if it was visible in the editor, recreate it in editor location

That let the tab title update without fully dropping out of the parked-terminal model.

## Debug Delay

Park mode coexisted with `VSmux.experimentalZmxActionDelayMs`.

That delay setting inserted pauses before VSmux-issued terminal UI actions so the move sequence could be observed step by step while debugging layout behavior.

## Why It Was Removed

The feature achieved the original goal of avoiding terminal recreation, but it introduced significant complexity around:

- editor-group placement
- panel/editor move semantics
- active panel selection preservation
- planner assumptions versus real VS Code behavior
- extra empty editor groups appearing during or after moves

Because of that complexity, the setting and implementation were removed from the codebase, while this document preserves the design and runtime behavior that existed before removal.
