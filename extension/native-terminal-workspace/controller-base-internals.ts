import * as path from "node:path";
import * as vscode from "vscode";
import {
  isBrowserSession,
  isT3Session,
  type ExtensionToSidebarMessage,
  type SessionGridSnapshot,
  type SessionGroupRecord,
  type SessionRecord,
  type SidebarHydrateMessage,
  type SidebarSessionStateMessage,
  type SidebarToExtensionMessage,
} from "../../shared/session-grid-contract";
import type { ExtensionToNativeTerminalDebugMessage } from "../../shared/native-terminal-debug-contract";
import { getSidebarAgentIconById, type SidebarAgentIcon } from "../../shared/sidebar-agents";
import type { TerminalAgentStatus } from "../../shared/terminal-host-protocol";
import { BrowserSessionManager } from "../browser-session-manager";
import { NativeTerminalDebugPanel } from "../native-terminal-debug-panel";
import { NativeTerminalWorkspaceBackend } from "../native-terminal-workspace-backend";
import { createPreviousSessionEntry } from "../native-terminal-workspace-sidebar-state";
import {
  PreviousSessionHistory,
  type PreviousSessionHistoryEntry,
} from "../previous-session-history";
import { SessionGridStore } from "../session-grid-store";
import {
  captureControllerTraceState,
  captureSnapshotTraceState,
} from "../native-terminal-workspace-trace-state";
import { captureWorkbenchState, SessionLayoutTrace } from "../session-layout-trace";
import { SessionSidebarViewProvider } from "../session-sidebar-view";
import { type TitleDerivedSessionActivity } from "../session-title-activity";
import { T3ActivityMonitor } from "../t3-activity-monitor";
import type { T3RuntimeManager } from "../t3-runtime-manager";
import { T3WebviewManager } from "../t3-webview-manager";
import type { TerminalWorkspaceBackend } from "../terminal-workspace-backend";
import {
  getDefaultShell,
  getDefaultWorkspaceCwd,
  getWorkspaceId,
  getWorkspaceStorageKey,
} from "../terminal-workspace-helpers";
import { getEffectiveSessionActivity } from "./activity";
import { syncKnownSessionActivities } from "./activity";
import { handleBackendSessionsChanged, handleT3ActivityChanged, syncSessionTitle } from "./events";
import {
  COMMAND_TERMINAL_EXIT_POLL_MS,
  COMPLETION_BELL_ENABLED_KEY,
  DISABLE_VS_MUX_MODE_KEY,
  NATIVE_TERMINAL_DEBUG_STATE_KEY,
  SCRATCH_PAD_CONTENT_KEY,
  getAgentsConfigurationKey,
  getBackgroundSessionTimeoutConfigurationKey,
  getCompletionSoundConfigurationKey,
  getDebuggingMode,
  getDebuggingModeConfigurationKey,
  getKeepSessionGroupsUnlockedConfigurationKey,
  getMatchVisibleTerminalOrderConfigurationKey,
  getNativeTerminalActionDelayConfigurationKey,
  getShowCloseButtonOnSessionCardsConfigurationKey,
  getShowHotkeysOnSessionCardsConfigurationKey,
  getSidebarThemeConfigurationKey,
} from "./settings";

const SHORTCUT_LABEL_PLATFORM = process.platform === "darwin" ? "mac" : "default";
const SESSION_LAYOUT_TRACE_FILE_NAME = "session-layout.log";

type NativeTerminalWorkspaceBackendKind = "native";

export type NativeTerminalWorkspaceDebugState = {
  backend: NativeTerminalWorkspaceBackendKind;
  platform: NodeJS.Platform;
  terminalUiPath: string;
};

export abstract class NativeTerminalWorkspaceControllerBaseInternals implements vscode.Disposable {
  protected hasApprovedUntrustedShells = vscode.workspace.isTrusted;
  protected readonly backend: TerminalWorkspaceBackend;
  protected backendInitialized = false;
  protected readonly backendKind: NativeTerminalWorkspaceBackendKind = "native";
  protected readonly disposables: vscode.Disposable[] = [];
  protected debugStatePollTimer: NodeJS.Timeout | undefined;
  protected readonly lastKnownActivityBySessionId = new Map<string, TerminalAgentStatus>();
  protected projectionActionQueue: Promise<unknown> = Promise.resolve();
  protected projectionActionDepth = 0;
  protected ownsNativeTerminalControl = false;
  protected readonly sessionAgentLaunchBySessionId = new Map<
    string,
    import("../native-terminal-workspace-session-agent-launch").StoredSessionAgentLaunch
  >();
  protected readonly sidebarAgentIconBySessionId = new Map<string, SidebarAgentIcon>();
  protected sidebarWelcomeHandled = false;
  protected readonly debugPanel: NativeTerminalDebugPanel;
  protected readonly previousSessionHistory: PreviousSessionHistory;
  protected readonly startupProjectionRecoveryTimeouts = new Set<NodeJS.Timeout>();
  protected readonly startupSidebarRefreshTimeouts = new Set<NodeJS.Timeout>();
  protected readonly store: SessionGridStore;
  protected t3Runtime: T3RuntimeManager | undefined;
  protected t3RuntimeLoad: Promise<T3RuntimeManager | undefined> | undefined;
  protected readonly t3ActivityMonitor: T3ActivityMonitor;
  protected readonly browserSessions: BrowserSessionManager;
  protected readonly layoutTrace = new SessionLayoutTrace(SESSION_LAYOUT_TRACE_FILE_NAME);
  protected readonly t3Webviews: T3WebviewManager;
  protected readonly terminalTitleBySessionId = new Map<string, string>();
  protected readonly titleDerivedActivityBySessionId = new Map<
    string,
    TitleDerivedSessionActivity
  >();
  protected readonly shortcutLabelPlatform = SHORTCUT_LABEL_PLATFORM;
  public readonly sidebarProvider: SessionSidebarViewProvider;
  protected readonly workspaceId: string;

  public constructor(protected readonly context: vscode.ExtensionContext) {
    this.store = new SessionGridStore(context);
    this.previousSessionHistory = new PreviousSessionHistory(context);
    this.workspaceId = getWorkspaceId();
    this.loadSessionAgentCommands();
    this.backend = new NativeTerminalWorkspaceBackend({
      context,
      ensureShellSpawnAllowed: () => this.ensureShellSpawnAllowed(),
      workspaceId: this.workspaceId,
    });
    this.debugPanel = new NativeTerminalDebugPanel(context, {
      onClear: async () => {
        await this.layoutTrace.reset();
        await this.backend.clearDebugArtifacts();
        await this.t3Webviews.resetDebugTrace();
        await this.browserSessions.resetDebugTrace();
        await this.refreshDebugInspector();
      },
    });
    this.t3ActivityMonitor = new T3ActivityMonitor({
      getWebSocketUrl: () => this.t3Runtime?.getWebSocketUrl() ?? "ws://127.0.0.1:3773",
    });
    this.t3Webviews = new T3WebviewManager({
      context,
      onDidFocusSession: async (sessionId) => {
        const sessionRecord = this.store.getSession(sessionId);
        if (!sessionRecord || !isT3Session(sessionRecord)) {
          return;
        }
        await this.logControllerEvent("EVENT", "t3-focus-observed", { sessionId });
      },
    });
    this.browserSessions = new BrowserSessionManager({
      onDidChangeSessions: async () => {
        await this.logControllerEvent("EVENT", "browser-session-change");
        await this.refreshSidebar();
      },
      onDidFocusSession: async (sessionId) => {
        const sessionRecord = this.store.getSession(sessionId);
        if (!sessionRecord || !isBrowserSession(sessionRecord)) {
          return;
        }
        await this.logControllerEvent("EVENT", "browser-focus-observed", { sessionId });
      },
    });
    this.sidebarProvider = new SessionSidebarViewProvider({
      onDidResolveView: async () => {
        await this.maybeShowSidebarWelcome();
      },
      onMessage: async (message) => this.handleSidebarMessage(message),
    });

    this.disposables.push(
      this.backend,
      this.browserSessions,
      this.debugPanel,
      this.t3ActivityMonitor,
      this.sidebarProvider,
      this.t3Webviews,
      this.t3ActivityMonitor.onDidChange(() => {
        void this.logControllerEvent("EVENT", "t3-activity-changed");
        void handleT3ActivityChanged(this.createSessionEventContext());
      }),
      this.backend.onDidActivateSession((sessionId) => {
        void this.logControllerEvent("EVENT", "terminal-activated-observed", { sessionId });
      }),
      this.backend.onDidChangeSessions(() => {
        void this.logControllerEvent("EVENT", "backend-sessions-changed");
        void handleBackendSessionsChanged(this.createSessionEventContext());
      }),
      this.backend.onDidChangeDebugState(() => {
        void this.refreshDebugInspector();
      }),
      this.backend.onDidChangeSessionTitle(({ sessionId, title }) => {
        void this.logControllerEvent("EVENT", "backend-session-title-changed", {
          sessionId,
          title,
        });
        void syncSessionTitle(this.createSessionEventContext(), sessionId, title);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration(getBackgroundSessionTimeoutConfigurationKey()) ||
          event.affectsConfiguration(getMatchVisibleTerminalOrderConfigurationKey()) ||
          event.affectsConfiguration(getNativeTerminalActionDelayConfigurationKey()) ||
          event.affectsConfiguration(getKeepSessionGroupsUnlockedConfigurationKey())
        ) {
          void this.backend.syncConfiguration();
        }

        if (
          event.affectsConfiguration(getSidebarThemeConfigurationKey()) ||
          event.affectsConfiguration(getCompletionSoundConfigurationKey()) ||
          event.affectsConfiguration(getAgentsConfigurationKey()) ||
          event.affectsConfiguration(getShowCloseButtonOnSessionCardsConfigurationKey()) ||
          event.affectsConfiguration(getShowHotkeysOnSessionCardsConfigurationKey()) ||
          event.affectsConfiguration(getDebuggingModeConfigurationKey())
        ) {
          void this.refreshSidebar("hydrate");
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        void this.refreshSidebar("hydrate");
      }),
    );
  }

  public async initialize(): Promise<void> {
    await this.layoutTrace.reset();
    await this.t3Webviews.resetDebugTrace();
    await this.browserSessions.resetDebugTrace();
    await this.runLoggedAction("initialize", undefined, async (operation) => {
      await this.migrateCompletionBellPreference();
      await operation.step("after-migrate-completion-bell");
      await this.ensureNativeTerminalControl();
      await operation.step("after-ensure-native-terminal-control");
      await this.enforceSingleBrowserSession();
      await operation.step("after-enforce-single-browser-session");
      await this.ensureT3RuntimeForStoredSessions(this.getAllSessionRecords());
      await operation.step("after-ensure-t3-runtime");
      await this.syncT3RuntimeLease();
      this.t3Webviews.syncSessions(this.getAllSessionRecords());
      this.browserSessions.syncSessions(this.getAllSessionRecords());
      await operation.step("after-sync-external-session-managers", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions(true);
      await operation.step("after-reconcile");
      await this.refreshSidebar("hydrate");
      await operation.step("after-refresh-sidebar");
    });
  }

  public getDebuggingState(): NativeTerminalWorkspaceDebugState {
    return {
      backend: this.backendKind,
      platform: process.platform,
      terminalUiPath: "VS Code native shell terminals",
    };
  }

  public dispose(): void {
    this.stopDebugStatePolling();
    this.clearStartupProjectionRecovery();
    this.clearStartupSidebarRefreshes();
    void this.releaseNativeTerminalControl();
    this.t3Runtime?.dispose();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  protected abstract enforceSingleBrowserSession(): Promise<void>;
  protected abstract createSidebarMessage(
    type?: SidebarHydrateMessage["type"] | SidebarSessionStateMessage["type"],
  ): ExtensionToSidebarMessage;
  protected abstract handleSidebarMessage(message: SidebarToExtensionMessage): Promise<void>;
  protected abstract refreshSidebar(
    type?: SidebarHydrateMessage["type"] | SidebarSessionStateMessage["type"],
  ): Promise<void>;
  protected abstract clearStartupSidebarRefreshes(): void;
  protected abstract refreshDebugInspector(): Promise<void>;
  protected abstract maybeShowSidebarWelcome(): Promise<void>;
  protected abstract stopDebugStatePolling(): void;
  protected abstract createSessionActivityContext(): Parameters<
    typeof syncKnownSessionActivities
  >[0];
  protected abstract createSessionEventContext(): Parameters<
    typeof handleBackendSessionsChanged
  >[0];
  protected abstract ensureT3RuntimeForStoredSessions(
    sessionRecords: readonly SessionRecord[],
  ): Promise<void>;
  protected abstract syncT3RuntimeLease(): Promise<void>;
  protected abstract reconcileProjectedSessions(preserveFocus?: boolean): Promise<void>;
  protected abstract getT3ActivityState(sessionRecord: SessionRecord): {
    activity: TerminalAgentStatus;
    isRunning: boolean;
  };
  protected abstract loadSessionAgentCommands(): void;
  protected abstract captureTraceState(): {
    activeSnapshot: ReturnType<typeof captureSnapshotTraceState>;
    backend: ReturnType<TerminalWorkspaceBackend["getDebugState"]>;
    browser: ReturnType<BrowserSessionManager["getDebugState"]>;
    ownsNativeTerminalControl: boolean;
    sidebar: {
      groups: import("../../shared/session-grid-contract").SidebarSessionGroup[];
      hud: SidebarHydrateMessage["hud"];
    };
    store: ReturnType<typeof captureControllerTraceState>["store"];
    t3: ReturnType<T3WebviewManager["getDebugState"]>;
    workbench: ReturnType<typeof captureWorkbenchState>;
    workspaceId: string;
  };
  protected abstract captureSnapshotTraceState(
    snapshot: SessionGridSnapshot,
  ): ReturnType<typeof captureSnapshotTraceState>;
  protected abstract getActiveSnapshot(): SessionGridSnapshot;
  protected abstract getAllSessionRecords(): SessionRecord[];

  protected async ensureNativeTerminalControl(): Promise<boolean> {
    this.ownsNativeTerminalControl = true;
    if (!this.backendInitialized) {
      await this.backend.syncConfiguration();
      await this.backend.initialize(this.getAllSessionRecords());
      this.backendInitialized = true;
    }
    return true;
  }

  protected async releaseNativeTerminalControl(): Promise<void> {
    this.ownsNativeTerminalControl = false;
  }

  protected getNativeTerminalDebugStateStorageKey(): string {
    return getWorkspaceStorageKey(NATIVE_TERMINAL_DEBUG_STATE_KEY, this.workspaceId);
  }

  protected async publishSharedDebugInspectorMessage(
    message: ExtensionToNativeTerminalDebugMessage,
  ): Promise<void> {
    await this.context.globalState.update(this.getNativeTerminalDebugStateStorageKey(), message);
  }

  protected getSharedDebugInspectorMessage(): ExtensionToNativeTerminalDebugMessage | undefined {
    return this.context.globalState.get<ExtensionToNativeTerminalDebugMessage | undefined>(
      this.getNativeTerminalDebugStateStorageKey(),
    );
  }

  protected clearStartupProjectionRecovery(): void {
    for (const timeout of this.startupProjectionRecoveryTimeouts) {
      clearTimeout(timeout);
    }

    this.startupProjectionRecoveryTimeouts.clear();
  }

  protected createPreviousSessionEntry(
    group: SessionGroupRecord,
    sessionRecord: SessionRecord,
  ): PreviousSessionHistoryEntry | undefined {
    const sessionActivityContext = this.createSessionActivityContext();
    return createPreviousSessionEntry({
      browserHasLiveProjection: (sessionId) => this.browserSessions.hasLiveTab(sessionId),
      debuggingMode: getDebuggingMode(),
      getEffectiveSessionActivity: (session, snapshot) =>
        getEffectiveSessionActivity(sessionActivityContext, session, snapshot),
      getSessionAgentLaunch: (sessionId) => this.sessionAgentLaunchBySessionId.get(sessionId),
      getSessionSnapshot: (sessionId) => this.backend.getSessionSnapshot(sessionId),
      getSidebarAgentIcon: (sessionId, snapshotAgentName, derivedAgentName) =>
        this.sidebarAgentIconBySessionId.get(sessionId) ??
        getSidebarAgentIconById(snapshotAgentName) ??
        getSidebarAgentIconById(derivedAgentName),
      getT3ActivityState: (session) => this.getT3ActivityState(session),
      getTerminalTitle: (sessionId) => this.terminalTitleBySessionId.get(sessionId),
      group,
      ownsNativeTerminalControl: this.ownsNativeTerminalControl,
      platform: SHORTCUT_LABEL_PLATFORM,
      sessionRecord,
      terminalHasLiveProjection: (sessionId) => this.backend.hasLiveTerminal(sessionId),
      workspaceId: this.workspaceId,
    });
  }

  protected async ensureShellSpawnAllowed(): Promise<boolean> {
    if (vscode.workspace.isTrusted || this.hasApprovedUntrustedShells) {
      this.hasApprovedUntrustedShells = true;
      return true;
    }

    const approval = await vscode.window.showWarningMessage(
      "VSmux is about to start a shell in an untrusted workspace.",
      {
        detail:
          "Shell sessions can run commands against files in this workspace. Trust the workspace or explicitly allow shell access to continue.",
        modal: true,
      },
      "Allow Shell Access",
    );

    if (!approval) {
      return false;
    }

    this.hasApprovedUntrustedShells = true;
    return true;
  }

  protected isAlreadyActiveSession(sessionId: string): boolean {
    return this.getActiveSnapshot().focusedSessionId === sessionId;
  }

  protected async writePendingRenameCommand(sessionId: string, alias: string): Promise<void> {
    await this.backend.writeText(sessionId, `/rename ${alias}`, false);
  }

  protected getCompletionBellEnabled(): boolean {
    return (
      this.context.globalState.get<boolean>(
        this.getCompletionBellEnabledStorageKey(),
        this.context.workspaceState.get<boolean>(COMPLETION_BELL_ENABLED_KEY, false) ?? false,
      ) ?? false
    );
  }

  protected getCompletionBellEnabledStorageKey(): string {
    return getWorkspaceStorageKey(COMPLETION_BELL_ENABLED_KEY, this.workspaceId);
  }

  protected async migrateCompletionBellPreference(): Promise<void> {
    const globalStorageKey = this.getCompletionBellEnabledStorageKey();
    if (this.context.globalState.get<boolean>(globalStorageKey) !== undefined) {
      return;
    }

    const legacyPreference = this.context.workspaceState.get<boolean>(COMPLETION_BELL_ENABLED_KEY);
    if (legacyPreference === undefined) {
      return;
    }

    await this.context.globalState.update(globalStorageKey, legacyPreference);
  }

  protected async runLoggedAction<T>(
    action: string,
    payload: unknown,
    execute: (
      operation: import("../session-layout-trace").SessionLayoutTraceOperation,
    ) => Promise<T>,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      this.projectionActionDepth += 1;
      try {
        return await this.layoutTrace.runOperation(action, {
          captureState: () => this.captureTraceState(),
          execute,
          payload,
        });
      } finally {
        this.projectionActionDepth = Math.max(0, this.projectionActionDepth - 1);
      }
    };
    if (this.projectionActionDepth > 0) {
      return run();
    }
    const previous = this.projectionActionQueue;
    const next = previous.then(run, run);
    this.projectionActionQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  protected async logControllerEvent(
    tag: string,
    message: string,
    details?: unknown,
  ): Promise<void> {
    if (!this.layoutTrace.isEnabled()) {
      return;
    }

    await this.layoutTrace.log(tag, message, {
      details,
      state: this.captureTraceState(),
    });
  }

  protected isVsMuxDisabled(): boolean {
    return this.context.workspaceState.get<boolean>(this.getDisableVsMuxStorageKey(), false);
  }

  protected getScratchPadContent(): string {
    const storedContent = this.context.workspaceState.get<string>(
      this.getScratchPadStorageKey(),
      "",
    );
    return typeof storedContent === "string" ? storedContent : "";
  }

  protected async toggleVsMuxDisabled(): Promise<void> {
    await this.runLoggedAction("toggleVsMuxDisabled", undefined, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const nextValue = !this.isVsMuxDisabled();
      await this.context.workspaceState.update(this.getDisableVsMuxStorageKey(), nextValue);
      await operation.step("after-store-toggle", { nextValue });
      if (nextValue) {
        await this.applyDisabledVsMuxMode();
        await operation.step("after-apply-disabled-mode");
      } else {
        await this.reconcileProjectedSessions();
        await operation.step("after-reconcile");
      }
      await this.refreshSidebar("hydrate");
      await operation.step("after-refresh-sidebar");
    });
  }

  protected async applyDisabledVsMuxMode(): Promise<void> {
    this.t3Webviews.disposeAllSessions();
  }

  protected getDisableVsMuxStorageKey(): string {
    return getWorkspaceStorageKey(DISABLE_VS_MUX_MODE_KEY, this.workspaceId);
  }

  protected getScratchPadStorageKey(): string {
    return getWorkspaceStorageKey(SCRATCH_PAD_CONTENT_KEY, this.workspaceId);
  }

  protected createSidebarCommandTerminal(
    name: string,
    command?: string,
    closeOnExit = false,
  ): vscode.Terminal {
    if (closeOnExit && command) {
      const shellPath = getDefaultShell();
      return vscode.window.createTerminal({
        cwd: getDefaultWorkspaceCwd(),
        iconPath: new vscode.ThemeIcon("terminal"),
        isTransient: true,
        location: vscode.TerminalLocation.Panel,
        name: `VSmux: ${name}`,
        shellArgs: getCommandTerminalShellArgs(shellPath, command),
        shellPath,
      });
    }

    return vscode.window.createTerminal({
      cwd: getDefaultWorkspaceCwd(),
      iconPath: new vscode.ThemeIcon("terminal"),
      isTransient: true,
      location: vscode.TerminalLocation.Panel,
      name: `VSmux: ${name}`,
    });
  }

  protected disposeTerminalWhenProcessExits(terminal: vscode.Terminal): void {
    const interval = setInterval(() => {
      if (!terminal.exitStatus) {
        return;
      }

      clearInterval(interval);
      terminal.dispose();
    }, COMMAND_TERMINAL_EXIT_POLL_MS);
  }
}

function getCommandTerminalShellArgs(shellPath: string, command: string): string[] {
  const shellName = path.basename(shellPath).toLowerCase();

  if (process.platform === "win32") {
    if (shellName === "cmd.exe" || shellName === "cmd") {
      return ["/d", "/c", command];
    }

    return ["-NoLogo", "-NoProfile", "-Command", command];
  }

  return ["-l", "-c", command];
}
