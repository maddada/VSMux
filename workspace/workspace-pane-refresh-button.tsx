import { IconRefresh } from "@tabler/icons-react";

export type WorkspacePaneRefreshButtonProps = {
  onRefresh: () => void;
};

export const WorkspacePaneRefreshButton: React.FC<WorkspacePaneRefreshButtonProps> = ({
  onRefresh,
}) => (
  <button
    aria-label="Refresh terminal rendering"
    className="workspace-pane-refresh-button"
    draggable={false}
    onClick={(event) => {
      event.stopPropagation();
      onRefresh();
    }}
    onMouseDown={(event) => {
      event.stopPropagation();
    }}
    type="button"
  >
    <IconRefresh aria-hidden size={14} stroke={1.8} />
  </button>
);
