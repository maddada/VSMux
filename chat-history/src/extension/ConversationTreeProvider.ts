import * as vscode from "vscode";
import {
  scanForConversationsAsync,
  encodeWorkspacePath,
  formatFileSize,
  formatDate,
  conversationStoresExist,
  loadFolderSummaries,
  type ConversationFile,
  type FolderNode,
} from "./fileSystem";
import { logChatHistoryError } from "./log";

export type ConversationScope = "current" | "all";

/**
 * Tree item representing either a folder or a conversation file
 */
export class ConversationTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly conversationFile?: ConversationFile,
    public readonly folderNode?: FolderNode,
  ) {
    super(label, collapsibleState);

    if (conversationFile) {
      // This is a conversation file
      this.tooltip = this.createFileTooltip(conversationFile);
      this.description = this.createFileDescription(conversationFile);
      this.contextValue = "conversationFile";
      this.iconPath = new vscode.ThemeIcon("file");

      // Command to open the conversation when clicked
      this.command = {
        command: "VSmuxSearch.openConversation",
        title: "Open Conversation",
        arguments: [conversationFile],
      };
    } else if (folderNode) {
      // This is a folder
      this.tooltip = `${folderNode.files.length} conversation(s)`;
      this.description = `${folderNode.files.length} files`;
      this.contextValue = "conversationFolder";
      this.iconPath = new vscode.ThemeIcon("folder");
    }
  }

  private createFileTooltip(file: ConversationFile): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${file.name}**\n\n`);
    if (file.summary !== null && file.summary.length > 0) {
      md.appendMarkdown(`${file.summary}\n\n`);
    }
    md.appendMarkdown(`- Size: ${formatFileSize(file.size)}\n`);
    md.appendMarkdown(`- Modified: ${formatDate(file.lastModified)}\n`);
    return md;
  }

  private createFileDescription(file: ConversationFile): string {
    // Show summary if available and loaded, otherwise show size
    if (file.summary !== null && file.summary.length > 0) {
      const truncated = file.summary.length > 40 ? file.summary.slice(0, 40) + "..." : file.summary;
      return truncated;
    }
    return formatFileSize(file.size);
  }
}

/**
 * Tree data provider for AI assistant conversations
 */
export class ConversationTreeProvider implements vscode.TreeDataProvider<ConversationTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ConversationTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ConversationTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<ConversationTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private folders: Map<string, FolderNode> = new Map();
  private loadedFolderSummaries: Set<string> = new Set(); // Track which folders have loaded summaries
  private isLoading: boolean = false;
  private _scope: ConversationScope = "current";
  private _currentProjectFolderName: string | null = null;

  constructor(workspacePath?: string) {
    if (workspacePath) {
      this._currentProjectFolderName = encodeWorkspacePath(workspacePath);
    }
    this.refresh();
  }

  /**
   * Dispose resources and clear caches
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.clearCache();
  }

  /**
   * Clear all cached data to free memory
   */
  clearCache(): void {
    this.folders.clear();
    this.loadedFolderSummaries.clear();
  }

  /**
   * Get the current scope
   */
  get scope(): ConversationScope {
    return this._scope;
  }

  /**
   * Set the scope and refresh
   */
  setScope(scope: ConversationScope): void {
    if (this._scope !== scope) {
      this._scope = scope;
      this.refresh();
    }
  }

  /**
   * Toggle the scope between 'current' and 'all'
   */
  toggleScope(): ConversationScope {
    this._scope = this._scope === "current" ? "all" : "current";
    this.refresh();
    return this._scope;
  }

  /**
   * Set the workspace path for current project detection
   */
  setWorkspacePath(workspacePath: string | null): void {
    this._currentProjectFolderName = workspacePath ? encodeWorkspacePath(workspacePath) : null;
    this.refresh();
  }

  /**
   * Get the current project folder name (encoded)
   */
  get currentProjectFolderName(): string | null {
    return this._currentProjectFolderName;
  }

  /**
   * Check if there are conversations for the current project
   */
  hasCurrentProjectConversations(): boolean {
    if (!this._currentProjectFolderName) return false;
    return this.folders.has(this._currentProjectFolderName);
  }

  /**
   * Refresh the tree view by rescanning the conversations
   */
  refresh(): void {
    if (this.isLoading) return;

    this.isLoading = true;
    // Clear summary cache on refresh - summaries will be lazy loaded again
    this.loadedFolderSummaries.clear();

    // Scan asynchronously to not block UI
    scanForConversationsAsync()
      .then((folders) => {
        this.folders = folders;
      })
      .catch((err) => {
        logChatHistoryError("Error scanning conversations:", err);
        this.folders = new Map();
      })
      .finally(() => {
        this.isLoading = false;
        this._onDidChangeTreeData.fire();
      });
  }

  getTreeItem(element: ConversationTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ConversationTreeItem): Thenable<ConversationTreeItem[]> {
    if (!conversationStoresExist()) {
      // Return empty array - the welcome view will be shown
      return Promise.resolve([]);
    }

    if (!element) {
      // Root level - return folders based on scope
      let foldersToShow: FolderNode[];

      if (this._scope === "current" && this._currentProjectFolderName) {
        // Current project scope - only show the current project's folder
        const currentFolder = this.folders.get(this._currentProjectFolderName);
        if (currentFolder) {
          // In current project mode, show files directly without folder wrapper
          // Lazy load summaries for current project files
          return this.loadSummariesAndCreateItems(currentFolder);
        }
        // No conversations for current project
        return Promise.resolve([]);
      } else {
        // All projects scope - show all folders
        foldersToShow = Array.from(this.folders.values()).sort((a, b) => {
          const aLatest = a.files[0]?.lastModified.getTime() || 0;
          const bLatest = b.files[0]?.lastModified.getTime() || 0;
          return bLatest - aLatest;
        });
      }

      return Promise.resolve(
        foldersToShow.map((folder) => {
          // Mark the current project folder
          const isCurrentProject = folder.name === this._currentProjectFolderName;
          const item = new ConversationTreeItem(
            folder.name,
            isCurrentProject
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            folder,
          );
          if (isCurrentProject) {
            item.description = `${folder.files.length} files (current)`;
          }
          return item;
        }),
      );
    } else if (element.folderNode) {
      // Folder level - lazy load summaries when folder is expanded
      return this.loadSummariesAndCreateItems(element.folderNode);
    }

    return Promise.resolve([]);
  }

  /**
   * Lazy load summaries for a folder and create tree items
   */
  private async loadSummariesAndCreateItems(
    folderNode: FolderNode,
  ): Promise<ConversationTreeItem[]> {
    // Check if summaries are already loaded for this folder
    if (!this.loadedFolderSummaries.has(folderNode.name)) {
      // Load summaries asynchronously
      await loadFolderSummaries(folderNode);
      this.loadedFolderSummaries.add(folderNode.name);
    }

    return folderNode.files.map(
      (file) =>
        new ConversationTreeItem(file.name, vscode.TreeItemCollapsibleState.None, file, undefined),
    );
  }

  /**
   * Get the parent of a tree item (for reveal functionality)
   */
  getParent(element: ConversationTreeItem): ConversationTreeItem | undefined {
    if (element.conversationFile) {
      const folder = this.folders.get(element.conversationFile.folder);
      if (folder) {
        return new ConversationTreeItem(
          folder.name,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          folder,
        );
      }
    }
    return undefined;
  }
}
