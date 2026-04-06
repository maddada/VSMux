---
title: Terminal Title Normalization and Session Actions
tags: []
related:
  [
    architecture/terminal_workspace/current_state.md,
    architecture/terminal_workspace/session_rename_title_auto_summarization.md,
    architecture/terminal_workspace/title_activity_and_sidebar_runtime.md,
    facts/project/terminal_workspace_facts.md,
  ]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: "2026-04-06T20:36:15.389Z"
updatedAt: "2026-04-06T20:36:15.389Z"
---

## Raw Concept

**Task:**
Document how terminal workspace normalizes terminal titles for persistence and session-facing flows such as rename, resume, and fork.

**Changes:**

- Centralized title sanitization in normalizeTerminalTitle().
- Normalized persisted session titles during parse and serialization.
- Made rename, resume, copy resume, fork, and detached resume flows prefer visible normalized terminal titles.
- Kept raw live daemon titles available for title-derived activity detection while hiding path-like titles from resumable UI flows.

**Files:**

- shared/session-grid-contract-session.ts
- extension/session-state-file.ts
- extension/terminal-daemon-session-state.ts
- extension/native-terminal-workspace/controller.ts
- extension/native-terminal-workspace-session-agent-launch.test.ts

**Flow:**
daemon emits raw terminal title -> controller stores raw liveTitle for activity handling -> shared helpers normalize and filter titles for visibility -> persistence stores normalized title -> rename/resume/fork actions build commands from preferred visible titles

**Timestamp:** 2026-04-06

**Patterns:**

- `^[\s\u2800-\u28ff·•⋅◦✳*✦◇🤖🔔]+` (flags: u) - Matches leading whitespace and status/progress glyphs removed from terminal titles before persistence and session-facing use.
- `^(~|/)` - Treats normalized path-like or home-like titles as non-visible for visible terminal title flows.
- `^Session \d+$` - Identifies generated default session titles that should not be treated as visible primary titles.
- `^session-(\d+)$` - Parses positive numeric session identifiers from sessionId strings.
- `^\d+$` - Identifies numeric session aliases.
- `^\d{2}$` - Preserves exact two-digit display IDs during session display formatting.

## Narrative

### Structure

The shared session grid contract defines terminal-title normalization and visibility helpers. normalizeTerminalTitle() trims text, removes leading status glyphs, and yields undefined for empty titles. getVisibleTerminalTitle() then hides titles that start with ~ or /, and getPreferredSessionTitle() chooses a visible terminal title before falling back to a visible user session title. The persistence layer uses the same normalization when parsing and serializing line-oriented session state files, while daemon presentation resolution normalizes the persistence-facing title chosen from live title, last known persisted title, or current stored title. In contrast, the workspace controller intentionally keeps raw live titles in terminalTitleBySessionId so title-derived activity detection still has access to unfiltered daemon output.

### Dependencies

This behavior depends on shared helpers in shared/session-grid-contract-session.ts, persisted session state handling in extension/session-state-file.ts, presentation precedence in extension/terminal-daemon-session-state.ts, and controller/session action wiring in extension/native-terminal-workspace/controller.ts. Test coverage in extension/native-terminal-workspace-session-agent-launch.test.ts preserves command semantics for Codex, Claude, Gemini, Copilot, Opencode, and custom Codex-style command prefixes.

### Highlights

Session-facing actions now consistently operate on cleaned titles rather than raw daemon text. Rename sends /rename with a normalized title, resume and fork builders strip status markers from terminal titles, and path-like titles are excluded from visible and resumable flows so repository paths do not leak into session labels. Raw liveTitle is still preserved in memory for title-derived activity and symbol detection, which keeps operational behavior separate from user-facing presentation. The tests also lock in agent-specific behavior such as Claude using -r, Codex using resume/fork verbs, and Gemini, Copilot, and Opencode returning guidance or prefill strings instead of always-executable commands.

### Rules

Shared `normalizeTerminalTitle()` is the canonical sanitizer for persistence and session-facing title usage. Persistence layer stores normalized titles, not raw daemon titles. UI and session actions prefer normalized visible terminal title over user-entered session title. Titles beginning with `~` or `/` are hidden from visible/resumable title flows. Raw `liveTitle` must still be preserved in daemon/controller paths for title-derived activity detection. Invalid persisted session file read returns default state. Invalid `status` values in persisted state are ignored and status remains `"idle"`. Invalid or non-finite display IDs normalize to `"00"`. Empty or whitespace-only titles after normalization resolve to `undefined`.

### Examples

Representative test cases include `buildResumeAgentCommand({ agentId: "codex", command: "codex" }, "codex", "Pinned session", "  ✦ Bug Fix  ") => "codex resume 'Bug Fix'"`, `buildForkAgentCommand({ agentId: "claude", command: "claude" }, "claude", "Design pass") => "claude --fork-session -r 'Design pass'"`, and `buildForkAgentCommand({ agentId: "codex", command: "codex" }, "codex", "Session 34", "/Users/madda/dev/_active/agent-tiler") => undefined`. Copied resume text for Gemini is `gemini -y --list-sessions && echo 'Enter gemini -y -r id' to resume a session`, for Copilot is `copilot --continue && echo 'Or use copilot --resume to pick a session, or copilot --resume SESSION-ID if you know it'`, and detached resume for a Codex fallback can become `codex resume 'Auto fix corruption'` when launch metadata is absent.

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
