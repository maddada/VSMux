import type * as vscode from "vscode";

const SESSION_ID_ENV_KEY = "VSMUX_SESSION_ID";
const SESSION_STATE_FILE_ENV_KEY = "VSMUX_SESSION_STATE_FILE";
const WORKSPACE_ID_ENV_KEY = "VSMUX_WORKSPACE_ID";

export type ManagedTerminalIdentity = {
  sessionId: string;
  workspaceId: string;
};

export function createManagedTerminalEnvironment(
  workspaceId: string,
  sessionId: string,
  sessionStateFilePath: string,
): Record<string, string> {
  return {
    [SESSION_ID_ENV_KEY]: sessionId,
    [SESSION_STATE_FILE_ENV_KEY]: sessionStateFilePath,
    [WORKSPACE_ID_ENV_KEY]: workspaceId,
  };
}

export function getManagedTerminalIdentity(
  terminal: vscode.Terminal,
): ManagedTerminalIdentity | undefined {
  const creationOptions = terminal.creationOptions;
  if ("pty" in creationOptions) {
    return undefined;
  }

  const environment = creationOptions.env;
  if (!environment) {
    return undefined;
  }

  const sessionId = normalizeEnvironmentValue(environment[SESSION_ID_ENV_KEY]);
  const workspaceId = normalizeEnvironmentValue(environment[WORKSPACE_ID_ENV_KEY]);
  if (!sessionId || !workspaceId) {
    return undefined;
  }

  return {
    sessionId,
    workspaceId,
  };
}

function normalizeEnvironmentValue(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : undefined;
}
