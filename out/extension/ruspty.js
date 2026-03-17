"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pty = void 0;
const path = require("node:path");
const node_tty_1 = require("node:tty");
function getNativeBindingName() {
    if (process.platform === "darwin" && process.arch === "arm64") {
        return "ruspty.darwin-arm64.node";
    }
    if (process.platform === "darwin" && process.arch === "x64") {
        return "ruspty.darwin-x64.node";
    }
    if (process.platform === "linux" && process.arch === "x64") {
        return "ruspty.linux-x64-gnu.node";
    }
    throw new Error(`Unsupported ruspty platform: ${process.platform}/${process.arch}`);
}
const nativeModule = require(path.join(__dirname, getNativeBindingName()));
class Pty {
    #fd;
    #handledClose = false;
    #socketClosed = false;
    #pty;
    #socket;
    #userFdDropped = false;
    read;
    write;
    constructor(options) {
        const realExit = options.onExit;
        this.#pty = new nativeModule.Pty({
            ...options,
            onExit: (error, exitCode) => {
                this.dropUserFd();
                realExit(error, exitCode);
            },
        });
        this.#fd = this.#pty.takeControllerFd();
        this.#socket = new node_tty_1.ReadStream(this.#fd);
        this.read = this.#socket;
        this.write = this.#socket;
        this.#socket.on("error", (error) => {
            if (error.code === "EINTR" || error.code === "EAGAIN") {
                return;
            }
            if (error.code?.includes("EIO")) {
                this.#socket.emit("end");
                return;
            }
            throw error;
        });
        this.#socket.once("close", () => {
            this.#socketClosed = true;
            this.dropUserFd();
        });
    }
    close() {
        if (this.#handledClose || this.#socketClosed) {
            return;
        }
        this.#handledClose = true;
        this.#socket.end();
        this.dropUserFd();
    }
    resize(size) {
        if (this.#handledClose || this.#socketClosed) {
            return;
        }
        if (size.cols < nativeModule.MIN_U16_VALUE ||
            size.cols > nativeModule.MAX_U16_VALUE ||
            size.rows < nativeModule.MIN_U16_VALUE ||
            size.rows > nativeModule.MAX_U16_VALUE) {
            throw new RangeError(`Size (${size.rows}x${size.cols}) out of range: must be between ${nativeModule.MIN_U16_VALUE} and ${nativeModule.MAX_U16_VALUE}`);
        }
        try {
            nativeModule.ptyResize(this.#fd, size);
        }
        catch (error) {
            if (error instanceof Error &&
                (error.message.includes("os error 9") || error.message.includes("os error 25"))) {
                return;
            }
            throw error;
        }
    }
    get pid() {
        return this.#pty.pid;
    }
    dropUserFd() {
        if (this.#userFdDropped) {
            return;
        }
        this.#userFdDropped = true;
        this.#pty.dropUserFd();
    }
}
exports.Pty = Pty;
//# sourceMappingURL=ruspty.js.map