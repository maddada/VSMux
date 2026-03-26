import * as vscode from "vscode";
import {
  MAX_SESSION_COUNT,
  getOrderedSessions,
  isBrowserSession,
  isNumericSessionAlias,
  isT3Session,
  isTerminalSession,
  type SessionGridDirection,
} from "../../shared/session-grid-contract";
import {
  deleteSidebarAgentPreference,
  getSidebarAgentButtonById,
  saveSidebarAgentPreference,
} from "../sidebar-agent-preferences";
import {
  deleteSidebarCommandPreference,
  getSidebarCommandButtonById,
  saveSidebarCommandPreference,
  syncSidebarCommandOrderPreference,
} from "../sidebar-command-preferences";
import type { PreviousSessionHistoryEntry } from "../previous-session-history";
import { getDefaultWorkspaceCwd } from "../terminal-workspace-helpers";
import { createSessionActivationPlan } from "./session-activation";
import { COMPLETION_BELL_ENABLED_KEY, getSendRenameCommandOnSidebarRename } from "./settings";
import { acknowledgeSessionAttention } from "./events";
import { NativeTerminalWorkspaceControllerBase } from "./controller-base";

export abstract class NativeTerminalWorkspaceControllerSessionActions extends NativeTerminalWorkspaceControllerBase {
  public async createSession(): Promise<void> {
    await this.runLoggedAction("createSession", undefined, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const sessionRecord = await this.store.createSession();
      if (!sessionRecord) {
        await operation.step("session-limit-reached");
        void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
        return;
      }

      await operation.step("after-store-create", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
        sessionId: sessionRecord.sessionId,
      });
      await this.backend.createOrAttachSession(sessionRecord);
      await operation.step("after-backend-create-or-attach");
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async focusDirection(direction: SessionGridDirection): Promise<void> {
    await this.runLoggedAction("focusDirection", { direction }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const changed = await this.store.focusDirection(direction);
      await operation.step("after-store-focus-direction", {
        changed,
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      if (!changed) {
        return;
      }

      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async focusSession(sessionId: string, preserveFocus = false): Promise<void> {
    await this.runLoggedAction(
      "focusSession",
      {
        preserveFocus,
        sessionId,
      },
      async (operation) => {
        const sessionRecord = this.store.getSession(sessionId);
        if (!sessionRecord) {
          await operation.step("session-not-found");
          return;
        }

        const activationPlan = createSessionActivationPlan(sessionRecord, {
          hasLiveBrowserTab: this.browserSessions.hasLiveTab(sessionId),
          hasLiveT3Panel: this.t3Webviews.hasLivePanel(sessionId),
          hasLiveTerminal: this.backend.hasLiveTerminal(sessionId),
          hasStoredAgentLaunch: this.sessionAgentLaunchBySessionId.has(sessionId),
          isAlreadyFocused: this.isAlreadyActiveSession(sessionId),
          isT3Running: this.getT3ActivityState(sessionRecord).isRunning,
        });

        if (activationPlan.shouldNoop) {
          await this.logControllerEvent("ACTION", "focusSession-noop", {
            preserveFocus,
            sessionId,
          });
          return;
        }

        if (!(await this.ensureNativeTerminalControl())) {
          await operation.step("ensure-native-terminal-control-blocked");
          return;
        }

        const changed = activationPlan.shouldFocusStoredSession
          ? await this.store.focusSession(sessionId)
          : false;
        await operation.step("after-store-focus", {
          activationPlan,
          changed,
          expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
        });

        if (activationPlan.shouldCreateOrAttachTerminal) {
          const nextSessionRecord = this.store.getSession(sessionId) ?? sessionRecord;
          await this.backend.createOrAttachSession(nextSessionRecord);
          await operation.step("after-create-or-attach-session");
        }

        await this.reconcileProjectedSessions(preserveFocus);
        await operation.step("after-reconcile");

        if (activationPlan.shouldResumeAgentAfterReveal) {
          await this.resumeAgentSessionIfConfigured(sessionId);
          await operation.step("after-resume-agent-session");
        }

        if (!preserveFocus) {
          this.focusT3ComposerIfPossible(sessionId);
          await operation.step("after-focus-t3-composer-if-possible");
        }

        const acknowledgedAttention = await acknowledgeSessionAttention(
          this.createSessionEventContext(),
          sessionId,
        );
        await operation.step("after-acknowledge-attention", {
          acknowledgedAttention,
        });
        if (
          (changed || !preserveFocus || activationPlan.shouldRefreshAfterActivation) &&
          !acknowledgedAttention
        ) {
          await this.refreshSidebar();
          await operation.step("after-refresh-sidebar");
        }
      },
    );
  }

  public async focusSessionSlot(slotNumber: number): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const normalizedSlotNumber = Math.max(1, Math.min(MAX_SESSION_COUNT, Math.floor(slotNumber)));
    const session = getOrderedSessions(this.getActiveSnapshot()).find(
      (sessionRecord) => sessionRecord.slotIndex === normalizedSlotNumber - 1,
    );
    if (!session) {
      return;
    }

    await this.focusSession(session.sessionId);
  }

  public async openWorkspace(): Promise<void> {
    await this.runLoggedAction("openWorkspace", undefined, async (operation) => {
      await this.revealSidebar();
      await operation.step("after-reveal-sidebar");

      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      if (this.getAllSessionRecords().length === 0) {
        await operation.step("before-create-initial-session");
        await this.createSession();
        await operation.step("after-create-initial-session");
        return;
      }

      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async revealSession(sessionId?: string): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const resolvedSessionId = sessionId ?? (await this.promptForSessionId("Reveal session"));
    if (!resolvedSessionId) {
      return;
    }

    await this.focusSession(resolvedSessionId);
  }

  public async resetWorkspace(): Promise<void> {
    await this.runLoggedAction("resetWorkspace", undefined, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        "Reset VSmux sessions?",
        {
          detail:
            "This clears the saved session grid for the current workspace and kills all detached shells owned by it.",
          modal: true,
        },
        "Reset",
      );

      if (!confirmation) {
        await operation.step("reset-cancelled");
        return;
      }

      const archivedSessions: PreviousSessionHistoryEntry[] = [];
      for (const sessionRecord of this.getAllSessionRecords()) {
        const group = this.store.getSessionGroup(sessionRecord.sessionId);
        if (group) {
          const archivedSession = this.createPreviousSessionEntry(group, sessionRecord);
          if (archivedSession) {
            archivedSessions.push(archivedSession);
          }
        }
        await this.backend.killSession(sessionRecord.sessionId);
        await this.t3Webviews.disposeSession(sessionRecord.sessionId);
        await this.browserSessions.disposeSession(sessionRecord.sessionId);
      }

      this.sessionAgentLaunchBySessionId.clear();
      this.terminalTitleBySessionId.clear();
      this.titleDerivedActivityBySessionId.clear();
      this.sidebarAgentIconBySessionId.clear();
      await this.previousSessionHistory.append(archivedSessions);
      await this.persistSessionAgentCommands();
      await this.store.reset();
      await this.context.workspaceState.update(this.getDisableVsMuxStorageKey(), false);
      await operation.step("after-store-reset", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async restartSession(sessionId: string): Promise<void> {
    await this.runLoggedAction("restartSession", { sessionId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const sessionRecord = this.store.getSession(sessionId);
      if (!sessionRecord) {
        await operation.step("session-not-found");
        return;
      }

      if (isT3Session(sessionRecord)) {
        const t3Runtime = await this.getOrCreateT3Runtime();
        if (!t3Runtime) {
          await operation.step("t3-runtime-unavailable");
          return;
        }

        await t3Runtime.ensureRunning(sessionRecord.t3.workspaceRoot);
        await operation.step("after-ensure-t3-running");
        await this.reconcileProjectedSessions();
        await operation.step("after-reconcile");
        await this.refreshSidebar();
        await operation.step("after-refresh-sidebar");
        return;
      }

      if (isBrowserSession(sessionRecord)) {
        await this.browserSessions.disposeSession(sessionId);
        await operation.step("after-dispose-browser-session");
        await this.reconcileProjectedSessions();
        await operation.step("after-reconcile");
        await this.refreshSidebar();
        await operation.step("after-refresh-sidebar");
        return;
      }

      this.terminalTitleBySessionId.delete(sessionId);
      this.titleDerivedActivityBySessionId.delete(sessionId);
      await this.backend.restartSession(sessionRecord);
      await operation.step("after-backend-restart");
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async restartSessionFromCommand(sessionId?: string): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const resolvedSessionId = sessionId ?? (await this.promptForSessionId("Restart session"));
    if (!resolvedSessionId) {
      return;
    }

    await this.restartSession(resolvedSessionId);
  }

  public async renameSession(sessionId: string, title: string): Promise<void> {
    await this.runLoggedAction("renameSession", { sessionId, title }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const nextAlias = title.trim();
      if (!nextAlias) {
        await operation.step("empty-alias");
        return;
      }

      if (isNumericSessionAlias(nextAlias)) {
        await operation.step("numeric-alias-rejected");
        return;
      }

      const changed = await this.store.renameSessionAlias(sessionId, nextAlias);
      const shouldSendRenameCommand = getSendRenameCommandOnSidebarRename();
      await operation.step("after-store-rename", {
        changed,
        shouldSendRenameCommand,
      });
      if (!changed && !shouldSendRenameCommand) {
        return;
      }

      const sessionRecord = this.store.getSession(sessionId);
      if (!sessionRecord) {
        await operation.step("session-not-found");
        return;
      }

      if (changed) {
        await this.backend.renameSession(sessionRecord);
        await this.reconcileProjectedSessions(true);
        await operation.step("after-surface-rename");
      }

      if (shouldSendRenameCommand && isTerminalSession(sessionRecord)) {
        await this.writePendingRenameCommand(sessionId, nextAlias);
        await operation.step("after-write-pending-rename-command");
        await this.focusSession(sessionId);
        await operation.step("after-focus-renamed-session");
      }

      if (changed) {
        await this.refreshSidebar();
        await operation.step("after-refresh-sidebar");
      }
    });
  }

  public async promptRenameSession(sessionId: string): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const session = this.store.getSession(sessionId);
    if (!session) {
      return;
    }

    const title = await vscode.window.showInputBox({
      prompt: "Enter a session nickname",
      title: "Rename VSC-Mux Session",
      validateInput: (value) =>
        value.trim().length === 0
          ? "Session nickname cannot be empty."
          : isNumericSessionAlias(value)
            ? "Session nickname cannot be only numbers."
            : undefined,
      value: session.alias,
      valueSelection: [0, session.alias.length],
    });
    if (title === undefined) {
      return;
    }

    await this.renameSession(sessionId, title);
  }

  public async promptRenameFocusedSession(): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const session =
      this.store.getFocusedSession() ?? getOrderedSessions(this.getActiveSnapshot())[0];
    if (!session) {
      void vscode.window.showInformationMessage("No sessions are available yet.");
      return;
    }

    await this.promptRenameSession(session.sessionId);
  }

  public async closeSession(sessionId: string): Promise<void> {
    await this.runLoggedAction("closeSession", { sessionId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const group = this.store.getSessionGroup(sessionId);
      const sessionRecord = this.store.getSession(sessionId);
      const archivedSession =
        group && sessionRecord ? this.createPreviousSessionEntry(group, sessionRecord) : undefined;
      const removed = await this.store.removeSession(sessionId);
      if (!removed) {
        await operation.step("session-not-removed");
        return;
      }

      await operation.step("after-store-remove", {
        archivedSessionCreated: Boolean(archivedSession),
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.t3Webviews.disposeSession(sessionId);
      await this.browserSessions.disposeSession(sessionId);
      await this.backend.killSession(sessionId);
      await this.deleteSessionAgentCommand(sessionId);
      this.terminalTitleBySessionId.delete(sessionId);
      this.titleDerivedActivityBySessionId.delete(sessionId);
      this.sidebarAgentIconBySessionId.delete(sessionId);
      if (archivedSession) {
        await this.previousSessionHistory.append([archivedSession]);
      }
      await operation.step("after-dispose-surface-state");
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");

      await this.syncT3RuntimeLease();
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async copyResumeCommand(sessionId: string): Promise<void> {
    const resumeText = this.buildCopyResumeCommandText(sessionId);
    if (!resumeText) {
      return;
    }

    await vscode.env.clipboard.writeText(resumeText);
  }

  public async openSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:maddada.VSmux");
  }

  public async toggleCompletionBell(): Promise<void> {
    const nextValue = !this.getCompletionBellEnabled();
    await this.context.globalState.update(this.getCompletionBellEnabledStorageKey(), nextValue);
    await this.context.workspaceState.update(COMPLETION_BELL_ENABLED_KEY, nextValue);
    await this.refreshSidebar();
  }

  public async runSidebarCommand(commandId: string): Promise<void> {
    const commandButton = getSidebarCommandButtonById(this.context, commandId);
    if (!commandButton) {
      return;
    }

    if (commandButton.actionType === "browser") {
      await this.createBrowserSession(commandButton.name, commandButton.url);
      return;
    }

    const command = commandButton.command?.trim();
    if (!command) {
      return;
    }

    if (!(await this.ensureShellSpawnAllowed())) {
      return;
    }

    if (commandButton?.closeTerminalOnExit) {
      const terminal = this.createSidebarCommandTerminal(commandButton.name, command, true);
      terminal.show(true);
      this.disposeTerminalWhenProcessExits(terminal);
      return;
    }

    const terminal = this.createSidebarCommandTerminal(commandButton?.name ?? "Command");
    terminal.show(true);
    terminal.sendText(command, true);
  }

  public async runSidebarAgent(agentId: string): Promise<void> {
    await this.runLoggedAction("runSidebarAgent", { agentId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const agentButton = getSidebarAgentButtonById(agentId);
      if (!agentButton) {
        await operation.step("agent-button-not-found");
        return;
      }

      const command = agentButton.command?.trim();
      if (agentId === "t3") {
        await this.createT3Session(command);
        await operation.step("after-create-t3-session");
        return;
      }

      if (!command) {
        await operation.step("agent-command-missing");
        return;
      }

      const sessionRecord = await this.store.createSession();
      if (!sessionRecord) {
        await operation.step("session-limit-reached");
        void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
        return;
      }

      if (agentButton.icon) {
        this.sidebarAgentIconBySessionId.set(sessionRecord.sessionId, agentButton.icon);
      }

      const nextSessionRecord = this.store.getSession(sessionRecord.sessionId) ?? sessionRecord;
      await this.setSessionAgentLaunch(nextSessionRecord.sessionId, agentId, command);
      await this.backend.createOrAttachSession(nextSessionRecord);
      await operation.step("after-create-or-attach-session");
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
      await this.backend.writeText(nextSessionRecord.sessionId, command, true);
      await operation.step("after-write-command");
    });
  }

  public async restorePreviousSession(historyId: string): Promise<void> {
    await this.runLoggedAction("restorePreviousSession", { historyId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const archivedSession = this.previousSessionHistory.getEntry(historyId);
      if (!archivedSession) {
        await operation.step("history-entry-not-found");
        return;
      }

      const restoredSession =
        archivedSession.sessionRecord.kind === "browser"
          ? await this.store.createSession({
              browser: archivedSession.sessionRecord.browser,
              kind: "browser",
              title: archivedSession.sessionRecord.title,
            })
          : archivedSession.sessionRecord.kind === "t3"
            ? await this.store.createSession({
                kind: "t3",
                t3: archivedSession.sessionRecord.t3,
                title: archivedSession.sessionRecord.title,
              })
            : await this.store.createSession({
                title: archivedSession.sessionRecord.title,
              });
      if (!restoredSession) {
        await operation.step("session-limit-reached");
        void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
        return;
      }

      if (archivedSession.agentIcon) {
        this.sidebarAgentIconBySessionId.set(restoredSession.sessionId, archivedSession.agentIcon);
      }

      if (archivedSession.sessionRecord.alias !== restoredSession.alias) {
        await this.store.renameSessionAlias(
          restoredSession.sessionId,
          archivedSession.sessionRecord.alias,
        );
      }

      const nextSessionRecord = this.store.getSession(restoredSession.sessionId) ?? restoredSession;
      if (archivedSession.agentLaunch) {
        await this.setSessionAgentLaunch(
          nextSessionRecord.sessionId,
          archivedSession.agentLaunch.agentId,
          archivedSession.agentLaunch.command,
        );
      }

      await this.backend.createOrAttachSession(nextSessionRecord);
      await operation.step("after-create-or-attach-session");
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      if (archivedSession.agentLaunch) {
        await this.resumeAgentSessionIfConfigured(nextSessionRecord.sessionId);
        await operation.step("after-resume-agent-session");
      }
      await this.previousSessionHistory.remove(historyId);
      await operation.step("after-remove-history-entry");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async deletePreviousSession(historyId: string): Promise<void> {
    await this.previousSessionHistory.remove(historyId);
    await this.refreshSidebar();
  }

  public async clearGeneratedPreviousSessions(): Promise<void> {
    await this.previousSessionHistory.removeGeneratedNames();
    await this.refreshSidebar();
  }

  public async saveScratchPad(content: string): Promise<void> {
    const nextContent = typeof content === "string" ? content : "";
    if (nextContent === this.getScratchPadContent()) {
      return;
    }

    await this.context.workspaceState.update(this.getScratchPadStorageKey(), nextContent);
    await this.refreshSidebar();
  }

  public async saveSidebarCommand(
    commandId: string | undefined,
    name: string,
    actionType: "browser" | "terminal",
    closeTerminalOnExit: boolean,
    command?: string,
    url?: string,
  ): Promise<void> {
    await saveSidebarCommandPreference(this.context, {
      actionType,
      closeTerminalOnExit,
      commandId,
      name,
      command,
      url,
    });
    await this.refreshSidebar();
  }

  public async deleteSidebarCommand(commandId: string): Promise<void> {
    await deleteSidebarCommandPreference(this.context, commandId);
    await this.refreshSidebar();
  }

  public async syncSidebarCommandOrder(commandIds: readonly string[]): Promise<void> {
    await syncSidebarCommandOrderPreference(this.context, commandIds);
    await this.refreshSidebar();
  }

  public async saveSidebarAgent(
    agentId: string | undefined,
    name: string,
    command: string,
  ): Promise<void> {
    await saveSidebarAgentPreference({
      agentId,
      command,
      name,
    });
    await this.refreshSidebar("hydrate");
  }

  public async deleteSidebarAgent(agentId: string): Promise<void> {
    await deleteSidebarAgentPreference(agentId);
    await this.refreshSidebar("hydrate");
  }

  protected async createT3Session(startupCommand = "npx --yes t3"): Promise<void> {
    const workspaceRoot = getDefaultWorkspaceCwd();
    const t3Runtime = await this.getOrCreateT3Runtime();
    if (!t3Runtime) {
      return;
    }

    const t3SessionMetadata = await t3Runtime.createThreadSession(
      workspaceRoot,
      startupCommand,
      "T3 Code",
    );
    const sessionRecord = await this.store.createSession({
      kind: "t3",
      t3: t3SessionMetadata,
      title: "T3 Code",
    });
    if (!sessionRecord) {
      void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
      return;
    }

    this.sidebarAgentIconBySessionId.set(sessionRecord.sessionId, "t3");
    await this.backend.createOrAttachSession(sessionRecord);
    await this.reconcileProjectedSessions();
    await this.refreshSidebar();
  }

  protected async createBrowserSession(title: string, url: string | undefined): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const normalizedUrl = url?.trim();
    if (!normalizedUrl) {
      return;
    }

    await this.enforceSingleBrowserSession();
    const existingBrowserSession = this.getPrimaryBrowserSession();
    if (existingBrowserSession) {
      await this.store.setBrowserSessionMetadata(
        existingBrowserSession.sessionId,
        title,
        normalizedUrl,
      );
      await this.store.focusSession(existingBrowserSession.sessionId);
      const nextSessionRecord = this.store.getSession(existingBrowserSession.sessionId);
      if (nextSessionRecord && isBrowserSession(nextSessionRecord)) {
        await this.backend.createOrAttachSession(nextSessionRecord);
      }
      await this.reconcileProjectedSessions();
      await this.refreshSidebar();
      return;
    }

    const sessionRecord = await this.store.createSession({
      browser: {
        url: normalizedUrl,
      },
      kind: "browser",
      title,
    });
    if (!sessionRecord) {
      void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
      return;
    }

    await this.backend.createOrAttachSession(sessionRecord);
    await this.reconcileProjectedSessions();
    await this.refreshSidebar();
  }

  protected getPrimaryBrowserSession() {
    return this.getAllSessionRecords().find(isBrowserSession);
  }

  protected async enforceSingleBrowserSession(): Promise<void> {
    const browserSessions = this.getAllSessionRecords().filter(isBrowserSession);
    if (browserSessions.length <= 1) {
      return;
    }

    for (const sessionRecord of browserSessions.slice(1)) {
      await this.browserSessions.disposeSession(sessionRecord.sessionId);
      await this.store.removeSession(sessionRecord.sessionId);
    }
  }
}
