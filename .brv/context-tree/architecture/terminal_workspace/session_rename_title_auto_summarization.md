---
title: Session Rename Title Auto Summarization
tags: []
related: [architecture/terminal_workspace/current_state.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:46:46.154Z"
updatedAt: "2026-04-06T04:22:39.099Z"
---

## Raw Concept

**Task:**
Document session rename title auto-summarization thresholds, provider prompt rules, sanitization, and runtime behavior

**Changes:**

- Added 25-character threshold for deciding when rename titles need summarization
- Added 24-character clamp for generated session titles
- Documented provider-specific command construction and output handling for session title generation
- Documented sanitization and whole-word truncation rules for generated session titles

**Files:**

- extension/native-terminal-workspace/session-title-generation.ts
- extension/git/text-generation.ts
- extension/git/text-generation-utils.ts
- extension/git/text-generation.test.ts

**Flow:**
trim rename title -> compare against threshold 25 -> if short return trimmed title -> if long build session title prompt -> run provider command with timeout -> resolve stdout or output file -> parse first non-empty line -> sanitize quotes whitespace and punctuation -> clamp to 24 chars

**Timestamp:** 2026-04-06

## Narrative

### Structure

Session rename summarization is split between native-terminal-workspace/session-title-generation.ts, which decides whether summarization is required, and git/text-generation.ts plus git/text-generation-utils.ts, which build provider prompts, run shell commands, normalize provider output, and sanitize the final title. The pipeline reuses the generic git text generation subsystem but applies session-title-specific prompt and length constraints.

### Dependencies

Session title generation depends on GitTextGenerationSettings provider configuration, runShellCommand execution, temporary output-file handling for custom providers, and shared sanitization helpers in text-generation-utils.ts. The maximum title length constant is shared between the thresholding layer and sanitization layer so prompt instructions and post-processing remain aligned.

### Highlights

Titles at 25 characters or fewer are returned trimmed and unchanged. Longer titles are summarized with prompt instructions that require fewer than 25 characters, specificity, scannability, 2 to 4 words when possible, no quotes or markdown, and no ending punctuation. Final parsing uses the first non-empty line, strips code fences when the whole response is fenced, removes wrapping quotes, collapses whitespace, strips trailing periods, and clamps to 24 characters with whole-word preference before falling back to a raw slice.

### Rules

Generated session rename titles must stay under 25 characters.
Titles are summarized only when title.trim().length > 25.
Titles at 25 characters or fewer are returned trimmed, unchanged.
Return plain text only.

- keep it specific and scannable
- prefer 2 to 4 words when possible
- must be fewer than 25 characters
- do not use quotes, markdown, or commentary
- do not end with punctuation
- focus on the task, bug, feature, or topic
- Produce only the final session title.
- Do not wrap the result in backticks.
- Print only the final result to stdout.

### Examples

"Polish sidebar rename flow" becomes "Polish sidebar rename".
"Fix pasted rename summaries." becomes "Fix pasted rename".
"supercalifragilisticexpialidocious" becomes "supercalifragilisticexp".
End-to-end flow: trim incoming rename title -> if length <= 25 return as-is -> else build session-title prompt -> run provider command -> resolve output -> sanitize -> clamp to 24 chars.

## Facts

- **session_title_length_limit**: Generated session rename titles must stay under 25 characters. [project]
- **session_rename_summary_threshold**: SESSION_RENAME_SUMMARY_THRESHOLD is 25. [project]
- **generated_session_title_max_length**: GENERATED_SESSION_TITLE_MAX_LENGTH is 24. [project]
- **session_rename_summary_condition**: Session rename titles are summarized only when title.trim().length is greater than 25. [project]
- **session_title_sanitization_limit**: Generated session titles are sanitized and clamped to 24 characters. [project]
- **session_title_truncation_strategy**: Truncation prefers whole words and falls back to slicing to 24 characters when needed. [project]
- **git_text_generation_timeout_ms**: Git text generation uses a timeout of 180000 milliseconds. [project]
- **provider_prompt_delivery_modes**: Codex provider uses stdin prompt delivery while non-codex providers use interactive shell. [project]
- **session_title_prompt_output_rules**: The session title prompt requires plain text only, no quotes, markdown, commentary, or ending punctuation. [convention]
- **session_title_prompt_word_preference**: The session title prompt prefers 2 to 4 words when possible. [convention]
- **codex_session_title_model**: Codex session title generation is pinned to model gpt-5.4-mini with high reasoning effort. [project]
- **claude_session_title_model**: Claude session title generation is pinned to model haiku with high effort. [project]
