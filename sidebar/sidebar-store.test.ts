import { beforeEach, describe, expect, test } from "vite-plus/test";
import type {
  SidebarHydrateMessage,
  SidebarSessionGroup,
  SidebarSessionItem,
} from "../shared/session-grid-contract";
import {
  createInitialSidebarStoreDataState,
  resetSidebarStore,
  useSidebarStore,
} from "./sidebar-store";

describe("sidebar store", () => {
  beforeEach(() => {
    resetSidebarStore();
  });

  test("should update only the targeted session record on sessionPresentationChanged", () => {
    useSidebarStore.getState().applySidebarMessage(
      createHydrateMessage([
        createGroup("group-1", [createSession("session-1", "groups"), createSession("session-2", "notes")]),
        createGroup("group-2", [createSession("session-3", "logs")]),
      ]),
    );

    const before = useSidebarStore.getState();
    const previousGroupsById = before.groupsById;
    const previousSessionIdsByGroup = before.sessionIdsByGroup;
    const previousSession = before.sessionsById["session-1"];
    const previousSiblingSession = before.sessionsById["session-2"];

    useSidebarStore.getState().applySessionPresentationMessage({
      session: {
        ...previousSession,
        primaryTitle: "updated groups",
      },
      type: "sessionPresentationChanged",
    });

    const after = useSidebarStore.getState();
    expect(after.groupsById).toBe(previousGroupsById);
    expect(after.sessionIdsByGroup).toBe(previousSessionIdsByGroup);
    expect(after.sessionsById["session-1"]).not.toBe(previousSession);
    expect(after.sessionsById["session-1"]?.primaryTitle).toBe("updated groups");
    expect(after.sessionsById["session-2"]).toBe(previousSiblingSession);
  });
});

function createHydrateMessage(groups: SidebarSessionGroup[]): SidebarHydrateMessage {
  return {
    groups,
    hud: createInitialSidebarStoreDataState().hud,
    previousSessions: [],
    revision: 1,
    scratchPadContent: "",
    type: "hydrate",
  };
}

function createGroup(groupId: string, sessions: SidebarSessionItem[]): SidebarSessionGroup {
  return {
    groupId,
    isActive: groupId === "group-1",
    isFocusModeActive: false,
    layoutVisibleCount: 1,
    sessions,
    title: groupId === "group-1" ? "Main" : "Group 2",
    viewMode: "grid",
    visibleCount: 1,
  };
}

function createSession(sessionId: string, primaryTitle: string): SidebarSessionItem {
  return {
    activity: sessionId === "session-1" ? "working" : "idle",
    activityLabel: sessionId === "session-1" ? "Codex active" : undefined,
    alias: primaryTitle,
    column: 0,
    isFocused: sessionId === "session-1",
    isRunning: sessionId === "session-1",
    isVisible: sessionId === "session-1",
    primaryTitle,
    row: 0,
    sessionId,
    shortcutLabel: "⌘⌥1",
  };
}
