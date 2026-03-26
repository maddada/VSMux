import { IconPencil, IconWorld } from "@tabler/icons-react";
import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { SidebarSessionItem } from "../shared/session-grid-contract";
import { getSidebarAgentNameByIcon, type SidebarAgentIcon } from "../shared/sidebar-agents";
import { AGENT_LOGOS } from "./agent-logos";
import { TOOLTIP_DELAY_MS } from "./tooltip-delay";

const AGENT_SECONDARY_LABELS: Record<SidebarAgentIcon, readonly string[]> = {
  browser: ["browser"],
  claude: ["claude", "claude code"],
  codex: ["codex", "codex cli", "openai codex"],
  gemini: ["gemini"],
  opencode: ["open code", "opencode"],
  t3: ["t3", "t3 code"],
};

export type SessionCardContentProps = {
  aliasHeadingRef?: RefObject<HTMLDivElement | null>;
  onClose?: () => void;
  onRename?: () => void;
  session: SidebarSessionItem;
  showDebugSessionNumbers: boolean;
  showCloseButton: boolean;
  showHotkeys: boolean;
};

export function SessionCardContent({
  aliasHeadingRef,
  onClose,
  onRename,
  session,
  showDebugSessionNumbers,
  showCloseButton,
  showHotkeys,
}: SessionCardContentProps) {
  const headingText = session.primaryTitle?.trim() || session.alias;
  const terminalTitle = getAgentSecondaryText(session.terminalTitle, session.agentIcon);
  const secondaryText =
    session.detail ??
    terminalTitle ??
    session.activityLabel ??
    getSidebarAgentNameByIcon(session.agentIcon);
  const titleTooltip = [headingText, secondaryText].filter(Boolean).join("\n");
  const showDebugSessionNumber = showDebugSessionNumbers && session.sessionNumber !== undefined;
  const showMeta = showHotkeys || showDebugSessionNumber;

  return (
    <>
      {session.agentIcon === "browser" ? (
        <IconWorld
          aria-hidden="true"
          className="session-agent-tabler-watermark"
          data-agent-icon="browser"
          size={20}
          stroke={1.8}
        />
      ) : session.agentIcon ? (
        <span
          aria-hidden="true"
          className="session-agent-watermark"
          data-agent-icon={session.agentIcon}
          style={
            {
              "--session-agent-logo": `url("${AGENT_LOGOS[session.agentIcon]}")`,
            } as CSSProperties
          }
        />
      ) : null}
      <div className="session-head">
        <OverflowTooltipText
          className="session-alias-heading"
          textRef={aliasHeadingRef}
          text={headingText}
          tooltip={titleTooltip}
          tooltipWhen={secondaryText ? "always" : "overflow"}
        />
        <div className="session-head-actions">
          <div className="session-meta" data-visible={String(showMeta)}>
            {showDebugSessionNumber ? (
              <span className="session-debug-number">{session.sessionNumber}</span>
            ) : null}
            {showHotkeys ? (
              <span className="session-shortcut-label">{session.shortcutLabel}</span>
            ) : null}
          </div>
          {onRename ? (
            <button
              aria-label="Rename session"
              className="session-rename-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRename();
              }}
              type="button"
            >
              <IconPencil aria-hidden="true" size={14} stroke={1.8} />
            </button>
          ) : null}
          {showCloseButton && onClose ? (
            <button
              aria-label="Close session"
              className="close-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function getAgentSecondaryText(
  value: string | undefined,
  agentIcon: SidebarSessionItem["agentIcon"],
): string | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  if (!agentIcon) {
    return normalizedValue;
  }

  const matchingGenericLabel = AGENT_SECONDARY_LABELS[agentIcon].includes(
    normalizedValue.toLowerCase(),
  );
  if (matchingGenericLabel) {
    return getSidebarAgentNameByIcon(agentIcon);
  }

  return normalizedValue;
}

type OverflowTooltipTextProps = {
  className: string;
  text: string;
  textRef?: RefObject<HTMLDivElement | null>;
  tooltip?: string;
  tooltipWhen?: "always" | "overflow";
};

function OverflowTooltipText({
  className,
  text,
  textRef,
  tooltip,
  tooltipWhen = "overflow",
}: OverflowTooltipTextProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openTimeoutIdRef = useRef<number>();

  const clearOpenTimeout = () => {
    if (openTimeoutIdRef.current === undefined) {
      return;
    }

    window.clearTimeout(openTimeoutIdRef.current);
    openTimeoutIdRef.current = undefined;
  };

  const closeTooltip = () => {
    clearOpenTimeout();
    setIsOpen(false);
  };

  const hasOverflow = () => {
    const element = textRef?.current;
    if (!element) {
      return false;
    }

    if (element.scrollWidth > element.clientWidth) {
      return true;
    }

    return element.scrollHeight > element.clientHeight;
  };

  const openTooltip = () => {
    clearOpenTimeout();
    const shouldOpen = tooltipWhen === "always" ? Boolean(tooltip ?? text) : hasOverflow();
    if (!shouldOpen) {
      setIsOpen(false);
      return;
    }

    openTimeoutIdRef.current = window.setTimeout(() => {
      setIsOpen(true);
      openTimeoutIdRef.current = undefined;
    }, TOOLTIP_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearOpenTimeout();
    };
  }, []);

  const content = (
    <div className={className} ref={textRef}>
      {text}
    </div>
  );

  return (
    <Tooltip.Root onOpenChange={(open) => !open && closeTooltip()} open={isOpen}>
      <Tooltip.Trigger
        disabled
        render={
          <div
            className="session-tooltip-trigger"
            onBlur={closeTooltip}
            onFocus={openTooltip}
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
          >
            {content}
          </div>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="tooltip-positioner" sideOffset={8}>
          <Tooltip.Popup className="tooltip-popup">{tooltip ?? text}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
