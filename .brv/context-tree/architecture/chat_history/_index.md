---
children_hash: 0b161651e8f85d2e701dd7df81b2bafb3448663c2e75d3672150e17758942dba
compression_ratio: 0.6014678899082568
condensation_order: 1
covers: [context.md, viewer_search_and_resume_actions.md, vsmux_search_rename.md]
covers_token_total: 2725
summary_level: d1
token_count: 1639
type: summary
---

# chat_history

Structural overview of the conversation viewer and sidebar search feature set, centered on webview-based conversation inspection, browser-native find behavior, session resume into terminals, and the product rename to VSmux Search.

## Scope

This topic covers:

- Conversation viewer UX in `chat-history`
- Search and resume behavior implemented between webview and extension host
- Sidebar/view/command naming and packaging after the VSmux Search rename

For implementation details, drill into:

- `viewer_search_and_resume_actions`
- `vsmux_search_rename`

## Core architecture

### Webview + extension split

The architecture is split between:

- Webview UI state and message posting in `chat-history/src/webview/App.tsx`
- Search UI in `chat-history/src/webview/components/custom-ui/conversation/ConversationSearchBar.tsx`
- Extension-host message handling and terminal launch in `chat-history/src/extension/extension.ts`
- Sidebar/runtime rename surfaces in `chat-history/src/extension/SidebarViewProvider.ts`
- Export naming/branding in `chat-history/src/webview/lib/export-utils.ts`

### End-to-end flow

Primary flow across the topic:

1. Load conversation JSONL
2. Parse entries and derive `source`, `sessionId`, and optional `cwd`
3. Enable viewer search and resume actions when metadata is valid
4. Webview posts messages such as `ready`, `refreshConversation`, and `resumeSession`
5. Extension validates payloads and opens a terminal
6. Provider-specific resume command is executed
7. Conversations may also be exported as branded markdown

## Key patterns and decisions

### Search implementation

From `viewer_search_and_resume_actions`:

- Conversation search intentionally uses browser-native `window.find` instead of a custom search index.
- The custom find bar opens on Cmd/Ctrl+F.
- Keyboard behavior is standardized:
  - Enter = next match
  - Shift+Enter = previous match
  - Escape = close
- Search wraps around and resets selection/scroll state when the query changes.
- Explicit status messaging exists for empty input and failed matches.

This establishes a lightweight, DOM-driven search model rather than maintaining app-level indexed search state.

### Resume-session contract

The resume feature depends on a strict message contract between webview and extension:

- `resumeSession` carries:
  - `source`
  - `sessionId`
  - optional `cwd`

Resume is only available when:

- a `sessionId` is successfully extracted from parsed conversation data
- a source can be inferred from the conversation file path

Source inference rules documented in `viewer_search_and_resume_actions`:

- `/.codex/` and `/.codex-profiles/` → `Codex`
- `/.claude/` and `/.claude-profiles/` → `Claude`

Extension-side execution decisions:

- Claude resume command: `claude --resume <sessionId>`
- Codex resume command: `codex resume <sessionId>`
- Session IDs are shell-quoted with `quoteShellLiteral`
- Terminal opens in conversation `cwd` when available
- Terminal naming pattern: `AI DevTools Resume (<source>)`

### Viewer lifecycle behavior

A notable UI/runtime decision from `viewer_search_and_resume_actions`:

- The viewer panel is created with `retainContextWhenHidden: false`

This means hidden viewer state is intentionally not preserved, favoring simpler lifecycle behavior over persistent hidden-context state.

### Error representation

Parsing failures in JSONL are normalized as:

- `x-error` records

That gives the viewer a consistent representation for invalid lines and schema parse failures.

## VSmux Search rename structure

From `vsmux_search_rename`, the former integrated chat-history feature was renamed across package metadata, commands, view IDs, labels, exports, and browser filtering.

### Namespaces and identifiers

Key renamed identifiers:

- Command namespace: `VSmuxSearch.*`
- View ID: `VSmuxSearch.conversations`
- View label: `VSmux Search`
- Viewer panel type: `vsmuxSearchViewer`

Pattern references:

- `^VSmuxSearch\..+$`
- `^onView:VSmuxSearch\.conversations$`
- `^vsmux-search-export-.+\.md$`

### Packaging and activation

Package/runtime facts captured in `vsmux_search_rename`:

- Package name: `vsmux-search-vscode`
- Display name: `VSmux Search`
- Publisher: `vsmux-search`
- Version: `1.1.0`
- Activity bar container ID: `vsmux-search`
- Activation event: `onView:VSmuxSearch.conversations`

The rename spans both:

- root `package.json`
- `chat-history/package.json`

### Search/sidebar runtime behavior

The renamed sidebar flow includes:

- scanning/loading conversation folders
- refresh/reload behavior
- current-vs-all scope toggling
- recent-only vs all-time filtering
- viewer opening and optional resume
- markdown export

Important behavior from `vsmux_search_rename`:

- Recent-only mode uses a 7-day cutoff: `Date.now() - 7 * 24 * 60 * 60 * 1000`
- The recent-only cutoff applies only when `!this._showAllTime && !this._filterText`
- Live-browser tab filtering ignores VSmux Search labels

### Export behavior

Export changes tied to the rename:

- Filename format: `vsmux-search-export-${sessionId}.md`
- Output is branded with VSMUX-SEARCH tags
- Metadata and message categories are preserved
- Chrome MCP tools are mapped into grouped option keys
- Unknown tools are included by default when no option key is found

## Relationships

### Internal relationships

- `viewer_search_and_resume_actions` defines the core viewer interaction model: search, metadata derivation, resume messaging, terminal execution.
- `vsmux_search_rename` rebrands and re-scopes those capabilities under VSmux Search without changing the underlying viewer/resume architecture.

### Cross-topic relationships

Referenced related topics:

- `architecture/terminal_workspace/current_state`
- `architecture/terminal_workspace/workspace_browser_t3_integration`

These indicate that resume behavior and viewer integration depend on broader terminal workspace/runtime availability and workspace-browser integration patterns.

## Drill-down map

### `viewer_search_and_resume_actions`

Use for:

- `window.find` search behavior
- search keyboard shortcuts and status handling
- `resumeSession` payload shape
- source inference rules
- terminal command construction
- `retainContextWhenHidden: false`
- implementation files in webview and extension host

### `vsmux_search_rename`

Use for:

- VSmux Search command/view/package rename details
- `VSmuxSearch.*` namespace
- activation/view IDs and labels
- sidebar refresh/scope/time-filter behavior
- export filename and branding changes
- package metadata and manifest-level integration
