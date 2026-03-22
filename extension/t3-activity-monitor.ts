import * as vscode from "vscode";
import type { TerminalAgentStatus } from "../shared/terminal-host-protocol";

const DEFAULT_T3_WEBSOCKET_URL = "ws://127.0.0.1:3773";
const REQUEST_TIMEOUT_MS = 15_000;
const RECONNECT_DELAY_MS = 1_500;
const REFRESH_DEBOUNCE_MS = 100;

type T3ActivityMonitorOptions = {
  getWebSocketUrl?: () => string;
};

type SnapshotThread = {
  deletedAt?: string | null;
  id?: string;
  latestTurn?: {
    completedAt?: string | null;
    state?: string | null;
    turnId?: string;
  } | null;
  session?: {
    activeTurnId?: string | null;
    lastError?: string | null;
    status?: string | null;
    updatedAt?: string;
  } | null;
};

type SnapshotResponse = {
  threads?: SnapshotThread[];
};

type T3ThreadActivityState = {
  activity: TerminalAgentStatus;
  completionMarker?: string;
  isRunning: boolean;
};

type PendingSnapshotRequest = {
  reject: (error: Error) => void;
  resolve: (snapshot: SnapshotResponse) => void;
  timeout: NodeJS.Timeout;
};

export class T3ActivityMonitor implements vscode.Disposable {
  private readonly acknowledgedCompletionMarkerByThreadId = new Map<string, string>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly threadStateByThreadId = new Map<string, T3ThreadActivityState>();
  private socket: WebSocket | undefined;
  private enabled = false;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private refreshTimer: NodeJS.Timeout | undefined;
  private connectPromise: Promise<WebSocket> | undefined;
  private refreshPromise: Promise<void> | undefined;
  private pendingSnapshotRequest: PendingSnapshotRequest | undefined;

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly options: T3ActivityMonitorOptions = {}) {}

  public dispose(): void {
    this.enabled = false;
    this.clearReconnectTimer();
    this.clearRefreshTimer();
    this.rejectPendingSnapshotRequest(new Error("T3 activity monitor disposed."));
    this.socket?.close();
    this.socket = undefined;
    this.threadStateByThreadId.clear();
    this.acknowledgedCompletionMarkerByThreadId.clear();
    this.changeEmitter.dispose();
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.enabled) {
      return;
    }

    this.enabled = enabled;
    if (!enabled) {
      this.clearReconnectTimer();
      this.clearRefreshTimer();
      this.rejectPendingSnapshotRequest(new Error("T3 activity monitor disabled."));
      this.socket?.close();
      this.socket = undefined;
      const changed = this.threadStateByThreadId.size > 0;
      this.threadStateByThreadId.clear();
      this.acknowledgedCompletionMarkerByThreadId.clear();
      if (changed) {
        this.changeEmitter.fire();
      }
      return;
    }

    await this.refreshSnapshot();
  }

  public getThreadActivity(threadId: string): T3ThreadActivityState | undefined {
    return this.threadStateByThreadId.get(threadId);
  }

  public acknowledgeThread(threadId: string): boolean {
    const state = this.threadStateByThreadId.get(threadId);
    if (!state?.completionMarker || state.activity !== "attention") {
      return false;
    }

    this.acknowledgedCompletionMarkerByThreadId.set(threadId, state.completionMarker);
    this.threadStateByThreadId.set(threadId, {
      ...state,
      activity: "idle",
    });
    this.changeEmitter.fire();
    return true;
  }

  public async refreshSnapshot(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.refreshPromise ??= (async () => {
      try {
        const snapshot = await this.requestSnapshot();
        this.clearReconnectTimer();
        this.applySnapshot(snapshot);
      } catch {
        this.scheduleReconnect();
      } finally {
        this.refreshPromise = undefined;
      }
    })();

    await this.refreshPromise;
  }

  private async requestSnapshot(): Promise<SnapshotResponse> {
    const socket = await this.connect();

    return new Promise<SnapshotResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingSnapshotRequest?.timeout === timeout) {
          this.pendingSnapshotRequest = undefined;
        }
        reject(new Error("Timed out waiting for T3 activity snapshot."));
      }, REQUEST_TIMEOUT_MS);

      this.pendingSnapshotRequest = {
        reject,
        resolve,
        timeout,
      };

      try {
        socket.send(
          JSON.stringify({
            body: {
              _tag: "orchestration.getSnapshot",
            },
            id: "vsmux-t3-activity-snapshot",
          }),
        );
      } catch (error) {
        clearTimeout(timeout);
        this.pendingSnapshotRequest = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private async connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    this.connectPromise ??= new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(this.getWebSocketUrl());

      const handleOpen = () => {
        this.socket = socket;
        socket.addEventListener("message", handleMessage);
        socket.addEventListener("close", handleClose);
        resolve(socket);
      };

      const handleError = () => {
        reject(new Error("Failed to connect to the T3 activity websocket."));
      };

      const handleClose = () => {
        if (this.socket === socket) {
          this.socket = undefined;
        }
        this.rejectPendingSnapshotRequest(new Error("T3 activity websocket closed."));
        if (this.enabled) {
          this.scheduleReconnect();
        }
      };

      const handleMessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
    }).finally(() => {
      this.connectPromise = undefined;
    });

    return this.connectPromise;
  }

  private handleMessage(raw: string | ArrayBuffer | Blob): void {
    if (typeof raw !== "string") {
      return;
    }

    let message:
      | {
          channel?: string;
          data?: SnapshotResponse;
          error?: { message?: string };
          id?: string;
          result?: SnapshotResponse;
          type?: string;
        }
      | undefined;
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return;
    }

    if (!message) {
      return;
    }

    if (message.type === "push" && message.channel === "orchestration.domainEvent") {
      this.scheduleSnapshotRefresh();
      return;
    }

    if (message.id !== "vsmux-t3-activity-snapshot" || !this.pendingSnapshotRequest) {
      return;
    }

    const pendingRequest = this.pendingSnapshotRequest;
    this.pendingSnapshotRequest = undefined;
    clearTimeout(pendingRequest.timeout);
    if (message.error?.message) {
      pendingRequest.reject(new Error(message.error.message));
      return;
    }

    pendingRequest.resolve(message.result ?? {});
  }

  private applySnapshot(snapshot: SnapshotResponse): void {
    const nextStateByThreadId = new Map<string, T3ThreadActivityState>();

    for (const thread of snapshot.threads ?? []) {
      if (!thread.id || thread.deletedAt) {
        continue;
      }

      const previousState = this.threadStateByThreadId.get(thread.id);
      const nextState = resolveThreadActivity(thread, previousState);
      const acknowledgedCompletionMarker =
        nextState.completionMarker &&
        this.acknowledgedCompletionMarkerByThreadId.get(thread.id) === nextState.completionMarker;

      if (nextState.activity === "attention" && acknowledgedCompletionMarker) {
        nextStateByThreadId.set(thread.id, {
          ...nextState,
          activity: "idle",
        });
        continue;
      }

      nextStateByThreadId.set(thread.id, nextState);
    }

    if (!haveSameThreadStateMaps(this.threadStateByThreadId, nextStateByThreadId)) {
      this.threadStateByThreadId.clear();
      for (const [threadId, state] of nextStateByThreadId) {
        this.threadStateByThreadId.set(threadId, state);
      }
      this.changeEmitter.fire();
    } else {
      this.threadStateByThreadId.clear();
      for (const [threadId, state] of nextStateByThreadId) {
        this.threadStateByThreadId.set(threadId, state);
      }
    }
  }

  private scheduleSnapshotRefresh(): void {
    if (!this.enabled || this.refreshTimer) {
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshSnapshot();
    }, REFRESH_DEBOUNCE_MS);
  }

  private scheduleReconnect(): void {
    if (!this.enabled || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.refreshSnapshot();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref?.();
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  private clearRefreshTimer(): void {
    if (!this.refreshTimer) {
      return;
    }

    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private rejectPendingSnapshotRequest(error: Error): void {
    if (!this.pendingSnapshotRequest) {
      return;
    }

    clearTimeout(this.pendingSnapshotRequest.timeout);
    const pendingRequest = this.pendingSnapshotRequest;
    this.pendingSnapshotRequest = undefined;
    pendingRequest.reject(error);
  }

  private getWebSocketUrl(): string {
    return this.options.getWebSocketUrl?.() ?? DEFAULT_T3_WEBSOCKET_URL;
  }
}

export function resolveThreadActivity(
  thread: SnapshotThread,
  previousState?: T3ThreadActivityState,
): T3ThreadActivityState {
  const sessionStatus = normalizeThreadSessionStatus(thread.session?.status);
  const latestTurnState = normalizeLatestTurnState(thread.latestTurn?.state);
  const isWorking =
    sessionStatus === "starting" || sessionStatus === "running" || latestTurnState === "running";
  const completionMarker = getCompletionMarker(thread);
  const shouldRaiseAttention =
    !isWorking &&
    previousState !== undefined &&
    completionMarker !== undefined &&
    completionMarker !== previousState?.completionMarker &&
    (latestTurnState === "completed" ||
      latestTurnState === "interrupted" ||
      latestTurnState === "error");
  const shouldKeepAttention =
    !isWorking &&
    completionMarker !== undefined &&
    previousState?.activity === "attention" &&
    previousState.completionMarker === completionMarker;

  return {
    activity: isWorking
      ? "working"
      : shouldRaiseAttention || shouldKeepAttention
        ? "attention"
        : "idle",
    completionMarker,
    isRunning:
      sessionStatus === "starting" ||
      sessionStatus === "running" ||
      sessionStatus === "ready" ||
      sessionStatus === "interrupted" ||
      latestTurnState === "running",
  };
}

function getCompletionMarker(thread: SnapshotThread): string | undefined {
  const latestTurnState = normalizeLatestTurnState(thread.latestTurn?.state);
  if (
    latestTurnState === "completed" ||
    latestTurnState === "interrupted" ||
    latestTurnState === "error"
  ) {
    return [
      "turn",
      thread.latestTurn?.turnId ?? "",
      latestTurnState,
      thread.latestTurn?.completedAt ?? "",
    ].join(":");
  }

  if (normalizeThreadSessionStatus(thread.session?.status) === "error") {
    return [
      "session",
      thread.session?.updatedAt ?? "",
      "error",
      thread.session?.lastError ?? "",
    ].join(":");
  }

  return undefined;
}

function normalizeThreadSessionStatus(status: unknown): string | undefined {
  return typeof status === "string" ? status : undefined;
}

function normalizeLatestTurnState(state: unknown): string | undefined {
  return typeof state === "string" ? state : undefined;
}

function haveSameThreadStateMaps(
  left: ReadonlyMap<string, T3ThreadActivityState>,
  right: ReadonlyMap<string, T3ThreadActivityState>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [threadId, leftState] of left) {
    const rightState = right.get(threadId);
    if (
      !rightState ||
      leftState.activity !== rightState.activity ||
      leftState.isRunning !== rightState.isRunning ||
      leftState.completionMarker !== rightState.completionMarker
    ) {
      return false;
    }
  }

  return true;
}
