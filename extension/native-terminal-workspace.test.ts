import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const testState = vi.hoisted(() => ({
  backend: undefined as
    | {
        acknowledgeAttention: ReturnType<typeof vi.fn>;
        canReuseVisibleLayout: ReturnType<typeof vi.fn>;
        createOrAttachSession: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
        focusSession: ReturnType<typeof vi.fn>;
        getLastTerminalActivityAt: ReturnType<typeof vi.fn>;
        getSessionSnapshot: ReturnType<typeof vi.fn>;
        initialize: ReturnType<typeof vi.fn>;
        killSession: ReturnType<typeof vi.fn>;
        onDidActivateSession: ReturnType<typeof vi.fn>;
        onDidChangeSessionTitle: ReturnType<typeof vi.fn>;
        onDidChangeSessions: ReturnType<typeof vi.fn>;
        reconcileVisibleTerminals: ReturnType<typeof vi.fn>;
        renameSession: ReturnType<typeof vi.fn>;
        restartSession: ReturnType<typeof vi.fn>;
        syncConfiguration: ReturnType<typeof vi.fn>;
        writeText: ReturnType<typeof vi.fn>;
      }
    | undefined,
  configValues: new Map<string, unknown>(),
  createTerminal: vi.fn(),
  createdTerminals: [] as Array<{
    dispose: ReturnType<typeof vi.fn>;
    exitStatus: unknown;
    options: unknown;
    sendText: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
  }>,
  executeCommand: vi.fn(),
  activeColorTheme: {
    kind: 1,
  },
  onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  showInformationMessage: vi.fn(),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  showWarningMessage: vi.fn(),
  sidebarPostMessage: vi.fn(async () => {}),
}));

vi.mock("vscode", () => ({
  ColorThemeKind: {
    Light: 1,
  },
  ThemeIcon: class ThemeIcon {},
  ViewColumn: {
    One: 1,
    Nine: 9,
  },
  TerminalLocation: {
    Panel: "panel",
  },
  commands: {
    executeCommand: testState.executeCommand,
  },
  window: {
    activeColorTheme: testState.activeColorTheme,
    createTerminal: testState.createTerminal,
    onDidChangeActiveColorTheme: testState.onDidChangeActiveColorTheme,
    showInformationMessage: testState.showInformationMessage,
    showInputBox: testState.showInputBox,
    showQuickPick: testState.showQuickPick,
    showWarningMessage: testState.showWarningMessage,
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (key: string, defaultValue?: unknown) =>
        testState.configValues.has(key) ? testState.configValues.get(key) : defaultValue,
    })),
    isTrusted: true,
    onDidChangeConfiguration: testState.onDidChangeConfiguration,
    workspaceFile: undefined,
    workspaceFolders: [
      {
        uri: {
          fsPath: "/workspace",
          toString: () => "file:///workspace",
        },
      },
    ],
  },
}));

vi.mock("./session-sidebar-view", () => ({
  SessionSidebarViewProvider: class SessionSidebarViewProvider {
    public async postMessage(message: unknown): Promise<void> {
      await testState.sidebarPostMessage(message);
    }

    public async reveal(): Promise<void> {}

    public dispose(): void {}
  },
}));

vi.mock("./native-terminal-workspace-backend", () => ({
  NativeTerminalWorkspaceBackend: class NativeTerminalWorkspaceBackend {
    public constructor() {
      testState.backend = {
        acknowledgeAttention: vi.fn(async () => false),
        canReuseVisibleLayout: vi.fn(() => true),
        createOrAttachSession: vi.fn(),
        dispose: vi.fn(),
        focusSession: vi.fn(async () => true),
        getLastTerminalActivityAt: vi.fn(),
        getSessionSnapshot: vi.fn(() => undefined),
        initialize: vi.fn(),
        killSession: vi.fn(),
        onDidActivateSession: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeSessionTitle: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeSessions: vi.fn(() => ({ dispose: vi.fn() })),
        reconcileVisibleTerminals: vi.fn(),
        renameSession: vi.fn(),
        restartSession: vi.fn(),
        syncConfiguration: vi.fn(),
        writeText: vi.fn(),
      };

      return testState.backend;
    }
  },
}));

import type { GroupedSessionWorkspaceSnapshot } from "../shared/session-grid-contract";
import {
  createSessionAlias,
  createDefaultGroupedSessionWorkspaceSnapshot,
  createDefaultSessionGridSnapshot,
  createSessionRecord,
} from "../shared/session-grid-contract";
import { NativeTerminalWorkspaceController } from "./native-terminal-workspace";

describe("NativeTerminalWorkspaceController rename session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    testState.backend = undefined;
    testState.configValues.clear();
    testState.createdTerminals.length = 0;
    testState.createTerminal.mockReset();
    testState.createTerminal.mockImplementation((options: unknown) => {
      const terminal = {
        dispose: vi.fn(),
        exitStatus: undefined,
        options,
        sendText: vi.fn(),
        show: vi.fn(),
      };
      testState.createdTerminals.push(terminal);
      return terminal;
    });
    testState.executeCommand.mockReset();
    testState.onDidChangeActiveColorTheme.mockClear();
    testState.onDidChangeConfiguration.mockClear();
    testState.showInformationMessage.mockReset();
    testState.showInputBox.mockReset();
    testState.showQuickPick.mockReset();
    testState.showWarningMessage.mockReset();
    testState.sidebarPostMessage.mockReset();
    testState.sidebarPostMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should still stage /rename when the submitted alias is unchanged", async () => {
    testState.configValues.set("sendRenameCommandOnSidebarRename", true);
    const session = {
      ...createSessionRecord(3, 0),
      alias: "Harbor Vale",
    };
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));

    testState.showInputBox.mockResolvedValue(session.alias);

    await controller.promptRenameSession(session.sessionId);

    expect(testState.backend?.writeText).toHaveBeenCalledWith(
      session.sessionId,
      `/rename ${session.alias}`,
      false,
    );
    expect(testState.backend?.renameSession).not.toHaveBeenCalled();
  });

  test("should run sidebar commands in a new panel terminal instead of the VSmux backend", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(
      createContext(workspaceSnapshot, [
        [
          "VSmux.sidebarCommands",
          [
            {
              closeTerminalOnExit: false,
              command: "vp dev",
              commandId: "dev",
              isDefault: true,
              name: "Dev",
            },
          ],
        ],
      ]),
    );

    await controller.runSidebarCommand("dev");

    expect(testState.createTerminal).toHaveBeenCalledTimes(1);
    expect(testState.createdTerminals[0]?.options).toMatchObject({
      cwd: "/workspace",
      isTransient: true,
      location: "panel",
      name: "VSmux: Dev",
    });
    expect(testState.createdTerminals[0]?.show).toHaveBeenCalledWith(true);
    expect(testState.createdTerminals[0]?.sendText).toHaveBeenCalledWith("vp dev", true);
    expect(testState.backend?.writeText).not.toHaveBeenCalled();
  });

  test("should dispose the new panel terminal when close-after-run is enabled", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(
      createContext(workspaceSnapshot, [
        [
          "VSmux.sidebarCommands",
          [
            {
              closeTerminalOnExit: true,
              command: "vp test",
              commandId: "test",
              isDefault: true,
              name: "Test",
            },
          ],
        ],
      ]),
    );

    await controller.runSidebarCommand("test");

    const terminal = testState.createdTerminals[0];
    expect(terminal?.options).toMatchObject({
      cwd: "/workspace",
      isTransient: true,
      location: "panel",
      name: "VSmux: Test",
      shellArgs: ["-l", "-c", "vp test"],
    });
    expect(terminal?.sendText).not.toHaveBeenCalled();
    terminal!.exitStatus = { code: 0 };
    await vi.advanceTimersByTimeAsync(250);

    expect(terminal?.dispose).toHaveBeenCalledTimes(1);
    expect(testState.backend?.writeText).not.toHaveBeenCalled();
  });

  test("should keep the generated alias and attach the selected agent icon for sidebar agents", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));
    const generatedAlias = createSessionAlias(4, 1);

    await controller.runSidebarAgent("codex");

    expect(testState.backend?.createOrAttachSession).toHaveBeenCalledTimes(1);
    expect(testState.backend?.createOrAttachSession.mock.calls[0]?.[0]).toMatchObject({
      alias: generatedAlias,
      sessionId: "session-4",
      title: "Session 4",
    });
    expect(testState.sidebarPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        groups: expect.arrayContaining([
          expect.objectContaining({
            sessions: expect.arrayContaining([
              expect.objectContaining({
                agentIcon: "codex",
                alias: generatedAlias,
                sessionId: "session-4",
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(testState.backend?.writeText).toHaveBeenCalledWith("session-4", "codex", true);
  });

  test("should recreate a missing terminal when clicking an already-focused exited session", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    workspaceSnapshot.groups[0]!.snapshot.focusedSessionId = session.sessionId;
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));

    testState.backend?.getSessionSnapshot.mockReturnValue({
      status: "exited",
    });

    await controller.focusSession(session.sessionId);

    expect(testState.backend?.focusSession).not.toHaveBeenCalled();
    expect(testState.backend?.reconcileVisibleTerminals).toHaveBeenCalledTimes(1);
  });

  test("should re-focus the running terminal when clicking an already-focused live session", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    workspaceSnapshot.groups[0]!.snapshot.focusedSessionId = session.sessionId;
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));

    testState.backend?.getSessionSnapshot.mockReturnValue({
      status: "running",
    });
    testState.backend?.focusSession.mockResolvedValue(true);

    await controller.focusSession(session.sessionId);

    expect(testState.backend?.focusSession).toHaveBeenCalledWith(session.sessionId, false);
    expect(testState.backend?.reconcileVisibleTerminals).not.toHaveBeenCalled();
  });

  test("should send a codex resume command after recreating a closed sidebar-agent session", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));
    const generatedAlias = createSessionAlias(4, 1);

    await controller.runSidebarAgent("codex");

    testState.backend?.writeText.mockClear();
    testState.backend?.getSessionSnapshot.mockReturnValue({
      status: "exited",
    });

    await controller.focusSession("session-4");

    expect(testState.backend?.reconcileVisibleTerminals).toHaveBeenCalled();
    expect(testState.backend?.writeText).toHaveBeenCalledWith(
      "session-4",
      `codex resume '${generatedAlias}'`,
      true,
    );
  });

  test("should send a claude resume command after recreating a closed claude session", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));
    const generatedAlias = createSessionAlias(4, 1);

    await controller.runSidebarAgent("claude");

    testState.backend?.writeText.mockClear();
    testState.backend?.getSessionSnapshot.mockReturnValue({
      status: "exited",
    });

    await controller.focusSession("session-4");

    expect(testState.backend?.writeText).toHaveBeenCalledWith(
      "session-4",
      `claude -r '${generatedAlias}'`,
      true,
    );
  });

  test("should send an opencode continue command after recreating a closed opencode session", async () => {
    const session = createSessionRecord(3, 0);
    const workspaceSnapshot = createWorkspaceSnapshot(session);
    const controller = new NativeTerminalWorkspaceController(createContext(workspaceSnapshot));

    await controller.runSidebarAgent("opencode");

    testState.backend?.writeText.mockClear();
    testState.backend?.getSessionSnapshot.mockReturnValue({
      status: "exited",
    });

    await controller.focusSession("session-4");

    expect(testState.backend?.writeText).toHaveBeenCalledWith(
      "session-4",
      "opencode --continue",
      true,
    );
  });
});

function createWorkspaceSnapshot(
  session: ReturnType<typeof createSessionRecord>,
): GroupedSessionWorkspaceSnapshot {
  const snapshot = createDefaultGroupedSessionWorkspaceSnapshot();
  snapshot.groups[0] = {
    ...snapshot.groups[0],
    snapshot: {
      ...createDefaultSessionGridSnapshot(),
      sessions: [session],
      visibleSessionIds: [session.sessionId],
      visibleCount: 1,
    },
  };
  snapshot.nextSessionNumber = 4;
  return snapshot;
}

function createContext(
  snapshot: GroupedSessionWorkspaceSnapshot,
  extraWorkspaceEntries: ReadonlyArray<readonly [string, unknown]> = [],
) {
  const workspaceValues = new Map<string, unknown>([
    ["VSmux.sessionGridSnapshot", snapshot],
    ...extraWorkspaceEntries,
  ]);
  const globalValues = new Map<string, unknown>();

  return {
    extensionUri: {
      fsPath: "/extension",
      toString: () => "file:///extension",
    },
    globalState: {
      get: <T>(key: string, defaultValue?: T) =>
        (globalValues.has(key) ? globalValues.get(key) : defaultValue) as T,
      update: vi.fn(async (key: string, value: unknown) => {
        globalValues.set(key, value);
      }),
    },
    subscriptions: [],
    workspaceState: {
      get: <T>(key: string, defaultValue?: T) =>
        (workspaceValues.has(key) ? workspaceValues.get(key) : defaultValue) as T,
      update: vi.fn(async (key: string, value: unknown) => {
        workspaceValues.set(key, value);
      }),
    },
  };
}
