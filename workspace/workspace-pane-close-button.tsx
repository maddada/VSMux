import { useEffect, useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";

const CONFIRM_TOOLTIP_DURATION_MS = 3_000;

export type WorkspacePaneCloseButtonProps = {
  onConfirmClose: () => void;
};

export const WorkspacePaneCloseButton: React.FC<WorkspacePaneCloseButtonProps> = ({
  onConfirmClose,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmTimeoutRef = useRef<number | undefined>(undefined);
  const tooltipId = useId();

  useEffect(
    () => () => {
      if (confirmTimeoutRef.current !== undefined) {
        window.clearTimeout(confirmTimeoutRef.current);
      }
    },
    [],
  );

  const armConfirmation = () => {
    if (confirmTimeoutRef.current !== undefined) {
      window.clearTimeout(confirmTimeoutRef.current);
    }

    setIsConfirming(true);
    confirmTimeoutRef.current = window.setTimeout(() => {
      confirmTimeoutRef.current = undefined;
      setIsConfirming(false);
    }, CONFIRM_TOOLTIP_DURATION_MS);
  };

  const clearConfirmation = () => {
    if (confirmTimeoutRef.current !== undefined) {
      window.clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = undefined;
    }
    setIsConfirming(false);
  };

  return (
    <div className="workspace-pane-close-control">
      <button
        aria-describedby={isConfirming ? tooltipId : undefined}
        aria-label={isConfirming ? "Confirm close session" : "Close session"}
        className={`workspace-pane-close-button ${isConfirming ? "workspace-pane-close-button-confirming" : ""}`}
        draggable={false}
        onClick={(event) => {
          event.stopPropagation();

          if (isConfirming) {
            clearConfirmation();
            onConfirmClose();
            return;
          }

          armConfirmation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        type="button"
      >
        <IconX aria-hidden size={14} stroke={1.8} />
      </button>
      {isConfirming ? (
        <div className="workspace-pane-close-tooltip" id={tooltipId} role="tooltip">
          Click again to confirm
        </div>
      ) : null}
    </div>
  );
};
