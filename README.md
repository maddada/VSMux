# Agent Canvas X

This repo demonstrates a VS Code webview extension, with the editor and lint/format workflow aligned to the Vite+ template to the Vite+ template.

## Tooling baseline

- VS Code `1.110+`
- pnpm `10.14`
- Vite+ (`vp`) for format, lint, staged-file checks, and dependency management
- TypeScript `5.9`

The extension host still compiles through TypeScript so VS Code can load `out/extension.js`, but the day-to-day project workflow now follows the Vite+ template for checks, hooks, and editor defaults.

## Running the project

1. Run `vp install`.
2. Run `vp check`.
3. Run `vp run watch` to compile the extension in watch mode.
4. Press `F5` in VS Code to launch an Extension Development Host.
5. Run `Agent Canvas X: Open Canvas Panel` from the Command Palette.

## Hooks and editor setup

- `.vite-hooks/pre-commit` runs `vp staged`
- `prepare` runs `vp config`
- `.vscode/settings.json` enables OXC format-on-save
- `.vscode/extensions.json` recommends the Vite+ extension pack

## Commands

- `vp install`
- `vp check`
- `vp lint`
- `vp fmt`
- `vp run compile`
- `vp run watch`
