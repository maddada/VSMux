---
title: Low Effort Provider Settings
tags: []
related: [architecture/terminal_workspace/session_rename_title_auto_summarization.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:13:37.531Z"
updatedAt: "2026-04-06T11:13:37.531Z"
---

## Raw Concept

**Task:**
Document low-effort built-in provider settings and supporting git text generation behavior

**Changes:**

- Set Codex shell command to use model_reasoning_effort="low"
- Set Claude shell command to use --effort low
- Updated package.json provider descriptions and labels to describe low-effort built-in providers
- Preserved existing user-edited numeric session rename generation limits

**Files:**

- extension/git/text-generation-utils.ts
- extension/git/text-generation.ts
- extension/git/text-generation.test.ts
- package.json

**Flow:**
build prompt -> append output instructions -> build provider shell command -> run shell command -> read output file or stdout -> parse and sanitize result -> return generated commit message, PR content, or session title

**Timestamp:** 2026-04-06

**Patterns:**

- `^[a-z]+\([a-z0-9._/-]+\):\s+.+$` (flags: i) - Recognizes conventional commit subjects that should be preserved instead of being rewritten.
- `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$` (flags: i) - Strips surrounding fenced code blocks from generated text before parsing.
- `^diff --git a\/(.+?) b\/(.+)$` - Extracts file paths from patch sections when building prioritized commit patch samples.
- `^[a-z0-9._-]+$` (flags: i) - Determines whether a shell argument can be emitted without quoting.

## Narrative

### Structure

Git text generation is split between extension/git/text-generation-utils.ts for command construction and parsing helpers, extension/git/text-generation.ts for prompt assembly and shell execution, extension/git/text-generation.test.ts for behavior coverage, and package.json for exposed configuration settings. The public APIs generate commit messages, PR content, and session titles by building prompts, invoking a provider command, and parsing the returned text.

### Dependencies

Execution depends on runShellCommand from ./process, temporary filesystem handling via mkdtemp/readFile/rm, shell quoting from ../agent-shell-integration-utils, and GENERATED_SESSION_TITLE_MAX_LENGTH from the native-terminal-workspace session title generator. Provider behavior depends on GitTextGenerationSettings and package configuration keys VSmux.gitTextGenerationProvider and VSmux.gitTextGenerationCustomCommand.

### Highlights

As of 2026-04-06, built-in providers are pinned to low-effort defaults: Codex uses gpt-5.4-mini with model_reasoning_effort="low" and Claude uses haiku with --effort low. Codex is run with stdin-fed prompts using exec -, while Claude uses -p and interactive shell mode. Custom commands expand {outputFile} and {prompt}, append a quoted prompt when {prompt} is absent, and may return output through either a file or stdout. Empty outputs are fatal for commit messages, PR content, and session titles, and non-zero exits are wrapped with provider-specific error text from describeGitTextGenerationSettings.

### Rules

Commit message prompt rules:

- use conventional commit type such as feat, fix, refactor, chore, docs, test, style, perf, build, or ci
- prefer feat only when it really is a feature; otherwise pick the most accurate type
- scope must be short, lowercase, and specific
- summary must be imperative, specific, and <= 40 characters
- body should be 3 to 8 concise bullet points when there are meaningful changes
- do not use markdown code fences or commentary

PR content prompt rules:

- title must be concise and specific
- body must be markdown
- keep Summary and Testing short and concrete
- do not use markdown code fences or commentary

Session title prompt rules:

- keep it specific and scannable
- prefer 2 to 4 words when possible
- must be fewer than 25 characters in tested behavior and fewer than GENERATED_SESSION_TITLE_MAX_LENGTH + 1 by rule
- do not use quotes, markdown, or commentary
- do not end with punctuation
- focus on the task, bug, feature, or topic

### Examples

Example Codex command: exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -
Example Claude command: exec claude --model haiku --effort low -p prompt text
Example custom command expansion: my-generator --out /tmp/commitmessage.txt --prompt prompt text
Example preserved commit subject format: feat(git): Improve commit message generation
Example parsed PR title: Improve git text generation settings
Example parsed session title after clamping: Polish sidebar rename

## Facts

- **git_text_generation_effort**: Built-in git text generation providers now use low effort settings. [project]
- **git_text_generation_codex_model**: Codex git text generation uses model gpt-5.4-mini. [project]
- **git_text_generation_claude_model**: Claude git text generation uses model haiku. [project]
- **git_text_generation_timeout_ms**: Git text generation timeout is 180000 milliseconds. [project]
- **git_text_generation_provider_default**: The default VSmux.gitTextGenerationProvider setting is codex. [project]
- **git_text_generation_codex_prompt_transport**: Codex receives the git text generation prompt via stdin and the command ends with exec -. [project]
- **generated_session_title_max_length_behavior**: Session title parsing clamps output to GENERATED_SESSION_TITLE_MAX_LENGTH and tested behavior is under 25 characters. [project]
- **session_rename_numeric_limits**: Existing user-edited numeric session rename limits were intentionally preserved. [project]
