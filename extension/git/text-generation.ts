import { access } from "node:fs/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { GitTextGenerationSettings } from "../../shared/git-text-generation-provider";
import { runShellCommand } from "./process";
import {
  buildGitTextGenerationShellCommand,
  parseGeneratedCommitMessageText,
  parseGeneratedPrContentText,
} from "./text-generation-utils";

const GIT_TEXT_GENERATION_TIMEOUT_MS = 180_000;

type CommitMessageGenerationInput = {
  branch: string | null;
  cwd: string;
  settings: GitTextGenerationSettings;
  stagedPatch: string;
  stagedSummary: string;
};

type PrContentGenerationInput = {
  baseBranch: string;
  commitSummary: string;
  cwd: string;
  diffPatch: string;
  diffSummary: string;
  headBranch: string;
  settings: GitTextGenerationSettings;
};

type CommitMessageGenerationResult = ReturnType<typeof parseGeneratedCommitMessageText>;
type PrContentGenerationResult = ReturnType<typeof parseGeneratedPrContentText>;

export async function generateCommitMessage(
  input: CommitMessageGenerationInput,
): Promise<CommitMessageGenerationResult> {
  const prompt = buildCommitMessagePrompt({
    branch: input.branch,
    stagedPatch: input.stagedPatch,
    stagedSummary: input.stagedSummary,
  });
  const generated = await runGitTextGenerationText({
    cwd: input.cwd,
    outputFileName: "commitmessage.txt",
    prompt,
    settings: input.settings,
    targetLabel: "commit message",
  });

  return parseGeneratedCommitMessageText(generated);
}

export async function generatePrContent(
  input: PrContentGenerationInput,
): Promise<PrContentGenerationResult> {
  const prompt = buildPrContentPrompt(input);
  const generated = await runGitTextGenerationText({
    cwd: input.cwd,
    outputFileName: "prcontent.txt",
    prompt,
    settings: input.settings,
    targetLabel: "pull request content",
  });

  return parseGeneratedPrContentText(generated);
}

async function runGitTextGenerationText(input: {
  cwd: string;
  outputFileName: string;
  prompt: string;
  settings: GitTextGenerationSettings;
  targetLabel: string;
}): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "vsmux-git-text-"));
  const outputFilePath = path.join(tempDir, input.outputFileName);
  const prompt = appendOutputHandlingInstructions(
    input.prompt,
    outputFilePath,
    input.settings,
    input.targetLabel,
  );
  const usesPromptStdin = input.settings.provider === "codex";

  try {
    const result = await runShellCommand(
      buildGitTextGenerationShellCommand(input.settings, prompt, outputFilePath),
      {
        cwd: input.cwd,
        interactiveShell: true,
        stdin: usesPromptStdin ? prompt : undefined,
        timeoutMs: GIT_TEXT_GENERATION_TIMEOUT_MS,
      },
    );
    if (result.exitCode !== 0) {
      throw createGitTextGenerationCommandError(input.settings, result, input.targetLabel);
    }

    const content = await readGeneratedOutput(outputFilePath, result.stdout);
    if (!content.trim()) {
      throw new Error(`Git text generation returned an empty ${input.targetLabel}.`);
    }

    return content;
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

function buildCommitMessagePrompt(input: {
  branch: string | null;
  stagedPatch: string;
  stagedSummary: string;
}): string {
  return [
    "Write a Git commit message for the staged changes.",
    "Return plain text only.",
    "Use this exact format:",
    "type(scope): short imperative summary",
    "- bullet point",
    "- bullet point",
    "",
    "Rules:",
    "- use a conventional commit type such as feat, fix, refactor, chore, docs, test, style, perf, build, or ci",
    "- prefer feat only when it really is a feature; otherwise pick the most accurate type",
    "- scope must be short, lowercase, and specific",
    "- summary must be imperative, specific, and <= 72 characters",
    "- body should be 3 to 8 concise bullet points when there are meaningful changes",
    "- do not use markdown code fences or commentary",
    "",
    "Example:",
    "feat(daemon): Implement terminal daemon session management and UI enhancements",
    "- Add functions to create session keys and index terminal snapshots by workspace.",
    "- Update terminal host protocol version to 10.",
    "- Introduce DaemonSessionsModal for managing and displaying active daemon sessions.",
    "- Enhance sidebar to include options for refreshing and killing daemon sessions.",
    "- Update session-related types and messages to include workspaceId.",
    "- Improve styling for session cards and modals for better user experience.",
    "- Refactor session card content to include debug session numbers and improve tooltips.",
    "- Adjust session context menu and overlay styles for better usability.",
    "",
    `Current branch: ${input.branch ?? "(detached)"}`,
    "",
    "Staged files:",
    limitSection(input.stagedSummary, 6_000),
    "",
    "Staged patch:",
    limitSection(input.stagedPatch, 40_000),
  ].join("\n");
}

function buildPrContentPrompt(input: {
  baseBranch: string;
  commitSummary: string;
  diffPatch: string;
  diffSummary: string;
  headBranch: string;
}): string {
  return [
    "Write GitHub pull request content for these changes.",
    "Return plain text only.",
    "Use this exact format:",
    "Concise PR title",
    "",
    "## Summary",
    "- bullet point",
    "",
    "## Testing",
    "- Not run",
    "",
    "Rules:",
    "- title must be concise and specific",
    "- body must be markdown",
    "- keep Summary and Testing short and concrete",
    "- do not use markdown code fences or commentary",
    "",
    `Base branch: ${input.baseBranch}`,
    `Head branch: ${input.headBranch}`,
    "",
    "Commits:",
    limitSection(input.commitSummary, 12_000),
    "",
    "Diff stat:",
    limitSection(input.diffSummary, 12_000),
    "",
    "Diff patch:",
    limitSection(input.diffPatch, 40_000),
  ].join("\n");
}

function appendOutputHandlingInstructions(
  prompt: string,
  outputFilePath: string,
  settings: GitTextGenerationSettings,
  targetLabel: string,
): string {
  const outputHandlingLines =
    settings.provider === "custom"
      ? [
          `- If you can write files in this environment, write the exact final result to ${outputFilePath}.`,
          "- If you cannot write the file, print only the final result to stdout.",
        ]
      : ["- Print only the final result to stdout."];

  return [
    prompt,
    "",
    "Output handling:",
    `- Produce only the final ${targetLabel}.`,
    "- Do not wrap the result in backticks.",
    ...outputHandlingLines,
  ].join("\n");
}

async function readGeneratedOutput(outputFilePath: string, stdout: string): Promise<string> {
  if (await fileExists(outputFilePath)) {
    return readFile(outputFilePath, "utf8");
  }

  return stdout;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function limitSection(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trimEnd();
}

function createGitTextGenerationCommandError(
  settings: GitTextGenerationSettings,
  result: {
    stderr: string;
    stdout: string;
  },
  targetLabel: string,
): Error {
  const detail = result.stderr.trim() || result.stdout.trim() || "Git text generation failed.";
  return new Error(
    `Git ${targetLabel} generation via ${describeGitTextGenerationSettings(settings)} failed: ${detail}`,
  );
}

function describeGitTextGenerationSettings(settings: GitTextGenerationSettings): string {
  if (settings.provider === "custom") {
    return `custom command "${settings.customCommand}"`;
  }

  return settings.provider === "claude"
    ? "Claude Haiku (high effort)"
    : "Codex gpt-5.4-mini (high effort)";
}
