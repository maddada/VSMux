import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("vscode", () => ({}));

import { T3RuntimeManager } from "./t3-runtime-manager";

type FakeListener = (event?: { data?: unknown }) => void;

class FakeWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static instances: FakeWebSocket[] = [];
  public static outcomes: Array<"error" | "open"> = [];

  public readyState = FakeWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Array<{ listener: FakeListener; once: boolean }>>();

  public constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
    const outcome = FakeWebSocket.outcomes.shift() ?? "open";
    setTimeout(() => {
      if (outcome === "open") {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open");
        return;
      }

      this.readyState = FakeWebSocket.CLOSED;
      this.dispatch("error");
      this.dispatch("close");
    }, 0);
  }

  public static reset(): void {
    FakeWebSocket.instances = [];
    FakeWebSocket.outcomes = [];
  }

  public addEventListener(
    type: string,
    listener: FakeListener,
    options?: { once?: boolean },
  ): void {
    const current = this.listeners.get(type) ?? [];
    current.push({ listener, once: options?.once === true });
    this.listeners.set(type, current);
  }

  public removeEventListener(type: string, listener: FakeListener): void {
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((entry) => entry.listener !== listener),
    );
  }

  public close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close");
  }

  public send(_message: string): void {}

  private dispatch(type: string, event?: { data?: unknown }): void {
    const current = [...(this.listeners.get(type) ?? [])];
    for (const entry of current) {
      entry.listener(event);
      if (entry.once) {
        this.removeEventListener(type, entry.listener);
      }
    }
  }
}

describe("T3RuntimeManager", () => {
  beforeEach(() => {
    FakeWebSocket.reset();
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("should retry the websocket connection when the first startup handshake fails", async () => {
    FakeWebSocket.outcomes = ["error", "open"];

    const manager = new T3RuntimeManager({
      globalStorageUri: { fsPath: "/tmp/vsmux-test" },
    } as never);

    const connectPromise = (manager as never as { connect: () => Promise<WebSocket> }).connect();

    await vi.runAllTimersAsync();
    const socket = await connectPromise;

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(socket).toBe(FakeWebSocket.instances[1]);
  });
});
