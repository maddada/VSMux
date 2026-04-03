import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

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
  }

  public dispose(): void {
    this.listenPromise = undefined;
    this.port = undefined;
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
