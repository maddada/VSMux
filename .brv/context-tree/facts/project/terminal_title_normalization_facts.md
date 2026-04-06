---
title: Terminal Title Normalization Facts
tags: []
related: [architecture/terminal_workspace/terminal_title_normalization_and_session_actions.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T20:36:15.390Z"
updatedAt: "2026-04-06T20:36:15.390Z"
---

## Raw Concept

**Task:**
Capture factual project knowledge for terminal title normalization, persistence behavior, precedence rules, and agent session action command outputs.

**Changes:**

- Added atomic facts for normalization, visibility filtering, and precedence rules.
- Added atomic facts for resume, fork, copy resume, and detached resume behaviors across supported agents.

**Files:**

- shared/session-grid-contract-session.ts
- extension/session-state-file.ts
- extension/terminal-daemon-session-state.ts
- extension/native-terminal-workspace/controller.ts
- extension/native-terminal-workspace-session-agent-launch.test.ts

**Flow:**
implementation and tests -> extracted factual statements -> deduplicated fact reference entry

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry collects implementation-level statements about title sanitization, visibility filtering, precedence selection, persisted state behavior, and agent-specific command builder outputs. It is intended as a quick factual reference for future terminal workspace work without rereading the full implementation summary.

### Dependencies

The facts derive from shared session title helpers, persisted state utilities, daemon presentation state resolution, controller rename/resume/fork wiring, and dedicated command builder tests.

### Highlights

The project now cleanly separates raw live daemon titles used for activity detection from normalized titles used for persistence and user-facing session actions. Agent-specific resume behavior is also preserved as discrete facts.

## Facts

- **normalize_terminal_title**: normalizeTerminalTitle trims terminal titles and strips leading status or progress glyphs before session-facing use. [project]
- **leading_terminal_title_status_marker_pattern**: Leading terminal title markers are matched by the unicode-aware pattern ^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+. [project]
- **visible_terminal_title_filter**: getVisibleTerminalTitle returns undefined when the normalized title starts with ~ or /. [project]
- **preferred_session_title_precedence**: getPreferredSessionTitle prefers visible terminal title first, visible primary session title second, and otherwise returns undefined. [project]
- **persisted_session_title_normalization**: Persisted session state normalizes title values during both parsing and serialization. [project]
- **persisted_session_status_values**: Persisted session status only accepts idle, working, or attention and defaults to idle. [project]
- **persisted_session_atomic_write**: Persisted session state file writes are atomic through temp-file write followed by rename. [project]
- **persisted_title_precedence**: resolvePersistedSessionPresentationState chooses title by liveTitle, then lastKnownPersistedTitle, then currentState.title, and normalizes the selected title. [project]
- **persisted_agent_name_precedence**: resolvePersistedSessionPresentationState chooses agentName by titleActivityAgentName, then snapshotAgentName, then currentState.agentName. [project]
- **persisted_agent_status_precedence**: resolvePersistedSessionPresentationState chooses agentStatus by titleActivityStatus, then snapshotAgentStatus, then currentState.agentStatus. [project]
- **terminal_title_by_session_id**: The controller stores raw daemon terminal titles in terminalTitleBySessionId for activity-related handling. [project]
- **terminal_rename_command**: Terminal rename writes /rename with the normalized terminal title and falls back to the trimmed session title if normalization returns undefined. [project]
- **rename_prompt_title_preference**: Rename prompt values prefer the normalized visible terminal title over the stored session title. [project]
- **copy_resume_command_inputs**: Resume copy command building receives both session title and raw live terminal title so the builder can resolve a preferred normalized title. [project]
- **fork_source_title_normalization**: Fork source titles are derived from getPreferredSessionTitle and then whitespace-collapsed and trimmed. [project]
- **full_reload_resume_title_behavior**: Full reload resume command generation also routes through normalized preferred title behavior. [project]
- **codex_resume_default_title_behavior**: Codex default or numeric session resume commands can collapse to plain codex resume. [project]
- **claude_resume_command_format**: Claude titled resume commands use the form claude -r 'TITLE'. [project]
- **resume_terminal_title_override**: Terminal titles override user session titles when they are visible in resume command construction. [project]
- **fork_title_sanitization**: Fork commands strip leading indicators and surrounding whitespace from terminal titles before command construction. [project]
- **path_like_terminal_title_behavior**: Path-like terminal titles such as /Users/madda/dev/\_active/agent-tiler are treated as non-visible and can make fork command construction return undefined. [project]
- **gemini_resume_guidance**: Gemini copied resume output lists sessions and instructs the user to enter gemini -y -r id. [project]
- **copilot_resume_guidance**: Copilot copied resume output uses --continue and adds guidance about copilot --resume. [project]
- **opencode_resume_guidance**: Opencode copied resume output lists sessions and instructs the user to enter opencode -s id. [project]
- **detached_resume_auto_execute**: Detached resume actions auto-execute for Codex and Claude when the command form is executable. [project]
- **detached_resume_prefill_only_agents**: Gemini, Copilot, and Opencode detached resume actions provide prefills and do not auto-execute. [project]
- **detached_resume_codex_fallback**: If launch metadata is missing but the sidebar icon is codex, detached resume falls back to codex resume with title. [project]
- **custom_agent_detached_resume_behavior**: Raw custom agent commands are prefills only and do not auto-execute in detached resume actions. [project]
- **persisted_state_read_failure_behavior**: Invalid persisted session file reads return the default persisted session state. [project]
- **persisted_value_whitespace_normalization**: Whitespace in persisted session values is collapsed to single spaces. [project]
- **invalid_display_id_behavior**: Invalid or non-finite display IDs normalize to 00. [project]
