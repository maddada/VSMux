import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("vscode", () => ({
  EventEmitter: class MockEventEmitter<T> {
    public readonly event = vi.fn(() => ({ dispose: vi.fn() }));

    public dispose(): void {}

    public fire(_value: T): void {}
  },
}));

import { resolveThreadActivity } from "./t3-activity-monitor";

describe("resolveThreadActivity", () => {
  test("should not raise attention from the first completed snapshot after reload", () => {
    expect(
      resolveThreadActivity({
        id: "thread-1",
        latestTurn: {
          completedAt: "2026-03-22T10:00:00.000Z",
          state: "completed",
          turnId: "turn-1",
        },
        session: {
          status: "ready",
          updatedAt: "2026-03-22T10:00:00.000Z",
        },
      }),
    ).toEqual({
      activity: "idle",
      completionMarker: "turn:turn-1:completed:2026-03-22T10:00:00.000Z",
      isRunning: true,
    });
  });

  test("should raise attention when a new completion follows a previously observed working state", () => {
    expect(
      resolveThreadActivity(
        {
          id: "thread-1",
          latestTurn: {
            completedAt: "2026-03-22T10:00:00.000Z",
            state: "completed",
            turnId: "turn-1",
          },
          session: {
            status: "ready",
            updatedAt: "2026-03-22T10:00:00.000Z",
          },
        },
        {
          activity: "working",
          completionMarker: undefined,
          isRunning: true,
        },
      ),
    ).toEqual({
      activity: "attention",
      completionMarker: "turn:turn-1:completed:2026-03-22T10:00:00.000Z",
      isRunning: true,
    });
  });
});
