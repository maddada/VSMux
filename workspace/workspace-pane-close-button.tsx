import { useEffect, useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";

export const WORKSPACE_PANE_CLOSE_CONFIRM_DURATION_MS = 3_000;

const getWorkspacePaneCloseConfirmToastMessage = (sessionLabel?: string) => {
  const trimmedSessionLabel = sessionLabel?.trim();
  if (!trimmedSessionLabel) {
    return "Click the X again within 3 seconds to close this session.";
  }

  return `Click the X again within 3 seconds to close ${trimmedSessionLabel}.`;
};

export type WorkspacePaneCloseButtonProps = {
  onConfirmClose: () => void;
  sessionLabel?: string;
};

export const WorkspacePaneCloseButton: React.FC<WorkspacePaneCloseButtonProps> = ({
  onConfirmClose,
  sessionLabel,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmTimeoutRef = useRef<number | undefined>(undefined);
  const confirmToastId = useId();

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
    }, WORKSPACE_PANE_CLOSE_CONFIRM_DURATION_MS);
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
        aria-describedby={isConfirming ? confirmToastId : undefined}
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
        <div
          aria-live="polite"
          className="workspace-pane-close-toast"
          id={confirmToastId}
          role="status"
        >
          {getWorkspacePaneCloseConfirmToastMessage(sessionLabel)}
        </div>
      ) : null}
    </div>
  );
};
