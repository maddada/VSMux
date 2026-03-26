import * as path from "node:path";
import * as vscode from "vscode";
import type {
  NativeTerminalBackendDebugState,
  NativeTerminalLayoutDebugState,
  NativeTerminalDebugProjection,
} from "../shared/native-terminal-debug-contract";
import {
  getTerminalSessionSurfaceTitle,
  isTerminalSession,
  type SessionRecord,
  type TerminalSessionRecord,
} from "../shared/session-grid-contract";
import type {
  TerminalAgentStatus,
  TerminalSessionSnapshot,
} from "../shared/terminal-host-protocol";
import { ensureAgentShellIntegration, type AgentShellIntegration } from "./agent-shell-integration";
import {
  createManagedTerminalEnvironment,
  getManagedTerminalIdentity,
} from "./native-managed-terminal";
import { readManagedTerminalIdentityFromProcessId } from "./native-terminal-process-identity";
import type {
  TerminalWorkspaceBackend,
  TerminalWorkspaceBackendTitleChange,
} from "./terminal-workspace-backend";
import {
  createDisconnectedSessionSnapshot,
  getDefaultShell,
  getDefaultWorkspaceCwd,
  getWorkspaceStorageKey,
} from "./terminal-workspace-helpers";
import {
  focusEditorGroupByIndex,
  getActiveEditorGroupViewColumn,
  moveActiveEditorToGroup,
} from "./terminal-workspace-environment";
import {
  findTerminalGroupIndex as findTerminalGroupIndexByTitle,
  getActivePanelTerminalTabLabel,
  getActiveTerminalTabLocation,
  getTerminalDisplayName,
  isTerminalTabActive as isTerminalTabActiveByTitle,
  isTerminalTabForeground as isTerminalTabForegroundByTitle,
  resolveTerminalRestoreTarget,
  waitForActiveTerminal as waitForActiveTerminalInstance,
} from "./native-terminal-workspace-backend/workbench";
import { createWorkspaceTrace } from "./runtime-trace";
import {
  readPersistedSessionStateFromFile,
  updatePersistedSessionStateFile,
} from "./session-state-file";

const AGENT_STATE_DIR_NAME = "terminal-session-state";
const POLL_INTERVAL_MS = 500;
const PROCESS_ID_ASSOCIATIONS_KEY = "nativeTerminalProcessIdBySession";
const TERMINAL_RENAME_COMMAND = "workbench.action.terminal.renameWithArg";
const TRACE_FILE_NAME = "native-terminal-reconcile.log";

type NativeTerminalWorkspaceBackendOptions = {
  context: vscode.ExtensionContext;
  ensureShellSpawnAllowed: () => Promise<boolean>;
  workspaceId: string;
};

type SessionProjection = {
  sessionId: string;
  terminal: vscode.Terminal;
};

export class NativeTerminalWorkspaceBackend implements TerminalWorkspaceBackend {
  private agentShellIntegration: AgentShellIntegration | undefined;
  private readonly activateSessionEmitter = new vscode.EventEmitter<string>();
  private readonly changeDebugStateEmitter = new vscode.EventEmitter<void>();
  private readonly changeSessionsEmitter = new vscode.EventEmitter<void>();
  private readonly changeSessionTitleEmitter =
    new vscode.EventEmitter<TerminalWorkspaceBackendTitleChange>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly lastTerminalActivityAtBySessionId = new Map<string, number>();
  private pollTimer: NodeJS.Timeout | undefined;
  private readonly projections = new Map<string, SessionProjection>();
  private readonly sessionIdByProcessId = new Map<number, string>();
  private readonly sessionRecordBySessionId = new Map<string, TerminalSessionRecord>();
  private readonly sessionTitleBySessionId = new Map<string, string>();
  private readonly sessions = new Map<string, TerminalSessionSnapshot>();
  private readonly terminalToSessionId = new Map<vscode.Terminal, string>();
  private readonly trace = createWorkspaceTrace(TRACE_FILE_NAME);

  public readonly onDidActivateSession = this.activateSessionEmitter.event;
  public readonly onDidChangeDebugState = this.changeDebugStateEmitter.event;
  public readonly onDidChangeSessions = this.changeSessionsEmitter.event;
  public readonly onDidChangeSessionTitle = this.changeSessionTitleEmitter.event;

  public constructor(private readonly options: NativeTerminalWorkspaceBackendOptions) {}

  public async initialize(sessionRecords: readonly SessionRecord[]): Promise<void> {
    this.agentShellIntegration = await ensureAgentShellIntegration(
      path.join(this.options.context.globalStorageUri.fsPath, "terminal-host-daemon"),
    );
    this.loadStoredProcessAssociations();
    this.syncSessions(sessionRecords);
    await this.trace.reset();

    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        void this.logState("EVENT", "terminal-opened", {
          terminalName: terminal.name,
        });
        void this.attachManagedTerminal(terminal);
      }),
      vscode.window.onDidCloseTerminal((terminal) => {
        const sessionId = this.terminalToSessionId.get(terminal);
        if (!sessionId) {
          return;
        }

        void this.logState("EVENT", "terminal-closed", {
          exitCode: terminal.exitStatus?.code,
          sessionId,
          terminalName: terminal.name,
        });
        this.terminalToSessionId.delete(terminal);
        this.projections.delete(sessionId);
        this.sessions.set(sessionId, {
          ...(this.sessions.get(sessionId) ??
            createDisconnectedSessionSnapshot(sessionId, this.options.workspaceId)),
          agentStatus: "idle",
          endedAt: new Date().toISOString(),
          exitCode: terminal.exitStatus?.code ?? 0,
          restoreState: "live",
          status: terminal.exitStatus ? "exited" : "disconnected",
        });
        this.changeSessionsEmitter.fire();
        this.changeDebugStateEmitter.fire();
      }),
      vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (!terminal) {
          return;
        }

        const sessionId = this.terminalToSessionId.get(terminal);
        if (!sessionId) {
          return;
        }

        void this.logState("EVENT", "active-terminal-changed", {
          sessionId,
          terminalName: terminal.name,
        });
        this.activateSessionEmitter.fire(sessionId);
      }),
      vscode.window.onDidChangeTerminalState((terminal) => {
        void this.attachManagedTerminal(terminal);
        const sessionId = this.terminalToSessionId.get(terminal);
        if (!sessionId) {
          return;
        }

        this.lastTerminalActivityAtBySessionId.set(sessionId, Date.now());
        void this.captureProcessAssociation(sessionId, terminal);
        void this.logState("EVENT", "terminal-state-changed", {
          sessionId,
          terminalName: terminal.name,
        });
        this.changeDebugStateEmitter.fire();
      }),
    );

    for (const terminal of vscode.window.terminals) {
      await this.attachManagedTerminal(terminal);
    }

    await this.refreshSessionSnapshots();
    this.pollTimer = setInterval(() => {
      void this.refreshSessionSnapshots();
    }, POLL_INTERVAL_MS);
  }

  public async syncConfiguration(): Promise<void> {}

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.activateSessionEmitter.dispose();
    this.changeDebugStateEmitter.dispose();
    this.changeSessionsEmitter.dispose();
    this.changeSessionTitleEmitter.dispose();
  }

  public async clearDebugArtifacts(): Promise<void> {
    await this.trace.reset();
  }

  public getTraceState(): {
    layout: NativeTerminalLayoutDebugState;
    sessions: Array<{
      agentStatus: TerminalAgentStatus;
      sessionId: string;
      status: TerminalSessionSnapshot["status"];
      terminalName?: string;
    }>;
  } {
    return {
      layout: this.captureLayoutState(),
      sessions: [...this.sessions.entries()].map(([sessionId, snapshot]) => ({
        agentStatus: snapshot.agentStatus,
        sessionId,
        status: snapshot.status,
        terminalName:
          this.projections.get(sessionId)?.terminal.name ??
          this.projections.get(sessionId)?.terminal.creationOptions.name,
      })),
    };
  }

  public getDebugState(): NativeTerminalBackendDebugState {
    return {
      currentMoveAction: undefined,
      lastVisibleSnapshot: undefined,
      layout: this.captureLayoutState(),
      matchVisibleTerminalOrder: false,
      moveHistory: [],
      nativeTerminalActionDelayMs: 0,
      observedAt: new Date().toISOString(),
      workspaceId: this.options.workspaceId,
    };
  }

  public getLastTerminalActivityAt(sessionId: string): number | undefined {
    return this.lastTerminalActivityAtBySessionId.get(sessionId);
  }

  public hasLiveTerminal(sessionId: string): boolean {
    const projection = this.projections.get(sessionId);
    return Boolean(
      projection &&
      !projection.terminal.exitStatus &&
      vscode.window.terminals.includes(projection.terminal),
    );
  }

  public async acknowledgeAttention(sessionId: string): Promise<boolean> {
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot || snapshot.agentStatus !== "attention") {
      return false;
    }

    const persistedState = await updatePersistedSessionStateFile(
      this.getSessionAgentStateFilePath(sessionId),
      (currentState) => {
        if (currentState.agentStatus !== "attention") {
          return currentState;
        }

        return {
          ...currentState,
          agentName: snapshot.agentName ?? currentState.agentName,
          agentStatus: "idle",
        };
      },
    ).catch(() => undefined);

    const nextSnapshot = {
      ...snapshot,
      agentName: persistedState?.agentName ?? snapshot.agentName,
      agentStatus: persistedState?.agentStatus ?? "idle",
    } satisfies TerminalSessionSnapshot;
    this.sessions.set(sessionId, nextSnapshot);

    if (!haveSameTerminalSessionSnapshot(snapshot, nextSnapshot)) {
      this.changeSessionsEmitter.fire();
    }

    return nextSnapshot.agentStatus === "idle";
  }

  public async createOrAttachSession(
    sessionRecord: SessionRecord,
  ): Promise<TerminalSessionSnapshot> {
    if (!isTerminalSession(sessionRecord)) {
      return (
        this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId)
      );
    }

    this.upsertSession(sessionRecord);
    await this.logState("SESSION", "create-or-attach", {
      sessionId: sessionRecord.sessionId,
      title: sessionRecord.title,
    });
    const projection = await this.ensureTerminal(sessionRecord);
    await this.syncTerminalName(projection.terminal, sessionRecord.sessionId);
    await this.refreshSessionSnapshot(sessionRecord.sessionId);
    return this.sessions.get(sessionRecord.sessionId)!;
  }

  public async focusSession(sessionId: string, preserveFocus = false): Promise<boolean> {
    const projection = this.projections.get(sessionId);
    if (!projection) {
      await this.logState("FOCUS", "missing-session", { preserveFocus, sessionId });
      return false;
    }

    if (this.isTerminalTabActive(sessionId, projection.terminal)) {
      await this.logState("FOCUS", "terminal-noop", { preserveFocus, sessionId });
      return true;
    }

    projection.terminal.show(preserveFocus);
    await this.logState("FOCUS", "terminal", { preserveFocus, sessionId });
    return true;
  }

  public async revealSessionInGroup(
    sessionRecord: SessionRecord,
    targetGroupIndex: number,
    preserveFocus = false,
  ): Promise<boolean> {
    if (!isTerminalSession(sessionRecord)) {
      return false;
    }

    const restoreViewColumn = preserveFocus ? getActiveEditorGroupViewColumn() : undefined;
    const projection = await this.ensureTerminalInGroup(sessionRecord, targetGroupIndex);
    const isTerminalActive = this.isTerminalTabActive(sessionRecord.sessionId, projection.terminal);
    if (!preserveFocus || !isTerminalActive) {
      projection.terminal.show(preserveFocus);
    }

    if (preserveFocus && restoreViewColumn && restoreViewColumn !== targetGroupIndex + 1) {
      await focusEditorGroupByIndex(restoreViewColumn - 1);
    }

    await this.logState("FOCUS", "terminal-group", {
      preserveFocus,
      sessionId: sessionRecord.sessionId,
      targetGroupIndex,
    });
    return true;
  }

  public getObservedGroupIndex(sessionId: string): number | undefined {
    return this.findTerminalGroupIndex(sessionId);
  }

  public isSessionForegroundVisible(sessionId: string): boolean {
    const groupIndex = this.findTerminalGroupIndex(sessionId);
    return groupIndex !== undefined && this.isTerminalTabForeground(sessionId, groupIndex);
  }

  public async parkAllEditorTerminalsToPanel(): Promise<void> {
    const terminals = [...vscode.window.terminals];
    const panelTerminalTabLabel = getActivePanelTerminalTabLabel();
    const activeTerminalBefore = vscode.window.activeTerminal;

    await this.logState("MOVE", "park-editor-terminals-start", {
      activeTerminalName: activeTerminalBefore
        ? getTerminalDisplayName(activeTerminalBefore) ?? activeTerminalBefore.name
        : undefined,
      panelTerminalTabLabel,
      terminalNames: terminals.map((terminal) => getTerminalDisplayName(terminal) ?? terminal.name),
    });

    for (const terminal of terminals) {
      const isActive = await this.activateTerminalForWorkbenchCommand(terminal);
      if (!isActive) {
        await this.logState("MOVE", "park-editor-terminal-skip-inactive", {
          terminalName: getTerminalDisplayName(terminal) ?? terminal.name,
        });
        continue;
      }

      if (getActiveTerminalTabLocation() !== "editor") {
        continue;
      }

      await vscode.commands.executeCommand("workbench.action.terminal.moveToTerminalPanel");
      await this.logState("MOVE", "park-editor-terminal", {
        terminalName: getTerminalDisplayName(terminal) ?? terminal.name,
      });
    }

    const restoreTarget = resolveTerminalRestoreTarget(
      vscode.window.terminals,
      activeTerminalBefore,
      panelTerminalTabLabel,
    );
    if (!restoreTarget) {
      return;
    }

    restoreTarget.show(true);
    await this.logState("FOCUS", "restore-panel-terminal", {
      terminalName: getTerminalDisplayName(restoreTarget) ?? restoreTarget.name,
    });
  }

  public getSessionSnapshot(sessionId: string): TerminalSessionSnapshot | undefined {
    return this.sessions.get(sessionId);
  }

  public async killSession(sessionId: string): Promise<void> {
    const projection = this.projections.get(sessionId);
    if (!projection) {
      return;
    }

    await this.logState("SESSION", "kill", { sessionId });
    projection.terminal.dispose();
    this.projections.delete(sessionId);
  }

  public async renameSession(sessionRecord: SessionRecord): Promise<void> {
    if (!isTerminalSession(sessionRecord)) {
      return;
    }

    this.upsertSession(sessionRecord);
    const projection = this.projections.get(sessionRecord.sessionId);
    if (!projection) {
      return;
    }

    await this.syncTerminalName(projection.terminal, sessionRecord.sessionId);
  }

  public async syncRunningTerminalTitles(): Promise<void> {
    for (const terminal of vscode.window.terminals) {
      if (terminal.exitStatus) {
        continue;
      }

      await this.attachManagedTerminal(terminal);
    }
  }

  public async restartSession(sessionRecord: SessionRecord): Promise<TerminalSessionSnapshot> {
    if (!isTerminalSession(sessionRecord)) {
      return (
        this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId)
      );
    }

    await this.killSession(sessionRecord.sessionId);
    return this.createOrAttachSession(sessionRecord);
  }

  public async writeText(sessionId: string, data: string, shouldExecute = true): Promise<void> {
    const projection = this.projections.get(sessionId);
    if (!projection) {
      return;
    }

    projection.terminal.sendText(data, shouldExecute);
    this.lastTerminalActivityAtBySessionId.set(sessionId, Date.now());
  }

  public syncSessions(sessionRecords: readonly SessionRecord[]): void {
    const nextSessionRecords = sessionRecords.filter(isTerminalSession);
    const nextSessionIdSet = new Set(
      nextSessionRecords.map((sessionRecord) => sessionRecord.sessionId),
    );

    for (const sessionRecord of nextSessionRecords) {
      this.upsertSession(sessionRecord);
    }

    for (const sessionId of this.sessionRecordBySessionId.keys()) {
      if (nextSessionIdSet.has(sessionId)) {
        continue;
      }

      this.sessionRecordBySessionId.delete(sessionId);
      this.sessionTitleBySessionId.delete(sessionId);
    }
  }

  private upsertSession(sessionRecord: TerminalSessionRecord): void {
    this.sessionRecordBySessionId.set(sessionRecord.sessionId, sessionRecord);
    this.sessions.set(
      sessionRecord.sessionId,
      this.sessions.get(sessionRecord.sessionId) ??
        createDisconnectedSessionSnapshot(sessionRecord.sessionId, this.options.workspaceId),
    );
  }

  private async ensureTerminal(sessionRecord: TerminalSessionRecord): Promise<SessionProjection> {
    const existingProjection = this.projections.get(sessionRecord.sessionId);
    if (existingProjection && vscode.window.terminals.includes(existingProjection.terminal)) {
      await this.logState("ENSURE", "projection-reused", {
        sessionId: sessionRecord.sessionId,
      });
      return existingProjection;
    }

    const existingTerminal = await this.findExistingTerminal(sessionRecord);
    if (existingTerminal) {
      await this.logState("ENSURE", "existing-terminal-attached", {
        sessionId: sessionRecord.sessionId,
        terminalName: existingTerminal.name,
      });
      const projection = {
        sessionId: sessionRecord.sessionId,
        terminal: existingTerminal,
      } satisfies SessionProjection;
      this.bindTerminalToSession(sessionRecord.sessionId, existingTerminal);
      await this.captureProcessAssociation(sessionRecord.sessionId, existingTerminal);
      return projection;
    }

    if (!(await this.options.ensureShellSpawnAllowed())) {
      const disconnectedSnapshot = createDisconnectedSessionSnapshot(
        sessionRecord.sessionId,
        this.options.workspaceId,
        "error",
      );
      disconnectedSnapshot.errorMessage = "Shell creation blocked in an untrusted workspace.";
      this.sessions.set(sessionRecord.sessionId, disconnectedSnapshot);
      this.changeSessionsEmitter.fire();
      throw new Error("Shell creation blocked in an untrusted workspace.");
    }

    const terminal = vscode.window.createTerminal({
      cwd: getDefaultWorkspaceCwd(),
      env: this.createTerminalEnvironment(sessionRecord.sessionId),
      iconPath: new vscode.ThemeIcon("terminal"),
      location: {
        preserveFocus: true,
        viewColumn: vscode.window.tabGroups.activeTabGroup?.viewColumn ?? vscode.ViewColumn.One,
      },
      name: this.getSessionSurfaceTitle(sessionRecord.sessionId),
      shellPath: getDefaultShell(),
    });
    const projection = {
      sessionId: sessionRecord.sessionId,
      terminal,
    } satisfies SessionProjection;
    this.bindTerminalToSession(sessionRecord.sessionId, terminal);
    await this.captureProcessAssociation(sessionRecord.sessionId, terminal);
    await this.logState("ENSURE", "terminal-created", {
      sessionId: sessionRecord.sessionId,
      terminalName: terminal.name,
    });
    return projection;
  }

  private async ensureTerminalInGroup(
    sessionRecord: TerminalSessionRecord,
    targetGroupIndex: number,
  ): Promise<SessionProjection> {
    const existingProjection = this.projections.get(sessionRecord.sessionId);
    if (!existingProjection || !vscode.window.terminals.includes(existingProjection.terminal)) {
      await focusEditorGroupByIndex(targetGroupIndex);
      return this.ensureTerminal(sessionRecord);
    }

    const currentGroupIndex = this.findTerminalGroupIndex(sessionRecord.sessionId);
    if (currentGroupIndex === undefined || currentGroupIndex !== targetGroupIndex) {
      existingProjection.terminal.show(false);
      await this.waitForActiveTerminal(existingProjection.terminal);
      await this.moveTerminalToGroup(sessionRecord.sessionId, targetGroupIndex);
    }

    return existingProjection;
  }

  private async attachManagedTerminal(terminal: vscode.Terminal): Promise<void> {
    const sessionId = await this.resolveManagedSessionId(terminal);
    if (!sessionId) {
      return;
    }

    if (this.terminalToSessionId.get(terminal) === sessionId) {
      await this.captureProcessAssociation(sessionId, terminal);
      await this.syncTerminalName(terminal, sessionId);
      return;
    }

    this.bindTerminalToSession(sessionId, terminal);
    await this.captureProcessAssociation(sessionId, terminal);
    await this.syncTerminalName(terminal, sessionId);
    await this.refreshSessionSnapshot(sessionId);
    await this.logState("ATTACH", "managed-terminal", {
      sessionId,
      terminalName: terminal.name,
    });
    this.changeSessionsEmitter.fire();
    this.changeDebugStateEmitter.fire();
  }

  private async findExistingTerminal(
    sessionRecord: TerminalSessionRecord,
  ): Promise<vscode.Terminal | undefined> {
    for (const terminal of vscode.window.terminals) {
      const resolvedSessionId = await this.resolveManagedSessionId(terminal);
      if (resolvedSessionId === sessionRecord.sessionId) {
        return terminal;
      }
    }

    return undefined;
  }

  private async resolveManagedSessionId(terminal: vscode.Terminal): Promise<string | undefined> {
    const managedIdentity = getManagedTerminalIdentity(terminal);
    if (
      managedIdentity?.workspaceId === this.options.workspaceId &&
      this.sessionRecordBySessionId.has(managedIdentity.sessionId)
    ) {
      return managedIdentity.sessionId;
    }

    const processId = await this.getTerminalProcessId(terminal);
    if (!processId) {
      return undefined;
    }

    const storedSessionId = this.sessionIdByProcessId.get(processId);
    if (storedSessionId && this.sessionRecordBySessionId.has(storedSessionId)) {
      return storedSessionId;
    }

    const processIdentity = await readManagedTerminalIdentityFromProcessId(processId);
    if (
      processIdentity?.workspaceId === this.options.workspaceId &&
      this.sessionRecordBySessionId.has(processIdentity.sessionId)
    ) {
      return processIdentity.sessionId;
    }

    const sessionRecord = this.findSessionRecordByTitle(
      terminal.name ?? terminal.creationOptions.name,
    );
    if (sessionRecord) {
      return sessionRecord.sessionId;
    }

    return undefined;
  }

  private bindTerminalToSession(sessionId: string, terminal: vscode.Terminal): void {
    const previousSessionId = this.terminalToSessionId.get(terminal);
    if (previousSessionId && previousSessionId !== sessionId) {
      const previousProjection = this.projections.get(previousSessionId);
      if (previousProjection?.terminal === terminal) {
        this.projections.delete(previousSessionId);
      }
    }

    const previousProjection = this.projections.get(sessionId);
    if (previousProjection && previousProjection.terminal !== terminal) {
      const previousTerminalSessionId = this.terminalToSessionId.get(previousProjection.terminal);
      if (previousTerminalSessionId === sessionId) {
        this.terminalToSessionId.delete(previousProjection.terminal);
      }
    }

    this.projections.set(sessionId, {
      sessionId,
      terminal,
    });
    this.terminalToSessionId.set(terminal, sessionId);
  }

  private findSessionRecordByTitle(title: string | undefined): TerminalSessionRecord | undefined {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      return undefined;
    }

    return [...this.sessionRecordBySessionId.values()].find(
      (sessionRecord) => this.getSessionSurfaceTitle(sessionRecord.sessionId) === normalizedTitle,
    );
  }

  private async syncTerminalName(terminal: vscode.Terminal, sessionId: string): Promise<void> {
    const desiredName = this.getSessionSurfaceTitle(sessionId);
    if (!desiredName) {
      return;
    }

    if ((terminal.name ?? terminal.creationOptions.name) === desiredName) {
      return;
    }

    terminal.show(false);
    await this.waitForActiveTerminal(terminal);
    await vscode.commands.executeCommand(TERMINAL_RENAME_COMMAND, { name: desiredName });
    this.changeSessionTitleEmitter.fire({
      sessionId,
      title: desiredName,
    });
  }

  private async waitForActiveTerminal(terminal: vscode.Terminal): Promise<void> {
    await waitForActiveTerminalInstance(terminal);
  }

  private async activateTerminalForWorkbenchCommand(terminal: vscode.Terminal): Promise<boolean> {
    if (vscode.window.activeTerminal === terminal) {
      return true;
    }

    terminal.show(true);
    await this.waitForActiveTerminal(terminal);
    if (vscode.window.activeTerminal === terminal) {
      return true;
    }

    terminal.show(false);
    await this.waitForActiveTerminal(terminal);
    return vscode.window.activeTerminal === terminal;
  }

  private findTerminalGroupIndex(sessionId: string): number | undefined {
    return findTerminalGroupIndexByTitle(this.getSessionSurfaceTitle(sessionId));
  }

  private async moveTerminalToGroup(sessionId: string, targetGroupIndex: number): Promise<void> {
    const currentGroupIndex = this.findTerminalGroupIndex(sessionId);
    if (currentGroupIndex === undefined || currentGroupIndex === targetGroupIndex) {
      return;
    }

    await moveActiveEditorToGroup(targetGroupIndex);
    await this.logState("MOVE", "terminal-group", {
      currentGroupIndex,
      sessionId,
      targetGroupIndex,
    });
  }

  private isTerminalTabActive(sessionId: string, terminal: vscode.Terminal): boolean {
    return isTerminalTabActiveByTitle(this.getSessionSurfaceTitle(sessionId), terminal);
  }

  private async refreshSessionSnapshots(): Promise<void> {
    let didChangeSessions = false;
    const titleChanges: TerminalWorkspaceBackendTitleChange[] = [];

    for (const sessionId of this.sessionRecordBySessionId.keys()) {
      const result = await this.refreshSessionSnapshot(sessionId);
      didChangeSessions ||= result.didChangeSnapshot;
      if (result.titleChange) {
        titleChanges.push(result.titleChange);
      }
    }

    for (const titleChange of titleChanges) {
      this.changeSessionTitleEmitter.fire(titleChange);
    }

    if (didChangeSessions) {
      this.changeSessionsEmitter.fire();
    }

    if (didChangeSessions || titleChanges.length > 0) {
      this.changeDebugStateEmitter.fire();
    }
  }

  private async refreshSessionSnapshot(sessionId: string): Promise<{
    didChangeSnapshot: boolean;
    titleChange?: TerminalWorkspaceBackendTitleChange;
  }> {
    const projection = this.projections.get(sessionId);
    const persistedState = await this.readPersistedSessionState(sessionId);
    const previousSnapshot = this.sessions.get(sessionId);
    let nextSnapshot: TerminalSessionSnapshot;

    if (!projection || projection.terminal.exitStatus) {
      nextSnapshot = {
        ...(this.sessions.get(sessionId) ??
          createDisconnectedSessionSnapshot(sessionId, this.options.workspaceId)),
        agentName: persistedState.agentName,
        agentStatus: persistedState.agentStatus,
        restoreState: "live",
        status: projection?.terminal.exitStatus ? "exited" : "disconnected",
      };
    } else {
      nextSnapshot = {
        ...(this.sessions.get(sessionId) ??
          createDisconnectedSessionSnapshot(sessionId, this.options.workspaceId)),
        agentName: persistedState.agentName,
        agentStatus: persistedState.agentStatus,
        restoreState: "live",
        startedAt: this.sessions.get(sessionId)?.startedAt ?? new Date().toISOString(),
        status: "running",
        workspaceId: this.options.workspaceId,
      };
    }

    this.sessions.set(sessionId, nextSnapshot);

    const previousTitle = this.sessionTitleBySessionId.get(sessionId);
    const nextTitle = persistedState.title;
    if (!nextTitle) {
      this.sessionTitleBySessionId.delete(sessionId);
      return {
        didChangeSnapshot: !haveSameTerminalSessionSnapshot(previousSnapshot, nextSnapshot),
      };
    }

    this.sessionTitleBySessionId.set(sessionId, nextTitle);
    return {
      didChangeSnapshot: !haveSameTerminalSessionSnapshot(previousSnapshot, nextSnapshot),
      titleChange:
        nextTitle !== previousTitle
          ? {
              sessionId,
              title: nextTitle,
            }
          : undefined,
    };
  }

  private async readPersistedSessionState(sessionId: string): Promise<{
    agentName?: string;
    agentStatus: TerminalAgentStatus;
    title?: string;
  }> {
    return readPersistedSessionStateFromFile(this.getSessionAgentStateFilePath(sessionId));
  }

  private createTerminalEnvironment(sessionId: string): Record<string, string> {
    const environment = createManagedTerminalEnvironment(
      this.options.workspaceId,
      sessionId,
      this.getSessionAgentStateFilePath(sessionId),
    );

    if (this.agentShellIntegration) {
      environment.PATH = `${this.agentShellIntegration.binDir}${path.delimiter}${process.env.PATH ?? ""}`;
      if (process.platform !== "win32") {
        environment.ZDOTDIR = this.agentShellIntegration.zshDotDir;
      }
    }

    return environment;
  }

  private getSessionSurfaceTitle(sessionId: string): string | undefined {
    const sessionRecord = this.sessionRecordBySessionId.get(sessionId);
    return sessionRecord ? getTerminalSessionSurfaceTitle(sessionRecord) : undefined;
  }

  private getAgentStateDirectory(): string {
    return path.join(this.options.context.globalStorageUri.fsPath, AGENT_STATE_DIR_NAME);
  }

  private getSessionAgentStateFilePath(sessionId: string): string {
    return path.join(this.getAgentStateDirectory(), `${sessionId}.env`);
  }

  private getProcessAssociationStorageKey(): string {
    return getWorkspaceStorageKey(PROCESS_ID_ASSOCIATIONS_KEY, this.options.workspaceId);
  }

  private loadStoredProcessAssociations(): void {
    const storedAssociations =
      this.options.context.workspaceState?.get<Record<string, number>>(
        this.getProcessAssociationStorageKey(),
      ) ?? {};

    this.sessionIdByProcessId.clear();
    for (const [sessionId, processId] of Object.entries(storedAssociations)) {
      if (Number.isInteger(processId) && processId > 0) {
        this.sessionIdByProcessId.set(processId, sessionId);
      }
    }
  }

  private async captureProcessAssociation(
    sessionId: string,
    terminal: vscode.Terminal,
  ): Promise<void> {
    const processId = await this.getTerminalProcessId(terminal);
    if (!processId || this.sessionIdByProcessId.get(processId) === sessionId) {
      return;
    }

    this.sessionIdByProcessId.set(processId, sessionId);
    const storedAssociations = Object.fromEntries(
      [...this.sessionIdByProcessId.entries()].map(([candidateProcessId, candidateSessionId]) => [
        candidateSessionId,
        candidateProcessId,
      ]),
    );
    await this.options.context.workspaceState?.update(
      this.getProcessAssociationStorageKey(),
      storedAssociations,
    );
  }

  private async getTerminalProcessId(terminal: vscode.Terminal): Promise<number | undefined> {
    try {
      const processId = await terminal.processId;
      return typeof processId === "number" && processId > 0 ? processId : undefined;
    } catch {
      return undefined;
    }
  }

  private captureLayoutState(): NativeTerminalLayoutDebugState {
    const projections: NativeTerminalDebugProjection[] = [
      ...this.sessionRecordBySessionId.keys(),
    ].map((sessionId) => {
      const projection = this.projections.get(sessionId);
      const groupIndex = this.findTerminalGroupIndex(sessionId);
      return {
        alias: this.sessionRecordBySessionId.get(sessionId)?.alias,
        exitCode: projection?.terminal.exitStatus?.code,
        isParked: groupIndex !== undefined && !this.isTerminalTabForeground(sessionId, groupIndex),
        isTracked: true,
        location: formatLocation(groupIndex),
        sessionId,
        terminalName: projection?.terminal.name ?? projection?.terminal.creationOptions.name,
      };
    });

    return {
      activeTerminalName: vscode.window.activeTerminal?.name,
      editorSurfaceGroups: vscode.window.tabGroups.all.map((group) => ({
        labels: group.tabs.map((tab) => tab.label),
        sessionIds: group.tabs
          .filter((tab) => tab.input instanceof vscode.TabInputTerminal)
          .map((tab) => this.findSessionIdByTitle(tab.label))
          .filter((sessionId): sessionId is string => Boolean(sessionId)),
        visibleIndex: (group.viewColumn ?? 1) - 1,
        viewColumn: group.viewColumn,
      })),
      parkedTerminals: projections.filter((projection) => projection.isParked),
      processAssociations: [...this.sessionIdByProcessId.entries()].map(
        ([processId, sessionId]) => ({
          processId,
          sessionId,
        }),
      ),
      projections,
      rawTabGroups: vscode.window.tabGroups.all.map((group) => ({
        labels: group.tabs.map((tab) => tab.label),
        terminalLabels: group.tabs
          .filter((tab) => tab.input instanceof vscode.TabInputTerminal)
          .map((tab) => tab.label),
        viewColumn: group.viewColumn,
      })),
      terminalCount: vscode.window.terminals.length,
      terminalNames: vscode.window.terminals.map((terminal) => terminal.name),
      trackedSessionIds: [...this.sessionRecordBySessionId.keys()],
    };
  }

  private findSessionIdByTitle(title: string): string | undefined {
    return [...this.sessionRecordBySessionId.values()].find(
      (sessionRecord) => getTerminalSessionSurfaceTitle(sessionRecord) === title,
    )?.sessionId;
  }

  private isTerminalTabForeground(sessionId: string, groupIndex: number): boolean {
    return isTerminalTabForegroundByTitle(this.getSessionSurfaceTitle(sessionId), groupIndex);
  }

  private async logState(tag: string, message: string, details?: unknown): Promise<void> {
    if (!this.trace.isEnabled()) {
      return;
    }

    await this.trace.log(tag, message, {
      details,
      state: this.getTraceState(),
    });
  }
}

function formatLocation(groupIndex: number | undefined): string {
  if (groupIndex === undefined) {
    return "unknown";
  }

  return `editor:${groupIndex}`;
}

function haveSameTerminalSessionSnapshot(
  left: TerminalSessionSnapshot | undefined,
  right: TerminalSessionSnapshot,
): boolean {
  return (
    left?.agentName === right.agentName &&
    left?.agentStatus === right.agentStatus &&
    left?.cols === right.cols &&
    left?.cwd === right.cwd &&
    left?.endedAt === right.endedAt &&
    left?.errorMessage === right.errorMessage &&
    left?.exitCode === right.exitCode &&
    left?.restoreState === right.restoreState &&
    left?.rows === right.rows &&
    left?.sessionId === right.sessionId &&
    left?.shell === right.shell &&
    left?.startedAt === right.startedAt &&
    left?.status === right.status &&
    left?.workspaceId === right.workspaceId
  );
}
