---
title: VSmux Ai Devtools Integration Facts
tags: []
related: [architecture/terminal_workspace/vsmux_ai_devtools_integration.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T12:22:12.048Z"
updatedAt: "2026-04-06T12:22:12.048Z"
---

## Raw Concept

**Task:**
Store concrete factual recall items for the VSmux ai-devtools integration.

**Changes:**

- Recorded extension host, sidebar, build, packaging, version, and configuration facts for the integration.

**Files:**

- extension/extension.ts
- package.json
- tsconfig.extension.json
- chat-history/src/extension/extension.ts
- chat-history/esbuild.webview.ts

**Flow:**
integration summary -> extract concrete settings and behaviors -> store as project facts for recall

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact record isolates the most recall-worthy integration details: extension host architecture, sidebar registration, build outputs, packaging entries, compile scope, memory behavior, and versioning.

### Dependencies

These facts depend on package.json contributions, extension activation code, tsconfig settings, and chat-history viewer/build implementation details remaining aligned.

### Highlights

The highest-value recall items are that VSmux stays the only shipped host, aiDevtools.conversations lives under VSmuxSessions, chat-history assets come from dist/media, and suspend is designed to release memory.

## Facts

- **extension_host**: VSmux remains the single shipped VS Code extension host after integrating ai-devtools. [project]
- **ai_devtools_sidebar_view**: VSmux registers aiDevtools.conversations under the existing VSmuxSessions primary sidebar container below VSmux.sessions. [project]
- **chat_history_build_output**: The root build now runs a dedicated chat-history webview build that outputs to chat-history/dist. [project]
- **chat_history_asset_roots**: Copied chat-history extension code resolves viewer assets from chat-history/dist and chat-history/media. [project]
- **extension_main_entry**: The extension main entry is ./out/extension/extension.js. [project]
- **extension_build_pipeline**: The build:extension script runs sidebar:build, debug-panel:build, workspace:build, chat-history:webview:build, TypeScript compilation, and vendor-runtime-deps. [project]
- **chat_history_webview_build_tools**: The chat-history webview build uses Tailwind CLI for CSS and esbuild for JavaScript. [project]
- **tsconfig_extension_include**: The extension compilation includes extension, shared, and chat-history/src/extension. [project]
- **extension_ts_target**: The extension TypeScript target is ES2024. [project]
- **webview_bundle_target**: The chat-history webview JavaScript target is es2020 and bundle format is iife. [project]
- **viewer_memory_behavior**: The chat-history viewer webview uses retainContextWhenHidden: false for memory efficiency. [project]
- **ai_devtools_suspend_behavior**: The ai-devtools.suspend command disposes the current panel, clears the sidebar provider cache, and sets suspended state for memory release. [project]
- **extension_version**: The extension version is 2.6.0. [project]
- **vscode_engine**: The VS Code engine requirement is ^1.100.0. [project]
- **package_manager**: The package manager is pnpm@10.14.0. [project]
- **git_text_generation_provider**: VSmux.gitTextGenerationProvider defaults to codex and allows codex, claude, or custom. [project]
- **sidebar_rename_behavior**: VSmux.sendRenameCommandOnSidebarRename defaults to true and stages /rename <new name> in the terminal without pressing Enter. [project]
