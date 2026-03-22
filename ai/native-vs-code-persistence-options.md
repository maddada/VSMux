# Native VS Code Persistence Options

The core constraint is this: a truly native VS Code terminal is owned by VS Code. Once VS Code fully exits, that shell process is normally gone unless VS Code itself revives it later. An extension does not get a supported API to say "bind this already-running external PTY back into a native terminal editor."

So there are really three levels of "persistence," and they differ a lot.

## 1. Native Persistence

This is the closest to VS Code and the safest for rendering.

What you keep:

- native shell-backed terminals
- normal VS Code/xterm.js rendering path
- good Codex CLI behavior

What you get:

- survive reloads
- sometimes revive after reopen, depending on VS Code's terminal persistence behavior

What you do not get:

- a guaranteed always-running shell after VS Code is fully gone

This is basically the direction of the current work in `extension/native-terminal-workspace-backend.ts`: keep sessions as real VS Code terminals, rediscover them from `window.terminals`, and manage layout around them.

## 2. Soft Persistence

This is "look persistent" rather than "actually keep the same process alive."

What you would add:

- persist session metadata: cwd, title, agent state, shell, maybe last command
- optionally persist screen content or scrollback
- on reopen, create a fresh native terminal and restore the visible state as much as possible, then relaunch the shell

This stays much closer to VS Code's own model. VS Code does this internally with xterm-headless serialization in its PTY layer. But there is a catch for extensions: native terminals do not expose raw output bytes to extensions, so you cannot just bolt on the same recorder from the outside.

That means if you want soft restore yourself, you need one of these:

- shell-level logging or wrappers
- a helper process that captures PTY output before it reaches the terminal
- shell integration that emits enough state to rebuild a useful approximation

The more you do here, the less "native" it becomes.

## 3. True Persistence

This means the process really keeps running while VS Code is closed.

To get that, something outside VS Code must own the PTY:

- `tmux`
- `shpool`
- custom `node-pty` daemon
- similar background service

The rendering risk comes back the moment the visible terminal reconnects through that external owner. That is exactly why an external attach layer was causing trouble before.

So the hard truth is:

## You Cannot Have All Three Perfectly At Once

- fully native rendering
- true out-of-process persistence
- no attach or proxy layer

One of them has to give.

## What A More VS Code-Native Persistent Design Would Look Like

The best compromise is probably a hybrid.

### 1. Visible sessions stay native

Use real `window.createTerminal` shell-backed terminals for anything the user is actively looking at.

### 2. Persist only lightweight state by default

Keep:

- session id
- cwd
- title
- agent state
- maybe last known shell or profile
- maybe a bounded text summary of recent output

### 3. On restart, recreate native terminals instead of reattaching

This avoids the extra mux or rendering layer.

### 4. Accept that full process continuity is not guaranteed in this mode

You restore experience, not the exact live PTY.

### 5. Offer an explicit durable background mode separately

If a user really wants a session to survive VS Code exit, move just that session to an external durable backend and mark it as such in the UI. Then the tradeoff is explicit instead of imposed on every Codex session.

That split is probably the cleanest product design:

- default mode: native and reliable rendering
- durable mode: external owner, with some compatibility caveats

## If You Wanted To Push Soft Persistence Further Without Going Full Mux

You would need to build a recorder pipeline. The hard part is getting terminal output from native terminals.

Options:

- shell wrapper that logs stdout or stderr
- shell integration hooks that emit prompt, command, title, and cwd changes
- helper executable launched as the terminal process, which then starts the real shell and records PTY data

That last option gets you closest to VS Code's internal architecture, but it stops being truly native because your helper becomes the real terminal owner.

## Practical Recommendation

If Codex rendering quality is the top priority, aim for:

- native terminals as the default runtime
- soft persistence only
- explicit opt-in durable sessions for the small set of cases that must survive full VS Code exit

If you want to take this further in the repo, the main options are:

- minimal native-only persistence
- hybrid native plus durable mode
- full daemon-backed design with the least risky rendering compromises

## Summary

The more native you stay, the less true background persistence you can guarantee. The best practical path is native terminals by default plus optional durable sessions when real out-of-process persistence is required.
