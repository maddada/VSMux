---
title: Sidebar Session Card Last Interaction Timestamps
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: "2026-04-06T03:48:19.300Z"
updatedAt: "2026-04-06T04:11:26.415Z"
---

## Raw Concept

**Task:**
Document the sortable session card runtime regression and the required store selector pattern for HUD flags

**Changes:**

- Fixed a runtime regression in sidebar/sortable-session-card.tsx
- Documented that showLastInteractionTime must come from selected sidebar store fields rather than direct state access in render
- Recorded verification using tsconfig.extension typecheck and targeted vp tests

**Files:**

- sidebar/sortable-session-card.tsx

**Flow:**
add HUD boolean -> include it in useSidebarStore(useShallow(...)) selector -> bind selected local variable -> pass local variable to child component -> verify with typecheck and targeted tests

**Timestamp:** 2026-04-06

## Narrative

### Structure

The sortable session card reads sidebar state through an existing useSidebarStore(useShallow(...)) selector. New HUD display flags must be added to that selector so render logic only references locally selected values rather than reaching back into state paths that are not in scope.

### Dependencies

This pattern depends on the sidebar store selection contract in sortable-session-card.tsx and on child component props receiving already-selected values. Validation relied on tsconfig.extension typecheck plus targeted vp tests covering the sidebar card behavior.

### Highlights

The regression came from passing showLastInteractionTime: state.hud.showLastInteractionTimeOnSessionCards inside render while only selected store fields were available. The documented fix is to select new HUD booleans alongside the existing fields, then pass the resulting local variable to children.

## Facts

- **sortable_session_card_hud_selector_regression**: sidebar/sortable-session-card.tsx had a runtime regression when showLastInteractionTime was passed from state.hud.showLastInteractionTimeOnSessionCards inside render without selecting that field from the sidebar store. [project]
- **sidebar_store_selector_pattern**: The correct pattern is to add new HUD booleans to the existing useSidebarStore(useShallow(...)) selector and pass the selected local variable to child components. [convention]
- **verification_for_sidebar_hud_fix**: The fix was verified with tsconfig.extension typecheck and targeted vp tests. [project]
