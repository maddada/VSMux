import { readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  getT3SessionSurfaceTitle,
  isT3Session,
  type SessionGridSnapshot,
  type T3SessionRecord,
} from "../shared/session-grid-contract";
import {
  focusEditorGroupByIndex,
  getActiveEditorGroupViewColumn,
  getViewColumn,
  moveActiveEditorToNextGroup,
  moveActiveEditorToPreviousGroup,
} from "./terminal-workspace-helpers";

type T3WebviewManagerOptions = {
  context: vscode.ExtensionContext;
  onDidFocusSession: (sessionId: string) => Promise<void>;
};

type ManagedPanel = {
  panel: vscode.WebviewPanel;
  pendingComposerFocus: boolean;
  ready: boolean;
  renderKey: string;
  sessionId: string;
};

const T3_PANEL_TYPE = "VSmux.t3Session";
const MAX_PANEL_MOVE_STEPS = 8;
const PANEL_MOVE_SETTLE_MS = 25;
const SUPPRESSED_FOCUS_EVENT_MS = 1_500;

export class T3WebviewManager implements vscode.Disposable {
  private readonly panelsBySessionId = new Map<string, ManagedPanel>();
  private readonly suppressedFocusUntilBySessionId = new Map<string, number>();
  private pendingProgrammaticFocus:
    | {
        clearTimeout: ReturnType<typeof setTimeout>;
        sessionId: string;
      }
    | undefined;

  public constructor(private readonly options: T3WebviewManagerOptions) {}

  public dispose(): void {
    this.clearPendingProgrammaticFocus();
    this.suppressedFocusUntilBySessionId.clear();
    for (const managedPanel of this.panelsBySessionId.values()) {
      managedPanel.panel.dispose();
    }
    this.panelsBySessionId.clear();
  }

  public async reconcileVisibleSessions(
    snapshot: SessionGridSnapshot,
    preserveFocus = false,
  ): Promise<void> {
    const orderedVisibleSessions = snapshot.visibleSessionIds
      .map((sessionId) => snapshot.sessions.find((session) => session.sessionId === sessionId))
      .filter((session): session is T3SessionRecord => Boolean(session && isT3Session(session)));
    await this.closeRestoredPanelsOutsideVisibleSessions(orderedVisibleSessions);
    const visibleSessionIdSet = new Set(orderedVisibleSessions.map((session) => session.sessionId));

    for (const [sessionId, managedPanel] of this.panelsBySessionId.entries()) {
      if (visibleSessionIdSet.has(sessionId)) {
        continue;
      }

      managedPanel.panel.dispose();
      this.panelsBySessionId.delete(sessionId);
    }

    const focusedVisibleSession = orderedVisibleSessions.find(
      (session) => session.sessionId === snapshot.focusedSessionId,
    );
    const nonFocusedSessions = orderedVisibleSessions.filter(
      (session) => session.sessionId !== focusedVisibleSession?.sessionId,
    );

    for (const session of nonFocusedSessions) {
      await this.revealSession(session, snapshot, true);
    }

    if (focusedVisibleSession) {
      await this.revealSession(focusedVisibleSession, snapshot, preserveFocus);
    }
  }

  private async closeRestoredPanelsOutsideVisibleSessions(
    visibleSessions: readonly T3SessionRecord[],
  ): Promise<void> {
    const visibleSessionIdByTitle = new Map(
      visibleSessions.map((sessionRecord) => [
        getPanelTitle(sessionRecord),
        sessionRecord.sessionId,
      ]),
    );

    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          !(tab.input instanceof vscode.TabInputWebview) ||
          tab.input.viewType !== T3_PANEL_TYPE
        ) {
          continue;
        }

        const visibleSessionId = visibleSessionIdByTitle.get(tab.label);
        if (visibleSessionId && this.panelsBySessionId.get(visibleSessionId)?.panel.visible) {
          continue;
        }

        await vscode.window.tabGroups.close(tab, true);
      }
    }
  }

  public async revealStoredSession(
    sessionRecord: T3SessionRecord,
    snapshot: SessionGridSnapshot,
    preserveFocus: boolean,
  ): Promise<void> {
    await this.revealSession(sessionRecord, snapshot, preserveFocus);
  }

  public disposeSession(sessionId: string): void {
    const managedPanel = this.panelsBySessionId.get(sessionId);
    if (!managedPanel) {
      return;
    }

    managedPanel.panel.dispose();
    this.panelsBySessionId.delete(sessionId);
  }

  public disposeAllSessions(): void {
    for (const sessionId of this.panelsBySessionId.keys()) {
      this.disposeSession(sessionId);
    }
  }

  public focusComposer(sessionId: string): void {
    const managedPanel = this.panelsBySessionId.get(sessionId);
    if (!managedPanel) {
      return;
    }

    this.requestComposerFocus(managedPanel);
  }

  private async revealSession(
    sessionRecord: T3SessionRecord,
    snapshot: SessionGridSnapshot,
    preserveFocus: boolean,
  ): Promise<void> {
    const visibleIndex = snapshot.visibleSessionIds.indexOf(sessionRecord.sessionId);
    if (visibleIndex < 0) {
      return;
    }

    const managedPanel = this.panelsBySessionId.get(sessionRecord.sessionId);
    const viewColumn = getViewColumn(visibleIndex);
    const nextRenderKey = getRenderKey(sessionRecord);
    this.setSuppressedSessionFocus(sessionRecord.sessionId, preserveFocus);
    if (!preserveFocus) {
      this.beginProgrammaticFocus(sessionRecord.sessionId);
    }
    if (managedPanel) {
      managedPanel.panel.title = getPanelTitle(sessionRecord);
      if (managedPanel.renderKey !== nextRenderKey) {
        managedPanel.ready = false;
        managedPanel.panel.webview.html = await this.createPanelHtml(
          managedPanel.panel.webview,
          sessionRecord,
        );
        managedPanel.renderKey = nextRenderKey;
      }
      if (
        !preserveFocus ||
        managedPanel.panel.viewColumn !== viewColumn ||
        !managedPanel.panel.visible
      ) {
        managedPanel.panel.reveal(viewColumn, preserveFocus);
      }
      await this.ensurePanelViewColumn(managedPanel.panel, viewColumn, preserveFocus);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      T3_PANEL_TYPE,
      getPanelTitle(sessionRecord),
      {
        preserveFocus,
        viewColumn,
      },
      {
        enableScripts: true,
        localResourceRoots: [getEmbeddedT3Root(this.options.context)],
        retainContextWhenHidden: true,
      },
    );
    const nextManagedPanel: ManagedPanel = {
      panel,
      pendingComposerFocus: false,
      ready: false,
      renderKey: nextRenderKey,
      sessionId: sessionRecord.sessionId,
    };
    this.panelsBySessionId.set(sessionRecord.sessionId, nextManagedPanel);

    panel.onDidDispose(() => {
      if (this.panelsBySessionId.get(sessionRecord.sessionId)?.panel === panel) {
        this.panelsBySessionId.delete(sessionRecord.sessionId);
      }
      this.suppressedFocusUntilBySessionId.delete(sessionRecord.sessionId);
    });
    panel.onDidChangeViewState((event) => {
      if (!event.webviewPanel.active) {
        return;
      }

      if (this.shouldSuppressSessionFocus(sessionRecord.sessionId)) {
        return;
      }

      if (this.shouldIgnoreFocusEvent(sessionRecord.sessionId)) {
        return;
      }

      void this.options.onDidFocusSession(sessionRecord.sessionId);
    });
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isT3WebviewMessage(message)) {
        return;
      }

      nextManagedPanel.ready = true;
      if (nextManagedPanel.pendingComposerFocus) {
        this.requestComposerFocus(nextManagedPanel);
      }
    });
    panel.webview.html = await this.createPanelHtml(panel.webview, sessionRecord);
    await this.ensurePanelViewColumn(panel, viewColumn, preserveFocus);
  }

  private async ensurePanelViewColumn(
    panel: vscode.WebviewPanel,
    desiredViewColumn: vscode.ViewColumn,
    preserveFocus: boolean,
  ): Promise<void> {
    if (panel.viewColumn === desiredViewColumn) {
      return;
    }

    if (preserveFocus) {
      panel.reveal(desiredViewColumn, true);
      await delay(PANEL_MOVE_SETTLE_MS);
      return;
    }

    const restoreViewColumn = preserveFocus ? getActiveEditorGroupViewColumn() : undefined;
    panel.reveal(panel.viewColumn ?? desiredViewColumn, false);
    await delay(PANEL_MOVE_SETTLE_MS);

    for (let attempt = 0; attempt < MAX_PANEL_MOVE_STEPS; attempt += 1) {
      const currentViewColumn = panel.viewColumn;
      if (currentViewColumn === desiredViewColumn) {
        break;
      }

      if (currentViewColumn === undefined) {
        panel.reveal(desiredViewColumn, false);
        await delay(PANEL_MOVE_SETTLE_MS);
        continue;
      }

      if (currentViewColumn < desiredViewColumn) {
        await moveActiveEditorToNextGroup();
      } else {
        await moveActiveEditorToPreviousGroup();
      }

      await delay(PANEL_MOVE_SETTLE_MS);
    }

    if (panel.viewColumn !== desiredViewColumn) {
      panel.reveal(desiredViewColumn, preserveFocus);
      await delay(PANEL_MOVE_SETTLE_MS);
    }

    if (preserveFocus && restoreViewColumn && restoreViewColumn !== desiredViewColumn) {
      await focusEditorGroupByIndex(restoreViewColumn - 1);
    }
  }

  private requestComposerFocus(managedPanel: ManagedPanel): void {
    if (!managedPanel.ready) {
      managedPanel.pendingComposerFocus = true;
      return;
    }

    managedPanel.pendingComposerFocus = false;
    void managedPanel.panel.webview.postMessage({ type: "focusComposer" });
  }

  private beginProgrammaticFocus(sessionId: string): void {
    this.clearPendingProgrammaticFocus();
    this.pendingProgrammaticFocus = {
      clearTimeout: setTimeout(() => {
        if (this.pendingProgrammaticFocus?.sessionId === sessionId) {
          this.pendingProgrammaticFocus = undefined;
        }
      }, 250),
      sessionId,
    };
  }

  private clearPendingProgrammaticFocus(): void {
    if (!this.pendingProgrammaticFocus) {
      return;
    }

    clearTimeout(this.pendingProgrammaticFocus.clearTimeout);
    this.pendingProgrammaticFocus = undefined;
  }

  private setSuppressedSessionFocus(sessionId: string, preserveFocus: boolean): void {
    if (!preserveFocus) {
      this.suppressedFocusUntilBySessionId.delete(sessionId);
      return;
    }

    this.suppressedFocusUntilBySessionId.set(sessionId, Date.now() + SUPPRESSED_FOCUS_EVENT_MS);
  }

  private shouldSuppressSessionFocus(sessionId: string): boolean {
    const suppressedUntil = this.suppressedFocusUntilBySessionId.get(sessionId);
    if (!suppressedUntil) {
      return false;
    }

    if (Date.now() <= suppressedUntil) {
      return true;
    }

    this.suppressedFocusUntilBySessionId.delete(sessionId);
    return false;
  }

  private shouldIgnoreFocusEvent(sessionId: string): boolean {
    const pendingProgrammaticFocus = this.pendingProgrammaticFocus;
    if (!pendingProgrammaticFocus) {
      return false;
    }

    if (pendingProgrammaticFocus.sessionId === sessionId) {
      this.clearPendingProgrammaticFocus();
      return true;
    }

    return true;
  }

  private async createPanelHtml(
    webview: vscode.Webview,
    sessionRecord: T3SessionRecord,
  ): Promise<string> {
    const embeddedRoot = getEmbeddedT3Root(this.options.context);
    const indexPath = path.join(embeddedRoot.fsPath, "index.html");
    const nonce = createNonce();

    let html: string;
    try {
      html = await readFile(indexPath, "utf8");
    } catch {
      return createMissingEmbedHtml(webview, nonce);
    }

    const webviewRootUri = webview.asWebviewUri(embeddedRoot).toString();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource} data:`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `connect-src ${sessionRecord.t3.serverOrigin} ${toWebSocketOrigin(sessionRecord.t3.serverOrigin)}`,
    ].join("; ");
    const bootstrapScript = `<script nonce="${nonce}">window.__VSMUX_T3_BOOTSTRAP__=${JSON.stringify(
      {
        embedMode: "vsmux-mobile",
        httpOrigin: sessionRecord.t3.serverOrigin,
        sessionId: sessionRecord.sessionId,
        threadId: sessionRecord.t3.threadId,
        workspaceRoot: sessionRecord.t3.workspaceRoot,
        wsUrl: toWebSocketOrigin(sessionRecord.t3.serverOrigin),
      },
    )};</script>`;

    return html
      .replace(
        /<meta\s+charset="UTF-8"\s*\/?>/i,
        `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${csp}" />${bootstrapScript}`,
      )
      .replaceAll(/(src|href)="\/([^"]+)"/g, (_, attribute: string, assetPath: string) => {
        const resourceUri = `${webviewRootUri}/${assetPath}`;
        return `${attribute}="${resourceUri}"`;
      })
      .replace(/<script type="module"/g, `<script nonce="${nonce}" type="module"`);
  }
}

function getEmbeddedT3Root(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, "forks", "t3code-embed", "dist");
}

function getPanelTitle(sessionRecord: T3SessionRecord): string {
  return getT3SessionSurfaceTitle(sessionRecord);
}

function getRenderKey(sessionRecord: T3SessionRecord): string {
  return [
    sessionRecord.alias,
    sessionRecord.t3.projectId,
    sessionRecord.t3.serverOrigin,
    sessionRecord.t3.threadId,
    sessionRecord.t3.workspaceRoot,
  ].join("|");
}

function toWebSocketOrigin(serverOrigin: string): string {
  return serverOrigin.replace(/^http/i, "ws");
}

function createMissingEmbedHtml(webview: vscode.Webview, nonce: string): string {
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>T3 Code</title>
    <style>
      body {
        margin: 0;
        background: #111827;
        color: #f9fafb;
        font: 13px/1.5 -apple-system, BlinkMacSystemFont, sans-serif;
        padding: 24px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, monospace;
      }
    </style>
  </head>
  <body>
    <h1>Embedded T3 assets are missing</h1>
    <p>Build the patched T3 frontend into <code>forks/t3code-embed/dist</code> to render T3 sessions.</p>
  </body>
</html>`;
}

function createNonce(): string {
  return Math.random().toString(36).slice(2);
}

function isT3WebviewMessage(message: unknown): message is { type: "vsmuxReady" } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "vsmuxReady"
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
