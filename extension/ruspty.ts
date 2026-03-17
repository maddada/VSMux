import * as path from "node:path";
import { ReadStream } from "node:tty";
import type { Readable, Writable } from "node:stream";

type PtyOptions = {
  command: string;
  args?: string[];
  envs?: Record<string, string>;
  dir?: string;
  size?: Size;
  interactive?: boolean;
  onExit: (err: null | Error, exitCode: number) => void;
};

type RawPty = {
  pid: number;
  dropUserFd: () => void;
  takeControllerFd: () => number;
};

type RusptyNativeModule = {
  MAX_U16_VALUE: number;
  MIN_U16_VALUE: number;
  Pty: new (options: PtyOptions) => RawPty;
  ptyResize: (fd: number, size: Size) => void;
};

type Size = {
  cols: number;
  rows: number;
};

function getNativeBindingName(): string {
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

const nativeModule = require(path.join(__dirname, getNativeBindingName())) as RusptyNativeModule;

export class Pty {
  #fd: number;
  #handledClose = false;
  #socketClosed = false;
  #pty: RawPty;
  #socket: ReadStream;
  #userFdDropped = false;

  public readonly read: Readable;
  public readonly write: Writable;

  public constructor(options: PtyOptions) {
    const realExit = options.onExit;

    this.#pty = new nativeModule.Pty({
      ...options,
      onExit: (error, exitCode) => {
        this.dropUserFd();
        realExit(error, exitCode);
      },
    });
    this.#fd = this.#pty.takeControllerFd();
    this.#socket = new ReadStream(this.#fd);
    this.read = this.#socket;
    this.write = this.#socket;

    this.#socket.on("error", (error: NodeJS.ErrnoException) => {
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

  public close(): void {
    if (this.#handledClose || this.#socketClosed) {
      return;
    }

    this.#handledClose = true;
    this.#socket.end();
    this.dropUserFd();
  }

  public resize(size: Size): void {
    if (this.#handledClose || this.#socketClosed) {
      return;
    }

    if (
      size.cols < nativeModule.MIN_U16_VALUE ||
      size.cols > nativeModule.MAX_U16_VALUE ||
      size.rows < nativeModule.MIN_U16_VALUE ||
      size.rows > nativeModule.MAX_U16_VALUE
    ) {
      throw new RangeError(
        `Size (${size.rows}x${size.cols}) out of range: must be between ${nativeModule.MIN_U16_VALUE} and ${nativeModule.MAX_U16_VALUE}`,
      );
    }

    try {
      nativeModule.ptyResize(this.#fd, size);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("os error 9") || error.message.includes("os error 25"))
      ) {
        return;
      }

      throw error;
    }
  }

  public get pid(): number {
    return this.#pty.pid;
  }

  private dropUserFd(): void {
    if (this.#userFdDropped) {
      return;
    }

    this.#userFdDropped = true;
    this.#pty.dropUserFd();
  }
}

export type { PtyOptions, Size };
