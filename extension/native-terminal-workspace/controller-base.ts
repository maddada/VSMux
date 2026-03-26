import {
  type SessionGridDirection,
  type SessionGridSnapshot,
  type SessionRecord,
  type SidebarHydrateMessage,
  type SidebarSessionGroup,
  type SidebarSessionStateMessage,
  type TerminalViewMode,
  type VisibleSessionCount,
} from "../../shared/session-grid-contract";
import { captureWorkbenchState } from "../session-layout-trace";
import type { BrowserSessionManager } from "../browser-session-manager";
import type { TerminalWorkspaceBackend } from "../terminal-workspace-backend";
import type { T3WebviewManager } from "../t3-webview-manager";
import {
  captureControllerTraceState,
  captureSnapshotTraceState,
} from "../native-terminal-workspace-trace-state";
import { NativeTerminalWorkspaceControllerBaseRuntime } from "./controller-base-runtime";
export { type NativeTerminalWorkspaceDebugState } from "./controller-base-internals";

export abstract class NativeTerminalWorkspaceControllerBase extends NativeTerminalWorkspaceControllerBaseRuntime {
  public abstract createSession(): Promise<void>;
  public abstract focusDirection(direction: SessionGridDirection): Promise<void>;
  public abstract focusSession(sessionId: string, preserveFocus?: boolean): Promise<void>;
  public abstract focusSessionSlot(slotNumber: number): Promise<void>;
  public abstract openWorkspace(): Promise<void>;
  public abstract moveSidebarToSecondarySidebar(): Promise<void>;
  public abstract moveSidebarToOtherSide(): Promise<void>;
  public abstract revealSidebar(): Promise<void>;
  public abstract openDebugInspector(): Promise<void>;
  public abstract revealSession(sessionId?: string): Promise<void>;
  public abstract resetWorkspace(): Promise<void>;
  public abstract restartSession(sessionId: string): Promise<void>;
  public abstract restartSessionFromCommand(sessionId?: string): Promise<void>;
  public abstract renameSession(sessionId: string, title: string): Promise<void>;
  public abstract promptRenameSession(sessionId: string): Promise<void>;
  public abstract promptRenameFocusedSession(): Promise<void>;
  public abstract closeSession(sessionId: string): Promise<void>;
  public abstract copyResumeCommand(sessionId: string): Promise<void>;
  public abstract setVisibleCount(visibleCount: VisibleSessionCount): Promise<void>;
  public abstract toggleFullscreenSession(): Promise<void>;
  public abstract setViewMode(viewMode: TerminalViewMode): Promise<void>;
  public abstract openSettings(): Promise<void>;
  public abstract toggleCompletionBell(): Promise<void>;
  public abstract runSidebarCommand(commandId: string): Promise<void>;
  public abstract runSidebarAgent(agentId: string): Promise<void>;
  public abstract restorePreviousSession(historyId: string): Promise<void>;
  public abstract deletePreviousSession(historyId: string): Promise<void>;
  public abstract clearGeneratedPreviousSessions(): Promise<void>;
  public abstract saveScratchPad(content: string): Promise<void>;
  public abstract saveSidebarCommand(
    commandId: string | undefined,
    name: string,
    actionType: "browser" | "terminal",
    closeTerminalOnExit: boolean,
    command?: string,
    url?: string,
  ): Promise<void>;
  public abstract deleteSidebarCommand(commandId: string): Promise<void>;
  public abstract syncSidebarCommandOrder(commandIds: readonly string[]): Promise<void>;
  public abstract saveSidebarAgent(
    agentId: string | undefined,
    name: string,
    command: string,
  ): Promise<void>;
  public abstract deleteSidebarAgent(agentId: string): Promise<void>;
  public abstract focusGroup(groupId: string): Promise<void>;
  public abstract focusGroupByIndex(groupIndex: number): Promise<void>;
  public abstract renameGroup(groupId: string, title: string): Promise<void>;
  public abstract syncSessionOrder(groupId: string, sessionIds: readonly string[]): Promise<void>;
  public abstract syncGroupOrder(groupIds: readonly string[]): Promise<void>;
  public abstract moveSessionToGroup(
    sessionId: string,
    groupId: string,
    targetIndex?: number,
  ): Promise<void>;
  public abstract createGroupFromSession(sessionId: string): Promise<void>;
  public abstract createSessionInGroup(groupId: string): Promise<void>;
  public abstract closeGroup(groupId: string): Promise<void>;

  protected captureTraceState(): {
    activeSnapshot: ReturnType<typeof captureSnapshotTraceState>;
    backend: ReturnType<TerminalWorkspaceBackend["getDebugState"]>;
    browser: ReturnType<BrowserSessionManager["getDebugState"]>;
    ownsNativeTerminalControl: boolean;
    sidebar: {
      groups: SidebarSessionGroup[];
      hud: SidebarHydrateMessage["hud"];
    };
    store: {
      activeGroupId: string;
      groups: Array<{
        focusedSessionId?: string;
        fullscreenRestoreVisibleCount?: VisibleSessionCount;
        groupId: string;
        sessions: Array<{
          alias: string;
          displayId: string;
          kind: SessionRecord["kind"];
          sessionId: string;
          slotIndex: number;
          title: string;
        }>;
        title: string;
        viewMode: TerminalViewMode;
        visibleCount: VisibleSessionCount;
        visibleSessionIds: string[];
      }>;
    };
    t3: ReturnType<T3WebviewManager["getDebugState"]>;
    workbench: ReturnType<typeof captureWorkbenchState>;
    workspaceId: string;
  } {
    const sidebarState = this.createSidebarMessage("sessionState") as SidebarSessionStateMessage;
    return captureControllerTraceState({
      activeSnapshot: this.getActiveSnapshot(),
      allSessionRecords: this.getAllSessionRecords(),
      backendState: this.backend.getDebugState(),
      browserState: this.browserSessions.getDebugState(),
      ownsNativeTerminalControl: this.ownsNativeTerminalControl,
      sidebarGroups: sidebarState.groups,
      sidebarHud: sidebarState.hud,
      storeSnapshot: this.store.getSnapshot(),
      t3State: this.t3Webviews.getDebugState(),
      workspaceId: this.workspaceId,
    });
  }

  protected captureSnapshotTraceState(snapshot: SessionGridSnapshot): {
    expectedProjection: {
      browser: Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>;
      focusedSessionId?: string;
      t3: Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>;
      terminals: Array<{
        isFocused: boolean;
        isVisible: boolean;
        sessionId: string;
        targetGroupIndex: number;
      }>;
      viewMode: TerminalViewMode;
      visibleCount: VisibleSessionCount;
      visibleSessionIds: string[];
    };
    focusedSessionId?: string;
    fullscreenRestoreVisibleCount?: VisibleSessionCount;
    sessions: Array<{
      alias: string;
      displayId: string;
      kind: SessionRecord["kind"];
      sessionId: string;
      slotIndex: number;
      title: string;
    }>;
    viewMode: TerminalViewMode;
    visibleCount: VisibleSessionCount;
    visibleSessionIds: string[];
  } {
    return captureSnapshotTraceState(snapshot, this.getAllSessionRecords());
  }
}
