import { describe, expect, test } from "vite-plus/test";
import { getHookResponseForInput, getNormalizedEventType } from "./agent-shell-notify-runner";

describe("getHookResponseForInput", () => {
  test("should acknowledge Codex UserPromptSubmit hooks with valid JSON", () => {
    const response = getHookResponseForInput(
      JSON.stringify({
        agent: "codex",
        hook_event_name: "UserPromptSubmit",
      }),
    );

    expect(response).toBeDefined();
    expect(JSON.parse(response ?? "null")).toEqual({ continue: true });
  });

  test("should not emit hook JSON for lifecycle events", () => {
    const response = getHookResponseForInput(
      JSON.stringify({
        agent: "codex",
        hook_event_name: "Stop",
      }),
    );

    expect(response).toBeUndefined();
  });
});

describe("getNormalizedEventType", () => {
  test("should keep watcher lifecycle events intact", () => {
    expect(
      getNormalizedEventType(
        JSON.stringify({
          agent: "codex",
          hook_event_name: "Start",
        }),
      ),
    ).toBe("start");

    expect(
      getNormalizedEventType(
        JSON.stringify({
          agent: "codex",
          hook_event_name: "Stop",
        }),
      ),
    ).toBe("stop");
  });

  test("should continue mapping Codex task completion log events to stop", () => {
    expect(
      getNormalizedEventType(
        JSON.stringify({
          type: "task_complete",
        }),
      ),
    ).toBe("stop");
  });
});
