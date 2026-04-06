---
children_hash: 8c17c0ed415513220d2447709632cca11d7a269fd7e0e61e10d4c6e39f831f54
compression_ratio: 0.8289379900213828
condensation_order: 1
covers: [context.md, viewer_search_and_resume_actions.md]
covers_token_total: 1403
summary_level: d1
token_count: 1163
type: summary
---

# chat_history

Structural overview of the conversation viewer’s search and session-resume architecture. This topic centers on `viewer_search_and_resume_actions` and links directly to terminal runtime behavior in `architecture/terminal_workspace/current_state` and viewer/workspace coordination in `architecture/terminal_workspace/workspace_browser_t3_integration`.

## Scope

- Conversation viewer UX in the `chat-history` webview
- Search controls built around browser-native text finding
- Resume-session message flow from webview to extension host
- Source/session inference from conversation file paths and parsed JSONL metadata
- Terminal-based provider-specific resume execution

## Core Architecture

From `viewer_search_and_resume_actions`:

- The main orchestration lives in:
  - `chat-history/src/webview/App.tsx`
  - `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
  - `chat-history/src/webview/components/ui/input.tsx`
  - `chat-history/src/extension/extension.ts`
- The webview owns:
  - parsed conversation loading
  - search state
  - keyboard shortcut handling
  - resume metadata derivation
  - posting `resumeSession` and refresh-related messages
- The extension host owns:
  - panel creation
  - JSONL loading into the webview
  - `resumeSession` validation
  - terminal creation
  - execution of provider-specific CLI resume commands

## End-to-End Flow

Documented in `viewer_search_and_resume_actions`:

`loadConversation -> parse JSONL -> derive source/sessionId/cwd -> enable search and resume actions -> webview posts resumeSession -> extension validates payload -> create terminal -> run provider-specific resume command`

This establishes a clean split:

- webview: infer + request
- extension: validate + execute

## Search Design

From `viewer_search_and_resume_actions`:

- Search is intentionally built on browser-native `window.find`, not a custom text index.
- The custom find bar opens on `Cmd/Ctrl+F`.
- Controls include:
  - input
  - previous
  - next
  - close
- Keyboard behavior:
  - `Enter` → next match
  - `Shift+Enter` → previous match
  - `Escape` → close
- Search behavior:
  - wraps around
  - resets selection and scroll position when query changes
  - surfaces explicit statuses for empty query and no match

Key decision:

- Reuse browser selection/find behavior instead of maintaining a parallel search model in the app.

## Resume-Session Contract

From `viewer_search_and_resume_actions`:

- Webview-to-extension messages include:
  - `{ command: "ready" }`
  - `{ command: "refreshConversation", filePath }`
  - `{ command: "resumeSession", cwd, sessionId, source }`
- Resume is gated:
  - only available if `sessionId` is extracted from parsed conversation entries
  - only available if provider `source` can be inferred from `filePath`
- Optional `cwd` is preserved and used when available.

## Source Inference and Provider Mapping

From `viewer_search_and_resume_actions`:

- Path-based source inference determines provider:
  - `/.codex/` and `/.codex-profiles/` → Codex
  - `/.claude/` and `/.claude-profiles/` → Claude
- This path inference is a core enablement rule for the Resume action.
- If inference fails, the Resume button is disabled.

## Terminal Execution Behavior

From `viewer_search_and_resume_actions`:

- The extension creates a terminal named `AI DevTools Resume (<source>)`.
- Terminal `cwd` is set to the conversation cwd when available.
- Commands:
  - Claude: `claude --resume <sessionId>`
  - Codex: `codex resume <sessionId>`
- Session IDs are shell-quoted via `quoteShellLiteral`.

Key decision:

- Resume is executed through VS Code terminal APIs, not an internal runtime bridge.

## Data and Parsing Notes

From `viewer_search_and_resume_actions`:

- Parsed conversation entries supply:
  - `sessionId`
  - possible `cwd`
  - enough context to pair with path-based source inference
- Invalid JSONL lines or schema parse failures are represented as `x-error` records rather than silently discarded.

## Runtime / Panel Constraints

From `viewer_search_and_resume_actions`:

- Viewer panel is created with:
  - `retainContextWhenHidden: false`
- The panel intentionally does not preserve hidden-state context, which affects how the viewer lifecycle behaves compared with longer-lived workspace surfaces.

## Drill-down

- `viewer_search_and_resume_actions` — full search UX, resume contract, file paths, commands, and rules
- `architecture/terminal_workspace/current_state` — terminal runtime behavior relevant to resume execution
- `architecture/terminal_workspace/workspace_browser_t3_integration` — viewer/workspace integration patterns
