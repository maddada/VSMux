# Two-Way Split Implementation

## 1. All user requirements (high level)

This work added the first real split-mode implementation for grouped sessions, with the immediate goal of supporting only split counts `1` and `2` in the UI.

The high-level requirements from this conversation were:

- Add support for a real two-way split mode.
- Keep split logic maintainable by implementing each split count in its own file:
  - `1`
  - `2`
  - `3`
  - `4`
  - `6`
  - `9`
- For split `2`, if a group only has one session, do not split yet. Show that one session only.
- When a second session is added to that group, surface both sessions and switch to a two-column layout.
- Avoid unnecessary moves and keep transitions smooth.
- Sessions that are not part of the active group should stay behind the currently surfaced sessions for the active group.
- Respect the distinction between:
  - `active`: the currently focused session in the group
  - `visible`: all sessions currently surfaced for the active group
- In a group with more than two sessions while split `2` is selected, the last two activated sessions should be the ones surfaced.
- If the user clicks a hidden session in the same group, that hidden session should replace the currently active surfaced session, while the other surfaced session stays visible.
- The active session must be the one that gets swapped out when choosing another hidden session in two-way mode.
- When that hidden session is behind another terminal/group, it must be activated first and then moved into the outgoing active session’s slot.
- When switching between groups, always make sure both the active session and the visible-but-not-active session for that group are surfaced.
- Hide the sidebar buttons for `3`, `4`, `6`, and `9` for now, but do not remove their code or future support.
- Keep the implementation simple, reliable, and easy to debug later.

## 2. High level technical overview

The core change was moving from a mostly “reveal the focused session” approach to a real projection system.

Before this work, the extension had group state such as active group, focused session, and visible sessions, but the actual VS Code workbench layout and surfaced editors were not driven by a dedicated split strategy layer. That made two-way behavior harder to reason about and harder to stabilize.

The new implementation introduced a split projection flow:

1. Read the active group snapshot from the grouped session store.
2. Build a split projection for the group based on its `visibleCount`.
3. Compare the desired workbench layout with the current editor layout.
4. Apply the minimum layout change needed.
5. Surface each visible session into its intended group/column.
6. Surface passive visible sessions first and the focused session last so final focus stays correct.
7. Verify that each visible session actually landed where expected and re-surface it if needed.

This logic is now organized around separate split strategy files in:

- [extension/native-terminal-workspace/splits/split-1.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-1.ts)
- [extension/native-terminal-workspace/splits/split-2.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-2.ts)
- [extension/native-terminal-workspace/splits/split-3.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-3.ts)
- [extension/native-terminal-workspace/splits/split-4.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-4.ts)
- [extension/native-terminal-workspace/splits/split-6.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-6.ts)
- [extension/native-terminal-workspace/splits/split-9.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-9.ts)

They are routed through:

- [extension/native-terminal-workspace/splits/index.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/index.ts)

The main controller that consumes those projections is:

- [extension/native-terminal-workspace/controller-base.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/controller-base.ts)

To make projection work across all supported surface types, the controller now uses slot-aware surfacing APIs from:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace-backend.ts)
- [extension/browser-session-manager.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/browser-session-manager.ts)
- [extension/t3-webview-manager.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/t3-webview-manager.ts)

The sidebar still supports the full visible-count type, but only shows `1` and `2` right now:

- [sidebar/session-group-section.tsx](/Users/madda/dev/_active/agent-tiler.worktrees/test/sidebar/session-group-section.tsx)

## 3. Going into details of the most important parts and explaining technical implementation

### 3.1 Split strategies are now isolated per count

The split layer introduces a simple projection contract in:

- [extension/native-terminal-workspace/splits/types.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/types.ts)

Each split strategy returns:

- `layout`: the desired editor-group layout shape
- `slotSessionIds`: which session should appear in each visible slot
- `focusedSessionId`: the session that should end up focused
- `splitCount`: the selected visible count

For split `2`, the important behavior is in:

- [extension/native-terminal-workspace/splits/split-2.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/split-2.ts)

That file intentionally stays simple:

- It takes up to the first two `visibleSessionIds`.
- If there are actually two visible sessions, it returns a two-column layout.
- If there is only one visible session, it still returns a one-column layout even though the selected count is `2`.

That directly implements the rule: “split in 2 only when the group actually has 2 surfaced sessions.”

### 3.2 The controller now projects the group instead of only revealing one session

The most important architectural change is in:

- [extension/native-terminal-workspace/controller-base.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/controller-base.ts)

The controller now builds a `SessionSplitProjection` from the active snapshot and reconciles the editor area from that projection.

The important controller responsibilities are:

- Build the target split projection from group state.
- Ensure the VS Code editor layout shape matches the projection.
- Surface each slot session into the correct workbench group.
- Surface passive slots first.
- Surface the focused slot last so active focus ends in the right place.
- If focus must be preserved, restore the previously active editor group afterward.

This was the key step that made two-way behavior reliable, because the controller now reasons in terms of visible slots instead of treating the focused session as the only thing that matters.

### 3.3 The implementation uses actual editor-group layout helpers

To support projection, the workbench helper layer gained APIs for reading and applying editor layouts in:

- [extension/terminal-workspace-environment.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/terminal-workspace-environment.ts)

This layer now supports:

- reading the current editor layout
- setting the editor layout
- comparing layout shape
- moving the active editor to a target group
- focusing a group by index

This matters because split behavior is now based on the real workbench layout, not just assumptions about what is already open.

### 3.4 Surface managers now support “reveal this session in this group”

Previously, each session type mostly knew how to open or focus itself. For two-way projection, the controller needed a stronger contract: “put this session into this slot/group.”

That is why the surface managers now expose group-aware reveal APIs.

#### Native terminal backend

File:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace-backend.ts)

Important additions:

- `getObservedGroupIndex(sessionId)`
- `revealSessionInGroup(sessionRecord, targetGroupIndex, preserveFocus?)`

The terminal path is the most sensitive because VS Code terminals can be active in one group while hidden behind others.

The important terminal behavior implemented here is:

- If the terminal is already live in the correct group, keep it there and just surface it.
- If it is live but in the wrong group, move it to the target group.
- If it is hidden behind another visible terminal, activate it first, wait until it becomes the actual active terminal, and only then move it.

That last step was added specifically to fix the bug you found in two-way mode. Without that wait, the move command could apply to the wrong terminal because VS Code’s move command operates on the currently active editor/terminal.

### 3.5 Browser tabs and T3 panels also became slot-aware

Files:

- [extension/browser-session-manager.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/browser-session-manager.ts)
- [extension/t3-webview-manager.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/t3-webview-manager.ts)

Both managers now support:

- observing where a surfaced session currently lives
- surfacing a session into a specific editor group

For browser tabs:

- If a managed browser tab already exists in the correct group, it is revealed there.
- If it exists in the wrong group, it is moved.
- If it does not exist, it is opened directly into the target group.
- Passive visible browser tabs can be surfaced with `preserveFocus` so they become visible without stealing final focus.

For T3 panels:

- Existing panels are reused when possible.
- The panel is revealed into the target column.
- Previous focus can be restored if this was only surfacing a passive visible session.

This made the controller logic consistent across terminals, browser tabs, and T3 sessions.

### 3.6 Group switching now verifies both visible sessions are actually surfaced

After the first implementation pass, there was still an issue when switching groups: sometimes the active session was surfaced correctly, but the other visible session from that group remained hidden behind something else.

That was fixed in:

- [extension/native-terminal-workspace/controller-base.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/controller-base.ts)

The controller now performs a follow-up verification step after the main projection pass:

- For each visible slot session, check the observed column/group where it actually ended up.
- Compare that with the intended slot.
- If the session did not land in the expected slot, surface it again into the intended group.

This extra verification is what ensures that, on group switch, both the `active` session and the `visible but not active` session are actually brought forward.

### 3.7 Hidden-session replacement in two-way mode now swaps only the active slot

Another bug found during this conversation was the swap behavior when activating a hidden session in a two-way group.

The intended behavior is:

- The currently active surfaced session is the one that gets replaced.
- The other visible surfaced session must remain visible and should not move.
- If the new session is hidden behind another visible session, activate it first and then move it into the outgoing active session’s slot.

The key fix for this lives in:

- [extension/native-terminal-workspace-backend.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace-backend.ts)

The terminal backend now explicitly waits for the newly shown terminal to become the active terminal before issuing the move-to-group command. That sequencing is what preserves the passive visible session’s position while swapping only the active slot.

### 3.8 The sidebar only exposes `1` and `2`, but future counts remain intact

The UI change is intentionally small and isolated:

- [sidebar/session-group-section.tsx](/Users/madda/dev/_active/agent-tiler.worktrees/test/sidebar/session-group-section.tsx)

The code still keeps:

- `COUNT_OPTIONS = [1, 2, 3, 4, 6, 9]`

But it renders from a filtered list:

- `SIDEBAR_VISIBLE_COUNT_OPTIONS`

That means:

- the underlying type support is still present
- the split files for `3/4/6/9` still exist
- those buttons are simply hidden from the sidebar for now

This was done so those layouts can be enabled later without having to rebuild the structure.

### 3.9 Tests and validation added during the work

Split projection tests were added in:

- [extension/native-terminal-workspace/splits/index.test.ts](/Users/madda/dev/_active/agent-tiler.worktrees/test/extension/native-terminal-workspace/splits/index.test.ts)

These tests cover the most important contract of the split layer, especially that split `2` stays as one column until there are actually two visible sessions.

During implementation, the code was also type-checked with:

```bash
npx -y -p typescript tsc -p tsconfig.extension.json --noEmit
```

That passed after the final fixes in this conversation.

### 3.10 The final mental model

The best way to think about the final implementation is:

- The store decides which sessions are `visible` and which one is `active`.
- The split strategy converts that state into a desired slot layout.
- The controller projects that desired layout into the VS Code workbench.
- Each surface manager knows how to place its own session type into a specific editor group.
- After projection, the controller verifies that every visible session really ended up where expected.

That is the main improvement from this conversation: the workbench layout is now derived from explicit split projection instead of incidental focus/reveal behavior.
