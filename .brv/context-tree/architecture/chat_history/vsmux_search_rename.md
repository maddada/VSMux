---
title: VSmux Search Rename
tags: []
related: [architecture/chat_history/viewer_search_and_resume_actions.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T21:17:30.613Z"
updatedAt: "2026-04-06T21:17:30.613Z"
---

## Raw Concept

**Task:**
Rename the integrated chat-history feature and related surfaces to VSmux Search.

**Changes:**

- Renamed root and chat-history manifest command ids to the VSmuxSearch namespace
- Renamed search view ids and user-facing labels to VSmux Search
- Updated extension and webview strings in chat-history surfaces
- Updated exported markdown filename prefix to vsmux-search-export-
- Updated live-browser tab filtering to ignore VSmux Search labels

**Files:**

- package.json
- chat-history/package.json
- chat-history/src/extension/extension.ts
- chat-history/src/extension/SidebarViewProvider.ts
- chat-history/src/webview/lib/export-utils.ts

**Flow:**
activate extension -> register VSmux Search sidebar and commands -> scan/load conversation folders -> filter/scope/time-toggle results -> open viewer -> optionally resume session -> export conversation markdown

**Timestamp:** 2026-04-06

**Patterns:**

- `^VSmuxSearch\..+$` - Search command and view-related identifier namespace after rename
- `^onView:VSmuxSearch\.conversations$` - Activation event for the VSmux Search sidebar view
- `^vsmux-search-export-.+\.md$` - Exported markdown filename pattern for VSmux Search conversations

## Narrative

### Structure

The rename spans the root extension manifest, the embedded chat-history package manifest, the extension activation/runtime layer, the sidebar provider, and the webview export utilities. Package metadata now uses vsmux-search-vscode and publisher vsmux-search, while the integrated view uses the VSmuxSearch.conversations id and VSmux Search label in both manifests and webview HTML titles.

### Dependencies

The extension runtime depends on the existing chat-history bridge at extension/chat-history-vsmux-bridge, the SidebarViewProvider implementation, JSONL conversation file reading, conversation store scanning, and browser/webview APIs for panel rendering, clipboard access, and file downloads. Resume-session support still depends on the VSmux workspace target being available before forwarding sessionId, source, and optional cwd.

### Highlights

Search commands now include VSmuxSearch.openViewer, refresh, openConversation, toggleScope, toggleTimeFilter, and suspend. The sidebar refresh path rescans folders, loads summaries, supports current-vs-all scope, applies a recent-only cutoff of seven days unless a text filter is active, and posts view updates including scope, filter, showAllTime, and expandedFolders. Export output is branded with VSMUX-SEARCH tags, preserves metadata and message categories, maps Chrome MCP tools into grouped option keys, and emits vsmux-search-export-${sessionId}.md filenames.

### Rules

resumeSession requires typeof message.sessionId === "string", message.sessionId.length > 0, and message.source === "Claude" || message.source === "Codex".
Unknown tools are included by default during export when no tool option key is found.
The recent-only time filter applies only when !this.\_showAllTime && !this.\_filterText.

### Examples

Example renamed commands: VSmuxSearch.openViewer, VSmuxSearch.toggleScope, VSmuxSearch.toggleTimeFilter, VSmuxSearch.suspend. Example view id and label pair: VSmuxSearch.conversations / VSmux Search. Example folder display decoding: -Users-madda-dev-vsmux-search-vscode becomes ~/dev/vsmux-search-vscode.

## Facts

- **feature_rename**: The integrated ai-devtools/chat-history feature was renamed across VSmux to VSmux Search. [project]
- **command_namespace**: Search-related command ids were renamed to the VSmuxSearch.\* namespace. [project]
- **search_view_id**: The search view id is VSmuxSearch.conversations. [project]
- **search_view_label**: The search view label is VSmux Search. [project]
- **chat_history_package_name**: The chat-history package metadata name is vsmux-search-vscode. [project]
- **chat_history_display_name**: The chat-history package displayName is VSmux Search. [project]
- **chat_history_publisher**: The chat-history package publisher is vsmux-search. [project]
- **chat_history_version**: The chat-history package version is 1.1.0. [project]
- **activitybar_container_id**: The activity bar container id for the standalone search extension is vsmux-search. [project]
- **root_activation_event**: The root package activates search on onView:VSmuxSearch.conversations. [project]
- **standalone_activation_event**: The standalone chat-history package activates on onView:VSmuxSearch.conversations. [project]
- **viewer_panel_type**: The viewer webview panel type is vsmuxSearchViewer. [project]
- **export_filename_format**: The export filename format changed to vsmux-search-export-${sessionId}.md. [project]
- **live_browser_tab_filtering**: Live-browser tab filtering ignores VSmux Search labels. [project]
- **recent_cutoff_rule**: Recent conversations use a one-week cutoff computed as Date.now() - 7 _ 24 _ 60 _ 60 _ 1000. [project]
- **unknown_tool_export_rule**: Unknown tools are included by default during export when no option key is found. [convention]
