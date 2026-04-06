---
title: Session Rename Title Auto Summarization Facts
tags: []
related: [architecture/terminal_workspace/session_rename_title_auto_summarization.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:46:46.157Z"
updatedAt: "2026-04-06T04:22:39.102Z"
---

## Raw Concept

**Task:**
Capture factual constraints and runtime settings for session rename title generation

**Changes:**

- Captured threshold, max length, provider, and sanitization facts for session rename title generation

**Files:**

- extension/native-terminal-workspace/session-title-generation.ts
- extension/git/text-generation.ts
- extension/git/text-generation-utils.ts
- extension/git/text-generation.test.ts

**Flow:**
source code and tests -> extract stable constants and behaviors -> store as reusable project facts

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact set isolates the stable constants, provider selections, prompt constraints, and sanitization rules behind session rename title generation so they can be reused without rereading implementation files.

### Dependencies

The facts are derived from session-title-generation.ts, text-generation.ts, text-generation-utils.ts, and their tests, which collectively define thresholds, prompt wording, command construction, timeout behavior, and sanitization.

### Highlights

The implementation uses a 25-character decision threshold, a 24-character enforced output cap, provider-specific execution modes, and tests that validate truncation and sanitization outcomes for realistic title inputs.

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
