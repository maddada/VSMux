import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createWorkspaceResttyTransport } from "./restty-session-transport";

type FakeListener = (event?: { data?: unknown }) => void;

class FakeWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static instances: FakeWebSocket[] = [];

  public readonly sentMessages: string[] = [];
  public binaryType = "blob";
  public readyState = FakeWebSocket.CONNECTING;
  private readonly listeners = new Map<string, FakeListener[]>();

  public constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  public addEventListener(type: string, listener: FakeListener): void {
    const currentListeners = this.listeners.get(type) ?? [];
    currentListeners.push(listener);
    this.listeners.set(type, currentListeners);
  }

  public send(message: string): void {
    this.sentMessages.push(message);
  }

  public close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close");
  }

  public open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open");
  }

  public fail(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("error");
  }

  private dispatch(type: string, event?: { data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("createWorkspaceResttyTransport", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("should include cols and rows in the initial socket url", () => {
    const controller = createWorkspaceResttyTransport({
      sessionId: "session-1",
    });

    controller.transport.connect({
      callbacks: {},
      cols: 120,
      rows: 34,
      url: "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1",
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]?.url).toBe(
      "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1&cols=120&rows=34",
    );
  });

  test("should wait for an explicit ready signal before sending the attach handshake", () => {
    const controller = createWorkspaceResttyTransport({
      sessionId: "session-1",
    });

    controller.transport.connect({
      callbacks: {},
      cols: 120,
      rows: 34,
      url: "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1",
    });

    const socket = FakeWebSocket.instances[0];
    socket?.open();
    expect(socket?.sentMessages).toEqual([]);

    controller.markTerminalReady(120, 34);
    expect(socket?.sentMessages).toEqual([
      JSON.stringify({
        cols: 120,
        rows: 34,
        sessionId: "session-1",
        type: "terminalReady",
      }),
    ]);
  });

  test("should reconnect with the latest cols and rows after a disconnect", () => {
    const controller = createWorkspaceResttyTransport({
      sessionId: "session-1",
    });

    controller.transport.connect({
      callbacks: {},
      cols: 120,
      rows: 34,
      url: "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1",
    });

    const firstSocket = FakeWebSocket.instances[0];
    controller.markTerminalReady(120, 34);
    firstSocket?.open();

    controller.transport.resize(160, 48);
    firstSocket?.fail();
    vi.runOnlyPendingTimers();

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1]?.url).toBe(
      "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1&cols=160&rows=48",
    );
  });

  test("should reset the local terminal state before replaying a reconnect", () => {
    const onData = vi.fn();
    const controller = createWorkspaceResttyTransport({
      sessionId: "session-1",
    });

    controller.transport.connect({
      callbacks: { onData },
      cols: 120,
      rows: 34,
      url: "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1",
    });

    const firstSocket = FakeWebSocket.instances[0];
    firstSocket?.open();
    expect(onData).not.toHaveBeenCalled();

    firstSocket?.fail();
    vi.runOnlyPendingTimers();

    const secondSocket = FakeWebSocket.instances[1];
    secondSocket?.open();

    expect(onData).toHaveBeenCalledWith("\x1bc");
  });

  test("should queue resize messages until the daemon is told the terminal is ready", () => {
    const controller = createWorkspaceResttyTransport({
      sessionId: "session-1",
    });

    controller.transport.connect({
      callbacks: {},
      cols: 120,
      rows: 34,
      url: "ws://127.0.0.1:9000/session?token=test&workspaceId=workspace-1&sessionId=session-1",
    });

    const socket = FakeWebSocket.instances[0];
    socket?.open();
    controller.transport.resize(140, 40);
    expect(socket?.sentMessages).toEqual([]);

    controller.markTerminalReady(140, 40);

    expect(socket?.sentMessages).toEqual([
      JSON.stringify({
        cols: 140,
        rows: 40,
        sessionId: "session-1",
        type: "terminalReady",
      }),
      JSON.stringify({
        cols: 140,
        rows: 40,
        sessionId: "session-1",
        type: "terminalResize",
      }),
    ]);
  });
});
