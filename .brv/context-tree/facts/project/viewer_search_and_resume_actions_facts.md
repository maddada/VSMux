---
title: Viewer Search And Resume Actions Facts
tags: []
related: [architecture/chat_history/viewer_search_and_resume_actions.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T17:03:29.681Z"
updatedAt: "2026-04-06T17:03:29.681Z"
---

## Raw Concept

**Task:**
Capture project facts for AI DevTools conversation viewer search and resume actions

**Changes:**

- Recorded keyboard shortcuts, message contracts, validation rules, CLI commands, and changed files for the viewer update

**Files:**

- chat-history/src/webview/App.tsx
- chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx
- chat-history/src/webview/components/ui/input.tsx
- chat-history/src/extension/extension.ts

**Flow:**
search shortcut and UI events -> window.find search -> resume metadata derivation -> resumeSession message -> extension validation -> terminal command execution

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry isolates stable implementation details that are likely to be queried later, including shortcuts, source inference rules, command syntax, validation requirements, and viewer panel settings.

### Dependencies

These facts depend on the chat-history webview and extension host implementation plus shell-safe quoting support in the shared extension utilities.

### Highlights

The implementation uses native browser search, provider-specific resume commands, and a strict enablement rule for the Resume button based on inferred source and discovered sessionId.

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
