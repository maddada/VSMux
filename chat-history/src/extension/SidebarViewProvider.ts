import * as vscode from "vscode";
import {
  scanForConversationsAsync,
  encodeWorkspacePath,
  formatFileSize,
  formatDate,
  conversationStoresExist,
  loadFolderSummaries,
  getHomeDirectory,
  type ConversationProfile,
  type ConversationSource,
  type ConversationFile,
  type FolderNode,
} from "./fileSystem";

// Cache for folder display names and home prefix
const folderDisplayNameCache = new Map<string, string>();
let cachedHomePrefix: string | null = null;

// Known subdirectories that should be decoded as path segments
const KNOWN_SUBDIRS = [
  ".claude",
  "dev",
  "src",
  "code",
  "projects",
  "work",
  "Documents",
  "repos",
  "github",
  "Desktop",
  "Downloads",
  "workspace",
  "git",
];

/**
 * Get the encoded home directory prefix (cached)
 */
function getEncodedHomePrefix(): string {
  if (cachedHomePrefix === null) {
    const homeDir = getHomeDirectory();
    // /Users/madda -> -Users-madda
    cachedHomePrefix = homeDir.replace(/\//g, "-");
  }
  return cachedHomePrefix;
}

/**
 * Convert encoded folder name back to a readable path
 * e.g. "-Users-madda-dev-vsmux-search-vscode" -> "~/dev/vsmux-search-vscode"
 * Only decodes known directory prefixes, keeps project name with dashes intact
 */
function formatFolderDisplayName(encodedName: string): string {
  if (encodedName === "__codex_unknown__") {
    return "Codex (Unknown Workspace)";
  }
  if (encodedName === "-") {
    return "/";
  }

  // Check cache first
  const cached = folderDisplayNameCache.get(encodedName);
  if (cached) return cached;

  const homePrefix = getEncodedHomePrefix();
  let result = encodedName;

  // Check if starts with home prefix
  if (encodedName.startsWith(homePrefix + "-")) {
    let remaining = encodedName.slice(homePrefix.length + 1); // +1 for dash after home
    const parts: string[] = ["~"];

    // Decode known directory prefixes iteratively
    let foundKnown = true;
    while (foundKnown && remaining) {
      foundKnown = false;
      for (const subdir of KNOWN_SUBDIRS) {
        const prefix = subdir + "-";
        if (remaining.startsWith(prefix)) {
          parts.push(subdir);
          remaining = remaining.slice(prefix.length);
          foundKnown = true;
          break;
        } else if (remaining === subdir) {
          parts.push(subdir);
          remaining = "";
          foundKnown = true;
          break;
        }
      }
    }

    // Remaining is the project name - keep dashes as-is
    if (remaining) {
      parts.push(remaining);
    }

    result = parts.join("/");
  }

  // Cache the result
  folderDisplayNameCache.set(encodedName, result);
  return result;
}

function inferConversationSource(filePath: string): ConversationSource {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/.codex/") || normalized.includes("/.codex-profiles/")) {
    return "Codex";
  }
  return "Claude";
}

function inferConversationProfile(filePath: string): ConversationProfile | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  if (
    normalized.includes("/.claude-profiles/work/") ||
    normalized.includes("/.codex-profiles/work/")
  ) {
    return "Work";
  }
  if (
    normalized.includes("/.claude-profiles/personal/") ||
    normalized.includes("/.codex-profiles/personal/")
  ) {
    return "Personal";
  }
  return undefined;
}

export type ConversationScope = "current" | "all";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "VSmuxSearch.conversations";

  private _view?: vscode.WebviewView;
  private _folders: Map<string, FolderNode> = new Map();
  private _loadedFolderSummaries: Set<string> = new Set();
  private _isLoading: boolean = false;
  private _scope: ConversationScope = "current";
  private _currentProjectFolderName: string | null = null;
  private _filterText: string = "";
  private _showAllTime: boolean = false;
  private _expandedFolders: Set<string> = new Set();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    workspacePath?: string,
  ) {
    if (workspacePath) {
      this._currentProjectFolderName = encodeWorkspacePath(workspacePath);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "ready":
          await this.refresh();
          break;
        case "filter":
          this._filterText = message.text || "";
          this._updateWebview();
          break;
        case "openConversation":
          const file = this._findFileByPath(message.path);
          if (file) {
            vscode.commands.executeCommand("VSmuxSearch.openConversation", file);
          }
          break;
        case "toggleScope":
          this.toggleScope();
          break;
        case "toggleShowAllTime":
          this._showAllTime = !this._showAllTime;
          this._updateWebview();
          break;
        case "toggleFolder":
          if (this._expandedFolders.has(message.folder)) {
            this._expandedFolders.delete(message.folder);
          } else {
            this._expandedFolders.add(message.folder);
          }
          this._updateWebview();
          break;
      }
    });
  }

  private _findFileByPath(filePath: string): ConversationFile | undefined {
    for (const folder of this._folders.values()) {
      const file = folder.files.find((f) => f.path === filePath);
      if (file) return file;
    }
    return undefined;
  }

  public get scope(): ConversationScope {
    return this._scope;
  }

  public setScope(scope: ConversationScope): void {
    if (this._scope !== scope) {
      this._scope = scope;
      this.refresh();
    }
  }

  public toggleScope(): ConversationScope {
    this._scope = this._scope === "current" ? "all" : "current";
    this.refresh();
    return this._scope;
  }

  public toggleTimeFilter(): boolean {
    this._showAllTime = !this._showAllTime;
    this._updateWebview();
    return this._showAllTime;
  }

  public setWorkspacePath(workspacePath: string | null): void {
    this._currentProjectFolderName = workspacePath ? encodeWorkspacePath(workspacePath) : null;
    this.refresh();
  }

  public get currentProjectFolderName(): string | null {
    return this._currentProjectFolderName;
  }

  public hasCurrentProjectConversations(): boolean {
    if (!this._currentProjectFolderName) return false;
    return this._folders.has(this._currentProjectFolderName);
  }

  public async refresh(): Promise<void> {
    if (this._isLoading) return;

    this._isLoading = true;
    this._loadedFolderSummaries.clear();

    try {
      this._folders = await scanForConversationsAsync();

      // Load summaries for all folders
      for (const folder of this._folders.values()) {
        if (!this._loadedFolderSummaries.has(folder.name)) {
          await loadFolderSummaries(folder);
          this._loadedFolderSummaries.add(folder.name);
        }
      }
    } catch (err) {
      console.error("Error scanning conversations:", err);
      this._folders = new Map();
    } finally {
      this._isLoading = false;
      this._updateWebview();
    }
  }

  public clearCache(): void {
    this._folders.clear();
    this._loadedFolderSummaries.clear();
  }

  public dispose(): void {
    this.clearCache();
  }

  private _updateWebview(): void {
    if (!this._view) return;

    const data = this._getFilteredData();
    const expandedFolders = Array.from(this._expandedFolders);
    this._view.webview.postMessage({
      command: "update",
      data: data,
      scope: this._scope,
      filter: this._filterText,
      hasProjects: conversationStoresExist(),
      showAllTime: this._showAllTime,
      expandedFolders: expandedFolders,
    });
  }

  private _getFilteredData(): Array<{
    folder: string;
    displayName: string;
    files: Array<{
      name: string;
      path: string;
      size: string;
      summary: string;
      date: string;
      timestamp: number;
      source: ConversationSource;
      profile?: ConversationProfile;
    }>;
    totalFiles: number;
  }> {
    let foldersToShow: FolderNode[];

    if (this._scope === "current" && this._currentProjectFolderName) {
      const currentFolder = this._folders.get(this._currentProjectFolderName);
      foldersToShow = currentFolder ? [currentFolder] : [];
    } else {
      foldersToShow = Array.from(this._folders.values()).sort((a, b) => {
        const aLatest = a.files[0]?.lastModified.getTime() || 0;
        const bLatest = b.files[0]?.lastModified.getTime() || 0;
        return bLatest - aLatest;
      });
    }

    const filterLower = this._filterText.toLowerCase();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return foldersToShow
      .map((folder) => {
        let files = folder.files;

        // Apply text filter
        if (this._filterText) {
          files = files.filter(
            (f) =>
              f.name.toLowerCase().includes(filterLower) ||
              (f.summary && f.summary.toLowerCase().includes(filterLower)),
          );
        }

        // Apply time filter (unless showAllTime is true or there's a text filter)
        if (!this._showAllTime && !this._filterText) {
          files = files.filter((f) => f.lastModified.getTime() >= oneWeekAgo);
        }

        return {
          folder: folder.name,
          displayName: formatFolderDisplayName(folder.name),
          totalFiles: folder.files.length,
          files: files.map((f) => ({
            name: f.name,
            path: f.path,
            size: formatFileSize(f.size),
            summary: f.summary || "",
            date: formatDate(f.lastModified),
            timestamp: f.lastModified.getTime(),
            source: f.source ?? inferConversationSource(f.path),
            profile: f.profile ?? inferConversationProfile(f.path),
          })),
        };
      })
      .filter((f) => f.files.length > 0);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>VSmux Search</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 0;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .filter-container {
      padding: 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background);
      z-index: 10;
    }
    .filter-input {
      width: 100%;
      padding: 4px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 2px;
      outline: none;
      font-size: 12px;
    }
    .filter-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .filter-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .list {
      flex: 1;
      overflow-y: auto;
    }
    .folder {
      margin-bottom: 4px;
    }
    .folder-header {
      padding: 4px 8px;
      font-weight: 600;
      font-size: 11px;
      color: var(--vscode-sideBarSectionHeader-foreground);
      background: var(--vscode-sideBarSectionHeader-background);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }
    .folder-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .folder-header .count {
      color: var(--vscode-descriptionForeground);
      font-weight: normal;
    }
    .folder-header .chevron {
      font-size: 10px;
      transition: transform 0.15s;
    }
    .folder-header .chevron.expanded {
      transform: rotate(90deg);
    }
    .file-item {
      padding: 4px 8px 4px 16px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .file-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .file-summary {
      font-size: 12px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-name {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      word-break: break-all;
    }
    .file-meta {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .empty {
      padding: 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .empty a {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
    }
    .highlight {
      background: var(--vscode-editor-findMatchHighlightBackground);
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="filter-container">
      <input type="text" class="filter-input" placeholder="Filter by name or summary..." id="filter">
    </div>
    <div class="header">
      <span id="scope-label">Current Project</span>
    </div>
    <div class="list" id="list">
      <div class="empty">Loading...</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const filterInput = document.getElementById('filter');
    const listEl = document.getElementById('list');
    const scopeLabel = document.getElementById('scope-label');

    let currentData = [];
    let currentFilter = '';
    let currentScope = 'current';
    let currentShowAllTime = false;
    let currentExpandedFolders = [];

    // Debounce filter input
    let filterTimeout;
    filterInput.addEventListener('input', (e) => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        vscode.postMessage({ command: 'filter', text: e.target.value });
      }, 150);
    });

    function highlightMatch(text, filter) {
      if (!filter) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const filterEscaped = escapeHtml(filter);
      const regex = new RegExp('(' + filterEscaped.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
      return escaped.replace(regex, '<span class="highlight">$1</span>');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function render(data, filter, scope, hasProjects, showAllTime, expandedFolders) {
      currentData = data;
      currentFilter = filter;
      currentScope = scope;
      currentShowAllTime = showAllTime;
      currentExpandedFolders = expandedFolders || [];

      // Update scope UI
      const timeLabel = showAllTime ? ' (all time)' : ' (recent)';
      scopeLabel.textContent = (scope === 'current' ? 'Current Project' : 'All Projects') + timeLabel;

      if (!hasProjects) {
        listEl.innerHTML = '<div class="empty">No Claude or Codex conversations found.<br><br>Start a Claude Code or Codex conversation to see it here.</div>';
        return;
      }

      if (data.length === 0) {
        if (filter) {
          listEl.innerHTML = '<div class="empty">No matches found.</div>';
        } else if (scope === 'current') {
          let msg = '<div class="empty">No recent conversations for this project.';
          if (!showAllTime) {
            msg += '<br><br><a id="show-old">Show older conversations</a>';
          }
          msg += '<br><br><a id="show-all">Show All Projects</a></div>';
          listEl.innerHTML = msg;
          document.getElementById('show-old')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'toggleShowAllTime' });
          });
          document.getElementById('show-all')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'toggleScope' });
          });
        } else {
          listEl.innerHTML = '<div class="empty">No conversations found.</div>';
        }
        return;
      }

      let html = '';
      for (const folder of data) {
        // In current scope with single folder, don't show folder header
        const showFolderHeader = scope === 'all' || data.length > 1;
        // In 'all' scope with no filter, folders are collapsed by default
        const isExpanded = filter || scope === 'current' || currentExpandedFolders.includes(folder.folder);

        if (showFolderHeader) {
          html += '<div class="folder">';
          const chevronClass = isExpanded ? 'chevron expanded' : 'chevron';
          html += '<div class="folder-header" data-folder="' + escapeHtml(folder.folder) + '">';
          html += '<span class="' + chevronClass + '">▶</span> ';
          html += escapeHtml(folder.displayName) + ' <span class="count">(' + folder.files.length + (folder.totalFiles !== folder.files.length ? '/' + folder.totalFiles : '') + ')</span></div>';
        }

        if (isExpanded || !showFolderHeader) {
          for (const file of folder.files) {
            html += '<div class="file-item" data-path="' + escapeHtml(file.path) + '">';
            html += '<div class="file-summary">' + (file.summary ? highlightMatch(file.summary, filter) : escapeHtml('(No user message)')) + '</div>';
            html += '<div class="file-name">' + highlightMatch(file.name, filter) + '</div>';
            const sourceParts = [file.date, file.source];
            if (file.profile) {
              sourceParts.push(file.profile);
            }
            html += '<div class="file-meta">' + escapeHtml(file.size) + ' • ' + sourceParts.map(escapeHtml).join(' · ') + '</div>';
            html += '</div>';
          }
        }

        if (showFolderHeader) {
          html += '</div>';
        }
      }
      listEl.innerHTML = html;

      // Attach click handlers for files
      listEl.querySelectorAll('.file-item').forEach(el => {
        el.addEventListener('click', () => {
          const path = el.getAttribute('data-path');
          vscode.postMessage({ command: 'openConversation', path });
        });
      });

      // Attach click handlers for folder headers
      listEl.querySelectorAll('.folder-header').forEach(el => {
        el.addEventListener('click', () => {
          const folder = el.getAttribute('data-folder');
          vscode.postMessage({ command: 'toggleFolder', folder });
        });
      });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'update':
          render(message.data, message.filter, message.scope, message.hasProjects, message.showAllTime, message.expandedFolders);
          break;
      }
    });

    // Signal ready
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
