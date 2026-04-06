import { describe, expect, test, vi } from "vite-plus/test";
import { formatRelativeTime, formatRelativeTimeLabel } from "./relative-time";

describe("formatRelativeTime", () => {
  test("should mirror the T3 just-now threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));

    expect(formatRelativeTime("2026-04-06T11:59:57.000Z")).toEqual({
      suffix: null,
      value: "just now",
    });
  });

  test("should format seconds, minutes, hours, and days with compact suffixes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));

    expect(formatRelativeTimeLabel("2026-04-06T11:59:40.000Z")).toBe("20s ago");
    expect(formatRelativeTimeLabel("2026-04-06T11:55:00.000Z")).toBe("5m ago");
    expect(formatRelativeTimeLabel("2026-04-06T10:00:00.000Z")).toBe("2h ago");
    expect(formatRelativeTimeLabel("2026-04-04T12:00:00.000Z")).toBe("2d ago");
  });

  test("should clamp future timestamps to just now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));

    expect(formatRelativeTimeLabel("2026-04-06T12:00:05.000Z")).toBe("just now");
  });
});
