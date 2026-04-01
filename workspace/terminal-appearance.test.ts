import { describe, expect, test } from "vite-plus/test";
import { getTerminalAppearanceOptions } from "./terminal-appearance";

describe("getTerminalAppearanceOptions", () => {
  test("should map every workspace terminal appearance field into xterm options", () => {
    expect(
      getTerminalAppearanceOptions({
        cursorBlink: false,
        cursorStyle: "underline",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 15,
        letterSpacing: 1.25,
        lineHeight: 1.4,
      }),
    ).toEqual({
      cursorBlink: false,
      cursorStyle: "underline",
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 15,
      letterSpacing: 1.25,
      lineHeight: 1.4,
    });
  });
});
