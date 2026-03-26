import * as vscode from "vscode";
import {
  getOrderedSessions,
  isBrowserSession,
  isT3Session,
  isTerminalSession,
  type SessionRecord,
} from "../../shared/session-grid-contract";
import type { TerminalAgentStatus } from "../../shared/terminal-host-protocol";
import {
  createEmptyWorkspaceSessionSnapshot,
  focusEditorGroupByIndex,
  getActiveEditorGroupViewColumn,
  getCurrentEditorLayout,
  haveSameEditorLayoutShape,
  setEditorLayout,
} from "../terminal-workspace-helpers";
import {
  buildCopyResumeCommandText,
  buildResumeAgentCommand,
  loadStoredSessionAgentLaunches,
  persistSessionAgentLaunches,
} from "../native-terminal-workspace-session-agent-launch";
import { getClampedCompletionSoundSetting } from "./settings";
import { createSessionSplitProjection, type SessionSplitProjection } from "./splits";
import { NativeTerminalWorkspaceControllerBaseInternals } from "./controller-base-internals";

export abstract class NativeTerminalWorkspaceControllerBaseRuntime extends NativeTerminalWorkspaceControllerBaseInternals {
  protected async updateFocusedTerminal(
    previousVisibleSessionIds: readonly string[],
    preserveFocus = false,
  ): Promise<void> {
    void previousVisibleSessionIds;
    await this.reconcileProjectedSessions(preserveFocus);
  }

  protected async reconcileProjectedSessions(preserveFocus = false): Promise<void> {
    await this.layoutTrace.runOperation("reconcileProjectedSessions", {
      captureState: () => this.captureTraceState(),
      execute: async (operation) => {
        const sessionRecords = this.getAllSessionRecords();
        this.backend.syncSessions(sessionRecords);
        this.t3Webviews.syncSessions(sessionRecords);
        this.browserSessions.syncSessions(sessionRecords);
        await operation.step("after-sync-session-managers", {
          expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
          preserveFocus,
        });
        await this.ensureT3RuntimeForStoredSessions(sessionRecords);
        await this.syncT3RuntimeLease();
        await operation.step("after-sync-t3-runtime");

        if (this.isVsMuxDisabled()) {
          await operation.step("vsmux-disabled");
          return;
        }

        const splitProjection = createSessionSplitProjection(this.getActiveSnapshot());
        await operation.step("after-build-split-projection", {
          splitProjection,
        });
        if (splitProjection.slotSessionIds.length === 0) {
          await operation.step("no-visible-sessions");
          return;
        }

        await this.projectVisibleSessions(splitProjection, preserveFocus);
        await operation.step("after-project-visible-sessions", {
          preserveFocus,
          splitProjection,
        });
      },
      payload: {
        preserveFocus,
      },
    });
  }

  protected async projectVisibleSessions(
    splitProjection: SessionSplitProjection,
    preserveFocus = false,
  ): Promise<void> {
    const currentLayout = await getCurrentEditorLayout();
    if (!haveSameEditorLayoutShape(currentLayout, splitProjection.layout)) {
      await setEditorLayout(splitProjection.layout);
    }

    const restoreViewColumn = preserveFocus ? getActiveEditorGroupViewColumn() : undefined;
    const focusedSessionId =
      splitProjection.focusedSessionId &&
      splitProjection.slotSessionIds.includes(splitProjection.focusedSessionId)
        ? splitProjection.focusedSessionId
        : splitProjection.slotSessionIds.at(-1);

    for (let slotIndex = 0; slotIndex < splitProjection.slotSessionIds.length; slotIndex += 1) {
      const sessionId = splitProjection.slotSessionIds[slotIndex];
      if (sessionId === focusedSessionId) {
        continue;
      }

      await this.revealSessionSurfaceInGroup(sessionId, slotIndex, true);
    }

    if (focusedSessionId) {
      const focusedSlotIndex = splitProjection.slotSessionIds.indexOf(focusedSessionId);
      await this.revealSessionSurfaceInGroup(
        focusedSessionId,
        Math.max(0, focusedSlotIndex),
        preserveFocus,
      );
    }

    for (let slotIndex = 0; slotIndex < splitProjection.slotSessionIds.length; slotIndex += 1) {
      const sessionId = splitProjection.slotSessionIds[slotIndex];
      if (this.getObservedSessionViewColumn(sessionId) === slotIndex + 1) {
        continue;
      }

      await this.revealSessionSurfaceInGroup(
        sessionId,
        slotIndex,
        sessionId !== focusedSessionId || preserveFocus,
      );
    }

    if (preserveFocus && restoreViewColumn) {
      await focusEditorGroupByIndex(
        Math.max(0, Math.min(restoreViewColumn - 1, splitProjection.slotSessionIds.length - 1)),
      );
    }
  }

  protected async revealSessionSurfaceInGroup(
    sessionId: string,
    targetGroupIndex: number,
    preserveFocus = false,
  ): Promise<void> {
    const sessionRecord = this.store.getSession(sessionId);
    if (!sessionRecord) {
      return;
    }

    if (isTerminalSession(sessionRecord)) {
      await this.backend.revealSessionInGroup(sessionRecord, targetGroupIndex, preserveFocus);
      return;
    }

    if (isT3Session(sessionRecord)) {
      await this.t3Webviews.revealSessionInGroup(sessionRecord, targetGroupIndex, preserveFocus);
      if (!preserveFocus) {
        this.t3Webviews.focusComposer(sessionId);
      }
      return;
    }

    if (isBrowserSession(sessionRecord)) {
      await this.browserSessions.revealSessionInGroup(
        sessionRecord,
        targetGroupIndex,
        preserveFocus,
      );
    }
  }

  protected getObservedSessionViewColumn(sessionId: string): number | undefined {
    const sessionRecord = this.store.getSession(sessionId);
    if (!sessionRecord) {
      return undefined;
    }

    if (isTerminalSession(sessionRecord)) {
      const groupIndex = this.backend.getObservedGroupIndex(sessionId);
      return groupIndex === undefined ? undefined : groupIndex + 1;
    }

    if (isT3Session(sessionRecord)) {
      return this.t3Webviews.getObservedViewColumn(sessionId);
    }

    if (isBrowserSession(sessionRecord)) {
      return this.browserSessions.getObservedViewColumn(sessionId);
    }

    return undefined;
  }

  protected focusT3ComposerIfPossible(sessionId: string): void {
    const sessionRecord = this.store.getSession(sessionId);
    if (!sessionRecord || !isT3Session(sessionRecord)) {
      return;
    }

    this.t3Webviews.focusComposer(sessionId);
  }

  protected createSessionActivityContext() {
    return {
      getCompletionBellEnabled: () => this.getCompletionBellEnabled(),
      getLastTerminalActivityAt: (sessionId: string) =>
        this.backend.getLastTerminalActivityAt(sessionId),
      getSessionSnapshot: (sessionId: string) => this.backend.getSessionSnapshot(sessionId),
      getT3ActivityState: (sessionRecord: SessionRecord) => this.getT3ActivityState(sessionRecord),
      lastKnownActivityBySessionId: this.lastKnownActivityBySessionId,
      playCompletionSound: async () => {
        await this.sidebarProvider.postMessage({
          sound: getClampedCompletionSoundSetting(),
          type: "playCompletionSound",
        });
      },
      terminalTitleBySessionId: this.terminalTitleBySessionId,
      titleDerivedActivityBySessionId: this.titleDerivedActivityBySessionId,
      workspaceId: this.workspaceId,
    };
  }

  protected createSessionEventContext() {
    return {
      acknowledgeT3Thread: (threadId: string) => this.t3ActivityMonitor.acknowledgeThread(threadId),
      backend: this.backend,
      createSessionActivityContext: () => this.createSessionActivityContext(),
      getActiveSnapshot: () => this.getActiveSnapshot(),
      getAllSessionRecords: () => this.getAllSessionRecords(),
      getSession: (sessionId: string) => this.store.getSession(sessionId),
      getT3ActivityState: (sessionRecord: SessionRecord) => this.getT3ActivityState(sessionRecord),
      refreshSidebar: async () => this.refreshSidebar(),
      terminalTitleBySessionId: this.terminalTitleBySessionId,
      titleDerivedActivityBySessionId: this.titleDerivedActivityBySessionId,
    };
  }

  protected async ensureT3RuntimeForStoredSessions(
    sessionRecords: readonly SessionRecord[],
  ): Promise<void> {
    await this.syncT3RuntimeLease();
    const t3Sessions = sessionRecords.filter(isT3Session);
    if (t3Sessions.length === 0) {
      return;
    }

    const t3Runtime = await this.getOrCreateT3Runtime();
    if (!t3Runtime) {
      return;
    }

    const workspaceRoots = [
      ...new Set(t3Sessions.map((sessionRecord) => sessionRecord.t3.workspaceRoot)),
    ];
    for (const workspaceRoot of workspaceRoots) {
      await t3Runtime.ensureRunning(workspaceRoot);
    }
    await this.t3ActivityMonitor.refreshSnapshot();
  }

  protected async getOrCreateT3Runtime() {
    if (this.t3Runtime) {
      return this.t3Runtime;
    }

    this.t3RuntimeLoad ??= import("../t3-runtime-manager")
      .then(({ T3RuntimeManager }) => {
        this.t3Runtime = new T3RuntimeManager(this.context);
        return this.t3Runtime;
      })
      .catch(async (error: unknown) => {
        this.t3RuntimeLoad = undefined;
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`T3 sessions are unavailable: ${message}`);
        return undefined;
      });

    return this.t3RuntimeLoad;
  }

  protected async syncT3RuntimeLease(): Promise<void> {
    const hasStoredT3Sessions = this.getAllSessionRecords().some(isT3Session);
    await this.t3ActivityMonitor.setEnabled(hasStoredT3Sessions);
    if (!hasStoredT3Sessions) {
      await this.t3Runtime?.setLeaseActive(false);
      return;
    }

    const t3Runtime = await this.getOrCreateT3Runtime();
    await t3Runtime?.setLeaseActive(true);
  }

  protected getT3ActivityState(sessionRecord: SessionRecord): {
    activity: TerminalAgentStatus;
    isRunning: boolean;
  } {
    if (!isT3Session(sessionRecord)) {
      return {
        activity: "idle",
        isRunning: false,
      };
    }

    const activityState = this.t3ActivityMonitor.getThreadActivity(sessionRecord.t3.threadId);
    return {
      activity: activityState?.activity ?? "idle",
      isRunning: activityState?.isRunning ?? true,
    };
  }

  protected async resumeAgentSessionIfConfigured(sessionId: string): Promise<void> {
    const command = this.buildResumeAgentCommand(sessionId);
    if (!command) {
      return;
    }

    await this.backend.writeText(sessionId, command, true);
  }

  protected buildResumeAgentCommand(sessionId: string): string | undefined {
    const sessionRecord = this.store.getSession(sessionId);
    return buildResumeAgentCommand(
      this.sessionAgentLaunchBySessionId.get(sessionId),
      sessionRecord?.alias,
    );
  }

  protected buildCopyResumeCommandText(sessionId: string): string | undefined {
    const sessionRecord = this.store.getSession(sessionId);
    return buildCopyResumeCommandText(
      this.sessionAgentLaunchBySessionId.get(sessionId),
      this.sidebarAgentIconBySessionId.get(sessionId),
      sessionRecord?.alias,
    );
  }

  protected async setSessionAgentLaunch(
    sessionId: string,
    agentId: string,
    command: string,
  ): Promise<void> {
    const normalizedAgentId = agentId.trim();
    const normalizedCommand = command.trim();
    if (!normalizedAgentId || !normalizedCommand) {
      return;
    }

    this.sessionAgentLaunchBySessionId.set(sessionId, {
      agentId: normalizedAgentId,
      command: normalizedCommand,
    });
    await this.persistSessionAgentCommands();
  }

  protected async deleteSessionAgentCommand(sessionId: string): Promise<void> {
    if (!this.sessionAgentLaunchBySessionId.delete(sessionId)) {
      return;
    }

    await this.persistSessionAgentCommands();
  }

  protected loadSessionAgentCommands(): void {
    this.sessionAgentLaunchBySessionId.clear();
    for (const [sessionId, launch] of loadStoredSessionAgentLaunches(
      this.context,
      this.workspaceId,
    )) {
      this.sessionAgentLaunchBySessionId.set(sessionId, launch);
    }
  }

  protected async persistSessionAgentCommands(): Promise<void> {
    await persistSessionAgentLaunches(
      this.context,
      this.workspaceId,
      this.sessionAgentLaunchBySessionId,
    );
  }

  protected async promptForSessionId(title: string): Promise<string | undefined> {
    const sessions = this.store.getSnapshot().groups.flatMap((group) =>
      getOrderedSessions(group.snapshot).map((session) => ({
        groupTitle: group.title,
        session,
      })),
    );
    if (sessions.length === 0) {
      void vscode.window.showInformationMessage("No sessions are available yet.");
      return undefined;
    }

    const selection = await vscode.window.showQuickPick(
      sessions.map(({ groupTitle, session }) => ({
        description: `${groupTitle} · ${session.alias} · R${session.row + 1}C${session.column + 1}`,
        label: session.title,
        sessionId: session.sessionId,
      })),
      {
        placeHolder: title,
        title: `VSmux: ${title}`,
      },
    );

    return selection?.sessionId;
  }

  protected getActiveSnapshot() {
    return this.store.getActiveGroup()?.snapshot ?? createEmptyWorkspaceSessionSnapshot();
  }

  protected getAllSessionRecords(): SessionRecord[] {
    return this.store.getSnapshot().groups.flatMap((group) => getOrderedSessions(group.snapshot));
  }
}
