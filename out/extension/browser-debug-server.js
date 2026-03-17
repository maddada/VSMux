"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserDebugServer = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const webview_html_1 = require("./webview-html");
const BROWSER_BRIDGE_STATUS_TYPE = "__agentCanvasXBridgeStatus";
class BrowserDebugServer {
    options;
    activeEventStream;
    bridgeToken = (0, node_crypto_1.randomBytes)(24).toString("hex");
    buildAssetPaths;
    isBrowserHostActive = false;
    server = http.createServer((request, response) => {
        void this.handleRequest(request, response);
    });
    startedAtUrl;
    constructor(options) {
        this.options = options;
        this.buildAssetPaths = (0, webview_html_1.getCanvasBuildAssetPaths)(options.extensionUri);
    }
    dispose() {
        this.activeEventStream?.end();
        this.activeEventStream = undefined;
        this.server.close();
    }
    async ensureStarted() {
        if (this.startedAtUrl) {
            return this.startedAtUrl;
        }
        await new Promise((resolve, reject) => {
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
    async postMessage(message) {
        if (!this.isBrowserHostActive || !this.activeEventStream) {
            return false;
        }
        this.writeEvent(message);
        return true;
    }
    setHostActive() {
        this.isBrowserHostActive = true;
        this.writeEvent({
            status: "active",
            type: BROWSER_BRIDGE_STATUS_TYPE,
        });
    }
    setHostInactive(message) {
        this.isBrowserHostActive = false;
        this.writeEvent({
            message,
            status: "inactive",
            type: BROWSER_BRIDGE_STATUS_TYPE,
        });
    }
    getServerOrigin() {
        if (!this.startedAtUrl) {
            return undefined;
        }
        return new URL(this.startedAtUrl).origin;
    }
    getBridgeToken() {
        return this.bridgeToken;
    }
    async handleRequest(request, response) {
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
    hasValidToken(requestUrl) {
        return requestUrl.searchParams.get("token") === this.bridgeToken;
    }
    async serveHtml(response) {
        const serverOrigin = this.getServerOrigin();
        if (!serverOrigin) {
            response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Server not ready");
            return;
        }
        const html = await (0, webview_html_1.getCanvasBrowserHtml)({
            bridgeToken: this.bridgeToken,
            extensionUri: this.options.extensionUri,
            serverOrigin,
        });
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
    }
    openEventStream(response) {
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
    async handleBrowserMessage(request, response) {
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
            const parsed = JSON.parse(requestBody);
            this.options.onMessage(parsed);
            response.writeHead(204);
            response.end();
        }
        catch {
            response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ ok: false }));
        }
    }
    async serveAsset(pathname, response) {
        const assetRelativePath = pathname.slice("/assets/".length);
        const assetFilePath = path.resolve(this.buildAssetPaths.assetsRoot.fsPath, assetRelativePath);
        if (!assetFilePath.startsWith(this.buildAssetPaths.assetsRoot.fsPath)) {
            response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Forbidden");
            return;
        }
        try {
            const fileContents = await (0, promises_1.readFile)(assetFilePath);
            response.writeHead(200, { "Content-Type": getContentType(assetFilePath) });
            response.end(fileContents);
        }
        catch {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Not found");
        }
    }
    writeEvent(message) {
        if (!this.activeEventStream) {
            return;
        }
        this.activeEventStream.write(`data: ${JSON.stringify(message)}\n\n`);
    }
}
exports.BrowserDebugServer = BrowserDebugServer;
async function readRequestBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}
function getContentType(filePath) {
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
//# sourceMappingURL=browser-debug-server.js.map