---
title: Session Rename Title Auto Summarization Facts
tags: []
related: [architecture/terminal_workspace/session_rename_title_auto_summarization.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T03:46:46.157Z"
updatedAt: "2026-04-06T03:46:46.157Z"
---

## Raw Concept

**Task:**
Capture project facts for session rename title auto-summarization and git text-generation provider behavior

**Changes:**

- Recorded threshold, provider, timeout, and sanitization facts for session rename summarization

**Files:**

- extension/native-terminal-workspace/controller.ts
- extension/native-terminal-workspace/session-title-generation.ts
- extension/git/text-generation.ts
- extension/git/text-generation-utils.ts

**Flow:**
extract implementation facts -> deduplicate -> group by subject -> store as project facts entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry stores normalized implementation details for the session rename auto-summarization feature. It groups threshold logic, provider command selection, timeout behavior, UI progress reporting, custom command placeholder handling, and session title sanitization into reusable factual statements across 10 subjects.

### Highlights

The most recall-worthy facts are the 25-character threshold, the 180000 ms generation timeout, continued /rename dispatch for terminal sessions, and the provider-specific shell command behaviors.

### Examples

Example fact subjects include session_rename_summary_threshold, git_text_generation_timeout_ms, git_text_generation_custom_placeholders, and session_title_sanitization.

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
