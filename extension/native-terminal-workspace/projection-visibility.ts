export type ObservedSessionSurfaceState = {
  isForegroundVisible: boolean;
  observedViewColumn?: number;
};

export function isProjectedSessionSurfaceVisibleInTargetGroup(
  surfaceState: ObservedSessionSurfaceState | undefined,
  targetGroupIndex: number,
): boolean {
  if (!surfaceState?.isForegroundVisible) {
    return false;
  }

  return surfaceState.observedViewColumn === targetGroupIndex + 1;
}
