import * as vscode from "vscode";
import {
  isBrowserSession,
  type BrowserSessionRecord,
  type SessionGridSnapshot,
} from "../shared/session-grid-contract";
import { focusEditorGroupByIndex, getViewColumn } from "./terminal-workspace-helpers";

type BrowserSessionManagerOptions = {
  onDidChangeSessions?: () => Promise<void> | void;
  onDidFocusSession: (sessionId: string) => Promise<void>;
};

type ManagedBrowserTab = {
  renderKey: string;
  sessionId: string;
  tab: vscode.Tab | undefined;
};

const SIMPLE_BROWSER_OPEN_COMMAND = "simpleBrowser.api.open";

export class BrowserSessionManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly managedTabsBySessionId = new Map<string, ManagedBrowserTab>();
  private lastFocusedSessionId: string | undefined;
  private pendingProgrammaticFocus:
    | {
        clearTimeout: ReturnType<typeof setTimeout>;
        sessionId: string;
      }
    | undefined;

  public constructor(private readonly options: BrowserSessionManagerOptions) {
    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        this.handleTabStateChange();
      }),
      vscode.window.tabGroups.onDidChangeTabGroups(() => {
        this.handleTabStateChange();
      }),
    );
  }

  public dispose(): void {
    this.clearPendingProgrammaticFocus();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.managedTabsBySessionId.clear();
  }

  public async reconcileVisibleSessions(
    snapshot: SessionGridSnapshot,
    preserveFocus = false,
  ): Promise<void> {
    const orderedVisibleSessions = snapshot.visibleSessionIds
      .map((sessionId) => snapshot.sessions.find((session) => session.sessionId === sessionId))
      .filter((session): session is BrowserSessionRecord =>
        Boolean(session && isBrowserSession(session)),
      );
    const visibleSessionIdSet = new Set(orderedVisibleSessions.map((session) => session.sessionId));

    for (const [sessionId, managedTab] of this.managedTabsBySessionId.entries()) {
      if (visibleSessionIdSet.has(sessionId)) {
        continue;
      }

      await this.closeManagedTab(managedTab, true);
      this.managedTabsBySessionId.delete(sessionId);
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

  public async revealStoredSession(
    sessionRecord: BrowserSessionRecord,
    snapshot: SessionGridSnapshot,
    preserveFocus: boolean,
  ): Promise<void> {
    await this.revealSession(sessionRecord, snapshot, preserveFocus);
  }

  public async disposeSession(sessionId: string): Promise<void> {
    const managedTab = this.managedTabsBySessionId.get(sessionId);
    if (!managedTab) {
      return;
    }

    await this.closeManagedTab(managedTab, true);
    this.managedTabsBySessionId.delete(sessionId);
  }

  public hasLiveTab(sessionId: string): boolean {
    const managedTab = this.managedTabsBySessionId.get(sessionId);
    return Boolean(managedTab && this.resolveLiveTab(managedTab.tab));
  }

  private async revealSession(
    sessionRecord: BrowserSessionRecord,
    snapshot: SessionGridSnapshot,
    preserveFocus: boolean,
  ): Promise<void> {
    const visibleIndex = snapshot.visibleSessionIds.indexOf(sessionRecord.sessionId);
    if (visibleIndex < 0) {
      return;
    }

    const viewColumn = getViewColumn(visibleIndex);
    const renderKey = getRenderKey(sessionRecord);
    const managedTab =
      this.managedTabsBySessionId.get(sessionRecord.sessionId) ??
      this.createManagedTab(sessionRecord.sessionId, renderKey);
    let currentTab =
      this.resolveLiveTab(managedTab.tab) ?? this.findMatchingTab(sessionRecord, viewColumn);

    if (managedTab.renderKey !== renderKey) {
      await this.closeManagedTab(managedTab, true);
      managedTab.renderKey = renderKey;
      currentTab = undefined;
    }

    if (!currentTab || currentTab.group.viewColumn !== viewColumn) {
      if (!preserveFocus) {
        this.beginProgrammaticFocus(sessionRecord.sessionId);
      }
      managedTab.tab = await this.openBrowserTab(
        sessionRecord,
        viewColumn,
        preserveFocus,
        visibleIndex,
      );
      return;
    }

    managedTab.tab = currentTab;
    if (!preserveFocus && (!currentTab.group.isActive || !currentTab.isActive)) {
      this.beginProgrammaticFocus(sessionRecord.sessionId);
      const focusedTab = await this.focusExistingTab(currentTab, visibleIndex);
      managedTab.tab = focusedTab ?? currentTab;
    }
  }

  private createManagedTab(sessionId: string, renderKey: string): ManagedBrowserTab {
    const managedTab: ManagedBrowserTab = {
      renderKey,
      sessionId,
      tab: undefined,
    };
    this.managedTabsBySessionId.set(sessionId, managedTab);
    return managedTab;
  }

  private async closeManagedTab(
    managedTab: ManagedBrowserTab,
    preserveFocus: boolean,
  ): Promise<void> {
    const liveTab = this.resolveLiveTab(managedTab.tab);
    managedTab.tab = undefined;
    if (!liveTab) {
      return;
    }

    try {
      await vscode.window.tabGroups.close(liveTab, preserveFocus);
    } catch {
      // The built-in browser can disappear outside VSmux control; ignore close races.
    }
  }

  private handleTabStateChange(): void {
    let changed = false;
    const liveTabs = new Set(vscode.window.tabGroups.all.flatMap((group) => group.tabs));
    for (const managedTab of this.managedTabsBySessionId.values()) {
      if (managedTab.tab && !liveTabs.has(managedTab.tab)) {
        managedTab.tab = undefined;
        changed = true;
      }
    }

    const activeSessionId = Array.from(this.managedTabsBySessionId.values()).find(
      (managedTab) => managedTab.tab?.group.isActive && managedTab.tab.isActive,
    )?.sessionId;
    if (changed) {
      void this.options.onDidChangeSessions?.();
    }

    if (!activeSessionId || activeSessionId === this.lastFocusedSessionId) {
      return;
    }

    if (this.shouldIgnoreFocusEvent(activeSessionId)) {
      this.lastFocusedSessionId = activeSessionId;
      return;
    }

    this.lastFocusedSessionId = activeSessionId;
    void this.options.onDidFocusSession(activeSessionId);
  }

  private async openBrowserTab(
    sessionRecord: BrowserSessionRecord,
    viewColumn: vscode.ViewColumn,
    preserveFocus: boolean,
    visibleIndex: number,
  ): Promise<vscode.Tab | undefined> {
    const tabsBeforeOpen = new Set(this.getTabsInViewColumn(viewColumn));
    if (!preserveFocus) {
      await focusEditorGroupByIndex(visibleIndex);
    }

    await vscode.commands.executeCommand(
      SIMPLE_BROWSER_OPEN_COMMAND,
      vscode.Uri.parse(sessionRecord.browser.url),
      {
        preserveFocus,
        viewColumn,
      },
    );

    return (
      this.findMatchingTab(sessionRecord, viewColumn) ??
      this.findOpenedTab(viewColumn, tabsBeforeOpen) ??
      this.getLastTabInViewColumn(viewColumn)
    );
  }

  private async focusExistingTab(
    tab: vscode.Tab,
    visibleIndex: number,
  ): Promise<vscode.Tab | undefined> {
    if (!tab.group.isActive) {
      await focusEditorGroupByIndex(visibleIndex);
    }

    if (!tab.isActive) {
      const tabIndex = tab.group.tabs.indexOf(tab);
      if (tabIndex >= 0 && tabIndex < 9) {
        await vscode.commands.executeCommand(`workbench.action.openEditorAtIndex${tabIndex + 1}`);
      }
    }

    return this.resolveLiveTab(tab) ?? this.getTabsInViewColumn(getViewColumn(visibleIndex)).at(-1);
  }

  private findMatchingTab(
    sessionRecord: BrowserSessionRecord,
    viewColumn: vscode.ViewColumn,
  ): vscode.Tab | undefined {
    const expectedUrl = normalizeUrl(sessionRecord.browser.url);
    const exactGroupMatch = vscode.window.tabGroups.all.find(
      (group) => group.viewColumn === viewColumn,
    );
    const exactMatch = exactGroupMatch?.tabs.find(
      (tab) => normalizeUrl(getBrowserTabUrl(tab)) === expectedUrl,
    );
    if (exactMatch) {
      return exactMatch;
    }

    return vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .find((tab) => normalizeUrl(getBrowserTabUrl(tab)) === expectedUrl);
  }

  private resolveLiveTab(tab: vscode.Tab | undefined): vscode.Tab | undefined {
    if (!tab) {
      return undefined;
    }

    return vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .find((candidate) => candidate === tab);
  }

  private findOpenedTab(
    viewColumn: vscode.ViewColumn,
    tabsBeforeOpen: ReadonlySet<vscode.Tab>,
  ): vscode.Tab | undefined {
    return this.getTabsInViewColumn(viewColumn).find((tab) => !tabsBeforeOpen.has(tab));
  }

  private getLastTabInViewColumn(viewColumn: vscode.ViewColumn): vscode.Tab | undefined {
    const tabs = this.getTabsInViewColumn(viewColumn);
    return tabs.at(-1);
  }

  private getTabsInViewColumn(viewColumn: vscode.ViewColumn): readonly vscode.Tab[] {
    return vscode.window.tabGroups.all.find((group) => group.viewColumn === viewColumn)?.tabs ?? [];
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
}

function getRenderKey(sessionRecord: BrowserSessionRecord): string {
  return [sessionRecord.alias, sessionRecord.browser.url].join("|");
}

function getBrowserTabUrl(tab: vscode.Tab): string | undefined {
  const input = tab.input;
  if (input instanceof vscode.TabInputText) {
    return input.uri.toString(true);
  }

  if (input instanceof vscode.TabInputCustom) {
    return input.uri.toString(true);
  }

  return undefined;
}

function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return vscode.Uri.parse(url).toString(true);
  } catch {
    return url;
  }
}
