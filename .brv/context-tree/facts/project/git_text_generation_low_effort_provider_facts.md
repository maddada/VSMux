---
title: Git Text Generation Low Effort Provider Facts
tags: []
related: [architecture/git_text_generation/low_effort_provider_settings.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T11:13:37.533Z"
updatedAt: "2026-04-06T11:13:37.533Z"
---

## Raw Concept

**Task:**
Record factual project settings for git text generation providers and execution behavior

**Changes:**

- Recorded provider defaults and enum values
- Recorded timeout and execution mode facts
- Recorded preserved session rename limit behavior

**Files:**

- extension/git/text-generation-utils.ts
- extension/git/text-generation.ts
- extension/git/text-generation.test.ts
- package.json

**Flow:**
configuration -> provider command selection -> shell execution -> output retrieval -> parsing

**Timestamp:** 2026-04-06

## Narrative

### Structure

This fact record captures stable configuration and runtime properties exposed by the git text generation implementation and package settings.

### Dependencies

These facts depend on package.json configuration entries and the text generation runtime helpers in extension/git.

### Highlights

The current built-in providers are low-effort Codex and low-effort Claude, with codex as the default package setting and a 180 second execution timeout.

## Facts

- **git_text_generation_provider_default**: VSmux.gitTextGenerationProvider defaults to codex. [project]
- **git_text_generation_provider_enum**: VSmux.gitTextGenerationProvider supports codex, claude, and custom. [project]
- **git_text_generation_codex_builtin**: Codex built-in git text generation uses gpt-5.4-mini with model_reasoning_effort="low". [project]
- **git_text_generation_claude_builtin**: Claude built-in git text generation uses haiku with --effort low. [project]
- **git_text_generation_timeout_ms**: Git text generation commands time out after 180000 milliseconds. [project]
- **git_text_generation_codex_execution_mode**: Codex git text generation uses stdin input and disables interactive shell mode. [project]
- **git_text_generation_custom_output_mode**: Custom git text generation commands may write output to a temporary file or print to stdout. [project]
- **session_rename_numeric_limits**: User-edited numeric session rename limits were intentionally preserved during the low-effort provider update. [project]
