import { mkdtemp, readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  createDefaultPersistedSessionState,
  deletePersistedSessionStateFile,
  readPersistedSessionStateFromFile,
  writePersistedSessionStateToFile,
} from "./session-state-file";

describe("deletePersistedSessionStateFile", () => {
  test("should remove the persisted session state file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-session-state-"));
    const filePath = path.join(tempDir, "session-00.state");

    await writePersistedSessionStateToFile(filePath, {
      agentName: "claude",
      agentStatus: "attention",
      title: "Claude Code",
    });
    await readFile(filePath, "utf8");

    await deletePersistedSessionStateFile(filePath);

    await expect(readPersistedSessionStateFromFile(filePath)).resolves.toEqual(
      createDefaultPersistedSessionState(),
    );
  });
});
