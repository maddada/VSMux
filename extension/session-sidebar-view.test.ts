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
  test("should accept forkSession messages with a session id", () => {
    expect(
      isSidebarMessage({
        sessionId: "session-7",
        type: "forkSession",
      }),
    ).toBe(true);
  });

  test("should reject forkSession messages without a session id", () => {
    expect(
      isSidebarMessage({
        sessionId: "",
        type: "forkSession",
      }),
    ).toBe(false);
  });

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

  test("should accept setSessionFavorite messages with a boolean favorite value", () => {
    expect(
      isSidebarMessage({
        favorite: true,
        sessionId: "session-7",
        type: "setSessionFavorite",
      }),
    ).toBe(true);
  });

  test("should reject setSessionFavorite messages without a boolean favorite value", () => {
    expect(
      isSidebarMessage({
        favorite: "yes",
        sessionId: "session-7",
        type: "setSessionFavorite",
      }),
    ).toBe(false);
  });
});
