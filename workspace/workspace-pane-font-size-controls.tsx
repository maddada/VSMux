import { IconMinus, IconPlus } from "@tabler/icons-react";
import { WorkspacePaneActionTooltip } from "./workspace-pane-action-tooltip";

export type WorkspacePaneFontSizeControlsProps = {
  onAdjustTerminalFontSize: (delta: -1 | 1) => void;
};

export const WorkspacePaneFontSizeControls: React.FC<WorkspacePaneFontSizeControlsProps> = ({
  onAdjustTerminalFontSize,
}) => (
  <>
    <WorkspacePaneActionTooltip tooltip="Zoom Out">
      <button
        aria-label="Zoom Out"
        className="workspace-pane-font-size-button"
        draggable={false}
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail === 0) {
            onAdjustTerminalFontSize(-1);
          }
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAdjustTerminalFontSize(-1);
        }}
        type="button"
      >
        <IconMinus aria-hidden size={14} stroke={1.8} />
      </button>
    </WorkspacePaneActionTooltip>
    <WorkspacePaneActionTooltip tooltip="Zoom In">
      <button
        aria-label="Zoom In"
        className="workspace-pane-font-size-button"
        draggable={false}
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail === 0) {
            onAdjustTerminalFontSize(1);
          }
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAdjustTerminalFontSize(1);
        }}
        type="button"
      >
        <IconPlus aria-hidden size={14} stroke={1.8} />
      </button>
    </WorkspacePaneActionTooltip>
  </>
);
