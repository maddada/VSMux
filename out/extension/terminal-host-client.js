"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalHostClient = void 0;
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const node_events_1 = require("node:events");
const promises_1 = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const terminal_host_protocol_1 = require("../shared/terminal-host-protocol");
const CONNECT_RETRY_DELAY_MS = 200;
const CONNECT_RETRY_LIMIT = 100;
const DAEMON_RELAUNCH_COOLDOWN_MS = 15_000;
const PORT_FILE_NAME = `terminal-host-v${terminal_host_protocol_1.TERMINAL_HOST_PROTOCOL_VERSION}.port`;
const TOKEN_FILE_NAME = "auth-token";
class TerminalHostClient extends node_events_1.EventEmitter {
    options;
    connectPromise;
    lastLaunchAt = 0;
    nextRequestId = 1;
    pendingRequests = new Map();
    socket;
    constructor(options) {
        super();
        this.options = options;
    }
    async ensureConnected() {
        if (this.isSocketConnected()) {
            return;
        }
        this.connectPromise ||= this.openConnection();
        try {
            await this.connectPromise;
        }
        finally {
            this.connectPromise = undefined;
        }
    }
    async createOrAttach(request) {
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
    async dispose() {
        this.socket?.destroy();
        this.socket = undefined;
    }
    async kill(sessionId) {
        await this.send({
            sessionId,
            type: "kill",
        });
    }
    async listSessions() {
        const response = await this.sendRequest({
            requestId: this.createRequestId(),
            type: "listSessions",
        });
        if (!response.ok || !("sessions" in response)) {
            throw new Error(response.ok ? "Terminal host listSessions failed" : response.error);
        }
        return response.sessions;
    }
    async resize(sessionId, cols, rows) {
        await this.send({
            cols,
            rows,
            sessionId,
            type: "resize",
        });
    }
    async write(sessionId, data) {
        await this.send({
            data,
            sessionId,
            type: "write",
        });
    }
    async connectSocket(token) {
        if (this.isSocketConnected()) {
            return;
        }
        const port = await this.getPort();
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: "127.0.0.1",
                port,
            });
            let buffer = "";
            let isAuthenticated = false;
            let isSettled = false;
            socket.setEncoding("utf8");
            const settleReject = (error) => {
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
                socket.write(`${JSON.stringify({
                    token,
                    type: "authenticate",
                    version: terminal_host_protocol_1.TERMINAL_HOST_PROTOCOL_VERSION,
                })}\n`);
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
                    const parsedMessage = JSON.parse(trimmedMessage);
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
    createRequestId() {
        const requestId = String(this.nextRequestId);
        this.nextRequestId += 1;
        return requestId;
    }
    getDaemonStateDirectory() {
        return path.join(this.options.storagePath, "terminal-host-daemon");
    }
    getPortPath() {
        return path.join(this.getDaemonStateDirectory(), PORT_FILE_NAME);
    }
    async getPort() {
        const portValue = (await (0, promises_1.readFile)(this.getPortPath(), "utf8")).trim();
        const port = Number.parseInt(portValue, 10);
        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
            throw new Error(`Invalid terminal host port: ${portValue}`);
        }
        return port;
    }
    async getToken() {
        const daemonStateDirectory = this.getDaemonStateDirectory();
        const tokenPath = path.join(daemonStateDirectory, TOKEN_FILE_NAME);
        await (0, promises_1.mkdir)(daemonStateDirectory, { recursive: true });
        try {
            return (await (0, promises_1.readFile)(tokenPath, "utf8")).trim();
        }
        catch {
            const token = (0, node_crypto_1.randomBytes)(24).toString("hex");
            await (0, promises_1.writeFile)(tokenPath, token);
            return token;
        }
    }
    isSocketConnected() {
        return this.socket !== undefined && !this.socket.destroyed;
    }
    handleEvent(event) {
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
    async launchDaemon(token) {
        const daemonStateDirectory = this.getDaemonStateDirectory();
        const portPath = this.getPortPath();
        await (0, promises_1.mkdir)(daemonStateDirectory, { recursive: true });
        await (0, promises_1.rm)(portPath, { force: true });
        const daemonEnvironment = {
            ...Object.fromEntries(Object.entries(process.env).filter((entry) => entry[1] !== undefined)),
            GHOSTTY_CANVAS_DAEMON_STATE_DIR: daemonStateDirectory,
            GHOSTTY_CANVAS_DAEMON_TOKEN: token,
            GHOSTTY_CANVAS_DAEMON_PORT_FILE: portPath,
        };
        delete daemonEnvironment.NODE_OPTIONS;
        delete daemonEnvironment.VSCODE_INSPECTOR_OPTIONS;
        const child = (0, node_child_process_1.spawn)(process.execPath, [this.options.daemonScriptPath], {
            detached: true,
            env: daemonEnvironment,
            stdio: "ignore",
        });
        child.unref();
    }
    async openConnection() {
        const token = await this.getToken();
        try {
            await this.connectSocket(token);
            return;
        }
        catch {
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
            }
            catch {
                await wait(CONNECT_RETRY_DELAY_MS);
            }
        }
        throw new Error("Unable to connect to the terminal host daemon");
    }
    async send(message) {
        await this.ensureConnected();
        if (!this.socket) {
            throw new Error("Terminal host is not connected");
        }
        this.socket.write(`${JSON.stringify(message)}\n`);
    }
    async sendRequest(message) {
        await this.ensureConnected();
        if (!this.socket) {
            throw new Error("Terminal host is not connected");
        }
        const responsePromise = new Promise((resolve, reject) => {
            this.pendingRequests.set(message.requestId, {
                reject,
                resolve,
            });
        });
        this.socket.write(`${JSON.stringify(message)}\n`);
        return responsePromise;
    }
}
exports.TerminalHostClient = TerminalHostClient;
async function wait(durationMs) {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
}
//# sourceMappingURL=terminal-host-client.js.map