import * as vscode from "vscode";
import {
  getChatHistoryVSmuxTarget,
  type ChatHistoryResumeSource,
} from "../../../extension/chat-history-vsmux-bridge";
import { SidebarViewProvider } from "./SidebarViewProvider";
import { logChatHistoryInfo } from "./log";
import { readJsonlFileAsync, type ConversationFile } from "./fileSystem";

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let sidebarProvider: SidebarViewProvider | undefined = undefined;
let isSuspended: boolean = false;

/**
 * Get the current workspace folder path
 */
function getWorkspacePath(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  return null;
}

export function activate(context: vscode.ExtensionContext) {
  logChatHistoryInfo("VSmux Search extension is now active");

  // Get the current workspace path
  const workspacePath = getWorkspacePath();
  logChatHistoryInfo("Workspace path:", workspacePath);

  // Create and register the sidebar webview provider
  sidebarProvider = new SidebarViewProvider(context.extensionUri, workspacePath ?? undefined);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider),
  );

  // Watch for workspace folder changes
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    const newWorkspacePath = getWorkspacePath();
    if (sidebarProvider) {
      sidebarProvider.setWorkspacePath(newWorkspacePath);
    }
    logChatHistoryInfo("Workspace changed to:", newWorkspacePath);
  });
  context.subscriptions.push(workspaceWatcher);

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand("VSmuxSearch.refresh", () => {
    if (isSuspended) {
      // Resume from suspended state
      isSuspended = false;
      // vscode.window.showInformationMessage('VSmux Search resumed');
    }
    if (sidebarProvider) {
      sidebarProvider.refresh();
      // vscode.window.showInformationMessage('Refreshed conversations');
    }
  });
  context.subscriptions.push(refreshCommand);

  // Register toggle scope command
  const toggleScopeCommand = vscode.commands.registerCommand("VSmuxSearch.toggleScope", () => {
    if (sidebarProvider) {
      sidebarProvider.toggleScope();
    }
  });
  context.subscriptions.push(toggleScopeCommand);

  // Register toggle time filter command
  const toggleTimeFilterCommand = vscode.commands.registerCommand(
    "VSmuxSearch.toggleTimeFilter",
    () => {
      if (sidebarProvider) {
        sidebarProvider.toggleTimeFilter();
      }
    },
  );
  context.subscriptions.push(toggleTimeFilterCommand);

  // Register open conversation command (called when clicking a file in the tree)
  const openConversationCommand = vscode.commands.registerCommand(
    "VSmuxSearch.openConversation",
    (conversationFile: ConversationFile) => {
      openConversationViewer(context, conversationFile);
    },
  );
  context.subscriptions.push(openConversationCommand);

  // Register open viewer command (for command palette)
  const openViewerCommand = vscode.commands.registerCommand("VSmuxSearch.openViewer", () => {
    // Just create a blank viewer panel
    openConversationViewer(context, undefined);
  });
  context.subscriptions.push(openViewerCommand);

  // Register suspend command for memory release
  const suspendCommand = vscode.commands.registerCommand("VSmuxSearch.suspend", () => {
    // Dispose the webview panel if it exists
    if (currentPanel) {
      currentPanel.dispose();
      currentPanel = undefined;
    }

    // Clear caches in the sidebar provider
    if (sidebarProvider) {
      sidebarProvider.clearCache();
    }

    isSuspended = true;
    // vscode.window.showInformationMessage('VSmux Search suspended - memory released. Use Refresh to resume.');
  });
  context.subscriptions.push(suspendCommand);

  // Add sidebar provider disposal to subscriptions
  context.subscriptions.push({
    dispose: () => {
      if (sidebarProvider) {
        sidebarProvider.dispose();
        sidebarProvider = undefined;
      }
    },
  });
}

function openConversationViewer(
  context: vscode.ExtensionContext,
  conversationFile: ConversationFile | undefined,
) {
  const columnToShowIn = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    // If we already have a panel, reveal it and send the new file content
    currentPanel.reveal(columnToShowIn);
    if (conversationFile) {
      sendConversationToWebview(currentPanel, conversationFile);
    }
  } else {
    // Create a new webview panel
    currentPanel = vscode.window.createWebviewPanel(
      "vsmuxSearchViewer",
      "VSmux Search - Conversation Viewer",
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        // DO NOT retain context when hidden - dispose for memory efficiency
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "chat-history", "dist"),
          vscode.Uri.joinPath(context.extensionUri, "chat-history", "media"),
        ],
      },
    );

    currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionUri);

    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "alert":
            // vscode.window.showInformationMessage(message.text);
            return;
          case "ready":
            // Webview is ready, send conversation if we have one
            if (conversationFile && currentPanel) {
              sendConversationToWebview(currentPanel, conversationFile);
            }
            return;
          case "refreshConversation":
            // Reload the JSONL file and send updated content
            if (message.filePath && currentPanel) {
              const refreshFile: ConversationFile = {
                name: message.filePath.split("/").pop() || "conversation.jsonl",
                path: message.filePath,
                folder: "",
                size: 0,
                summary: null,
                lastModified: new Date(),
              };
              await sendConversationToWebview(currentPanel, refreshFile);
            }
            return;
          case "resumeSession":
            if (
              typeof message.sessionId === "string" &&
              message.sessionId.length > 0 &&
              (message.source === "Claude" || message.source === "Codex")
            ) {
              const target = getChatHistoryVSmuxTarget();
              if (!target) {
                void vscode.window.showErrorMessage(
                  "VSmux workspace is not available yet. Open the VSmux sidebar and try again.",
                );
                return;
              }

              void target.resumeChatHistorySession({
                cwd:
                  typeof message.cwd === "string" && message.cwd.length > 0
                    ? message.cwd
                    : undefined,
                sessionId: message.sessionId,
                source: message.source as ChatHistoryResumeSource,
              });
            }
            return;
        }
      },
      undefined,
      context.subscriptions,
    );

    // Reset when the panel is closed
    currentPanel.onDidDispose(
      () => {
        currentPanel = undefined;
      },
      null,
      context.subscriptions,
    );
  }
}

async function sendConversationToWebview(
  panel: vscode.WebviewPanel,
  conversationFile: ConversationFile,
) {
  try {
    const content = await readJsonlFileAsync(conversationFile.path);
    if (content === null) {
      // vscode.window.showErrorMessage('Failed to read conversation file: File is too large or could not be read');
      return;
    }
    panel.title = `VSmux Search - ${conversationFile.name}`;
    panel.webview.postMessage({
      command: "loadConversation",
      fileName: conversationFile.name,
      filePath: conversationFile.path,
      content: content,
    });
  } catch (error) {
    // vscode.window.showErrorMessage(`Failed to read conversation file: ${error}`);
  }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "chat-history", "dist", "webview.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "chat-history", "dist", "webview.css"),
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>VSmux Search</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {
  // Cleanup when the extension is deactivated
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = undefined;
  }
  if (sidebarProvider) {
    sidebarProvider.dispose();
    sidebarProvider = undefined;
  }
  isSuspended = false;
}
