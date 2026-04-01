import { describe, expect, test, vi } from "vite-plus/test";
import {
  CLOSE_TERMINAL_ON_EXIT_SOUND_PATH,
  CLOSE_TERMINAL_ON_EXIT_SOUND_VOLUME,
  playCloseTerminalOnExitSound,
} from "./terminal-exit-sound";

describe("playCloseTerminalOnExitSound", () => {
  test("should play the Tink sound at 50% volume on macOS", async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: "",
    });

    await playCloseTerminalOnExitSound({
      platform: "darwin",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith("afplay", [
      "-v",
      String(CLOSE_TERMINAL_ON_EXIT_SOUND_VOLUME),
      CLOSE_TERMINAL_ON_EXIT_SOUND_PATH,
    ]);
  });

  test("should skip playback on non-macOS platforms", async () => {
    const runCommand = vi.fn();

    await playCloseTerminalOnExitSound({
      platform: "linux",
      runCommand,
    });

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("should ignore playback failures", async () => {
    const runCommand = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      playCloseTerminalOnExitSound({
        platform: "darwin",
        runCommand,
      }),
    ).resolves.toBeUndefined();
  });
});
