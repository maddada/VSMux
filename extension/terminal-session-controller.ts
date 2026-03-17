import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type {
  CanvasWorkspaceSnapshot,
  ExtensionToWebviewMessage,
  TerminalTileModel,
} from "../shared/canvas-contract";
import type {
  TerminalOutputMessage,
  TerminalSessionSnapshot,
  TerminalSessionsByTileId,
} from "../shared/terminal-host-protocol";
import { TerminalHostClient } from "./terminal-host-client";

const OUTPUT_FLUSH_INTERVAL_MS = 16;
const HISTORY_FILE_NAME = "history.log";
const METADATA_FILE_NAME = "metadata.json";
const RESIZE_DEBOUNCE_MS = 72;

type TerminalSessionControllerOptions = {
  context: vscode.ExtensionContext;
  postMessage: (
    message: ExtensionToWebviewMessage,
  ) => Thenable<boolean> | Promise<boolean> | boolean;
};

export class TerminalSessionController implements vscode.Disposable {
  private hasApprovedUntrustedShells = vscode.workspace.isTrusted;
  private readonly client: TerminalHostClient;
  private outputFlushTimer: NodeJS.Timeout | undefined;
  private readonly pendingOutput = new Map<string, string>();
  private reconcileChain = Promise.resolve();
  private readonly resizeTimers = new Map<string, NodeJS.Timeout>();
  private readonly sessions = new Map<string, TerminalSessionSnapshot>();
  private readonly persistedSessionRoot: string;
  private isInitialSnapshot = true;
  private knownSnapshotTileIds = new Set<string>();
  private readonly workspaceId: string;

  public constructor(private readonly options: TerminalSessionControllerOptions) {
    this.client = new TerminalHostClient({
      daemonScriptPath: path.join(
        options.context.extensionUri.fsPath,
        "out",
        "extension",
        "terminal-host-daemon.js",
      ),
      storagePath: options.context.globalStorageUri.fsPath,
    });
    this.workspaceId = getWorkspaceId();
    this.persistedSessionRoot = path.join(
      options.context.globalStorageUri.fsPath,
      "terminal-host-daemon",
      "terminal-history",
      this.workspaceId,
    );

    this.client.on("sessionOutput", (event) => {
      const currentOutput = this.pendingOutput.get(event.sessionId) ?? "";
      this.pendingOutput.set(event.sessionId, `${currentOutput}${event.data}`);
      this.scheduleOutputFlush();
    });

    this.client.on("sessionState", (event) => {
      if (event.session.workspaceId !== this.workspaceId) {
        return;
      }

      this.upsertSession(event.session);
      void this.postMessage({
        session: event.session,
        type: "terminalSessionState",
      });
    });
  }

  public dispose(): void {
    clearTimeout(this.outputFlushTimer);

    for (const resizeTimer of this.resizeTimers.values()) {
      clearTimeout(resizeTimer);
    }

    void this.client.dispose();
  }

  public getSessionsByTileId(): TerminalSessionsByTileId {
    return Object.fromEntries(this.sessions.entries());
  }

  public async handleInput(tileId: string, data: string): Promise<void> {
    const session = this.sessions.get(tileId);
    if (!session || session.status !== "running" || data.length === 0) {
      return;
    }

    await this.client.write(tileId, data);
  }

  public handleResize(tileId: string, cols: number, rows: number): void {
    const session = this.sessions.get(tileId);
    if (!session || session.restoreState !== "live") {
      return;
    }

    const currentTimer = this.resizeTimers.get(tileId);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const nextCols = Math.max(20, Math.floor(cols));
    const nextRows = Math.max(8, Math.floor(rows));

    this.resizeTimers.set(
      tileId,
      setTimeout(() => {
        this.resizeTimers.delete(tileId);
        void this.client.resize(tileId, nextCols, nextRows);
      }, RESIZE_DEBOUNCE_MS),
    );
  }

  public async handleRestart(
    tileId: string,
    snapshot: CanvasWorkspaceSnapshot,
  ): Promise<TerminalSessionSnapshot | undefined> {
    const tile = snapshot.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) {
      return undefined;
    }

    const currentSession = this.sessions.get(tileId);
    const pendingResizeTimer = this.resizeTimers.get(tileId);
    if (pendingResizeTimer) {
      clearTimeout(pendingResizeTimer);
      this.resizeTimers.delete(tileId);
    }

    this.pendingOutput.delete(tileId);

    const startingSession = createStartingSession(tile, {
      cwd: currentSession?.cwd ?? getDefaultWorkspaceCwd(),
      shell: currentSession?.shell ?? getDefaultShell(),
      workspaceId: this.workspaceId,
    });

    this.upsertSession(startingSession);
    await this.postMessage({
      session: startingSession,
      type: "terminalSessionState",
    });

    try {
      await this.client.kill(tileId);
    } catch {
      // ignore missing/stale daemon sessions and recreate below
    }

    let nextSession: TerminalSessionSnapshot;

    if (!(await this.ensureShellSpawnAllowed())) {
      nextSession = createBlockedSession(tile, {
        cwd: startingSession.cwd,
        shell: startingSession.shell,
        workspaceId: this.workspaceId,
      });
      this.upsertSession(nextSession);
      await this.postMessage({
        session: nextSession,
        type: "terminalSessionState",
      });
      return nextSession;
    }

    try {
      nextSession = await this.client.createOrAttach({
        cols: startingSession.cols,
        cwd: startingSession.cwd,
        rows: startingSession.rows,
        sessionId: tileId,
        shell: startingSession.shell,
        workspaceId: this.workspaceId,
      });
    } catch (error) {
      nextSession = {
        ...startingSession,
        errorMessage: getErrorMessage(error),
        startedAt: new Date().toISOString(),
        status: "error",
      };
    }

    this.upsertSession(nextSession);
    await this.postMessage({
      session: nextSession,
      type: "terminalSessionState",
    });

    return nextSession;
  }

  public async initialize(): Promise<void> {
    try {
      await this.client.ensureConnected();
    } catch {
      return;
    }

    const sessions = await this.client.listSessions();

    for (const session of sessions) {
      if (session.workspaceId !== this.workspaceId) {
        continue;
      }

      this.upsertSession(session);
    }
  }

  public async reconcileSnapshot(snapshot: CanvasWorkspaceSnapshot): Promise<void> {
    this.reconcileChain = this.reconcileChain.then(async () => {
      let isClientConnected = true;

      try {
        await this.client.ensureConnected();
      } catch {
        isClientConnected = false;
      }

      const liveTileIds = new Set(snapshot.tiles.map((tile) => tile.id));
      const previousSnapshotTileIds = new Set(this.knownSnapshotTileIds);
      const knownTileIds = new Set(
        [...this.sessions.values()]
          .filter((session) => session.workspaceId === this.workspaceId)
          .map((session) => session.tileId),
      );

      for (const tile of snapshot.tiles) {
        if (knownTileIds.has(tile.id)) {
          continue;
        }

        const restoredSession = await this.loadPersistedSession(tile.id);
        const isNewTile = !this.isInitialSnapshot && !previousSnapshotTileIds.has(tile.id);

        if (restoredSession) {
          this.upsertSession(restoredSession);
          await this.postMessage({
            session: restoredSession,
            type: "terminalSessionState",
          });
          continue;
        }

        let session: TerminalSessionSnapshot;

        if (!isClientConnected || !isNewTile) {
          session = createDisconnectedSession(tile, {
            cwd: getDefaultWorkspaceCwd(),
            shell: getDefaultShell(),
            workspaceId: this.workspaceId,
          });
        } else {
          const cols = estimateTerminalColumns(tile.width);
          const cwd = getDefaultWorkspaceCwd();
          const rows = estimateTerminalRows(tile.height);
          const shell = getDefaultShell();

          if (!(await this.ensureShellSpawnAllowed())) {
            session = createBlockedSession(tile, {
              cwd,
              shell,
              workspaceId: this.workspaceId,
            });
          } else {
            try {
              session = await this.client.createOrAttach({
                cols,
                cwd,
                rows,
                sessionId: tile.id,
                shell,
                workspaceId: this.workspaceId,
              });
            } catch (error) {
              session = {
                ...createStartingSession(tile, {
                  cwd,
                  shell,
                  workspaceId: this.workspaceId,
                }),
                errorMessage: getErrorMessage(error),
                status: "error",
              };
            }
          }
        }

        this.upsertSession(session);
        await this.postMessage({
          session,
          type: "terminalSessionState",
        });
      }

      for (const session of this.sessions.values()) {
        if (session.workspaceId !== this.workspaceId || liveTileIds.has(session.tileId)) {
          continue;
        }

        if (isClientConnected && session.restoreState === "live") {
          await this.client.kill(session.tileId);
        }

        await this.deletePersistedSession(session.tileId);
        this.sessions.delete(session.tileId);
      }

      this.knownSnapshotTileIds = liveTileIds;
      this.isInitialSnapshot = false;
    });

    await this.reconcileChain;
  }

  public async resetWorkspace(): Promise<void> {
    this.reconcileChain = this.reconcileChain.then(async () => {
      let liveSessions: TerminalSessionSnapshot[] = [];

      try {
        await this.client.ensureConnected();
        liveSessions = (await this.client.listSessions()).filter(
          (session) => session.workspaceId === this.workspaceId,
        );
      } catch {
        liveSessions = [];
      }

      for (const session of liveSessions) {
        try {
          await this.client.kill(session.tileId);
        } catch {
          // Ignore stale daemon sessions during reset.
        }
      }

      for (const resizeTimer of this.resizeTimers.values()) {
        clearTimeout(resizeTimer);
      }

      this.resizeTimers.clear();
      this.pendingOutput.clear();
      this.sessions.clear();
      this.knownSnapshotTileIds.clear();
      this.isInitialSnapshot = true;

      await rm(this.persistedSessionRoot, {
        force: true,
        recursive: true,
      });
    });

    await this.reconcileChain;
  }

  public async handleHostDetached(): Promise<void> {
    await this.client.dispose();
  }

  private async postMessage(message: ExtensionToWebviewMessage): Promise<boolean> {
    return this.options.postMessage(message) as Promise<boolean>;
  }

  private flushOutput(): void {
    this.outputFlushTimer = undefined;

    for (const [tileId, data] of this.pendingOutput.entries()) {
      this.pendingOutput.delete(tileId);

      const message: TerminalOutputMessage = {
        data,
        tileId,
        type: "terminalOutput",
      };
      void this.postMessage(message);
    }
  }

  private scheduleOutputFlush(): void {
    if (this.outputFlushTimer) {
      return;
    }

    this.outputFlushTimer = setTimeout(() => {
      this.flushOutput();
    }, OUTPUT_FLUSH_INTERVAL_MS);
  }

  private upsertSession(session: TerminalSessionSnapshot): void {
    this.sessions.set(session.tileId, session);
  }

  private async deletePersistedSession(tileId: string): Promise<void> {
    await rm(path.join(this.persistedSessionRoot, tileId), {
      force: true,
      recursive: true,
    });
  }

  private async loadPersistedSession(tileId: string): Promise<TerminalSessionSnapshot | undefined> {
    const sessionDirectory = path.join(this.persistedSessionRoot, tileId);
    const metadataPath = path.join(sessionDirectory, METADATA_FILE_NAME);
    const historyPath = path.join(sessionDirectory, HISTORY_FILE_NAME);

    try {
      const [history, rawMetadata] = await Promise.all([
        readFile(historyPath, "utf8").catch(() => ""),
        readFile(metadataPath, "utf8"),
      ]);
      const metadata = JSON.parse(rawMetadata) as TerminalSessionSnapshot;

      return {
        ...metadata,
        errorMessage: undefined,
        history,
        restoreState: "replayed",
        status: "disconnected",
        tileId,
        workspaceId: this.workspaceId,
      };
    } catch {
      return undefined;
    }
  }

  private async ensureShellSpawnAllowed(): Promise<boolean> {
    if (vscode.workspace.isTrusted || this.hasApprovedUntrustedShells) {
      this.hasApprovedUntrustedShells = true;
      return true;
    }

    const approval = await vscode.window.showWarningMessage(
      "Agent Canvas X is about to start a shell in an untrusted workspace.",
      {
        detail:
          "Shell sessions can run commands against files in this workspace. Trust the workspace or explicitly allow shell access to continue.",
        modal: true,
      },
      "Allow Shell Access",
    );

    if (!approval) {
      return false;
    }

    this.hasApprovedUntrustedShells = true;
    return true;
  }
}

function estimateTerminalColumns(tileWidth: number): number {
  return Math.max(20, Math.floor((tileWidth - 32) / 8.5));
}

function estimateTerminalRows(tileHeight: number): number {
  return Math.max(8, Math.floor((tileHeight - 72) / 18));
}

function createStartingSession(
  tile: TerminalTileModel,
  options: { cwd: string; shell: string; workspaceId: string },
): TerminalSessionSnapshot {
  return {
    cols: estimateTerminalColumns(tile.width),
    cwd: options.cwd,
    restoreState: "live",
    rows: estimateTerminalRows(tile.height),
    shell: options.shell,
    startedAt: new Date().toISOString(),
    status: "starting",
    tileId: tile.id,
    workspaceId: options.workspaceId,
  };
}

function createDisconnectedSession(
  tile: TerminalTileModel,
  options: { cwd: string; shell: string; workspaceId: string },
): TerminalSessionSnapshot {
  return {
    ...createStartingSession(tile, options),
    errorMessage: "Live session unavailable. Restart to launch a new shell.",
    restoreState: "replayed",
    status: "disconnected",
  };
}

function createBlockedSession(
  tile: TerminalTileModel,
  options: { cwd: string; shell: string; workspaceId: string },
): TerminalSessionSnapshot {
  return {
    ...createStartingSession(tile, options),
    errorMessage: "Shell creation blocked in an untrusted workspace.",
    status: "error",
  };
}

function getDefaultShell(): string {
  const configuredShell = process.env.SHELL?.trim();
  if (configuredShell) {
    return configuredShell;
  }

  return process.platform === "win32" ? "powershell.exe" : "/bin/zsh";
}

function getDefaultWorkspaceCwd(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();
}

function getWorkspaceId(): string {
  const workspaceKey =
    vscode.workspace.workspaceFile?.toString() ??
    vscode.workspace.workspaceFolders?.map((folder) => folder.uri.toString()).join("|") ??
    "no-workspace";

  return createHash("sha1").update(workspaceKey).digest("hex").slice(0, 12);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
