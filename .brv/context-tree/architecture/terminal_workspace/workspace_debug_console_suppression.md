---
title: Workspace Debug Console Suppression
tags: []
related: [architecture/terminal_workspace/context.md, facts/project/terminal_workspace_facts.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T21:17:24.919Z"
updatedAt: "2026-04-06T21:17:24.919Z"
---

## Raw Concept

**Task:**
Document suppression of workspace webview debug events from the browser console.

**Changes:**

- Changed logWorkspaceDebug to a no-op shim when debugging is enabled.
- Kept workspace debug event flow to extension-side VSmux Debug output/file channel via workspaceDebugLog messages.
- Added regression coverage to prevent terminal reconnect events from appearing in the desktop console.

**Files:**

- workspace/workspace-debug.ts
- workspace/workspace-debug.test.ts

**Flow:**
workspace event -> logWorkspaceDebug(enabled, event, payload) -> no browser console output -> event still handled through extension-side workspaceDebugLog channel

**Timestamp:** 2026-04-06

## Narrative

### Structure

The workspace webview debug helper is implemented in workspace/workspace-debug.ts. The exported logWorkspaceDebug(enabled, \_event, \_payload) function now keeps the same signature but intentionally performs no console logging when enabled is true, returning early only when debugging is disabled.

### Dependencies

Browser-console suppression is paired with extension-side logging that continues through workspaceDebugLog messages into the VSmux Debug output/file channel. Regression coverage depends on vite-plus/test and vi.spyOn(console, "debug") to verify the browser console remains silent.

### Highlights

This change removes noisy terminal reconnect diagnostics such as terminal.socketOpen and terminal.timeoutFired from the desktop console without disabling the underlying workspace debug event stream. The test specifically verifies that calling logWorkspaceDebug(true, "terminal.socketOpen", { connectionId: 219, sessionId: "session-09" }) does not invoke console.debug.

### Examples

API signature preserved: export function logWorkspaceDebug(enabled: boolean | undefined, \_event: string, \_payload?: Record<string, unknown>): void. Regression test example: logWorkspaceDebug(true, "terminal.socketOpen", { connectionId: 219, sessionId: "session-09" }); expect(consoleDebugSpy).not.toHaveBeenCalled();

## Facts

- **workspace_debug_console_behavior**: logWorkspaceDebug is a no-op when debuggingMode is enabled and does not write workspace debug events to the browser console. [project]
- **workspace_debug_log_sink**: Workspace debug events continue to flow to the extension-side VSmux Debug output/file channel through workspaceDebugLog messages. [project]
- **workspace_debug_regression_test**: A regression test asserts that terminal.socketOpen does not call console.debug. [project]
