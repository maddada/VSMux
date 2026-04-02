import { describe, expect, test, vi } from "vite-plus/test";
import { createDisconnectedSessionSnapshot } from "./terminal-workspace-environment";
import { applyPersistedSessionStateToDisconnectedSnapshot } from "./daemon-terminal-workspace-backend";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: () => 5,
    }),
    workspaceFolders: undefined,
  },
}));

describe("applyPersistedSessionStateToDisconnectedSnapshot", () => {
  test("should carry persisted terminal title and agent state into a disconnected snapshot", () => {
    const snapshot = createDisconnectedSessionSnapshot("session-00", "workspace-1");

    expect(
      applyPersistedSessionStateToDisconnectedSnapshot(snapshot, {
        agentName: "codex",
        agentStatus: "attention",
        title: "Claude Code",
      }),
    ).toEqual({
      ...snapshot,
      agentName: "codex",
      agentStatus: "attention",
      title: "Claude Code",
    });
  });
});
