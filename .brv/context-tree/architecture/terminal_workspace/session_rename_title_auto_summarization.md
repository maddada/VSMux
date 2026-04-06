---
title: Session Rename Title Auto Summarization
tags: []
related: [architecture/terminal_workspace/current_state.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:46:46.154Z"
updatedAt: "2026-04-06T03:46:46.154Z"
---

## Raw Concept

**Task:**
Document automatic session rename title summarization for long user-provided titles in the native terminal workspace

**Changes:**

- Added auto-summarization for long session rename input
- Reused existing git text-generation provider stack for session title generation
- Preserved terminal rename command dispatch after resolved title is applied
- Added trimming, threshold gating, sanitization, and provider configuration checks

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/native-terminal-workspace/session-title-generation.ts
- extension/native-terminal-workspace/session-title-generation.test.ts
- extension/git/text-generation.ts
- extension/git/text-generation-utils.ts

**Flow:**
user enters rename title -> trim input -> if length <= 25 apply directly -> else validate git text-generation provider -> show progress notification -> generate session title -> sanitize generated output -> set session title -> for terminal sessions send /rename {resolvedTitle}

**Timestamp:** 2026-04-06

**Patterns:**

- `title\.trim\(\)\.length > 25` - Determines whether a session rename title should be summarized before rename is applied
- `^["'0]+|["'0]+$` - Removes wrapping quotes and backticks from generated session titles
- `\s+` - Collapses repeated whitespace in generated session titles
- `[.]+$` - Removes trailing periods from generated session titles
- `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$` (flags: i) - Unwraps fenced generated text before parsing the session title

## Narrative

### Structure

Session rename summarization is initiated in native-terminal-workspace/controller.ts inside renameSessionFromUserInput. The controller trims the user input, skips empty values, and checks shouldSummarizeSessionRenameTitle before deciding whether to call resolveSessionRenameTitle. The resolution module in session-title-generation.ts delegates long-title summarization to generateSessionTitle in extension/git/text-generation.ts, which uses the shared git text-generation execution path also used for commit messages and PR content.

### Dependencies

Long-title rename generation depends on getGitTextGenerationSettings, hasConfiguredGitTextGenerationProvider, resolveSessionRenameTitle, and the shared runGitTextGenerationText shell execution path. The default provider uses Codex gpt-5.4-mini with high reasoning effort, Claude uses Haiku with high effort, and the custom provider requires VSmux.gitTextGenerationCustomCommand to be configured. Shell execution may use stdin for codex, may write output to a temporary sessiontitle.txt file, and always cleans up the temporary directory after execution.

### Highlights

Summarization is triggered only when the trimmed title length exceeds 25 characters, while shorter titles are preserved except for trimming. VS Code surfaces progress with title "VSmux" and message "Generating session name...", and generation failures abort the rename after showing getErrorMessage(error). Generated titles are sanitized to plain text by selecting the first non-empty line, stripping quotes or backticks, collapsing whitespace, trimming, and removing trailing periods. Terminal sessions preserve existing backend rename behavior by still issuing /rename {resolvedTitle} after the stored title changes.

### Rules

Rules:

- keep it specific and scannable
- prefer 2 to 6 words when possible
- target <= 40 characters
- do not use quotes, markdown, or commentary
- do not end with punctuation
- focus on the task, bug, feature, or topic

### Examples

Example threshold behavior: a title whose trimmed length is exactly SESSION_RENAME_SUMMARY_THRESHOLD is not summarized, while a trimmed title with threshold + 1 characters is summarized. Example generation call: resolveSessionRenameTitle({ cwd: "/workspace", settings: { customCommand: "", provider: "claude" }, title: "Paste this whole paragraph about the bug and the intended fix please" }) resolves to "Fix sidebar rename" in tests. Example provider errors include "Git text generation returned an empty session title." and "VSmux.gitTextGenerationCustomCommand must be configured when the Git text generation provider is custom."

## Facts

- **session_rename_summary_threshold**: Session rename titles are summarized only when title.trim().length > 25. [project]
- **session_rename_short_title_behavior**: Short session rename titles are applied directly after trimming without generation. [project]
- **session_rename_progress_ui**: During session name generation, VS Code shows progress title "VSmux" with message "Generating session name...". [project]
- **session_rename_custom_provider_requirement**: If the git text generation provider is custom and VSmux.gitTextGenerationCustomCommand is empty, rename aborts with a configuration error. [project]
- **terminal_session_rename_command**: Terminal session renames still send /rename {title} after storing the resolved title. [project]
- **git_text_generation_timeout_ms**: Git text generation commands time out after 180000 ms. [project]
- **git_text_generation_default_provider**: The default provider shell command uses codex -m gpt-5.4-mini -c model_reasoning_effort="high" exec -. [project]
- **git_text_generation_claude_provider**: The Claude provider shell command uses claude --model haiku --effort high -p <prompt>. [project]
- **git_text_generation_custom_placeholders**: Custom git text generation commands support {prompt} and {outputFile} placeholders. [project]
- **session_title_sanitization**: Generated session titles are sanitized by taking the first non-empty line, removing wrapping quotes or backticks, collapsing whitespace, trimming, and removing trailing periods. [project]
