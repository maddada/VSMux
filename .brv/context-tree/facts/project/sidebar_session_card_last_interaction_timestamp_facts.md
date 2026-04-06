---
title: Sidebar Session Card Last Interaction Timestamp Facts
tags: []
related: [architecture/terminal_workspace/sidebar_session_card_last_interaction_timestamps.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:48:19.302Z"
updatedAt: "2026-04-06T04:11:26.417Z"
---

## Raw Concept

**Task:**
Record factual project knowledge from the sidebar session card HUD selector regression fix

**Changes:**

- Added runtime regression fact for direct state.hud render access
- Added selector convention for new HUD booleans
- Added verification evidence for the fix

**Files:**

- sidebar/sortable-session-card.tsx

**Flow:**
identify regression -> move HUD flag into sidebar selector -> pass selected local prop -> validate via typecheck and vp tests

**Timestamp:** 2026-04-06

## Narrative

### Structure

This facts entry captures the concrete regression, the implementation rule that prevents similar issues, and the verification methods used after the fix.

### Dependencies

The facts depend on the sidebar store selector pattern in sortable-session-card.tsx and the project verification workflow using extension typechecks and focused vp coverage.

### Highlights

The key operational rule is that render paths must only use store values that were explicitly selected into local scope.

## Facts

- **sidebar_last_interaction_runtime_regression**: sidebar/sortable-session-card.tsx had a runtime regression caused by referencing state.hud.showLastInteractionTimeOnSessionCards directly inside render instead of using a selected local store value. [project]
- **hud_boolean_selector_requirement**: New HUD booleans in sortable session cards must be added to the existing useSidebarStore(useShallow(...)) selector before being passed to child components. [convention]
- **sidebar_fix_verification**: Verification for the fix used tsconfig.extension typecheck and targeted vp tests. [project]
