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
      if (event.detail === 0) {
        onRefresh();
      }
    }}
    onMouseDown={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onRefresh();
    }}
    type="button"
  >
    <IconRefresh aria-hidden size={14} stroke={1.8} />
  </button>
);
