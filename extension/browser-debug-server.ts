import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as http from "node:http";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ExtensionToWebviewMessage } from "../shared/canvas-contract";
import { getCanvasBrowserHtml, getCanvasBuildAssetPaths } from "./webview-html";

const BROWSER_BRIDGE_STATUS_TYPE = "__agentCanvasXBridgeStatus";

type BrowserBridgeStatus = "active" | "connecting" | "disconnected" | "inactive";

type BrowserBridgeStatusMessage = {
  type: typeof BROWSER_BRIDGE_STATUS_TYPE;
  status: BrowserBridgeStatus;
  message?: string;
};

type BrowserDebugServerOptions = {
  extensionUri: vscode.Uri;
  onMessage: (message: unknown) => void;
};

export class BrowserDebugServer implements vscode.Disposable {
  private activeEventStream: http.ServerResponse | undefined;
  private readonly bridgeToken = randomBytes(24).toString("hex");
  private readonly buildAssetPaths: ReturnType<typeof getCanvasBuildAssetPaths>;
  private isBrowserHostActive = false;
  private readonly server = http.createServer((request, response) => {
    void this.handleRequest(request, response);
  });
  private startedAtUrl: string | undefined;

  public constructor(private readonly options: BrowserDebugServerOptions) {
    this.buildAssetPaths = getCanvasBuildAssetPaths(options.extensionUri);
  }

  public dispose(): void {
    this.activeEventStream?.end();
    this.activeEventStream = undefined;
    this.server.close();
  }

  public async ensureStarted(): Promise<string> {
    if (this.startedAtUrl) {
      return this.startedAtUrl;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine browser debug server address.");
    }

    this.startedAtUrl = `http://127.0.0.1:${address.port}/?token=${this.bridgeToken}`;
    return this.startedAtUrl;
  }

  public async postMessage(message: ExtensionToWebviewMessage): Promise<boolean> {
    if (!this.isBrowserHostActive || !this.activeEventStream) {
      return false;
    }

    this.writeEvent(message);
    return true;
  }

  public setHostActive(): void {
    this.isBrowserHostActive = true;
    this.writeEvent({
      status: "active",
      type: BROWSER_BRIDGE_STATUS_TYPE,
    });
  }

  public setHostInactive(message: string): void {
    this.isBrowserHostActive = false;
    this.writeEvent({
      message,
      status: "inactive",
      type: BROWSER_BRIDGE_STATUS_TYPE,
    });
  }

  public getServerOrigin(): string | undefined {
    if (!this.startedAtUrl) {
      return undefined;
    }

    return new URL(this.startedAtUrl).origin;
  }

  public getBridgeToken(): string {
    return this.bridgeToken;
  }

  private async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (!this.hasValidToken(requestUrl)) {
      response.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unauthorized");
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/") {
      await this.serveHtml(response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/events") {
      this.openEventStream(response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/message") {
      await this.handleBrowserMessage(request, response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname.startsWith("/assets/")) {
      await this.serveAsset(requestUrl.pathname, response);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }

  private hasValidToken(requestUrl: URL): boolean {
    return requestUrl.searchParams.get("token") === this.bridgeToken;
  }

  private async serveHtml(response: http.ServerResponse): Promise<void> {
    const serverOrigin = this.getServerOrigin();
    if (!serverOrigin) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server not ready");
      return;
    }

    const html = await getCanvasBrowserHtml({
      bridgeToken: this.bridgeToken,
      extensionUri: this.options.extensionUri,
      serverOrigin,
    });
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  }

  private openEventStream(response: http.ServerResponse): void {
    this.activeEventStream?.end();
    this.activeEventStream = response;

    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    });
    response.write(": connected\n\n");

    response.on("close", () => {
      if (this.activeEventStream === response) {
        this.activeEventStream = undefined;
      }
    });

    if (!this.isBrowserHostActive) {
      this.writeEvent({
        message: "Canvas is attached to VS Code, not the browser debug host.",
        status: "inactive",
        type: BROWSER_BRIDGE_STATUS_TYPE,
      });
      return;
    }

    this.writeEvent({
      status: "active",
      type: BROWSER_BRIDGE_STATUS_TYPE,
    });
  }

  private async handleBrowserMessage(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    if (!this.isBrowserHostActive) {
      this.writeEvent({
        message: "Canvas is attached to VS Code, not the browser debug host.",
        status: "inactive",
        type: BROWSER_BRIDGE_STATUS_TYPE,
      });
      response.writeHead(409, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false }));
      return;
    }

    const requestBody = await readRequestBody(request);

    try {
      const parsed = JSON.parse(requestBody) as unknown;
      this.options.onMessage(parsed);
      response.writeHead(204);
      response.end();
    } catch {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false }));
    }
  }

  private async serveAsset(pathname: string, response: http.ServerResponse): Promise<void> {
    const assetRelativePath = pathname.slice("/assets/".length);
    const assetFilePath = path.resolve(this.buildAssetPaths.assetsRoot.fsPath, assetRelativePath);

    if (!assetFilePath.startsWith(this.buildAssetPaths.assetsRoot.fsPath)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const fileContents = await readFile(assetFilePath);
      response.writeHead(200, { "Content-Type": getContentType(assetFilePath) });
      response.end(fileContents);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  }

  private writeEvent(message: ExtensionToWebviewMessage | BrowserBridgeStatusMessage): void {
    if (!this.activeEventStream) {
      return;
    }

    this.activeEventStream.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function getContentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}
