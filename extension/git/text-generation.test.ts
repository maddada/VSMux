import { describe, expect, test } from "vite-plus/test";
import {
  buildGitTextGenerationShellCommand,
  parseGeneratedCommitMessageText,
  parseGeneratedPrContentText,
} from "./text-generation-utils";

describe("buildGitTextGenerationShellCommand", () => {
  test("should build the pinned codex command", () => {
    expect(
      buildGitTextGenerationShellCommand(
        { customCommand: "", provider: "codex" },
        "prompt text",
        "/tmp/commitmessage.txt",
      ),
    ).toBe(
      `exec codex -m gpt-5.4-mini -c 'model_reasoning_effort="high"' exec -`,
    );
  });

  test("should build the pinned claude command", () => {
    expect(
      buildGitTextGenerationShellCommand(
        { customCommand: "", provider: "claude" },
        "prompt text",
        "/tmp/commitmessage.txt",
      ),
    ).toBe("exec claude --model haiku --effort high -p 'prompt text'");
  });

  test("should expand custom command placeholders", () => {
    expect(
      buildGitTextGenerationShellCommand(
        {
          customCommand: "my-generator --out {outputFile} --prompt {prompt}",
          provider: "custom",
        },
        "prompt text",
        "/tmp/commitmessage.txt",
      ),
    ).toBe(
      "my-generator --out '/tmp/commitmessage.txt' --prompt 'prompt text'",
    );
  });
});

describe("parseGeneratedCommitMessageText", () => {
  test("should split the subject and body", () => {
    expect(
      parseGeneratedCommitMessageText(`feat(git): Improve commit message generation

- Add explicit provider settings for Claude and Codex.
- Read generated output from a temp file before cleanup.`),
    ).toEqual({
      body: [
        "- Add explicit provider settings for Claude and Codex.",
        "- Read generated output from a temp file before cleanup.",
      ].join("\n"),
      subject: "feat(git): Improve commit message generation",
    });
  });

  test("should strip markdown fences", () => {
    expect(
      parseGeneratedCommitMessageText(`\`\`\`
fix(git): Handle empty custom command

- Show a clear error when the provider is custom and the command is missing.
\`\`\``),
    ).toEqual({
      body: "- Show a clear error when the provider is custom and the command is missing.",
      subject: "fix(git): Handle empty custom command",
    });
  });
});

describe("parseGeneratedPrContentText", () => {
  test("should split the title and body", () => {
    expect(
      parseGeneratedPrContentText(`Improve git text generation settings

## Summary
- Add explicit Claude and Codex settings.

## Testing
- pnpm exec tsc -p ./tsconfig.extension.json --noEmit`),
    ).toEqual({
      body: [
        "## Summary",
        "- Add explicit Claude and Codex settings.",
        "",
        "## Testing",
        "- pnpm exec tsc -p ./tsconfig.extension.json --noEmit",
      ].join("\n"),
      title: "Improve git text generation settings",
    });
  });
});
