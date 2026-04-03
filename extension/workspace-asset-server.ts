import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { WebSocket, WebSocketServer } from "ws";

type AssetScope = "workspace" | "t3-embed";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

export class WorkspaceAssetServer implements vscode.Disposable {
  private readonly roots: Record<AssetScope, string>;
  private readonly websocketServer = new WebSocketServer({ noServer: true });
  private readonly server = createServer((request, response) => {
    void this.handleRequest(request, response);
  });
  private listenPromise: Promise<number> | undefined;
  private port: number | undefined;

  public constructor(context: vscode.ExtensionContext) {
    this.roots = {
      "t3-embed": path.join(context.extensionPath, "forks", "t3code-embed", "dist"),
      workspace: path.join(context.extensionPath, "out", "workspace"),
    };
    this.server.on("upgrade", (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });
  }

  public dispose(): void {
    this.listenPromise = undefined;
    this.port = undefined;
    this.websocketServer.close();
    this.server.close();
  }

  public async getUrl(scope: AssetScope, relativePath: string): Promise<string> {
    const port = await this.ensureListening();
    const normalizedPath = normalizeRelativePath(relativePath);
    return `http://127.0.0.1:${String(port)}/${scope}/${normalizedPath}`;
  }

  public async getRootUrl(scope: AssetScope): Promise<string> {
    const port = await this.ensureListening();
    return `http://127.0.0.1:${String(port)}/${scope}`;
  }

  private async ensureListening(): Promise<number> {
    if (this.port !== undefined) {
      return this.port;
    }

    this.listenPromise ??= new Promise<number>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        const address = this.server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Workspace asset server failed to bind to a port."));
          return;
        }

        this.port = address.port;
        resolve(address.port);
      });
    });

    return this.listenPromise;
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      if (!request.url) {
        respondNotFound(response);
        return;
      }

      const url = new URL(request.url, "http://127.0.0.1");
      const [scope, ...pathSegments] = url.pathname.split("/").filter(Boolean);
      if (scope !== "workspace" && scope !== "t3-embed") {
        respondNotFound(response);
        return;
      }

      const root = this.roots[scope];
      const relativePath = normalizeRelativePath(pathSegments.join("/"));
      const filePath = path.join(root, relativePath);
      const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
      if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
        respondNotFound(response);
        return;
      }

      const file = await readFile(filePath);
      const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath)] ?? "application/octet-stream";
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      });
      response.end(file);
    } catch {
      respondNotFound(response);
    }
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer,
  ): Promise<void> {
    try {
      if (!request.url) {
        socket.destroy();
        return;
      }

      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      this.websocketServer.handleUpgrade(request, socket, head, (clientSocket) => {
        const targetSocket = new WebSocket("ws://127.0.0.1:3773/ws");

        const closeTarget = () => {
          if (
            targetSocket.readyState === WebSocket.OPEN ||
            targetSocket.readyState === WebSocket.CONNECTING
          ) {
            targetSocket.close();
          }
        };
        const closeClient = () => {
          if (
            clientSocket.readyState === WebSocket.OPEN ||
            clientSocket.readyState === WebSocket.CONNECTING
          ) {
            clientSocket.close();
          }
        };

        clientSocket.on("message", (data, isBinary) => {
          if (targetSocket.readyState !== WebSocket.OPEN) {
            return;
          }
          targetSocket.send(data, { binary: isBinary });
        });
        clientSocket.on("close", closeTarget);
        clientSocket.on("error", closeTarget);

        targetSocket.on("message", (data, isBinary) => {
          if (clientSocket.readyState !== WebSocket.OPEN) {
            return;
          }
          clientSocket.send(data, { binary: isBinary });
        });
        targetSocket.on("close", closeClient);
        targetSocket.on("error", closeClient);
      });
    } catch {
      socket.destroy();
    }
  }
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, "");
  if (normalized === "." || normalized.length === 0) {
    return "index.html";
  }

  return normalized;
}
function respondNotFound(response: ServerResponse): void {
  response.writeHead(404, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end("Not found");
}
