# Bug Report: Visible Terminal Pane Periodically Flashes Black

## Summary

A visible terminal pane intermittently flashes to a black background and then returns to normal rendering while the user remains on the same terminal session. This appears to be a frontend rendering issue in the workspace terminal pane lifecycle, not a terminal session teardown or workarea reload issue.

## Symptoms

- A terminal pane that is currently visible briefly flashes black.
- The flash repeats periodically every few seconds.
- The terminal session then returns to normal without user action.
- This occurs while staying on the same terminal pane.
- The symptom is distinct from the separate lag/reload issue.

## Likely Regression Window

Most likely introduced by recent terminal runtime/canvas visibility work from April 5, 2026, especially:

- Commit `3e3b63f` `feat: enhance terminal functionality and improve workspace interactions`
- Possibly influenced by later terminal pane maintenance changes, but not primarily by the lag-reload work from April 6

## Most Likely Cause

The terminal pane has explicit logic that:

1. Seeds the terminal surface and canvas background to the startup black color.
2. Hides/shows canvas content using opacity.
3. Re-runs visible maintenance on observer-driven updates.

Relevant code paths:

- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L306) `runVisibleMaintenance`
- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L321) `seedResttyBackgroundSurfaces`
- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L346) `setResttyCanvasVisibility`
- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L362) `maybeRevealResttyCanvas`

This maintenance is invoked repeatedly, including from:

- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L1094) `ResizeObserver`
- [terminal-pane.tsx](/Users/madda/dev/_active/agent-tiler/workspace/terminal-pane.tsx#L1110) `MutationObserver`

The likely failure mode is that observer-driven maintenance re-applies the startup black surface treatment and/or interacts badly with canvas reveal timing while the terminal is already visible, producing a black flash.

## Why This Is Unlikely To Be The Lag Reload Fix

The newer lag workaround primarily affects workarea-level recovery:

- [workspace-app.tsx](/Users/madda/dev/_active/agent-tiler/workspace/workspace-app.tsx#L615) lag-triggered reload path
- [workspace-panel.ts](/Users/madda/dev/_active/agent-tiler/extension/workspace-panel.ts#L101) `retainContextWhenHidden: false`

These changes affect whole-workarea reload/hide-show behavior, not periodic black flashing inside a currently visible terminal pane.

## Why This Is Unlikely To Be Session Destruction

Runtime destruction paths are tied to session teardown/removal:

- [controller.ts](/Users/madda/dev/_active/agent-tiler/extension/native-terminal-workspace/controller.ts#L2049) `destroyTerminalRuntime`
- [workspace-app.tsx](/Users/madda/dev/_active/agent-tiler/workspace/workspace-app.tsx#L301) runtime destroy handling

If these were misfiring, the expected symptom would be cold reconnect/remount behavior, not a brief periodic black flash with automatic recovery.

## Suspected Root Cause

Startup-only canvas/background reveal logic is currently active during ongoing visible maintenance. Observer-triggered maintenance appears to be re-running code intended only for initial terminal bring-up, causing the visible terminal surface to momentarily fall back to the startup black state.

## Suggested Fix Direction

Limit startup-black/canvas reveal behavior to initial mount/connect only.

Possible approach:

- Keep `seedResttyBackgroundSurfaces` and initial canvas reveal gating for first render only.
- Do not run startup-black surface seeding during normal visible maintenance after the terminal has already become visible.
- Avoid using mutation/resize maintenance to re-apply black startup styling to a terminal that already has a live visible canvas.
- If needed, separate:
  - initial bootstrap maintenance
  - ongoing visible resize maintenance

## Useful Verification Signals

If additional logging is needed, inspect:

- `terminal.canvasRevealed`
- `terminal.resizeObserved`
- `terminal.schedulerWindow`

Correlate black flashes with resize/mutation activity and any repeated canvas reveal events.

## Summary

The visible terminal black-flash issue is most likely caused by startup canvas/background reveal logic being re-run during normal observer-driven maintenance in `workspace/terminal-pane.tsx`, especially the `runVisibleMaintenance` and `seedResttyBackgroundSurfaces` path introduced in the recent cached-runtime terminal work.
