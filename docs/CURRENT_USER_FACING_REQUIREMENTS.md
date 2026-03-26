# Current User-Facing Requirements

This document captures the current product requirements for grouped sessions, split mode, and code mode.

Scope notes:

- Session types in scope are only `CLI` and `T3`
- Browser sessions are out of scope
- User-facing split counts are only `1` and `2`

## Required Behavior

1. Sessions are organized into groups.
Each group owns its own session list, focused session, visible sessions, and split preference.

2. Only the active group drives the editor-area layout.
Inactive groups keep their state, but do not control the visible editor columns.

3. Supported session types are only `CLI` and `T3`.

4. Each group supports only two split modes in the UI:
`1` and `2`.

5. Split mode `1`:
show exactly one session for the active group, which is the group's focused session.

6. Split mode `2`:
show up to two visible sessions for the active group side by side.

7. Split mode `2` with only one visible session:
show one pane only. Do not create an empty second pane.

8. The active group state must distinguish:
`focusedSessionId` = final focused session
`visibleSessionIds` = sessions that should be surfaced

9. Clicking a currently visible session:
keep the same visible set and change focus to that session.

10. Clicking a hidden session in split mode `2`:
replace the currently focused visible session with the clicked hidden session.
The other visible session must remain visible.

11. When switching groups:
restore that group's own `focusedSessionId`, `visibleSessionIds`, and split mode.

12. Restoring a split-2 group must actually surface both intended sessions side by side, not just mark them visible in state.

13. Final focus must be correct after every reconcile.
Passive visible session first, focused session last.

14. `CLI` sessions must be surfaced into the correct editor slot.
If needed, they may be activated first so VS Code move commands act on the right terminal.

15. `T3` sessions must be reopened or revealed into the correct editor slot when they are part of the visible set.

16. Split mode is per-group.
Changing one group must not affect another group's split mode.

17. Persisted workspace state must preserve:
groups, session membership, focused session, visible sessions, and split mode.

## Code Mode

18. Code mode is a single toggle.

19. When code mode is turned on:
stop managing the editor-area split layout.

20. When code mode is turned on:
move all managed `CLI` terminals out of the editor area and into the bottom terminal panel.

21. When code mode is turned on:
dispose or close managed `T3` editor panels from the editor area.

22. When code mode is turned on:
do not immediately pull managed sessions back into editor splits.

23. When code mode is turned off:
resume normal VSmux editor-area management.

24. When code mode is turned off:
restore the active group's intended visible sessions back into their proper editor slots.

25. When code mode is turned off:
the group's focused session must end up focused again.

26. Code mode must not destroy logical workspace state.
It only changes where managed surfaces are shown.

## Non-Goals

1. No browser-session support.
Ignore browser entirely.

2. No user-facing split counts beyond `1` and `2`.

3. No requirement to keep inactive groups visibly open in the editor area.

4. No requirement to preserve arbitrary manual editor layouts while VSmux is active.
The active group layout wins.

5. No requirement for code mode to preserve T3 panel UI state beyond what normal session persistence already supports.

6. No requirement to restore every previously surfaced session after code mode.
Only the active group's currently intended visible sessions matter.

7. No requirement to make code mode aware of unmanaged terminals.
Only managed terminals are in scope.

## Edge Cases

1. Split mode `2` with one session in the group:
show one pane.

2. Split mode `2` with more than two sessions in the group:
only two are surfaced.
The clicked hidden session replaces the focused visible one.

3. Focused session missing from `visibleSessionIds`:
reconcile should still end with a valid focused visible session.

4. A `CLI` terminal exists but is hidden behind another terminal tab:
it must be brought foreground before move or reveal operations that depend on active-terminal behavior.

5. A `T3` session is logically visible but its panel is gone:
reconcile should reopen it if it belongs in the visible set.

6. Code mode turned on with no managed editor terminals:
should no-op cleanly.

7. Code mode turned off when the active group has no sessions:
should no-op cleanly.

8. Code mode turned off when the active group is split `2` but only one visible session is available:
restore one pane only.

9. Switching groups while code mode is off:
should restore the new active group's intended visible sessions.

10. Switching groups while code mode is on:
should update logical active-group state, but should not resume editor-area split management until code mode is turned off.
