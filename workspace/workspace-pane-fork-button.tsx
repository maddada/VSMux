import { IconGitFork } from "@tabler/icons-react";

export type WorkspacePaneForkButtonProps = {
  onFork: () => void;
};

export const WorkspacePaneForkButton: React.FC<WorkspacePaneForkButtonProps> = ({ onFork }) => (
  <button
    aria-label="Fork session"
    className="workspace-pane-fork-button"
    draggable={false}
    onClick={(event) => {
      event.stopPropagation();
      if (event.detail === 0) {
        onFork();
      }
    }}
    onMouseDown={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onFork();
    }}
    type="button"
  >
    <IconGitFork aria-hidden size={14} stroke={1.8} />
  </button>
);
