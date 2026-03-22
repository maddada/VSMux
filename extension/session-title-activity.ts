import type { SidebarSessionActivityState } from "../shared/session-grid-contract";

const CLAUDE_CODE_IDLE_MARKERS = ["✳", "*"] as const;
const CLAUDE_CODE_WORKING_MARKERS = ["·"] as const;
const CLAUDE_CODE_TITLE = "Claude Code";

export type TitleDerivedSessionActivity = {
  activity: SidebarSessionActivityState;
  agentName: string;
};

export function getTitleDerivedSessionActivity(
  title: string,
  previousDerivedActivity?: TitleDerivedSessionActivity,
): TitleDerivedSessionActivity | undefined {
  const claudeCodeTitleState = getClaudeCodeTitleState(title);
  if (!claudeCodeTitleState) {
    return undefined;
  }

  if (claudeCodeTitleState === "working") {
    return {
      activity: "working",
      agentName: "claude",
    };
  }

  if (previousDerivedActivity?.activity === "attention") {
    return previousDerivedActivity;
  }

  return {
    activity: "idle",
    agentName: "claude",
  };
}

export function getTitleDerivedSessionActivityFromTransition(
  previousTitle: string | undefined,
  nextTitle: string,
  previousDerivedActivity?: TitleDerivedSessionActivity,
): TitleDerivedSessionActivity | undefined {
  const previousTitleState = previousTitle ? getClaudeCodeTitleState(previousTitle) : undefined;
  const nextTitleState = getClaudeCodeTitleState(nextTitle);
  if (
    nextTitleState === undefined &&
    previousTitleState === "idleMarkerVisible" &&
    nextTitle.toLowerCase().includes(CLAUDE_CODE_TITLE.toLowerCase())
  ) {
    return {
      activity: "working",
      agentName: "claude",
    };
  }

  const nextActivity = getTitleDerivedSessionActivity(nextTitle, previousDerivedActivity);
  if (!nextActivity) {
    return undefined;
  }

  if (
    nextActivity.activity === "idle" &&
    (previousTitleState === "working" || previousDerivedActivity?.activity === "working")
  ) {
    return {
      activity: "attention",
      agentName: nextActivity.agentName,
    };
  }

  return nextActivity;
}

export function haveSameTitleDerivedSessionActivity(
  left: TitleDerivedSessionActivity | undefined,
  right: TitleDerivedSessionActivity | undefined,
): boolean {
  return left?.activity === right?.activity && left?.agentName === right?.agentName;
}

function getClaudeCodeTitleState(title: string): "idleMarkerVisible" | "working" | undefined {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  const lowerTitle = normalizedTitle.toLowerCase();
  const lowerClaudeCodeTitle = CLAUDE_CODE_TITLE.toLowerCase();

  if (!lowerTitle.includes(lowerClaudeCodeTitle)) {
    return undefined;
  }

  if (containsAnyMarker(normalizedTitle, CLAUDE_CODE_IDLE_MARKERS)) {
    return "idleMarkerVisible";
  }

  if (containsAnyMarker(normalizedTitle, CLAUDE_CODE_WORKING_MARKERS)) {
    return "working";
  }

  return undefined;
}

function containsAnyMarker(title: string, markers: readonly string[]): boolean {
  return markers.some((marker) => title.includes(marker));
}
