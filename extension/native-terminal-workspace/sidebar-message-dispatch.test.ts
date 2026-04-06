import { describe, expect, test, vi } from "vite-plus/test";
import { dispatchSidebarMessage, type SidebarMessageHandlers } from "./sidebar-message-dispatch";

function createHandlers(): SidebarMessageHandlers {
  return {
    adjustTerminalFontSize: vi.fn(async () => undefined),
    cancelSidebarGitCommit: vi.fn(async () => undefined),
    clearGeneratedPreviousSessions: vi.fn(async () => undefined),
    clearStartupSidebarRefreshes: vi.fn(() => undefined),
    closeGroup: vi.fn(async () => undefined),
    closeSession: vi.fn(async () => undefined),
    confirmSidebarGitCommit: vi.fn(async () => undefined),
    copyResumeCommand: vi.fn(async () => undefined),
    createGroup: vi.fn(async () => undefined),
    createGroupFromSession: vi.fn(async () => undefined),
    createSession: vi.fn(async () => undefined),
    createSessionInGroup: vi.fn(async () => undefined),
    deletePreviousSession: vi.fn(async () => undefined),
    deleteSidebarAgent: vi.fn(async () => undefined),
    deleteSidebarCommand: vi.fn(async () => undefined),
    focusGroup: vi.fn(async () => undefined),
    focusSession: vi.fn(async () => undefined),
    fullReloadSession: vi.fn(async () => undefined),
    killDaemonSession: vi.fn(async () => undefined),
    killTerminalDaemon: vi.fn(async () => undefined),
    moveSessionToGroup: vi.fn(async () => undefined),
    moveSidebarToOtherSide: vi.fn(async () => undefined),
    openBrowser: vi.fn(async () => undefined),
    openSettings: vi.fn(async () => undefined),
    promptRenameSession: vi.fn(async () => undefined),
    refreshDaemonSessions: vi.fn(async () => undefined),
    refreshGitState: vi.fn(async () => undefined),
    refreshSidebarHydrate: vi.fn(async () => undefined),
    renameGroup: vi.fn(async () => undefined),
    renameSession: vi.fn(async () => undefined),
    restartSession: vi.fn(async () => undefined),
    restorePreviousSession: vi.fn(async () => undefined),
    runSidebarAgent: vi.fn(async () => undefined),
    runSidebarCommand: vi.fn(async () => undefined),
    runSidebarGitAction: vi.fn(async () => undefined),
    saveScratchPad: vi.fn(async () => undefined),
    saveSidebarAgent: vi.fn(async () => undefined),
    saveSidebarCommand: vi.fn(async () => undefined),
    setSidebarGitCommitConfirmationEnabled: vi.fn(async () => undefined),
    setSidebarGitPrimaryAction: vi.fn(async () => undefined),
    setSidebarSectionCollapsed: vi.fn(async () => undefined),
    setT3SessionThreadId: vi.fn(async () => undefined),
    setViewMode: vi.fn(async () => undefined),
    setVisibleCount: vi.fn(async () => undefined),
    syncGroupOrder: vi.fn(async () => undefined),
    syncSessionOrder: vi.fn(async () => undefined),
    syncSidebarAgentOrder: vi.fn(async () => undefined),
    syncSidebarCommandOrder: vi.fn(async () => undefined),
    toggleCompletionBell: vi.fn(async () => undefined),
    toggleFullscreenSession: vi.fn(async () => undefined),
  };
}

describe("dispatchSidebarMessage", () => {
  test("should route setT3SessionThreadId to the matching handler", async () => {
    const handlers = createHandlers();

    await dispatchSidebarMessage(
      {
        sessionId: "session-3",
        type: "setT3SessionThreadId",
      },
      handlers,
    );

    expect(handlers.clearStartupSidebarRefreshes).toHaveBeenCalledTimes(1);
    expect(handlers.setT3SessionThreadId).toHaveBeenCalledWith("session-3");
  });
});
