# Development Guide

This file describes the current development workflow for the VS Code extension
and its webview frontend.

## Project Shape

- the extension host code lives in `extension/`
- the React webview app lives in `src/`
- the webview bundle is built with `vite.webview.config.ts` into `dist/webview`
- the Extension Development Host loads the compiled extension from `out/`

## Use Case: First-Time Setup

Run this once after pulling changes:

```bash
vp install
```

What this does:

- installs project dependencies
- runs the repo's `prepare` hook through Vite+

## Use Case: Just Play Around With The Extension

This is the fastest path if you only want to use the current build.

1. Open the workspace in VS Code.
2. Press `F5`.
3. Wait for the Extension Development Host window to open.
4. In the Extension Development Host, open the Command Palette.
5. Run `Agent Canvas X: Open Canvas Panel`.

What `F5` currently does:

- runs the one-time webview build task:

```bash
zsh scripts/build-webview-for-debug.zsh
```

That wrapper runs:

```bash
vp build --config vite.webview.config.ts
```

and force-stops it after 5 seconds if VS Code still has the task hanging.

If you want extension-host changes to rebuild automatically, run this in a
separate terminal before launching:

```bash
vp run watch
```

## Use Case: Change Frontend / Webview Code

If you are editing files under `src/`, run a separate webview watcher.

In a terminal:

```bash
vp build --config vite.webview.config.ts --watch
```

Then:

1. Press `F5` once to launch the Extension Development Host.
2. Keep the watcher terminal running.
3. After frontend changes rebuild, reload the Extension Development Host window.

Recommended reload command inside the Extension Development Host:

- `Developer: Reload Window`

Why this is needed:

- `F5` now performs a one-time webview build before launch
- the webview bundle is intentionally a separate manual build/watch step

## Use Case: Change Extension Host Code

If you are editing files under `extension/` or `shared/` that affect the
extension host:

1. Press `F5`.
2. Run `vp run watch` in a separate terminal if you want live rebuilds.
3. After the extension recompiles, reload the Extension Development Host window
   if the change is not picked up automatically.

You do not need the webview watcher for extension-only changes unless the
change also affects frontend assets or webview-rendered code.

## Use Case: Change Both Frontend And Extension Code

Run both parts of the dev loop:

In terminal 1:

```bash
vp build --config vite.webview.config.ts --watch
```

In VS Code:

1. Press `F5`.
2. Make changes in either `src/`, `extension/`, or `shared/`.
3. Reload the Extension Development Host window after rebuilds when needed.

This is the most reliable workflow right now.

## Use Case: Rebuild Everything Manually

If you want a clean manual rebuild without `F5`:

```bash
vp build --config vite.webview.config.ts
vp run compile
```

What this gives you:

- fresh webview assets in `dist/webview`
- freshly compiled extension host output in `out/`

## Use Case: Build Or Install The VSIX

If you want a packaged extension artifact for local installation:

```bash
vp run vsix:package
```

That writes the VSIX to `installer/agent-canvas-x-0.0.1.vsix`.

If you want to package the extension and install it into your local VS Code in
one step:

```bash
vp run vsix:install
```

## Use Case: Validate Changes

Run the repo checks:

```bash
vp check
vp test
```

Current note:

- `vp test` currently exits with "No test files found" because the project does
  not have tests yet

## Common Commands

```bash
vp install
vp build --config vite.webview.config.ts
vp build --config vite.webview.config.ts --watch
vp run compile
vp run watch
vp run vsix:package
vp run vsix:install
vp check
vp test
```

## Common Gotchas

- do not use `pnpm`, `npm`, or `yarn` directly; use `vp`
- do not assume `F5` starts long-running watch tasks automatically
- if the panel shows a missing-build message, run:

```bash
vp build --config vite.webview.config.ts
```

- if frontend changes are not visible, rebuild the webview and reload the
  Extension Development Host window
- if extension-host changes are not visible, reload the Extension Development
  Host window after `vp run watch` recompiles
