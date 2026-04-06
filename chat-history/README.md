# AI Dev Tools VS Code Extension Project

Lets you debug Claude Code and Codex chat history for the currently open project to know where and why things went wrong.

Shows all hidden system messages and tool calls that happen behind the scenes.

Also lets you easily view full subagent conversations and compaction summaries.

Note: This info is read from your local conversation files (for example `~/.claude/projects` and `~/.codex/sessions`) and displayed in a readable format.

<img width="100%" alt="2026-01-09_Code_12-27-17" src="https://github.com/user-attachments/assets/cf4dad78-13d7-4748-8fb0-092b626a4ac3" />

## Building & Installing

### Prerequisites

- [Bun](https://bun.sh/) installed
- [VS Code](https://code.visualstudio.com/) installed

### Install dependencies

```bash
bun install
```

### Build the .vsix package

```bash
bun run build
```

This compiles the CSS, extension, and webview, then packages everything into `vsmux-search-vscode-<version>.vsix`.

### Install to VS Code

```bash
code --install-extension vsmux-search-vscode-*.vsix
```

Then reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window").
