import { describe, expect, test } from "vite-plus/test";
import type { SidebarPreviousSessionItem } from "../shared/session-grid-contract";
import { filterPreviousSessions } from "./previous-session-search";

describe("filterPreviousSessions", () => {
  test("should fuzzy match aliases and secondary session text", () => {
    const previousSessions = [
      createPreviousSession({
        alias: "Adding prev sessions",
        detail: "Codex CLI",
        historyId: "history-1",
      }),
      createPreviousSession({
        alias: "Publish release prep",
        detail: "Claude Code",
        historyId: "history-2",
      }),
    ];

    expect(filterPreviousSessions(previousSessions, "ad pvs")).toMatchObject([
      { historyId: "history-1" },
    ]);
    expect(filterPreviousSessions(previousSessions, "cld")).toMatchObject([
      { historyId: "history-2" },
    ]);
  });
});

function createPreviousSession(
  overrides: Partial<SidebarPreviousSessionItem>,
): SidebarPreviousSessionItem {
  return {
    activity: "idle",
    alias: "Atlas",
    closedAt: "2026-03-24T10:00:00.000Z",
    column: 0,
    historyId: "history",
    isFocused: false,
    isGeneratedName: false,
    isRestorable: true,
    isRunning: false,
    isVisible: false,
    row: 0,
    sessionId: "session-1",
    shortcutLabel: "⌘⌥1",
    ...overrides,
  };
}
