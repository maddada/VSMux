export function logWorkspaceDebug(
  enabled: boolean | undefined,
  event: string,
  payload?: Record<string, unknown>,
): void {
  if (!enabled) {
    return;
  }

  if (payload) {
    console.debug(`[VSmux workspace] ${event}`, payload);
    return;
  }

  console.debug(`[VSmux workspace] ${event}`);
}
