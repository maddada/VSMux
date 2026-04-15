import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { getDefaultWorkspaceCwd } from "./terminal-workspace-environment";

const SETTINGS_SECTION = "VSmux";
const SHARE_COMMANDS_ACROSS_WORKTREES_SETTING = "shareSidebarCommandsAcrossWorktrees";

export function shouldShareSidebarCommandsAcrossWorktrees(): boolean {
  return vscode.workspace
    .getConfiguration(SETTINGS_SECTION)
    .get<boolean>(SHARE_COMMANDS_ACROSS_WORKTREES_SETTING, true);
}

export function getSidebarCommandProjectFamilyKey(): string {
  const workspaceRoot = getDefaultWorkspaceCwd();
  const familyRoot = resolveGitCommonWorkspaceRoot(workspaceRoot) ?? workspaceRoot;
  return createHash("sha1").update(path.resolve(familyRoot)).digest("hex").slice(0, 16);
}

function resolveGitCommonWorkspaceRoot(workspaceRoot: string): string | undefined {
  const gitDir = resolveGitDir(workspaceRoot);
  if (!gitDir) {
    return undefined;
  }

  const commonDir = resolveGitCommonDir(gitDir);
  return path.basename(commonDir) === ".git" ? path.dirname(commonDir) : undefined;
}

function resolveGitDir(workspaceRoot: string): string | undefined {
  const dotGitPath = path.join(workspaceRoot, ".git");
  if (!existsSync(dotGitPath)) {
    return undefined;
  }

  try {
    const stats = statSync(dotGitPath);
    if (stats.isDirectory()) {
      return dotGitPath;
    }

    if (!stats.isFile()) {
      return undefined;
    }

    const gitDirLine = readFileSync(dotGitPath, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(gitDirLine);
    if (!match) {
      return undefined;
    }

    return path.resolve(workspaceRoot, match[1]);
  } catch {
    return undefined;
  }
}

function resolveGitCommonDir(gitDir: string): string {
  const commonDirPath = path.join(gitDir, "commondir");
  if (!existsSync(commonDirPath)) {
    return gitDir;
  }

  try {
    const commonDir = readFileSync(commonDirPath, "utf8").trim();
    return path.resolve(gitDir, commonDir);
  } catch {
    return gitDir;
  }
}
