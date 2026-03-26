import * as vscode from "vscode";
import { getViewColumn } from "../terminal-workspace-helpers";

const WORKBENCH_SETTLE_TIMEOUT_MS = 750;
const WORKBENCH_SETTLE_POLL_MS = 25;

type TerminalLike = Pick<vscode.Terminal, "creationOptions" | "exitStatus" | "name">;

export function findTerminalGroupIndex(sessionTitle: string | undefined): number | undefined {
  return findTerminalGroupIndices(sessionTitle)[0];
}

export function findTerminalGroupIndices(sessionTitle: string | undefined): number[] {
  if (!sessionTitle) {
    return [];
  }

  return vscode.window.tabGroups.all
    .filter((group) => {
      return group.tabs.some((tab) => {
        return tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle;
      });
    })
    .map((group) => (group.viewColumn ?? 1) - 1)
    .sort((left, right) => left - right);
}

export function isTerminalTabForeground(
  sessionTitle: string | undefined,
  groupIndex: number,
): boolean {
  if (!sessionTitle) {
    return false;
  }

  const group = vscode.window.tabGroups.all.find((candidateGroup) => {
    return candidateGroup.viewColumn === getViewColumn(groupIndex);
  });
  if (!group) {
    return false;
  }

  return group.tabs.some((tab) => {
    return (
      tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle
    );
  });
}

export function isTerminalTabActive(
  sessionTitle: string | undefined,
  terminal: vscode.Terminal,
): boolean {
  if (vscode.window.activeTerminal !== terminal || !sessionTitle) {
    return false;
  }

  const activeGroup = vscode.window.tabGroups.activeTabGroup;
  if (!activeGroup) {
    return false;
  }

  return activeGroup.tabs.some((tab) => {
    return (
      tab.isActive && tab.input instanceof vscode.TabInputTerminal && tab.label === sessionTitle
    );
  });
}

export function getActivePanelTerminalTabLabel(
  tabGroups: readonly vscode.TabGroup[] = vscode.window.tabGroups.all,
): string | undefined {
  const panelGroup = tabGroups.find((group) => group.viewColumn === undefined);
  const activeTab = panelGroup?.activeTab;
  if (!activeTab || !(activeTab.input instanceof vscode.TabInputTerminal)) {
    return undefined;
  }

  return activeTab.label;
}

export function getActiveTerminalTabLocation(
  activeGroup: vscode.TabGroup | undefined = vscode.window.tabGroups.activeTabGroup,
): "editor" | "other" | "panel" {
  const activeTab = activeGroup?.activeTab;
  if (!activeTab || !(activeTab.input instanceof vscode.TabInputTerminal)) {
    return "other";
  }

  return activeGroup.viewColumn === undefined ? "panel" : "editor";
}

export function getTerminalDisplayName(terminal: TerminalLike): string | undefined {
  const creationName =
    typeof terminal.creationOptions === "object" &&
    terminal.creationOptions !== null &&
    "name" in terminal.creationOptions &&
    typeof terminal.creationOptions.name === "string"
      ? terminal.creationOptions.name
      : undefined;

  return terminal.name ?? creationName;
}

export function resolveTerminalRestoreTarget<T extends TerminalLike>(
  terminals: readonly T[],
  activeTerminal: T | undefined,
  panelTabLabel: string | undefined,
): T | undefined {
  if (!panelTabLabel) {
    return undefined;
  }

  if (
    activeTerminal &&
    !activeTerminal.exitStatus &&
    getTerminalDisplayName(activeTerminal) === panelTabLabel
  ) {
    return activeTerminal;
  }

  return terminals.find(
    (terminal) =>
      !terminal.exitStatus && getTerminalDisplayName(terminal) === panelTabLabel,
  );
}

export async function waitForActiveTerminal(terminal: vscode.Terminal): Promise<void> {
  const deadline = Date.now() + WORKBENCH_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (vscode.window.activeTerminal === terminal) {
      return;
    }
    await delay(WORKBENCH_SETTLE_POLL_MS);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
