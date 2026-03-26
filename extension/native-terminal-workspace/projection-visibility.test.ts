import { describe, expect, test } from "vite-plus/test";
import { isProjectedSessionSurfaceVisibleInTargetGroup } from "./projection-visibility";

describe("isProjectedSessionSurfaceVisibleInTargetGroup", () => {
  test("should accept a surface that is foreground-visible in the expected group", () => {
    expect(
      isProjectedSessionSurfaceVisibleInTargetGroup(
        {
          isForegroundVisible: true,
          observedViewColumn: 2,
        },
        1,
      ),
    ).toBe(true);
  });

  test("should reject a surface that is in the expected group but hidden behind another tab", () => {
    expect(
      isProjectedSessionSurfaceVisibleInTargetGroup(
        {
          isForegroundVisible: false,
          observedViewColumn: 2,
        },
        1,
      ),
    ).toBe(false);
  });

  test("should reject a foreground-visible surface in the wrong group", () => {
    expect(
      isProjectedSessionSurfaceVisibleInTargetGroup(
        {
          isForegroundVisible: true,
          observedViewColumn: 1,
        },
        1,
      ),
    ).toBe(false);
  });

  test("should reject a surface with no observed group", () => {
    expect(
      isProjectedSessionSurfaceVisibleInTargetGroup(
        {
          isForegroundVisible: true,
        },
        0,
      ),
    ).toBe(false);
  });
});
