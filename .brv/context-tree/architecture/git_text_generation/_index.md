---
children_hash: b9f72c34edf0ae5bf25057340594d25cfa03cb9f19ca6aa88c1f4dd6f46c53c8
compression_ratio: 0.8184754521963824
condensation_order: 1
covers: [context.md, low_effort_provider_settings.md]
covers_token_total: 1548
summary_level: d1
token_count: 1267
type: summary
---

# git_text_generation

Structural overview of built-in git text generation configuration and execution flow for commit messages, PR content, and session titles. See `low_effort_provider_settings` for provider commands, parsing rules, and prompt constraints.

## Scope and Architecture

- `context.md` defines the topic as provider-specific command construction, low-effort defaults, prompt transport, output parsing, and session title clamping.
- Core implementation is split across:
  - `extension/git/text-generation-utils.ts` — command construction, parsing helpers, shell argument handling
  - `extension/git/text-generation.ts` — prompt assembly, provider execution, result handling
  - `extension/git/text-generation.test.ts` — behavior and constraint coverage
  - `package.json` — provider labels, descriptions, and exposed settings
- Related drill-down:
  - `architecture/terminal_workspace/session_rename_title_auto_summarization` — session title length limits and rename behavior intersect here

## End-to-End Flow

From `low_effort_provider_settings`:

- Flow is:
  - build prompt
  - append output instructions
  - build provider shell command
  - run shell command
  - read output file or stdout
  - parse and sanitize result
  - return commit message, PR content, or session title
- Custom commands support `{outputFile}` and `{prompt}` expansion.
- If `{prompt}` is absent from a custom command, the quoted prompt is appended automatically.
- Output may come from either a temp file or stdout.

## Provider Configuration Decisions

From `low_effort_provider_settings`:

- Built-in providers are intentionally pinned to low-effort behavior as of `2026-04-06`.
- Codex:
  - command shape: `exec codex -m gpt-5.4-mini -c model_reasoning_effort="low" exec -`
  - model: `gpt-5.4-mini`
  - prompt transport: stdin via trailing `exec -`
- Claude:
  - command shape: `exec claude --model haiku --effort low -p ...`
  - model: `haiku`
  - effort flag: `--effort low`
  - prompt transport: CLI `-p` in interactive shell mode
- Default provider setting:
  - `VSmux.gitTextGenerationProvider = codex`
- Package metadata was updated to describe these as low-effort built-in providers.
- Existing user-edited numeric session rename generation limits were preserved rather than overwritten.

## Dependencies and Interfaces

From `low_effort_provider_settings`:

- Execution depends on:
  - `runShellCommand` from `./process`
  - temp filesystem helpers: `mkdtemp`, `readFile`, `rm`
  - shell quoting from `../agent-shell-integration-utils`
  - `GENERATED_SESSION_TITLE_MAX_LENGTH` from the native terminal workspace session title generator
- Configuration keys:
  - `VSmux.gitTextGenerationProvider`
  - `VSmux.gitTextGenerationCustomCommand`
- Public API surface generates:
  - commit messages
  - PR content
  - session titles

## Parsing, Sanitization, and Error Behavior

See `low_effort_provider_settings`:

- Empty outputs are treated as fatal for:
  - commit messages
  - PR content
  - session titles
- Non-zero provider exits are wrapped with provider-specific error text from `describeGitTextGenerationSettings`.
- Session titles are clamped to `GENERATED_SESSION_TITLE_MAX_LENGTH`.
- Tested session title behavior keeps output under 25 characters.

## Preserved Patterns and Recognition Rules

From `low_effort_provider_settings`:

- Conventional commit subjects preserved when matching:
  - `^[a-z]+\([a-z0-9._/-]+\):\s+.+$`
- Fenced generated output stripped with:
  - `^```(?:[a-z0-9_-]+)?\n([\s\S]*?)\n```$`
- Patch file paths extracted from:
  - `^diff --git a\/(.+?) b\/(.+)$`
- Safe unquoted shell args detected with:
  - `^[a-z0-9._-]+$`

## Prompt and Output Constraints

Detailed in `low_effort_provider_settings`:

### Commit messages

- Conventional commit type required
- Scope must be short, lowercase, specific
- Summary must be imperative, specific, and `<= 40` characters
- Body should be `3 to 8` concise bullet points when meaningful
- No markdown code fences or commentary

### PR content

- Title must be concise and specific
- Body must be markdown
- `Summary` and `Testing` should stay short and concrete
- No markdown code fences or commentary

### Session titles

- Prefer `2 to 4` words
- Must be specific and scannable
- Must not exceed tested `< 25 characters` behavior and must remain below `GENERATED_SESSION_TITLE_MAX_LENGTH + 1`
- No quotes, markdown, commentary, or trailing punctuation
- Focus on task, bug, feature, or topic

## Key Facts to Retain

From `low_effort_provider_settings`:

- Built-in git text generation providers use low-effort settings.
- Timeout is `180000 ms`.
- Codex uses `gpt-5.4-mini`.
- Claude uses `haiku`.
- Codex prompt transport is stdin-based with `exec -`.
- Session title parsing clamps to `GENERATED_SESSION_TITLE_MAX_LENGTH`.
- User-customized numeric session rename limits remain intact.

## Drill-down Map

- `context.md` — topic boundaries, concepts, and related topic link
- `low_effort_provider_settings.md` — exact provider commands, files, patterns, prompt rules, error behavior, and retained facts
