type CreateSessionFocusPlanOptions = {
  isWorkspacePanelVisible: boolean;
  source?: "sidebar" | "workspace";
};

type SessionFocusPlan = {
  shouldRevealWorkspacePanel: boolean;
};

export function createSessionFocusPlan({
  isWorkspacePanelVisible,
  source,
}: CreateSessionFocusPlanOptions): SessionFocusPlan {
  return {
    shouldRevealWorkspacePanel: source === "sidebar" && !isWorkspacePanelVisible,
  };
}
