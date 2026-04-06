import { describe, expect, test, vi } from "vite-plus/test";
import { isSidebarMessage } from "./session-sidebar-view";

vi.mock("vscode", () => ({
  extensions: {
    all: [],
    getExtension: () => undefined,
  },
  Uri: {
    joinPath: (...parts: unknown[]) => parts,
  },
}));

describe("isSidebarMessage", () => {
  test("should accept setT3SessionThreadId messages with a session id", () => {
    expect(
      isSidebarMessage({
        sessionId: "session-7",
        type: "setT3SessionThreadId",
      }),
    ).toBe(true);
  });

  test("should reject setT3SessionThreadId messages without a session id", () => {
    expect(
      isSidebarMessage({
        sessionId: "",
        type: "setT3SessionThreadId",
      }),
    ).toBe(false);
  });
});
