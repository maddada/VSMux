# VSmux - T3code & Agent CLIs Manager

> Manage all your CLI coding agent sessions without leaving your IDE.

Download links:

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=maddada.VSmux) [![Open VSX](https://img.shields.io/badge/Open%20VSX-Registry-purple)](https://open-vsx.org/extension/maddada/VSmux)

---

### Recent updates!

- T3 remote access has grown into a much smoother workflow: VSmux can open embedded T3 sessions outside the editor, reuse shared browser-access state, and now prefers simple same-network LAN links before falling back to Tailscale when that is the better path.
- You can keep reusable prompts pinned in the sidebar, and the surrounding sidebar workflow has kept getting cleaner with steadier collapse state, calmer controls, smarter search/history entry points, and more readable session cards.
- Workspace readability is much stronger now, with pane zoom controls, better cached appearance preferences, smoother terminal font-size and T3 zoom syncing, and a roomier commit-message editor for built-in Git actions.
- Auto-sleep coverage is broader: Claude, Codex, and now idle T3 sessions can all participate when you opt in with `VSmux.backgroundSessionTimeoutMinutes`.
- Embedded T3 handling is sturdier across the board, including native macOS clipboard fallback, cleaner runtime teardown after sleep, stronger thread projection across inactive groups, and explicit confirmation before a pane switches to a different bound thread.
- VSmux can now launch either bundled DP Code or T3 Code as the managed embedded provider, with better bundled-versus-checkout resolution so local dev setups and packaged installs behave more predictably.
- Codex and shell-hook integrations are smarter too, with first-prompt auto-titling, better resume-command fallbacks for custom agents, and duplicate prompt-hook deliveries filtered out before they can spam session state.

Full release notes: [CHANGELOG.md](./CHANGELOG.md)

---

## Screenshot

<img width="1000" alt="2026-0ffsafssfffsfs4-14_sfsdCodedsds_12-52-3d7@2x" src="https://github.com/user-attachments/assets/9ea0bcd8-38ea-4f87-9d78-ba91e76088c2" />

## Early Version Demo Video (Will rerecord soon)

https://github.com/user-attachments/assets/5b41df9a-bb2e-45f3-b8bd-ed3d6b7e2968

---

## Who Is This For?

This extension is for you if:

- You like to code using multiple agent CLIs in parallel.
- You don't want to be locked into a tool like conductor or superset or w/e.
- You don't want to be missing out on the new features that are coming to the CLIs first.
- You also love to be close to the code for some projects and review changes in your favorite editor (VS Code/Cursor/Antigravity/etc.)
- Like to use VS Code to edit the md files and prompts (ctrl+g) before sending them to the agent cli.

Then this is the extension for you! You get a very nice interface to work with your agents without having to jump between the editor and the ADE tool.

> Inspired by Antigravity agent panel, Codex app, T3Code, CMux, and Superset + many more.

---

## Main Features at a Glance

- **Remote access**: Access your T3code & Agent CLI sessions from your phone/another machine (Overflow menu -> Remote Access)
- **Multiplexed Split Views**: Split your workspace into multiple panes (e.g., view 2 up to 9 sessions at once) to monitor and interact with several tasks simultaneously, complete with per-pane zoom controls for easier reading.
- **Unified Session Search & History**: Quickly search across all your sessions from various tools (WSL, Cloud Code, Codex) in one centralized location, rather than hunting through different tabs.
- **Session Management & Organization**: Group, sort manually, or organize your sessions by recent activity to maintain a tidy workspace.
- **Session Resumption**: Click on any past session from the history to instantly reload it and pick up exactly where you left off with the original AI agent.
- **Quick Search & Launch**: Start typing the name of a closed session to quickly locate and reload it using just your arrow keys and the Enter button.
- **Session Forking**: Branch off from an active session to retain its current context, allowing you to explore a new task or idea in a separate pane without altering the original chat.
- **RAM/Resource Saver (Sleep Mode)**: Put inactive sessions to sleep to instantly free up memory (noted as roughly a 25% drop in RAM usage), ensuring background tasks don't slow down your machine.
- **Customizable AI Agents**: Add, configure, and modify distinct profiles for various AI models. You can set up custom paths, run different agents side-by-side, or create specific profiles (like "work" vs. "personal").
- **Cross-Agent Context Handoff**: Transfer the context of an active conversation from one AI model (e.g., GPT) directly to another (e.g., Claude) to continue the work seamlessly.
- **Custom Action Buttons**: Map any terminal command to a clickable, draggable button. These custom actions can be configured to execute commands automatically, play a notification sound upon completion, or close when finished.
- **Pinned Prompts**: Save reusable prompts directly in the sidebar so common instructions stay available across projects without digging through old notes.
- **Integrated Browser**: Open web environments (like your localhost) directly within a VSmux pane. The browser remembers login states and includes a DevTools console, allowing you to select and send specific HTML elements directly to your AI agents.
- **Automated Git Operations**: Built-in actions to automatically generate commit messages and push code changes.
- **Code Change Monitoring**: Keep an eye on the codebase modifications your agents are making in a dedicated bottom-left panel while simultaneously directing other agents on separate tasks.
- **Customizable Settings**: A robust settings menu that allows you to heavily configure the extension to fit your specific workflow preferences.

---

## Getting Started

1. Open the Command Palette.
2. Run `VSmux: Open Workspace`.
3. Create your first session.
4. Use the sidebar and hotkeys to change the visible split count and jump between sessions and groups.

---

## Recommended VS Code Setup for Worktrees & Parallel Agents

### 1. Enable Native Tabs

If you are on macOS, turn on VS Code's `window.nativeTabs` setting.

This makes it much easier to switch between projects, repos, and worktrees because each VS Code window can live in the same native tab strip. Instead of juggling separate windows, you can keep multiple VSmux workspaces open and move between them quickly with the normal macOS tab workflow.

### 2. Turn On Repositories Explorer for Worktrees

Enable `SCM > Repositories: Explorer`, and make sure `SCM > Repositories: Selection Mode` is set to `single`.

This exposes repository artifacts directly inside the Source Control UI, including branches, stashes, tags, and worktrees. It makes creating and managing Git worktrees much easier from the VS Code UI, without needing to drop into the terminal for every worktree action.

### 3. Set your `$EDITOR` in `~/.zshrc` to your editor (code/cursor/etc.)

This lets you write your prompt inside your editor instead strugling with the annoying input box that these AI tools provide.
No more [50 lines pasted] nonsense. Paste all the lines you want and even select parts of them and use inline AI to edit those.

Gist on how to do this: https://gist.github.com/maddada/6eec96f4c8b467b81d69d291d4ac130e

## Companion App

VSmux works great with my other tool that shows all running agent sessions in a mini floating bar on macOS (with running/waiting/done indicators). Check it out here: https://github.com/maddada/agent-manager-x

## Contributions Welcome

Contributions welcome 🙏🏻
