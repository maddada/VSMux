import * as vscode from "vscode";
import {
  createSidebarHudState,
  resolveSidebarTheme,
  type ExtensionToSidebarMessage,
  type SidebarHydrateMessage,
  type SidebarSessionStateMessage,
  type SidebarToExtensionMessage,
} from "../../shared/session-grid-contract";
import type { ExtensionToNativeTerminalDebugMessage } from "../../shared/native-terminal-debug-contract";
import { getSidebarAgentIconById } from "../../shared/sidebar-agents";
import { getSidebarAgentButtons } from "../sidebar-agent-preferences";
import { getSidebarCommandButtons } from "../sidebar-command-preferences";
import { buildSidebarMessage } from "../native-terminal-workspace-sidebar-state";
import { createDebugInspectorMessage } from "../native-terminal-workspace-trace-state";
import { getEffectiveSessionActivity, syncKnownSessionActivities } from "./activity";
import {
  DEBUG_STATE_POLL_INTERVAL_MS,
  PRIMARY_SESSIONS_CONTAINER_ID,
  SECONDARY_SESSIONS_CONTAINER_ID,
  SIDEBAR_LOCATION_IN_SECONDARY_KEY,
  SIDEBAR_WELCOME_DISMISSED_KEY,
  SIDEBAR_WELCOME_OK_LABEL,
  getClampedCompletionSoundSetting,
  getClampedSidebarThemeSetting,
  getDebuggingMode,
  getShowCloseButtonOnSessionCards,
  getShowHotkeysOnSessionCards,
  getSidebarThemeVariant,
} from "./settings";
import { dispatchSidebarMessage } from "./sidebar-message-dispatch";
import { NativeTerminalWorkspaceControllerGroupActions } from "./controller-group-actions";

export class NativeTerminalWorkspaceControllerSidebarUi extends NativeTerminalWorkspaceControllerGroupActions {
  public async moveSidebarToSecondarySidebar(): Promise<void> {
    await this.showSidebarMoveInstructions();
  }

  public async moveSidebarToOtherSide(): Promise<void> {
    await this.showSidebarMoveInstructions();
  }

  public async revealSidebar(): Promise<void> {
    await vscode.commands.executeCommand(
      `workbench.view.extension.${this.getSidebarContainerId()}`,
    );
  }

  public async openDebugInspector(): Promise<void> {
    await this.debugPanel.reveal();
    this.ensureDebugStatePolling();
    await this.refreshDebugInspector();
  }

  protected createSidebarMessage(
    type: SidebarHydrateMessage["type"] | SidebarSessionStateMessage["type"] = "sessionState",
  ): ExtensionToSidebarMessage {
    const sessionActivityContext = this.createSessionActivityContext();
    const activeSnapshot = this.getActiveSnapshot();
    return buildSidebarMessage({
      activeSnapshot,
      browserHasLiveProjection: (sessionId) => this.browserSessions.hasLiveTab(sessionId),
      completionBellEnabled: this.getCompletionBellEnabled(),
      debuggingMode: getDebuggingMode(),
      getEffectiveSessionActivity: (sessionRecord, sessionSnapshot) =>
        getEffectiveSessionActivity(sessionActivityContext, sessionRecord, sessionSnapshot),
      getSessionAgentLaunch: (sessionId) => this.sessionAgentLaunchBySessionId.get(sessionId),
      getSessionSnapshot: (sessionId) => this.backend.getSessionSnapshot(sessionId),
      getSidebarAgentIcon: (sessionId, snapshotAgentName, derivedAgentName) =>
        this.sidebarAgentIconBySessionId.get(sessionId) ??
        getSidebarAgentIconById(snapshotAgentName) ??
        getSidebarAgentIconById(derivedAgentName),
      getT3ActivityState: (sessionRecord) => this.getT3ActivityState(sessionRecord),
      getTerminalTitle: (sessionId) => this.terminalTitleBySessionId.get(sessionId),
      hud: createSidebarHudState(
        activeSnapshot,
        resolveSidebarTheme(getClampedSidebarThemeSetting(), getSidebarThemeVariant()),
        getShowCloseButtonOnSessionCards(),
        getShowHotkeysOnSessionCards(),
        getDebuggingMode(),
        this.getCompletionBellEnabled(),
        getClampedCompletionSoundSetting(),
        getSidebarAgentButtons(),
        getSidebarCommandButtons(this.context),
        this.isVsMuxDisabled(),
      ),
      ownsNativeTerminalControl: this.ownsNativeTerminalControl,
      platform: this.shortcutLabelPlatform,
      previousSessions: this.previousSessionHistory.getItems(),
      scratchPadContent: this.getScratchPadContent(),
      terminalHasLiveProjection: (sessionId) => this.backend.hasLiveTerminal(sessionId),
      type,
      workspaceId: this.workspaceId,
      workspaceSnapshot: this.store.getSnapshot(),
    });
  }

  protected async handleSidebarMessage(message: SidebarToExtensionMessage): Promise<void> {
    await dispatchSidebarMessage(message, {
      clearGeneratedPreviousSessions: async () => this.clearGeneratedPreviousSessions(),
      clearStartupSidebarRefreshes: () => this.clearStartupSidebarRefreshes(),
      closeGroup: async (groupId) => this.closeGroup(groupId),
      closeSession: async (sessionId) => this.closeSession(sessionId),
      copyResumeCommand: async (sessionId) => this.copyResumeCommand(sessionId),
      createGroupFromSession: async (sessionId) => this.createGroupFromSession(sessionId),
      createSession: async () => this.createSession(),
      createSessionInGroup: async (groupId) => this.createSessionInGroup(groupId),
      deletePreviousSession: async (historyId) => this.deletePreviousSession(historyId),
      deleteSidebarAgent: async (agentId) => this.deleteSidebarAgent(agentId),
      deleteSidebarCommand: async (commandId) => this.deleteSidebarCommand(commandId),
      focusGroup: async (groupId) => this.focusGroup(groupId),
      focusSession: async (sessionId, preserveFocus) =>
        this.focusSession(sessionId, preserveFocus === true),
      moveSessionToGroup: async (sessionId, groupId, targetIndex) =>
        this.moveSessionToGroup(sessionId, groupId, targetIndex),
      moveSidebarToOtherSide: async () => this.moveSidebarToOtherSide(),
      openDebugInspector: async () => this.openDebugInspector(),
      openSettings: async () => this.openSettings(),
      promptRenameSession: async (sessionId) => this.promptRenameSession(sessionId),
      refreshSidebarHydrate: async () => this.refreshSidebar("hydrate"),
      renameGroup: async (groupId, title) => this.renameGroup(groupId, title),
      renameSession: async (sessionId, title) => this.renameSession(sessionId, title),
      restartSession: async (sessionId) => this.restartSession(sessionId),
      restorePreviousSession: async (historyId) => this.restorePreviousSession(historyId),
      runSidebarAgent: async (agentId) => this.runSidebarAgent(agentId),
      runSidebarCommand: async (commandId) => this.runSidebarCommand(commandId),
      saveScratchPad: async (content) => this.saveScratchPad(content),
      saveSidebarAgent: async (agentId, name, command) =>
        this.saveSidebarAgent(agentId, name, command),
      saveSidebarCommand: async (commandId, name, actionType, closeTerminalOnExit, command, url) =>
        this.saveSidebarCommand(
          commandId,
          name,
          actionType,
          closeTerminalOnExit === true,
          command,
          url,
        ),
      setViewMode: async (viewMode) => this.setViewMode(viewMode),
      setVisibleCount: async (visibleCount) => this.setVisibleCount(visibleCount),
      syncGroupOrder: async (groupIds) => this.syncGroupOrder(groupIds),
      syncSessionOrder: async (groupId, sessionIds) => this.syncSessionOrder(groupId, sessionIds),
      syncSidebarCommandOrder: async (commandIds) => this.syncSidebarCommandOrder(commandIds),
      toggleCompletionBell: async () => this.toggleCompletionBell(),
      toggleFullscreenSession: async () => this.toggleFullscreenSession(),
      toggleVsMuxDisabled: async () => this.toggleVsMuxDisabled(),
    });
  }

  protected async refreshSidebar(
    type: SidebarHydrateMessage["type"] | SidebarSessionStateMessage["type"] = "sessionState",
  ): Promise<void> {
    await syncKnownSessionActivities(
      this.createSessionActivityContext(),
      this.getAllSessionRecords(),
      false,
    );
    await this.sidebarProvider.postMessage(this.createSidebarMessage(type));
    await this.refreshDebugInspector();
  }

  protected clearStartupSidebarRefreshes(): void {
    for (const timeout of this.startupSidebarRefreshTimeouts) {
      clearTimeout(timeout);
    }

    this.startupSidebarRefreshTimeouts.clear();
  }

  protected ensureDebugStatePolling(): void {
    if (this.debugStatePollTimer) {
      return;
    }

    this.debugStatePollTimer = setInterval(() => {
      if (this.ownsNativeTerminalControl || !this.debugPanel.hasPanel()) {
        return;
      }

      void this.refreshDebugInspector();
    }, DEBUG_STATE_POLL_INTERVAL_MS);
  }

  protected stopDebugStatePolling(): void {
    if (!this.debugStatePollTimer) {
      return;
    }

    clearInterval(this.debugStatePollTimer);
    this.debugStatePollTimer = undefined;
  }

  protected async refreshDebugInspector(): Promise<void> {
    if (this.ownsNativeTerminalControl) {
      const message = this.createDebugInspectorMessage();
      await this.publishSharedDebugInspectorMessage(message);
      await this.debugPanel.postMessage(message);
      return;
    }

    await this.debugPanel.postMessage(
      this.getSharedDebugInspectorMessage() ?? this.createDebugInspectorMessage(),
    );
  }

  protected async maybeShowSidebarWelcome(): Promise<void> {
    if (this.sidebarWelcomeHandled) {
      return;
    }

    this.sidebarWelcomeHandled = true;
    if (this.context.globalState.get<boolean>(SIDEBAR_WELCOME_DISMISSED_KEY, false)) {
      return;
    }

    const selection = await vscode.window.showInformationMessage(
      "Welcome to VSmux",
      {
        detail:
          'VSmux keeps your sessions organized with quick switching, layout controls, grouped workspaces, and resume-friendly terminal state.\n\nBy default it lives in the main sidebar on the left. If you would rather keep Explorer or Source Control there later, run "VSmux: Move to Secondary Sidebar" to open both sidebars and then drag the VSmux icon across.',
        modal: true,
      },
      SIDEBAR_WELCOME_OK_LABEL,
    );

    if (!selection) {
      this.sidebarWelcomeHandled = false;
      return;
    }

    await this.context.globalState.update(SIDEBAR_WELCOME_DISMISSED_KEY, true);
  }

  protected async showSidebarMoveInstructions(): Promise<void> {
    await vscode.commands.executeCommand(
      `workbench.view.extension.${PRIMARY_SESSIONS_CONTAINER_ID}`,
    );
    await vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
    await vscode.window.showInformationMessage(
      "Drag the VSmux icon to the other side to move it.",
      {
        detail:
          "The primary and secondary sidebars are open now. Drag the VSmux icon into the other sidebar to move it there.",
      },
      SIDEBAR_WELCOME_OK_LABEL,
    );
  }

  private createDebugInspectorMessage(): ExtensionToNativeTerminalDebugMessage {
    const sidebarState = this.createSidebarMessage("sessionState") as SidebarSessionStateMessage;
    return createDebugInspectorMessage({
      backendState: this.backend.getDebugState(),
      sidebarGroups: sidebarState.groups,
      sidebarHud: sidebarState.hud,
      workspaceId: this.workspaceId,
    });
  }

  private getSidebarContainerId(): string {
    return this.context.globalState.get<boolean>(SIDEBAR_LOCATION_IN_SECONDARY_KEY, false)
      ? SECONDARY_SESSIONS_CONTAINER_ID
      : PRIMARY_SESSIONS_CONTAINER_ID;
  }
}
