import { describe, expect, test, vi } from "vite-plus/test";
import {
  GENERATED_SESSION_TITLE_MAX_LENGTH,
  SESSION_RENAME_SUMMARY_THRESHOLD,
  resolveSessionRenameTitle,
  shouldSummarizeSessionRenameTitle,
} from "./session-title-generation";

describe("shouldSummarizeSessionRenameTitle", () => {
  test("should skip summarization at the threshold", () => {
    expect(shouldSummarizeSessionRenameTitle("x".repeat(SESSION_RENAME_SUMMARY_THRESHOLD))).toBe(
      false,
    );
  });

  test("should summarize when the trimmed title exceeds the threshold", () => {
    expect(
      shouldSummarizeSessionRenameTitle(`  ${"x".repeat(SESSION_RENAME_SUMMARY_THRESHOLD + 1)} `),
    ).toBe(true);
  });
});

describe("resolveSessionRenameTitle", () => {
  test("should return the trimmed title when summarization is not needed", async () => {
    const generateTitle = vi.fn(async () => "Ignored");

    await expect(
      resolveSessionRenameTitle(
        {
          cwd: "/workspace",
          settings: { customCommand: "", provider: "codex" },
          title: "  Tidy name  ",
        },
        generateTitle,
      ),
    ).resolves.toBe("Tidy name");

    expect(generateTitle).not.toHaveBeenCalled();
  });

  test("should generate a session title when the title is long", async () => {
    const generateTitle = vi.fn(async () => "Fix sidebar rename");

    await expect(
      resolveSessionRenameTitle(
        {
          cwd: "/workspace",
          settings: { customCommand: "", provider: "claude" },
          title: "Paste this whole paragraph about the bug and the intended fix please",
        },
        generateTitle,
      ),
    ).resolves.toBe("Fix sidebar rename");

    expect(generateTitle).toHaveBeenCalledWith({
      cwd: "/workspace",
      settings: { customCommand: "", provider: "claude" },
      sourceText: "Paste this whole paragraph about the bug and the intended fix please",
    });
  });

  test("should expose a generated title max length under the summarize threshold", () => {
    expect(GENERATED_SESSION_TITLE_MAX_LENGTH).toBeLessThan(SESSION_RENAME_SUMMARY_THRESHOLD);
  });
});
