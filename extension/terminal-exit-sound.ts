import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const CLOSE_TERMINAL_ON_EXIT_SOUND_PATH = "/System/Library/Sounds/Tink.aiff";
export const CLOSE_TERMINAL_ON_EXIT_SOUND_VOLUME = 0.5;

type ExecFileLike = (
  file: string,
  args: readonly string[],
) => Promise<{
  stderr: string;
  stdout: string;
}>;

export async function playCloseTerminalOnExitSound(
  options: {
    platform?: NodeJS.Platform;
    runCommand?: ExecFileLike;
  } = {},
): Promise<void> {
  if ((options.platform ?? process.platform) !== "darwin") {
    return;
  }

  try {
    await (options.runCommand ?? execFileAsync)("afplay", [
      "-v",
      String(CLOSE_TERMINAL_ON_EXIT_SOUND_VOLUME),
      CLOSE_TERMINAL_ON_EXIT_SOUND_PATH,
    ]);
  } catch {
    // Ignore notification failures so terminal cleanup is never blocked.
  }
}
