---
title: Viewer Search And Resume Actions
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T17:03:29.680Z"
updatedAt: "2026-04-06T17:03:29.680Z"
---

## Raw Concept

**Task:**
Document AI DevTools conversation viewer search controls and resume-session actions

**Changes:**

- Added custom conversation find bar opened by Cmd/Ctrl+F
- Added browser-native window.find based next/previous search behavior
- Added Resume header action that posts resumeSession from the webview
- Added extension-host handling to open a terminal and run claude or codex resume commands
- Added path-based source inference and validation for session resume metadata

**Files:**

- chat-history/src/webview/App.tsx
- chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx
- chat-history/src/webview/components/ui/input.tsx
- chat-history/src/extension/extension.ts

**Flow:**
loadConversation -> parse JSONL -> derive source/sessionId/cwd -> enable search and resume actions -> webview posts resumeSession -> extension validates payload -> create terminal -> run provider-specific resume command

**Timestamp:** 2026-04-06

## Narrative

### Structure

The webview App owns search state, keyboard shortcuts, resume metadata extraction, and message posting. ConversationSearchBar is a conditional search UI with input, Prev, Next, and Close controls. The extension host handles resumeSession and refreshConversation messages, creates the viewer panel, and loads JSONL into the webview.

### Dependencies

Search depends on browser support for window.find and DOM selection APIs. Resume depends on session metadata found in parsed conversation entries, filePath-based source inference, VS Code terminal APIs, and quoteShellLiteral from extension/agent-shell-integration-utils.

### Highlights

Search wraps around, resets selection and scroll position when the query changes, and surfaces exact status messages for empty queries and failed matches. Resume supports both Claude and Codex sessions, keeps cwd when available, and disables the button when source inference or sessionId extraction fails. The viewer panel intentionally does not retain context when hidden.

### Rules

Use browser-native `window.find` instead of building a custom text search index.
Resume is unavailable unless a source can be inferred and a `sessionId` is found.
Resume command execution uses shell-safe quoting through `quoteShellLiteral`.
Terminal opens in conversation `cwd` when available.
Webview does not retain context when hidden: `retainContextWhenHidden: false`.

### Examples

Webview -> extension messages: `{ command: "ready" }`, `{ command: "refreshConversation", filePath }`, and `{ command: "resumeSession", cwd, sessionId, source }`. Search statuses are `Enter search text.` for empty queries and `No matches found.` when window.find returns false. Resume commands are `claude --resume ${quoteShellLiteral(sessionId)}` for Claude and `codex resume ${quoteShellLiteral(sessionId)}` for Codex.

## Facts

- **viewer_search_shortcut**: The AI DevTools conversation viewer opens a custom find bar on Cmd/Ctrl+F. [project]
- **viewer_search_implementation**: Conversation search uses browser-native window.find for next and previous matches. [project]
- **viewer_search_keyboard_controls**: The search UI supports Enter for next result, Shift+Enter for previous result, and Escape to close. [convention]
- **resume_button_enablement**: The Resume button is enabled only when a source can be inferred from filePath and a sessionId is found in parsed conversation entries. [project]
- **resume_source_inference**: Conversation source inference maps /.codex/ and /.codex-profiles/ paths to Codex, and /.claude/ and /.claude-profiles/ paths to Claude. [project]
- **resume_message_contract**: The webview posts a resumeSession message containing source, sessionId, and optional cwd. [project]
- **resume_cli_commands**: The extension resumes Claude sessions with claude --resume <sessionId> and Codex sessions with codex resume <sessionId>. [project]
- **resume_shell_quoting**: Resume command execution uses quoteShellLiteral for shell-safe sessionId quoting. [project]
- **resume_terminal_behavior**: The extension opens a terminal named AI DevTools Resume (<source>) in the conversation cwd when available before sending the resume command. [project]
- **viewer_panel_context_retention**: The viewer webview panel is created with retainContextWhenHidden set to false. [project]
- **jsonl_parse_error_representation**: Invalid JSONL lines or schema parse failures are represented as x-error records. [project]
- **viewer_search_resume_files**: The changed files are chat-history/src/webview/App.tsx, chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx, chat-history/src/webview/components/ui/input.tsx, and chat-history/src/extension/extension.ts. [project]
