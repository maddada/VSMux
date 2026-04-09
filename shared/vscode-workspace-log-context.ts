import * as path from "node:path";
import * as vscode from "vscode";

export const NO_VSCODE_WORKSPACE_LOG_LABEL = "no-workspace";

export type VscodeWorkspaceLogState = {
  name?: string;
  workspaceFilePath?: string;
  workspaceFolderName?: string;
  workspaceFolderPath?: string;
};

export function resolveVscodeWorkspaceLogLabel(state: VscodeWorkspaceLogState): string {
  const workspaceName = normalizeWorkspaceLabel(state.name);
  if (workspaceName) {
    return workspaceName;
  }

  const workspaceFilePath = normalizeWorkspaceLabel(state.workspaceFilePath);
  if (workspaceFilePath) {
    return path.basename(workspaceFilePath, path.extname(workspaceFilePath));
  }

  const workspaceFolderName = normalizeWorkspaceLabel(state.workspaceFolderName);
  if (workspaceFolderName) {
    return workspaceFolderName;
  }

  const workspaceFolderPath = normalizeWorkspaceLabel(state.workspaceFolderPath);
  if (workspaceFolderPath) {
    return path.basename(workspaceFolderPath);
  }

  return NO_VSCODE_WORKSPACE_LOG_LABEL;
}

export function getVscodeWorkspaceLogLabel(): string {
  return resolveVscodeWorkspaceLogLabel({
    name: vscode.workspace.name,
    workspaceFilePath: vscode.workspace.workspaceFile?.fsPath,
    workspaceFolderName: vscode.workspace.workspaceFolders?.[0]?.name,
    workspaceFolderPath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });
}

export function formatVscodeWorkspaceLogPrefix(): string {
  return `[workspace:${getVscodeWorkspaceLogLabel()}]`;
}

export function prefixLogMessageWithVscodeWorkspace(message: string): string {
  return `${formatVscodeWorkspaceLogPrefix()} ${message}`;
}

function normalizeWorkspaceLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
