---
title: VSmux Ai Devtools Integration
tags: []
related:
  [
    architecture/terminal_workspace/workspace_browser_t3_integration.md,
    architecture/terminal_workspace/vsix_packaging_and_t3_embed_validation.md,
    architecture/git_text_generation/low_effort_provider_settings.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T12:22:12.046Z"
updatedAt: "2026-04-06T12:22:12.046Z"
---

## Raw Concept

**Task:**
Integrate ai-devtools chat history into VSmux as part of the shipped VS Code extension and build pipeline.

**Changes:**

- Activated chat-history extension code from the VSmux extension host.
- Registered aiDevtools.conversations as a webview view under the existing VSmuxSessions sidebar container.
- Added dedicated chat-history webview build output under chat-history/dist.
- Updated packaging to include chat-history media and dist assets.
- Compiled chat-history/src/extension as part of the extension TypeScript build.

**Files:**

- extension/extension.ts
- package.json
- tsconfig.extension.json
- chat-history/src/extension/extension.ts
- chat-history/esbuild.webview.ts
- chat-history/src/webview/index.css
- chat-history/src/webview/main.tsx

**Flow:**
extension activate -> initializeVSmuxDebugLog -> activateChatHistory -> create NativeTerminalWorkspaceController -> register VSmux and ai-devtools views/commands -> workspace.initialize; viewer flow: openConversationViewer -> readJsonlFileAsync -> post loadConversation to webview; build flow: root build:extension -> Tailwind CSS build -> esbuild webview JS -> tsc extension compile -> vendor runtime deps

**Timestamp:** 2026-04-06

**Patterns:**

- `VSmux\.(openWorkspace|openSettings|moveToSecondarySidebar|createSession|revealSession|restartSession|renameActiveSession|focusGroup[1-4]|focus(Up|Right|Down|Left)|focusSessionSlot|show(One|Two|Three|Four|Six|Nine)|toggleFullscreenSession|resetWorkspace)` - Contributed VSmux command identifiers
- `ai-devtools\.(openViewer|refresh|openConversation|toggleScope|toggleTimeFilter|suspend)` - Contributed ai-devtools command identifiers

## Narrative

### Structure

The integration keeps VSmux as the only shipped extension host while embedding the ai-devtools conversation experience as a mostly separate chat-history package. The extension activation path imports activateChatHistory from chat-history/src/extension/extension and runs it before constructing the terminal workspace controller and debugging indicator. package.json now contributes both VSmux.sessions and aiDevtools.conversations under the VSmuxSessions activity bar container, and also defines a matching secondary sidebar container and title-bar menu items for the AI DevTools view.

### Dependencies

The build depends on a root-level pipeline that runs sidebar, debug-panel, workspace, and chat-history webview builds before TypeScript compilation. The chat-history webview build depends on Tailwind CLI for CSS output and esbuild for a browser iife bundle. The runtime depends on chat-history/media and chat-history/dist being packaged, and the extension compiler includes chat-history/src/extension alongside extension and shared sources.

### Highlights

The viewer uses localResourceRoots pointed at chat-history/dist and chat-history/media, with retainContextWhenHidden disabled to reduce memory use. ai-devtools.suspend is explicitly used to dispose the panel, clear sidebar cache, and enter a suspended state for memory release. The integration preserves existing VSmux commands, keybindings, configuration, and focus/visible-count command helpers while layering in ai-devtools refresh, scope, time filter, open viewer, open conversation, and suspend behaviors.

### Rules

VSmux remains the single shipped VS Code extension host.
VSmux now registers aiDevtools.conversations under the existing VSmuxSessions primary sidebar container, below VSmux.sessions.
Root build now runs a dedicated chat-history webview build that outputs to chat-history/dist.
Copied chat-history extension code resolves viewer assets from chat-history/dist and chat-history/media.

### Examples

Example activation order: initializeVSmuxDebugLog(context) -> activateChatHistory(context) -> new NativeTerminalWorkspaceController(context) -> new DebuggingStatusIndicator(workspace) -> register webview provider and commands -> workspace.initialize(). Example viewer resource roots: vscode.Uri.joinPath(context.extensionUri, "chat-history", "dist") and vscode.Uri.joinPath(context.extensionUri, "chat-history", "media"). Example build command: vp run sidebar:build && vp run debug-panel:build && vp run workspace:build && pnpm run chat-history:webview:build && tsc -p ./tsconfig.extension.json && node ./scripts/vendor-runtime-deps.mjs.

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
