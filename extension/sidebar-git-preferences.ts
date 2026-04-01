import * as vscode from "vscode";
import {
  DEFAULT_SIDEBAR_GIT_ACTION,
  normalizeSidebarGitAction,
  type SidebarGitAction,
} from "../shared/sidebar-git";
import { getGitSkipSuggestedCommitConfirmation } from "./native-terminal-workspace/settings";
import { getWorkspaceStorageKey } from "./terminal-workspace-environment";

const PRIMARY_SIDEBAR_GIT_ACTION_KEY = "VSmux.primarySidebarGitAction";
const SIDEBAR_GIT_CONFIRM_SUGGESTED_COMMIT_KEY = "VSmux.sidebarGitConfirmSuggestedCommit";

export function getPrimarySidebarGitAction(
  context: vscode.ExtensionContext,
  workspaceId: string,
): SidebarGitAction {
  return normalizeSidebarGitAction(
    context.workspaceState.get<string>(getWorkspaceStorageKey(PRIMARY_SIDEBAR_GIT_ACTION_KEY, workspaceId)),
  );
}

export async function savePrimarySidebarGitAction(
  context: vscode.ExtensionContext,
  workspaceId: string,
  action: SidebarGitAction,
): Promise<void> {
  await context.workspaceState.update(
    getWorkspaceStorageKey(PRIMARY_SIDEBAR_GIT_ACTION_KEY, workspaceId),
    action,
  );
}

export function getDefaultPrimarySidebarGitAction(): SidebarGitAction {
  return DEFAULT_SIDEBAR_GIT_ACTION;
}

export function getSidebarGitConfirmSuggestedCommit(
  context: vscode.ExtensionContext,
  workspaceId: string,
): boolean {
  const storedValue = context.workspaceState.get<boolean>(
    getWorkspaceStorageKey(SIDEBAR_GIT_CONFIRM_SUGGESTED_COMMIT_KEY, workspaceId),
  );
  if (typeof storedValue === "boolean") {
    return storedValue;
  }

  return !getGitSkipSuggestedCommitConfirmation();
}

export async function saveSidebarGitConfirmSuggestedCommit(
  context: vscode.ExtensionContext,
  workspaceId: string,
  shouldConfirm: boolean,
): Promise<void> {
  await context.workspaceState.update(
    getWorkspaceStorageKey(SIDEBAR_GIT_CONFIRM_SUGGESTED_COMMIT_KEY, workspaceId),
    shouldConfirm,
  );
}
