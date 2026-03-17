import type {
  TerminalSessionSnapshot,
  TerminalSessionsByTileId,
} from "../../shared/terminal-host-protocol";

export const SESSION_ACTIVITY_IDLE_MS = 4000;

export type SessionActivitySnapshot = {
  hasReceivedOutput: boolean;
  lastOutputAt?: number;
  startedAt: string;
};

export type SessionActivityByTileId = Record<string, SessionActivitySnapshot>;

export type SessionActivityIndicator = "active" | "done" | "pending";

export function createSessionActivityFromSessions(
  sessions: TerminalSessionsByTileId,
  now = Date.now(),
): SessionActivityByTileId {
  return Object.fromEntries(
    Object.values(sessions).map((session) => [
      session.tileId,
      createSessionActivitySnapshot(session, now),
    ]),
  );
}

export function updateSessionActivityFromState(
  current: SessionActivityByTileId,
  previousSession: TerminalSessionSnapshot | undefined,
  nextSession: TerminalSessionSnapshot,
  now = Date.now(),
): SessionActivityByTileId {
  const hasRestarted =
    current[nextSession.tileId]?.startedAt !== undefined &&
    current[nextSession.tileId]?.startedAt !== nextSession.startedAt;

  if (hasRestarted) {
    return {
      ...current,
      [nextSession.tileId]: createSessionActivitySnapshot(nextSession, now),
    };
  }

  const previousHistoryLength = previousSession?.history?.length ?? 0;
  const nextHistoryLength = nextSession.history?.length ?? 0;
  const hasNewHistory = nextHistoryLength > previousHistoryLength;
  const nextActivity = current[nextSession.tileId] ?? {
    hasReceivedOutput: false,
    lastOutputAt: undefined,
    startedAt: nextSession.startedAt,
  };

  if (!hasNewHistory) {
    if (nextActivity.startedAt === nextSession.startedAt) {
      return current[nextSession.tileId]
        ? current
        : { ...current, [nextSession.tileId]: nextActivity };
    }

    return {
      ...current,
      [nextSession.tileId]: {
        ...nextActivity,
        startedAt: nextSession.startedAt,
      },
    };
  }

  return {
    ...current,
    [nextSession.tileId]: {
      hasReceivedOutput: true,
      lastOutputAt: now,
      startedAt: nextSession.startedAt,
    },
  };
}

export function markSessionOutput(
  current: SessionActivityByTileId,
  tileId: string,
  startedAt: string,
  now = Date.now(),
): SessionActivityByTileId {
  const previousActivity = current[tileId];

  if (
    previousActivity?.startedAt === startedAt &&
    previousActivity.hasReceivedOutput &&
    previousActivity.lastOutputAt === now
  ) {
    return current;
  }

  return {
    ...current,
    [tileId]: {
      hasReceivedOutput: true,
      lastOutputAt: now,
      startedAt,
    },
  };
}

export function getSessionActivityIndicator(
  activity: SessionActivitySnapshot | undefined,
  now = Date.now(),
): SessionActivityIndicator {
  if (!activity?.hasReceivedOutput) {
    return "pending";
  }

  if (
    activity.lastOutputAt !== undefined &&
    now - activity.lastOutputAt < SESSION_ACTIVITY_IDLE_MS
  ) {
    return "active";
  }

  return "done";
}

function createSessionActivitySnapshot(
  session: TerminalSessionSnapshot,
  now: number,
): SessionActivitySnapshot {
  const hasReceivedOutput = (session.history?.length ?? 0) > 0;

  return {
    hasReceivedOutput,
    lastOutputAt: hasReceivedOutput ? now : undefined,
    startedAt: session.startedAt,
  };
}
