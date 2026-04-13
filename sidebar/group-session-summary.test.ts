import { describe, expect, test } from "vite-plus/test";
import type { SidebarSessionItem } from "../shared/session-grid-contract";
import { getGroupSessionSummary } from "./group-session-summary";

describe("getGroupSessionSummary", () => {
  test("should count working sessions as active and attention sessions as done", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { activity: "working", lifecycleState: "running" }),
        createSession("session-2", { activity: "working", lifecycleState: "running" }),
        createSession("session-3", { activity: "attention", lifecycleState: "done" }),
      ]),
    ).toEqual({
      activeCount: 2,
      doneCount: 1,
    });
  });

  test("should ignore lifecycle state when the card activity is idle", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", { activity: "idle", lifecycleState: "running" }),
        createSession("session-2", { activity: "idle", lifecycleState: "done" }),
        createSession("session-3", { activity: "working", lifecycleState: "done" }),
        createSession("session-4", { activity: "attention", lifecycleState: "running" }),
      ]),
    ).toEqual({
      activeCount: 1,
      doneCount: 1,
    });
  });

  test("should ignore sleeping and error sessions in the collapsed summary", () => {
    expect(
      getGroupSessionSummary([
        createSession("session-1", {
          activity: "idle",
          lifecycleState: "sleeping",
          isRunning: true,
          isSleeping: true,
        }),
        createSession("session-2", {
          activity: "idle",
          lifecycleState: "sleeping",
          isRunning: false,
          isSleeping: true,
        }),
        createSession("session-3", { activity: "idle", lifecycleState: "done", isRunning: false }),
        createSession("session-4", { activity: "idle", lifecycleState: "error", isRunning: false }),
      ]),
    ).toEqual({
      activeCount: 0,
      doneCount: 0,
    });
  });
});

function createSession(
  sessionId: string,
  overrides: Partial<SidebarSessionItem>,
): SidebarSessionItem {
  return {
    activity: "idle",
    activityLabel: undefined,
    alias: sessionId,
    column: 0,
    isFocused: false,
    lifecycleState: "running",
    isRunning: true,
    isVisible: false,
    primaryTitle: sessionId,
    row: 0,
    sessionId,
    shortcutLabel: "⌘⌥1",
    ...overrides,
  };
}
