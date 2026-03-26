import * as vscode from "vscode";
import {
  type VisibleSessionCount,
  type TerminalViewMode,
} from "../../shared/session-grid-contract";
import { NativeTerminalWorkspaceControllerSessionActions } from "./controller-session-actions";

export abstract class NativeTerminalWorkspaceControllerGroupActions extends NativeTerminalWorkspaceControllerSessionActions {
  public async setVisibleCount(visibleCount: VisibleSessionCount): Promise<void> {
    await this.runLoggedAction("setVisibleCount", { visibleCount }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      await this.store.setVisibleCount(visibleCount);
      await operation.step("after-store-set-visible-count", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async toggleFullscreenSession(): Promise<void> {
    await this.runLoggedAction("toggleFullscreenSession", undefined, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      await this.store.toggleFullscreenSession();
      await operation.step("after-store-toggle-fullscreen", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async setViewMode(viewMode: TerminalViewMode): Promise<void> {
    await this.runLoggedAction("setViewMode", { viewMode }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      await this.store.setViewMode(viewMode);
      await operation.step("after-store-set-view-mode", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async focusGroup(groupId: string): Promise<void> {
    await this.runLoggedAction("focusGroup", { groupId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      if (!this.store.getGroup(groupId)) {
        await operation.step("group-not-found");
        return;
      }

      await this.store.focusGroup(groupId);
      await operation.step("after-store-focus-group", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async focusGroupByIndex(groupIndex: number): Promise<void> {
    await this.runLoggedAction("focusGroupByIndex", { groupIndex }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      if (!this.store.getSnapshot().groups[groupIndex - 1]) {
        await operation.step("group-index-not-found");
        return;
      }

      await this.store.focusGroupByIndex(groupIndex);
      await operation.step("after-store-focus-group-index", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async renameGroup(groupId: string, title: string): Promise<void> {
    if (!(await this.ensureNativeTerminalControl())) {
      return;
    }

    const changed = await this.store.renameGroup(groupId, title);
    if (!changed) {
      return;
    }

    await this.refreshSidebar();
  }

  public async syncSessionOrder(groupId: string, sessionIds: readonly string[]): Promise<void> {
    await this.runLoggedAction("syncSessionOrder", { groupId, sessionIds }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const changed = await this.store.syncSessionOrder(groupId, sessionIds);
      await operation.step("after-store-sync-session-order", {
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

  public async syncGroupOrder(groupIds: readonly string[]): Promise<void> {
    await this.runLoggedAction("syncGroupOrder", { groupIds }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const changed = await this.store.syncGroupOrder(groupIds);
      await operation.step("after-store-sync-group-order", { changed });
      if (!changed) {
        return;
      }

      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async moveSessionToGroup(
    sessionId: string,
    groupId: string,
    targetIndex?: number,
  ): Promise<void> {
    await this.runLoggedAction(
      "moveSessionToGroup",
      {
        groupId,
        sessionId,
        targetIndex,
      },
      async (operation) => {
        if (!(await this.ensureNativeTerminalControl())) {
          await operation.step("ensure-native-terminal-control-blocked");
          return;
        }

        const changed = await this.store.moveSessionToGroup(sessionId, groupId, targetIndex);
        if (!changed) {
          await operation.step("store-move-no-change");
          return;
        }

        await operation.step("after-store-move", {
          expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
        });
        await this.reconcileProjectedSessions();
        await operation.step("after-reconcile");
        await this.refreshSidebar();
        await operation.step("after-refresh-sidebar");
      },
    );
  }

  public async createGroupFromSession(sessionId: string): Promise<void> {
    await this.runLoggedAction("createGroupFromSession", { sessionId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const groupId = await this.store.createGroupFromSession(sessionId);
      if (!groupId) {
        await operation.step("group-not-created");
        return;
      }

      await operation.step("after-store-create-group", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
        groupId,
      });
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async createSessionInGroup(groupId: string): Promise<void> {
    await this.runLoggedAction("createSessionInGroup", { groupId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      if (!this.store.getGroup(groupId)) {
        await operation.step("group-not-found");
        return;
      }

      const previousVisibleSessionIds = this.getActiveSnapshot().visibleSessionIds;
      await this.store.focusGroup(groupId);
      await operation.step("after-store-focus-group", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
      });

      const sessionRecord = await this.store.createSession();
      if (!sessionRecord) {
        await operation.step("session-limit-reached");
        void vscode.window.showWarningMessage("The workspace already has 9 sessions.");
        await this.updateFocusedTerminal(previousVisibleSessionIds, false);
        await operation.step("after-update-focused-terminal");
        await this.refreshSidebar();
        await operation.step("after-refresh-sidebar");
        return;
      }

      await this.backend.createOrAttachSession(sessionRecord);
      await operation.step("after-create-or-attach-session");
      await this.updateFocusedTerminal(previousVisibleSessionIds, false);
      await operation.step("after-update-focused-terminal");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }

  public async closeGroup(groupId: string): Promise<void> {
    await this.runLoggedAction("closeGroup", { groupId }, async (operation) => {
      if (!(await this.ensureNativeTerminalControl())) {
        await operation.step("ensure-native-terminal-control-blocked");
        return;
      }

      const group = this.store.getGroup(groupId);
      if (!group || this.store.getSnapshot().groups.length <= 1) {
        await operation.step("group-not-closable");
        return;
      }

      const archivedSessions = group.snapshot.sessions.flatMap((sessionRecord) => {
        const archivedSession = this.createPreviousSessionEntry(group, sessionRecord);
        return archivedSession ? [archivedSession] : [];
      });
      for (const sessionRecord of group.snapshot.sessions) {
        await this.t3Webviews.disposeSession(sessionRecord.sessionId);
        await this.browserSessions.disposeSession(sessionRecord.sessionId);
        await this.backend.killSession(sessionRecord.sessionId);
        await this.deleteSessionAgentCommand(sessionRecord.sessionId);
        this.terminalTitleBySessionId.delete(sessionRecord.sessionId);
        this.titleDerivedActivityBySessionId.delete(sessionRecord.sessionId);
        this.sidebarAgentIconBySessionId.delete(sessionRecord.sessionId);
      }

      const removed = await this.store.removeGroup(groupId);
      await operation.step("after-store-remove-group", {
        expected: this.captureSnapshotTraceState(this.getActiveSnapshot()),
        removed,
      });
      if (!removed) {
        return;
      }

      await this.previousSessionHistory.append(archivedSessions);
      await this.reconcileProjectedSessions();
      await operation.step("after-reconcile");
      await this.refreshSidebar();
      await operation.step("after-refresh-sidebar");
    });
  }
}
