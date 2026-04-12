import { describe, expect, test } from "vite-plus/test";
import { createSessionFocusPlan } from "./session-focus";

describe("createSessionFocusPlan", () => {
  test("should skip workspace reveal for non-sidebar focus sources", () => {
    expect(
      createSessionFocusPlan({
        isWorkspacePanelVisible: false,
        source: "workspace",
      }),
    ).toEqual({
      shouldRevealWorkspacePanel: false,
    });
  });

  test("should reveal the workspace when the sidebar refocuses a session while the panel is hidden", () => {
    expect(
      createSessionFocusPlan({
        isWorkspacePanelVisible: false,
        source: "sidebar",
      }),
    ).toEqual({
      shouldRevealWorkspacePanel: true,
    });
  });

  test("should keep the current behavior when the workspace panel is already visible", () => {
    expect(
      createSessionFocusPlan({
        isWorkspacePanelVisible: true,
        source: "sidebar",
      }),
    ).toEqual({
      shouldRevealWorkspacePanel: false,
    });
  });
});
