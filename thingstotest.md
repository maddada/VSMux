• Test the behaviors that can still break at runtime, especially around host switching and
session durability.

Core Flows

- Open Agent Canvas X: Open Canvas Panel.
- Create a few terminal tiles.
- Type in them, resize them, rename them, close one, restart one.
- Confirm output, cursor, resize, and restart all still behave normally.

Surface Handoff

- With live terminals running, run Agent Canvas X: Move Canvas to Bottom Panel.
- Confirm the same canvas/session state appears there without spawning fresh shells.
- Then run Agent Canvas X: Move Canvas to Panel.
- Confirm only one host is active at a time and terminals stay attached.

Hydration / Reopen

- Open the canvas, create multiple tiles, move them around, zoom/pan, then close the host.
- Reopen it.
- Confirm layout, viewport, focused state, and terminal tile states restore correctly.

Reload / Reattach

- Open the canvas with live sessions.
- Reload the VS Code window.
- Reopen the canvas.
- Confirm live sessions reattach instead of becoming blank, duplicated, or auto-recreated.

Grace Timeout

- Open a live session, then close the canvas host completely.
- Reopen it within 5 minutes.
- Confirm the session is still live.
- Then repeat but wait more than 5 minutes before reopening.
- Confirm the tile restores as disconnected/read-only or otherwise no longer live.

Cold Restore UX

- Force a case where the live daemon session is gone but history exists.
- Reopen the canvas.
- Confirm the tile shows as disconnected, retains scrollback, does not accept input, and
  offers restart.

Restart Behavior

- Restart an exited tile.
- Restart a disconnected tile.
- Confirm it creates a fresh live shell and clears the disconnected/exited state cleanly.

Installed VSIX

- Install using your normal vp run vsix:install flow.
- Test the same basics in the installed extension, not just F5:
  - terminal render
  - typing
  - restart
  - panel/bottom-panel move
  - reopen after close
  - reload window

Trusted / Untrusted Workspace

- In a trusted workspace, confirm shell creation works immediately.
- In an untrusted workspace, confirm first shell spawn shows the warning.
- Deny it once and confirm the tile does not launch a shell.
- Allow it and confirm spawning/restart then works.

Regression Checks

- No duplicate characters on input.
- No WASM fetch errors.
- No “Unable to connect to the terminal host daemon”.
- No broken fonts/layout in installed VSIX.

If you want, I can turn this into a tight step-by-step QA checklist you can run top to
bottom and report back against.

Summary: You mainly need to test live terminal basics, panel/bottom-panel handoff, reopen/
reload reattach, 5-minute grace behavior, disconnected cold restore, restart flows,
trusted/untrusted shell gating, and the installed VSIX path.
