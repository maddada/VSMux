import { describe, expect, test } from "vite-plus/test";
import {
  createSidebarCommandButtons,
  normalizeStoredSidebarCommandOrder,
  normalizeStoredSidebarCommands,
} from "./sidebar-commands";

describe("createSidebarCommandButtons", () => {
  test("should expose the default command slots when no commands are configured", () => {
    expect(createSidebarCommandButtons([])).toEqual([
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
      },
    ]);
  });

  test("should merge configured defaults and append custom commands", () => {
    expect(
      createSidebarCommandButtons([
        {
          closeTerminalOnExit: false,
          command: "vp dev",
          commandId: "dev",
          isDefault: true,
          name: "App",
        },
        {
          closeTerminalOnExit: true,
          command: "vp run docs",
          commandId: "custom-docs",
          isDefault: false,
          name: "Docs",
        },
      ]),
    ).toEqual([
      {
        closeTerminalOnExit: false,
        command: "vp dev",
        commandId: "dev",
        isDefault: true,
        name: "App",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
      },
      {
        closeTerminalOnExit: true,
        command: "vp run docs",
        commandId: "custom-docs",
        isDefault: false,
        name: "Docs",
      },
    ]);
  });

  test("should respect a stored command order for defaults and custom commands", () => {
    expect(
      createSidebarCommandButtons(
        [
          {
            closeTerminalOnExit: true,
            command: "vp run docs",
            commandId: "custom-docs",
            isDefault: false,
            name: "Docs",
          },
        ],
        ["test", "custom-docs", "dev"],
      ),
    ).toEqual([
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "test",
        isDefault: true,
        name: "Test",
      },
      {
        closeTerminalOnExit: true,
        command: "vp run docs",
        commandId: "custom-docs",
        isDefault: false,
        name: "Docs",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "build",
        isDefault: true,
        name: "Build",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
      },
    ]);
  });

  test("should hide deleted default commands", () => {
    expect(createSidebarCommandButtons([], [], ["build", "test"])).toEqual([
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "dev",
        isDefault: true,
        name: "Dev",
      },
      {
        closeTerminalOnExit: false,
        command: undefined,
        commandId: "setup",
        isDefault: true,
        name: "Setup",
      },
    ]);
  });
});

describe("normalizeStoredSidebarCommands", () => {
  test("should ignore invalid entries and trim valid values", () => {
    expect(
      normalizeStoredSidebarCommands([
        {
          closeTerminalOnExit: false,
          command: "  vp dev  ",
          commandId: " dev ",
          isDefault: true,
          name: "  Dev server ",
        },
        {
          closeTerminalOnExit: "nope",
          command: "vp test",
          commandId: "test",
          isDefault: true,
          name: "Test",
        },
      ]),
    ).toEqual([
      {
        closeTerminalOnExit: false,
        command: "vp dev",
        commandId: "dev",
        isDefault: true,
        name: "Dev server",
      },
    ]);
  });
});

describe("normalizeStoredSidebarCommandOrder", () => {
  test("should ignore invalid ids, trim values, and dedupe entries", () => {
    expect(
      normalizeStoredSidebarCommandOrder([" test ", "", "dev", "test", 42, null]),
    ).toEqual(["test", "dev"]);
  });
});
