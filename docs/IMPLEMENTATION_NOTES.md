# Implementation Notes

## 1. User Requirements

- Clicking an inactive session card in the sidebar should activate the correct session surface instead of doing nothing.
- For terminal sessions, activation should reopen or attach the VS Code terminal.
- For T3 sessions, activation should reopen the T3 webview when needed.
- For browser sessions, activation should reopen the browser tab when needed.
- Agent resume commands should only use meaningful human aliases.
- Auto-generated session names should be numeric session identifiers, not random words.
- "Clear Auto Names" should use the same auto-name rule as normal session creation.
- Users should not be able to rename a session to a numeric-only alias.
- Terminal tab titles should follow the session naming rule:
  - auto-named sessions: numeric session identifier only
  - renamed sessions: `"<session number> <alias>"`
- After reload/reopen, restored terminals that drift to a generic title should be repairable by reattaching them to VSmux session records and renaming them.

## 2. High-Level Technical Overview

### Session activation

Inactive-session activation was centralized into a small planning layer in [`extension/native-terminal-workspace/session-activation.ts`](./extension/native-terminal-workspace/session-activation.ts). The sidebar still sends the same `focusSession` message, but the controller now decides whether that means:

- do nothing because the session is already focused and live
- focus stored workspace state only
- create or attach a terminal first
- resume an agent session after the surface is visible

The main controller entry point for this is [`extension/native-terminal-workspace/controller-session-actions.ts`](./extension/native-terminal-workspace/controller-session-actions.ts).

### Shared naming rules

Numeric auto-name behavior was moved into shared session helpers in [`shared/session-grid-contract-session.ts`](./shared/session-grid-contract-session.ts). That file now defines:

- how an auto alias is generated
- how to tell whether an alias is numeric-only
- how to tell whether a session alias is still auto-generated
- how terminal/T3 surface titles are formatted

This keeps normal session creation, history cleanup, rename validation, and surface-title formatting aligned.

### Agent resume behavior

Agent resume command building lives in [`extension/native-terminal-workspace-session-agent-launch.ts`](./extension/native-terminal-workspace-session-agent-launch.ts). Resume alias handling was changed so numeric-only aliases are treated as auto names and are therefore not used for Codex/Claude resume commands or copy-resume text.

### Terminal restore/rename behavior

Native terminal attachment and renaming live in [`extension/native-terminal-workspace-backend.ts`](./extension/native-terminal-workspace-backend.ts). The backend now has a `syncRunningTerminalTitles()` method that rescans live VS Code terminals and reruns managed-terminal attachment so restored terminals can be matched back to VSmux sessions and renamed.

## 3. Important Implementation Details

### A. Inactive sidebar sessions no longer noop incorrectly

The core bug was that a focused session could still be inactive, but the controller treated "already focused" as "nothing to do".

The fix:

- `createSessionActivationPlan(...)` classifies the session by kind and live state.
- Terminal sessions are considered live only when a real VS Code terminal projection exists.
- Browser sessions are considered live only when the managed tab exists.
- T3 sessions are considered live only when both the panel exists and the runtime is running.
- If the focused session is not live, the controller no longer bails out early.

For terminal sessions, the controller will call `backend.createOrAttachSession(...)` before reconcile. If the session has a stored agent launch, it will then call the existing resume flow after reveal.

Files:

- [`extension/native-terminal-workspace/session-activation.ts`](./extension/native-terminal-workspace/session-activation.ts)
- [`extension/native-terminal-workspace/controller-session-actions.ts`](./extension/native-terminal-workspace/controller-session-actions.ts)
- [`extension/t3-webview-manager.ts`](./extension/t3-webview-manager.ts)

### B. Random auto names were replaced with numeric session identifiers

Previously, auto aliases were generated from a word list like `Vale`, `Drift`, etc.

Now:

- `createSessionAlias(...)` returns the numeric session display id
- `isGeneratedSessionAlias(...)` compares against that numeric alias
- terminal surface titles use the same rule:
  - auto-generated alias -> just the numeric display id
  - renamed alias -> `<display id> <alias>`

This means the following behaviors now line up:

- new sessions
- previous-session generated-name detection
- "Clear Auto Names"
- terminal surface title formatting

File:

- [`shared/session-grid-contract-session.ts`](./shared/session-grid-contract-session.ts)

### C. Numeric-only aliases are blocked for rename

The rename restriction is enforced in two places on purpose:

- UI/controller validation in [`extension/native-terminal-workspace/controller-session-actions.ts`](./extension/native-terminal-workspace/controller-session-actions.ts)
- state mutation validation in [`shared/session-grid-state-mutations.ts`](./shared/session-grid-state-mutations.ts)

The controller-side validation improves UX by showing an input validation error.
The state-layer validation prevents bad aliases from being stored if the request bypasses the normal prompt flow.

### D. Resume commands ignore numeric-only aliases

Resume commands for human-named agent sessions still work the same way, but numeric-only aliases are now treated as non-meaningful auto names.

Behavior:

- Codex: no `resume <alias>` when alias is numeric-only
- Claude: no `-r <alias>` when alias is numeric-only
- OpenCode: `--continue` still works because it does not depend on alias
- Copy-resume text also suppresses numeric-only alias usage

File:

- [`extension/native-terminal-workspace-session-agent-launch.ts`](./extension/native-terminal-workspace-session-agent-launch.ts)

### E. Restored terminal tabs can be rematched and renamed

The native backend tries to match a VS Code terminal back to a VSmux session in this order:

1. Managed terminal identity from terminal creation env metadata
2. Stored process-id-to-session association
3. Process identity read from the managed session state file
4. Title match fallback against the expected VSmux title

If a match is found, the backend:

- binds the terminal to that session
- refreshes the process association
- calls `syncTerminalName(...)` to rename the terminal if the current tab title is wrong

The important change here is that `syncRunningTerminalTitles()` no longer only checks already-attached projections. It rescans **all** live VS Code terminals and reruns attachment. That is what makes generic restored names like `Code` recoverable if process identity becomes available only after reload settles.

File:

- [`extension/native-terminal-workspace-backend.ts`](./extension/native-terminal-workspace-backend.ts)

### F. Tests added or updated

Focused coverage was added/updated in:

- [`extension/native-terminal-workspace/session-activation.test.ts`](./extension/native-terminal-workspace/session-activation.test.ts)
- [`extension/native-terminal-workspace-session-agent-launch.test.ts`](./extension/native-terminal-workspace-session-agent-launch.test.ts)
- [`shared/session-grid-state-core.test.ts`](./shared/session-grid-state-core.test.ts)
- [`shared/session-grid-state-mutations.test.ts`](./shared/session-grid-state-mutations.test.ts)
- [`extension/previous-session-history.test.ts`](./extension/previous-session-history.test.ts)

## Note About Current Worktree State

There is an active controller refactor in this worktree where split controller files under `extension/native-terminal-workspace/` are not in a clean tracked/buildable state yet. Because of that, some startup-wiring work is harder to verify with a full TypeScript compile even though the backend/session logic above is implemented in the current workspace.
