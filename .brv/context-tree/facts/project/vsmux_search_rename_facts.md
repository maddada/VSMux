---
title: VSmux Search Rename Facts
tags: []
related: [architecture/chat_history/vsmux_search_rename.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T21:17:30.615Z"
updatedAt: "2026-04-06T21:17:30.615Z"
---

## Raw Concept

**Task:**
Record project facts introduced or clarified by the VSmux Search rename.

**Changes:**

- Recorded renamed identifiers and packaging metadata
- Recorded search sidebar runtime facts
- Recorded export filename and tool inclusion rules

**Files:**

- package.json
- chat-history/package.json
- chat-history/src/extension/extension.ts
- chat-history/src/extension/SidebarViewProvider.ts
- chat-history/src/webview/lib/export-utils.ts

**Flow:**
rename identifiers -> propagate to manifests and runtime -> capture stable project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry isolates stable identifiers and behavioral constants from the broader rename work so they can be recalled without re-reading the architecture note. It covers package metadata, view ids, panel ids, export naming, time filter defaults, and debounce timing.

### Dependencies

These facts depend on the integrated root manifest, the standalone chat-history package manifest, the extension activation layer, the sidebar provider, and export utility implementation remaining aligned after the rename.

### Highlights

The main stable constants are VSmuxSearch.conversations, VSmux Search, vsmux-search-vscode, vsmux-search, vsmuxSearchViewer, a seven-day recent cutoff, and a 150 ms filter debounce.

## Facts

- **search_view_id**: The search view id is VSmuxSearch.conversations. [project]
- **search_view_label**: The search view label is VSmux Search. [project]
- **package_name**: The standalone package name is vsmux-search-vscode. [project]
- **package_publisher**: The standalone package publisher is vsmux-search. [project]
- **activitybar_container_id**: The standalone activitybar container id is vsmux-search. [project]
- **viewer_panel_type**: The viewer panel type is vsmuxSearchViewer. [project]
- **export_filename_prefix**: The export filename prefix is vsmux-search-export-. [project]
- **unknown_tool_export_rule**: Unknown tools are exported by default when they do not map to an option key. [convention]
- **recent_cutoff_days**: The recent conversation cutoff is 7 days. [project]
- **filter_debounce_ms**: Debounced filter input runs at 150 ms. [project]
