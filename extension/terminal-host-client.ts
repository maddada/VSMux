import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as net from "node:net";
import * as path from "node:path";
import {
  TERMINAL_HOST_PROTOCOL_VERSION,
  type TerminalHostEvent,
  type TerminalHostRequest,
  type TerminalHostResponse,
  type TerminalSessionSnapshot,
} from "../shared/terminal-host-protocol";

const CONNECT_RETRY_DELAY_MS = 200;
const CONNECT_RETRY_LIMIT = 100;
const DAEMON_RELAUNCH_COOLDOWN_MS = 15_000;
const PORT_FILE_NAME = `terminal-host-v${TERMINAL_HOST_PROTOCOL_VERSION}.port`;
const TOKEN_FILE_NAME = "auth-token";

type TerminalHostClientOptions = {
  daemonScriptPath: string;
  storagePath: string;
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (message: TerminalHostResponse) => void;
};

type TerminalHostFireAndForgetRequest = Extract<
  TerminalHostRequest,
  { type: "kill" | "resize" | "write" }
>;

export class TerminalHostClient extends EventEmitter {
  private connectPromise: Promise<void> | undefined;
  private lastLaunchAt = 0;
  private nextRequestId = 1;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private socket: net.Socket | undefined;

  public constructor(private readonly options: TerminalHostClientOptions) {
    super();
  }

  public async ensureConnected(): Promise<void> {
    if (this.isSocketConnected()) {
      return;
    }

    this.connectPromise ||= this.openConnection();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  public async createOrAttach(request: {
    sessionId: string;
    workspaceId: string;
    cols: number;
    cwd: string;
    rows: number;
    shell: string;
  }): Promise<TerminalSessionSnapshot> {
    const response = await this.sendRequest({
      cols: request.cols,
      cwd: request.cwd,
      requestId: this.createRequestId(),
      rows: request.rows,
      sessionId: request.sessionId,
      shell: request.shell,
      type: "createOrAttach",
      workspaceId: request.workspaceId,
    });

    if (!response.ok || !("session" in response)) {
      throw new Error(response.ok ? "Terminal host createOrAttach failed" : response.error);
    }

    return response.session;
  }

  public async dispose(): Promise<void> {
    this.socket?.destroy();
    this.socket = undefined;
  }

  public async kill(sessionId: string): Promise<void> {
    await this.send({
      sessionId,
      type: "kill",
    });
  }

  public async listSessions(): Promise<TerminalSessionSnapshot[]> {
    const response = await this.sendRequest({
      requestId: this.createRequestId(),
      type: "listSessions",
    });

    if (!response.ok || !("sessions" in response)) {
      throw new Error(response.ok ? "Terminal host listSessions failed" : response.error);
    }

    return response.sessions;
  }

  public async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    await this.send({
      cols,
      rows,
      sessionId,
      type: "resize",
    });
  }

  public async write(sessionId: string, data: string): Promise<void> {
    await this.send({
      data,
      sessionId,
      type: "write",
    });
  }

  private async connectSocket(token: string): Promise<void> {
    if (this.isSocketConnected()) {
      return;
    }

    const port = await this.getPort();

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: "127.0.0.1",
        port,
      });
      let buffer = "";
      let isAuthenticated = false;
      let isSettled = false;

      socket.setEncoding("utf8");

      const settleReject = (error: Error) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        reject(error);
      };

      const settleResolve = () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        resolve();
      };

      socket.once("connect", () => {
        socket.write(
          `${JSON.stringify({
            token,
            type: "authenticate",
            version: TERMINAL_HOST_PROTOCOL_VERSION,
          })}\n`,
        );
      });

      socket.on("data", (chunk) => {
        buffer += chunk;
        const messages = buffer.split("\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
          const trimmedMessage = message.trim();
          if (!trimmedMessage) {
            continue;
          }

          const parsedMessage = JSON.parse(trimmedMessage) as TerminalHostEvent;
          if (parsedMessage.type === "authenticated") {
            isAuthenticated = true;
            if (this.socket && this.socket !== socket) {
              this.socket.destroy();
            }
            this.socket = socket;
            settleResolve();
            continue;
          }

          this.handleEvent(parsedMessage);
        }
      });

      socket.once("error", (error) => {
        if (!isAuthenticated) {
          settleReject(error);
        }
      });

      socket.on("close", () => {
        this.socket = undefined;

        if (!isAuthenticated) {
          settleReject(new Error("Terminal host connection closed before authentication"));
          return;
        }

        for (const pendingRequest of this.pendingRequests.values()) {
          pendingRequest.reject(new Error("Terminal host connection closed"));
        }

        this.pendingRequests.clear();
      });
    });
  }

  private createRequestId(): string {
    const requestId = String(this.nextRequestId);
    this.nextRequestId += 1;
    return requestId;
  }

  private getDaemonStateDirectory(): string {
    return path.join(this.options.storagePath, "terminal-host-daemon");
  }

  private getPortPath(): string {
    return path.join(this.getDaemonStateDirectory(), PORT_FILE_NAME);
  }

  private async getPort(): Promise<number> {
    const portValue = (await readFile(this.getPortPath(), "utf8")).trim();
    const port = Number.parseInt(portValue, 10);

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid terminal host port: ${portValue}`);
    }

    return port;
  }

  private async getToken(): Promise<string> {
    const daemonStateDirectory = this.getDaemonStateDirectory();
    const tokenPath = path.join(daemonStateDirectory, TOKEN_FILE_NAME);

    await mkdir(daemonStateDirectory, { recursive: true });

    try {
      return (await readFile(tokenPath, "utf8")).trim();
    } catch {
      const token = randomBytes(24).toString("hex");
      await writeFile(tokenPath, token);
      return token;
    }
  }

  private isSocketConnected(): boolean {
    return this.socket !== undefined && !this.socket.destroyed;
  }

  private handleEvent(event: TerminalHostEvent): void {
    if (event.type === "response") {
      const pendingRequest = this.pendingRequests.get(event.requestId);
      if (!pendingRequest) {
        return;
      }

      this.pendingRequests.delete(event.requestId);
      pendingRequest.resolve(event);
      return;
    }

    if (event.type === "sessionOutput") {
      this.emit("sessionOutput", event);
      return;
    }

    if (event.type === "sessionState") {
      this.emit("sessionState", event);
    }
  }

  private async launchDaemon(token: string): Promise<void> {
    const daemonStateDirectory = this.getDaemonStateDirectory();
    const portPath = this.getPortPath();

    await mkdir(daemonStateDirectory, { recursive: true });
    await rm(portPath, { force: true });

    const daemonEnvironment: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      GHOSTTY_CANVAS_DAEMON_STATE_DIR: daemonStateDirectory,
      GHOSTTY_CANVAS_DAEMON_TOKEN: token,
      GHOSTTY_CANVAS_DAEMON_PORT_FILE: portPath,
    };

    delete daemonEnvironment.NODE_OPTIONS;
    delete daemonEnvironment.VSCODE_INSPECTOR_OPTIONS;

    const child = spawn(process.execPath, [this.options.daemonScriptPath], {
      detached: true,
      env: daemonEnvironment,
      stdio: "ignore",
    });

    child.unref();
  }

  private async openConnection(): Promise<void> {
    const token = await this.getToken();

    try {
      await this.connectSocket(token);
      return;
    } catch {
      const now = Date.now();
      if (now - this.lastLaunchAt >= DAEMON_RELAUNCH_COOLDOWN_MS) {
        this.lastLaunchAt = now;
        await this.launchDaemon(token);
      }
    }

    for (let attempt = 0; attempt < CONNECT_RETRY_LIMIT; attempt += 1) {
      try {
        await this.connectSocket(token);
        return;
      } catch {
        await wait(CONNECT_RETRY_DELAY_MS);
      }
    }

    throw new Error("Unable to connect to the terminal host daemon");
  }

  private async send(message: TerminalHostFireAndForgetRequest): Promise<void> {
    await this.ensureConnected();

    if (!this.socket) {
      throw new Error("Terminal host is not connected");
    }

    this.socket.write(`${JSON.stringify(message)}\n`);
  }

  private async sendRequest(
    message: Extract<TerminalHostRequest, { requestId: string }>,
  ): Promise<TerminalHostResponse> {
    await this.ensureConnected();

    if (!this.socket) {
      throw new Error("Terminal host is not connected");
    }

    const responsePromise = new Promise<TerminalHostResponse>((resolve, reject) => {
      this.pendingRequests.set(message.requestId, {
        reject,
        resolve,
      });
    });

    this.socket.write(`${JSON.stringify(message)}\n`);
    return responsePromise;
  }
}

async function wait(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
