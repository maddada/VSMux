import { Tooltip } from "@base-ui/react/tooltip";
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, type DragDropEventHandlers } from "@dnd-kit/react";
import {
  IconBell,
  IconBellOff,
  IconArrowsSort,
  IconHelpCircle,
  IconHistory,
  IconLayoutSidebar,
  IconMinus,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconWorld,
} from "@tabler/icons-react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { MAX_GROUP_COUNT, type ExtensionToSidebarMessage } from "../shared/session-grid-contract";
import type { SidebarActionType } from "../shared/sidebar-commands";
import { playCompletionSound, prepareCompletionSoundPlayback } from "./completion-sound-player";
import { AgentsPanel } from "./agents-panel";
import { CommandsPanel } from "./commands-panel";
import { DaemonSessionsModal } from "./daemon-sessions-modal";
import { GitCommitModal } from "./git-commit-modal";
import { PreviousSessionsModal } from "./previous-sessions-modal";
import { ScratchPadModal } from "./scratch-pad-modal";
import {
  SidebarPreviousSessionsSearchGroup,
  SidebarSessionSearchField,
} from "./sidebar-session-search-overlay";
import {
  createSidebarSessionSearchResults,
  createSidebarSessionSearchSelection,
  getNextSidebarSessionSearchSelection,
  isSidebarSessionSearchSelectionMatch,
  type SidebarSessionSearchSelection,
} from "./sidebar-session-search";
import { logSidebarDebug } from "./sidebar-debug";
import { postSidebarOrderReproLog } from "./sidebar-order-repro-log";
import { scrollElementIntoViewIfNeeded } from "./scroll-into-view-if-needed";
import { resetSidebarStore, useSidebarStore } from "./sidebar-store";
import {
  getClientPoint,
  getSidebarDropData,
  getSidebarSessionDropTarget,
  type SidebarSessionDropTarget,
  getSidebarSessionDropTargetFromEvent,
  getSidebarSessionDropTargetAtPoint,
  moveSessionIdsByDropTarget,
} from "./sidebar-dnd";
import { SessionGroupSection } from "./session-group-section";
import {
  applyTextEditingKey,
  isEditableKeyboardTarget,
  isTextEditingKey,
} from "./text-input-keyboard";
import { TOOLTIP_DELAY_MS } from "./tooltip-delay";
import { useScrollGlowState } from "./use-scroll-glow-state";
import type { WebviewApi } from "./webview-api";
import { createDisplaySessionLayout } from "../shared/active-sessions-sort";
import { matchesSidebarSessionSearchQuery } from "./previous-session-search";

export type SidebarAppProps = {
  messageSource?: Pick<Window, "addEventListener" | "removeEventListener">;
  vscode: WebviewApi;
};

type SessionIdsByGroup = Record<string, string[]>;
type FloatingMenuPosition = {
  left: number;
  top: number;
};

type SidebarPointerDownSessionTarget = {
  groupId: string;
  point: {
    x: number;
    y: number;
  };
  sessionId: string;
};

type SidebarSessionPointerDragState = {
  didMove: boolean;
  startPoint?: {
    x: number;
    y: number;
  };
};

const SIDEBAR_EMPTY_SPACE_BLOCKER_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "[role='button']",
  "[role='menu']",
  "[role='menuitem']",
  "[data-empty-space-blocking='true']",
].join(", ");

const sensors = [
  PointerSensor.configure({
    activationConstraints(event) {
      if (event.pointerType === "touch") {
        return [new PointerActivationConstraints.Delay({ tolerance: 5, value: 250 })];
      }

      return [new PointerActivationConstraints.Distance({ value: 6 })];
    },
  }),
  KeyboardSensor,
];

const SIDEBAR_STARTUP_INTERACTION_BLOCK_MS = 1500;
const SIDEBAR_POINTER_DRAG_REORDER_THRESHOLD_PX = 8;
const MIN_SESSION_SEARCH_QUERY_LENGTH = 2;
const COMPLETION_FLASH_DURATION_MS = 3_000;

export function SidebarApp({ messageSource = window, vscode }: SidebarAppProps) {
  const [isStartupInteractionBlocked, setIsStartupInteractionBlocked] = useState(true);
  const [autoEditingGroupId, setAutoEditingGroupId] = useState<string>();
  const [agentCreateRequestId, setAgentCreateRequestId] = useState(0);
  const [commandCreateActionType, setCommandCreateActionType] = useState<SidebarActionType>();
  const [commandCreateRequestId, setCommandCreateRequestId] = useState(0);
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false);
  const [isDaemonSessionsOpen, setIsDaemonSessionsOpen] = useState(false);
  const [isPreviousSessionsOpen, setIsPreviousSessionsOpen] = useState(false);
  const [isScratchPadOpen, setIsScratchPadOpen] = useState(false);
  const [isSessionSearchOpen, setIsSessionSearchOpen] = useState(false);
  const [completionFlashNonceBySessionId, setCompletionFlashNonceBySessionId] = useState<
    Record<string, number>
  >({});
  const [collapsedGroupsById, setCollapsedGroupsById] = useState<Record<string, true>>({});
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [sessionDropIndicatorGroupId, setSessionDropIndicatorGroupId] = useState<string>();
  const [overflowMenuAnchor, setOverflowMenuAnchor] = useState<HTMLElement>();
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<FloatingMenuPosition>();
  const [isSessionSearchSelectionVisible, setIsSessionSearchSelectionVisible] = useState(false);
  const [selectedSessionSearchResult, setSelectedSessionSearchResult] =
    useState<SidebarSessionSearchSelection>();
  const pendingCreateGroupRef = useRef(false);
  const didResetStoreRef = useRef(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const sessionGroupsPanelRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const groupIdsRef = useRef<string[]>([]);
  const sessionIdsByGroupRef = useRef<SessionIdsByGroup>({});
  const previousNormalizedSessionSearchQueryRef = useRef("");
  const pointerDownSessionTargetRef = useRef<SidebarPointerDownSessionTarget>();
  const sessionPointerDragStateRef = useRef<SidebarSessionPointerDragState>();
  const completionFlashTimeoutBySessionIdRef = useRef<Map<string, number>>(new Map());
  const sessionGroupsContentRef = useRef<HTMLDivElement>(null);

  if (!didResetStoreRef.current) {
    resetSidebarStore();
    didResetStoreRef.current = true;
  }

  const applyLocalFocus = useSidebarStore((state) => state.applyLocalFocus);
  const applyOrderSyncResultMessage = useSidebarStore((state) => state.applyOrderSyncResultMessage);
  const applySessionPresentationMessage = useSidebarStore(
    (state) => state.applySessionPresentationMessage,
  );
  const applySidebarMessage = useSidebarStore((state) => state.applySidebarMessage);
  const setDaemonSessionsState = useSidebarStore((state) => state.setDaemonSessionsState);
  const setGitCommitDraft = useSidebarStore((state) => state.setGitCommitDraft);
  const setSectionCollapsed = useSidebarStore((state) => state.setSectionCollapsed);
  const {
    activeSessionsSortMode,
    agentManagerZoomPercent,
    browserGroupIds,
    collapsedSections,
    commandCount,
    completionBellEnabled,
    createSessionOnSidebarDoubleClick,
    debuggingMode,
    groupOrder,
    previousSessions,
    sectionVisibility,
    showHotkeysOnSessionCards,
    sessionsById,
    theme,
    workspaceGroupIds,
  } = useSidebarStore(
    useShallow((state) => ({
      activeSessionsSortMode: state.hud.activeSessionsSortMode,
      agentManagerZoomPercent: state.hud.agentManagerZoomPercent,
      browserGroupIds: state.browserGroupIds,
      collapsedSections: state.hud.collapsedSections,
      commandCount: state.hud.commands.length,
      completionBellEnabled: state.hud.completionBellEnabled,
      createSessionOnSidebarDoubleClick: state.hud.createSessionOnSidebarDoubleClick,
      debuggingMode: state.hud.debuggingMode,
      groupOrder: state.groupOrder,
      previousSessions: state.previousSessions,
      sectionVisibility: state.hud.sectionVisibility,
      showHotkeysOnSessionCards: state.hud.showHotkeysOnSessionCards,
      sessionsById: state.sessionsById,
      theme: state.hud.theme,
      workspaceGroupIds: state.workspaceGroupIds,
    })),
  );
  const gitCommitDraft = useSidebarStore((state) => state.gitCommitDraft);
  const authoritativeSessionIdsByGroup = useSidebarStore((state) => state.sessionIdsByGroup);

  useEffect(() => {
    setCollapsedGroupsById((previous) => {
      const validGroupIds = new Set(groupOrder);
      let changed = false;
      const next: Record<string, true> = {};

      for (const [groupId, collapsed] of Object.entries(previous)) {
        if (!validGroupIds.has(groupId)) {
          changed = true;
          continue;
        }

        next[groupId] = collapsed;
      }

      return changed ? next : previous;
    });
  }, [groupOrder]);

  const isSidebarInteractionBlocked = isStartupInteractionBlocked;

  const setGroupCollapsed = (groupId: string, collapsed: boolean) => {
    setCollapsedGroupsById((previous) => {
      if (collapsed) {
        if (previous[groupId]) {
          return previous;
        }

        return {
          ...previous,
          [groupId]: true,
        };
      }

      if (!previous[groupId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[groupId];
      return next;
    });
  };

  const requestNewSession = () => {
    if (isSidebarInteractionBlocked) {
      return;
    }

    vscode.postMessage({ type: "createSession" });
  };

  const handleSidebarDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!createSessionOnSidebarDoubleClick) {
      return;
    }

    if (!isEmptySidebarDoubleClick(event.target, event.currentTarget)) {
      return;
    }

    event.preventDefault();
    requestNewSession();
  };

  const handleWindowMessage = useEffectEvent((event: MessageEvent<ExtensionToSidebarMessage>) => {
    if (!event.data) {
      return;
    }

    if (event.data.type === "playCompletionSound") {
      postSidebarDebugLog("completionSound.messageReceived", {
        sound: event.data.sound,
        sessionId: event.data.sessionId,
      });
      const existingTimeout = completionFlashTimeoutBySessionIdRef.current.get(
        event.data.sessionId,
      );
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
      }
      setCompletionFlashNonceBySessionId((previous) => ({
        ...previous,
        [event.data.sessionId]: (previous[event.data.sessionId] ?? 0) + 1,
      }));
      const timeout = window.setTimeout(() => {
        completionFlashTimeoutBySessionIdRef.current.delete(event.data.sessionId);
        setCompletionFlashNonceBySessionId((previous) => {
          if (!(event.data.sessionId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[event.data.sessionId];
          return next;
        });
      }, COMPLETION_FLASH_DURATION_MS);
      completionFlashTimeoutBySessionIdRef.current.set(event.data.sessionId, timeout);
      void playCompletionSound(event.data.sound, (soundEvent, details) => {
        postSidebarDebugLog(soundEvent, details);
      });
      return;
    }

    if (event.data.type === "sessionPresentationChanged") {
      applySessionPresentationMessage(event.data);
      return;
    }

    if (event.data.type === "sidebarOrderSyncResult") {
      postSidebarOrderReproLog(vscode, "repro.sidebarOrder.webview.syncResultReceived", {
        itemIds: event.data.itemIds,
        kind: event.data.kind,
        requestId: event.data.requestId,
        status: event.data.status,
      });
      applyOrderSyncResultMessage(event.data);
      return;
    }

    if (event.data.type === "daemonSessionsState") {
      setDaemonSessionsState(event.data);
      return;
    }

    if (event.data.type === "promptGitCommit") {
      setGitCommitDraft(event.data);
      return;
    }

    if (event.data.type !== "hydrate" && event.data.type !== "sessionState") {
      return;
    }

    postSidebarOrderReproLog(vscode, "repro.sidebarOrder.webview.messageReceived", {
      agentIds: event.data.hud.agents.map((agent) => agent.agentId),
      commandIds: event.data.hud.commands.map((command) => command.commandId),
      groupTitles: event.data.groups.map((group) => group.title),
      messageType: event.data.type,
      revision: event.data.revision,
    });

    if (pendingCreateGroupRef.current) {
      const nextGroupId = findCreatedGroupId(
        groupOrder,
        event.data.groups.map((group) => group.groupId),
      );
      if (nextGroupId) {
        setAutoEditingGroupId(nextGroupId);
        pendingCreateGroupRef.current = false;
      }
    }

    applySidebarMessage(event.data);
  });

  useEffect(() => {
    const handleMessage = (event: Event) => {
      if (event instanceof MessageEvent) {
        handleWindowMessage(event);
      }
    };

    messageSource.addEventListener("message", handleMessage);

    return () => {
      messageSource.removeEventListener("message", handleMessage);
    };
  }, [handleWindowMessage, messageSource]);

  useEffect(() => {
    return () => {
      for (const timeout of completionFlashTimeoutBySessionIdRef.current.values()) {
        window.clearTimeout(timeout);
      }
      completionFlashTimeoutBySessionIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsStartupInteractionBlocked(false);
    }, SIDEBAR_STARTUP_INTERACTION_BLOCK_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    vscode.postMessage({ type: "ready" });
  }, [vscode]);

  useEffect(() => {
    document.body.dataset.sidebarTheme = theme;

    return () => {
      delete document.body.dataset.sidebarTheme;
    };
  }, [theme]);

  useEffect(() => {
    document.body.style.setProperty("--vsmux-agent-manager-zoom", `${agentManagerZoomPercent}%`);

    return () => {
      document.body.style.removeProperty("--vsmux-agent-manager-zoom");
    };
  }, [agentManagerZoomPercent]);

  const closeGitCommitModal = useEffectEvent((requestId: string) => {
    setGitCommitDraft(undefined);
    vscode.postMessage({
      requestId,
      type: "cancelSidebarGitCommit",
    });
  });

  useEffect(() => {
    if (!sessionGroupsPanelRef.current) {
      return;
    }

    sessionGroupsPanelRef.current.inert = isSidebarInteractionBlocked;
  }, [isSidebarInteractionBlocked]);

  useEffect(() => {
    if (!isOverflowMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (overflowMenuRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest('[data-sidebar-overflow-trigger="true"]')) {
        return;
      }

      setIsOverflowMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOverflowMenuOpen(false);
      }
    };

    const handleBlur = () => {
      setIsOverflowMenuOpen(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        setIsOverflowMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isOverflowMenuOpen]);

  useEffect(() => {
    if (!isOverflowMenuOpen || !overflowMenuAnchor) {
      setOverflowMenuPosition(undefined);
      return;
    }

    const updateOverflowMenuPosition = () => {
      if (!overflowMenuAnchor.isConnected) {
        setIsOverflowMenuOpen(false);
        setOverflowMenuAnchor(undefined);
        return;
      }

      const triggerBounds = overflowMenuAnchor.getBoundingClientRect();
      if (!triggerBounds) {
        return;
      }

      setOverflowMenuPosition({
        left: triggerBounds.right,
        top: triggerBounds.bottom + 6,
      });
    };

    updateOverflowMenuPosition();
    window.addEventListener("resize", updateOverflowMenuPosition);
    window.addEventListener("scroll", updateOverflowMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateOverflowMenuPosition);
      window.removeEventListener("scroll", updateOverflowMenuPosition, true);
    };
  }, [isOverflowMenuOpen, overflowMenuAnchor]);

  const toggleOverflowMenu = (trigger: HTMLElement) => {
    setOverflowMenuAnchor(trigger);
    setIsOverflowMenuOpen((previous) => !previous);
  };

  const isManualActiveSessionsSort = activeSessionsSortMode === "manual";
  const visibleBrowserGroupIds = sectionVisibility.browsers ? browserGroupIds : [];
  const shouldShowActionsPanel =
    sectionVisibility.actions && (sectionVisibility.git || commandCount > 0);
  const shouldShowAgentsPanel = sectionVisibility.agents;

  const { groupIds: effectiveGroupIds, sessionIdsByGroup: effectiveSessionIdsByGroup } = useMemo(
    () =>
      createDisplaySessionLayout({
        sessionIdsByGroup: createWorkspaceSessionIdsByGroup(
          workspaceGroupIds,
          authoritativeSessionIdsByGroup,
        ),
        sessionsById,
        sortMode: activeSessionsSortMode,
        workspaceGroupIds,
      }),
    [activeSessionsSortMode, authoritativeSessionIdsByGroup, sessionsById, workspaceGroupIds],
  );
  const normalizedSessionSearchQuery = sessionSearchQuery.trim();
  const isSessionSearchFiltering =
    isSessionSearchOpen && normalizedSessionSearchQuery.length >= MIN_SESSION_SEARCH_QUERY_LENGTH;
  const displayedBrowserSessionIdsByGroup = useMemo(
    () =>
      createDisplayedSessionIdsByGroup({
        groupIds: visibleBrowserGroupIds,
        query: normalizedSessionSearchQuery,
        sessionIdsByGroup: authoritativeSessionIdsByGroup,
        sessionsById,
        shouldFilter: isSessionSearchFiltering,
      }),
    [
      authoritativeSessionIdsByGroup,
      isSessionSearchFiltering,
      normalizedSessionSearchQuery,
      sessionsById,
      visibleBrowserGroupIds,
    ],
  );
  const displayedWorkspaceSessionIdsByGroup = useMemo(
    () =>
      createDisplayedSessionIdsByGroup({
        groupIds: effectiveGroupIds,
        query: normalizedSessionSearchQuery,
        sessionIdsByGroup: effectiveSessionIdsByGroup,
        sessionsById,
        shouldFilter: isSessionSearchFiltering,
      }),
    [
      effectiveGroupIds,
      effectiveSessionIdsByGroup,
      isSessionSearchFiltering,
      normalizedSessionSearchQuery,
      sessionsById,
    ],
  );
  const displayedBrowserGroupIds = useMemo(
    () =>
      createDisplayedGroupIds(
        visibleBrowserGroupIds,
        displayedBrowserSessionIdsByGroup,
        isSessionSearchFiltering,
      ),
    [displayedBrowserSessionIdsByGroup, isSessionSearchFiltering, visibleBrowserGroupIds],
  );
  const displayedWorkspaceGroupIds = useMemo(
    () =>
      createDisplayedGroupIds(
        effectiveGroupIds,
        displayedWorkspaceSessionIdsByGroup,
        isSessionSearchFiltering,
      ),
    [displayedWorkspaceSessionIdsByGroup, effectiveGroupIds, isSessionSearchFiltering],
  );
  const filteredPreviousSessions = useMemo(
    () =>
      !isSessionSearchFiltering
        ? []
        : previousSessions.filter((session) =>
            matchesSidebarSessionSearchQuery(session, normalizedSessionSearchQuery),
          ),
    [isSessionSearchFiltering, normalizedSessionSearchQuery, previousSessions],
  );
  const focusedSessionId = useMemo(
    () => Object.values(sessionsById).find((session) => session.isFocused)?.sessionId,
    [sessionsById],
  );
  const shouldShowSessionSearchEmptyState =
    isSessionSearchFiltering &&
    displayedBrowserGroupIds.length === 0 &&
    displayedWorkspaceGroupIds.length === 0 &&
    filteredPreviousSessions.length === 0;
  const { showBottomGlow: showSessionGroupsBottomGlow, showTopGlow: showSessionGroupsTopGlow } =
    useScrollGlowState(sessionGroupsContentRef);
  const sidebarSessionSearchResults = useMemo(
    () =>
      createSidebarSessionSearchResults({
        displayedBrowserGroupIds,
        displayedBrowserSessionIdsByGroup,
        displayedWorkspaceGroupIds,
        displayedWorkspaceSessionIdsByGroup,
        filteredPreviousSessions,
      }),
    [
      displayedBrowserGroupIds,
      displayedBrowserSessionIdsByGroup,
      displayedWorkspaceGroupIds,
      displayedWorkspaceSessionIdsByGroup,
      filteredPreviousSessions,
    ],
  );
  const dragStructureKey = useMemo(
    () => createDragStructureKey(displayedWorkspaceGroupIds, displayedWorkspaceSessionIdsByGroup),
    [displayedWorkspaceGroupIds, displayedWorkspaceSessionIdsByGroup],
  );

  useEffect(() => {
    groupIdsRef.current = displayedWorkspaceGroupIds;
  }, [displayedWorkspaceGroupIds]);

  useEffect(() => {
    sessionIdsByGroupRef.current = displayedWorkspaceSessionIdsByGroup;
  }, [displayedWorkspaceSessionIdsByGroup]);

  useEffect(() => {
    const queryChanged =
      previousNormalizedSessionSearchQueryRef.current !== normalizedSessionSearchQuery;
    previousNormalizedSessionSearchQueryRef.current = normalizedSessionSearchQuery;

    if (
      !isSessionSearchOpen ||
      normalizedSessionSearchQuery.length === 0 ||
      sidebarSessionSearchResults.length === 0 ||
      queryChanged
    ) {
      setIsSessionSearchSelectionVisible(false);
    }

    setSelectedSessionSearchResult((previous) => {
      if (!isSessionSearchOpen || normalizedSessionSearchQuery.length === 0) {
        return previous;
      }

      if (sidebarSessionSearchResults.length === 0) {
        return undefined;
      }

      if (queryChanged) {
        return createSidebarSessionSearchSelection(sidebarSessionSearchResults[0]);
      }

      if (!previous) {
        return undefined;
      }

      return sidebarSessionSearchResults.some((result) =>
        isSidebarSessionSearchSelectionMatch(result, previous),
      )
        ? previous
        : createSidebarSessionSearchSelection(sidebarSessionSearchResults[0]);
    });
  }, [isSessionSearchOpen, normalizedSessionSearchQuery, sidebarSessionSearchResults]);

  useEffect(() => {
    if (!isSessionSearchSelectionVisible || !selectedSessionSearchResult) {
      return;
    }

    const selectedElement =
      selectedSessionSearchResult.kind === "session"
        ? document.querySelector<HTMLElement>(
            `[data-sidebar-session-id="${selectedSessionSearchResult.sessionId}"]`,
          )
        : document.querySelector<HTMLElement>(
            `[data-sidebar-history-id="${selectedSessionSearchResult.historyId}"]`,
          );
    selectedElement?.scrollIntoView({
      block: "nearest",
    });
  }, [isSessionSearchSelectionVisible, selectedSessionSearchResult]);

  useEffect(() => {
    if (!focusedSessionId || !sessionGroupsContentRef.current) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const scrollViewport = sessionGroupsContentRef.current;
      if (!scrollViewport) {
        return;
      }

      const focusedSessionElement = document.querySelector<HTMLElement>(
        `[data-sidebar-session-id="${focusedSessionId}"]`,
      );
      if (!focusedSessionElement) {
        return;
      }

      scrollElementIntoViewIfNeeded(focusedSessionElement, scrollViewport);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [focusedSessionId]);

  const postSidebarDebugLog = useEffectEvent((event: string, details: unknown) => {
    if (!debuggingMode) {
      return;
    }

    logSidebarDebug(debuggingMode, event, details);
    vscode.postMessage({
      details,
      event,
      type: "sidebarDebugLog",
    });
  });

  const unlockCompletionSoundPlayback = useEffectEvent(() => {
    void prepareCompletionSoundPlayback((soundEvent, details) => {
      postSidebarDebugLog(soundEvent, details);
    });
  });

  const recordPointerDownSessionTarget = useEffectEvent((event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      pointerDownSessionTargetRef.current = undefined;
      return;
    }

    const sessionElement = target.closest<HTMLElement>("[data-sidebar-session-id]");
    const groupElement = target.closest<HTMLElement>("[data-sidebar-group-id]");
    const sessionId = sessionElement?.dataset.sidebarSessionId;
    const groupId = groupElement?.dataset.sidebarGroupId;
    if (!sessionId || !groupId) {
      pointerDownSessionTargetRef.current = undefined;
      return;
    }

    pointerDownSessionTargetRef.current = {
      groupId,
      point: {
        x: event.clientX,
        y: event.clientY,
      },
      sessionId,
    };
  });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      recordPointerDownSessionTarget(event);
      unlockCompletionSoundPlayback();
    };
    const handleKeyDown = () => {
      pointerDownSessionTargetRef.current = undefined;
      unlockCompletionSoundPlayback();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [recordPointerDownSessionTarget, unlockCompletionSoundPlayback]);

  const updateSessionDropIndicator = useEffectEvent(
    (event: Parameters<NonNullable<DragDropEventHandlers["onDragOver"]>>[0]) => {
      if (isManualActiveSessionsSort) {
        setSessionDropIndicatorGroupId(undefined);
        return;
      }

      const sourceData = getSidebarDropData(event.operation.source);
      if (sourceData?.kind !== "session") {
        setSessionDropIndicatorGroupId(undefined);
        return;
      }

      const resolvedSessionDropTarget = resolveSessionDropTargetFromPoint(
        getDragNativeEvent(event),
        sessionIdsByGroupRef.current,
        getSidebarDropData(event.operation.target),
        sourceData,
      );
      const nextGroupId =
        resolvedSessionDropTarget && resolvedSessionDropTarget.groupId !== sourceData.groupId
          ? resolvedSessionDropTarget.groupId
          : undefined;

      setSessionDropIndicatorGroupId((previous) =>
        previous === nextGroupId ? previous : nextGroupId,
      );
    },
  );

  const handleDragStart = ((event) => {
    const nativeEvent = getDragNativeEvent(event);
    const sourceData = getSidebarDropData(event.operation.source);
    const pointerDownSessionTarget = pointerDownSessionTargetRef.current;
    sessionPointerDragStateRef.current =
      sourceData?.kind === "session"
        ? createSessionPointerDragState(sourceData, pointerDownSessionTarget, nativeEvent)
        : undefined;
    setSessionDropIndicatorGroupId(undefined);
    postSidebarDebugLog("session.dragStart", {
      nativeEventType: nativeEvent?.type,
      pointerDragState: sessionPointerDragStateRef.current,
      point: getClientPoint(nativeEvent),
      sourceData,
      targetData: getSidebarDropData(event.operation.target),
    });
  }) satisfies DragDropEventHandlers["onDragStart"];

  const handleDragMove = ((event) => {
    updateSessionPointerDragState(sessionPointerDragStateRef.current, getDragNativeEvent(event));
    updateSessionDropIndicator(event);
  }) satisfies DragDropEventHandlers["onDragMove"];

  const handleDragOver = ((event) => {
    updateSessionPointerDragState(sessionPointerDragStateRef.current, getDragNativeEvent(event));
    updateSessionDropIndicator(event);
  }) satisfies DragDropEventHandlers["onDragOver"];

  const handleDragEnd = ((event) => {
    setSessionDropIndicatorGroupId(undefined);
    const currentGroupIds = groupIdsRef.current;
    const currentSessionIdsByGroup = sessionIdsByGroupRef.current;
    const authoritativeGroupIds = workspaceGroupIds;
    const previousSessionIdsByGroup = effectiveSessionIdsByGroup;

    const nativeEvent = getDragNativeEvent(event);
    const sourceData = getSidebarDropData(event.operation.source);
    const targetData = getSidebarDropData(event.operation.target);
    const sessionPointerDragState = sessionPointerDragStateRef.current;
    updateSessionPointerDragState(sessionPointerDragState, nativeEvent);
    sessionPointerDragStateRef.current = undefined;
    const resolvedSessionDropTarget =
      sourceData?.kind === "session"
        ? resolveSessionDropTargetFromPoint(
            nativeEvent,
            currentSessionIdsByGroup,
            targetData,
            sourceData,
          )
        : undefined;
    postSidebarDebugLog("session.dragEnd", {
      canceled: event.canceled,
      nativeEventType: nativeEvent?.type,
      pointerDragState: sessionPointerDragState,
      point: getClientPoint(nativeEvent),
      resolvedSessionDropTarget,
      sourceData,
      targetData,
    });
    if (!sourceData) {
      return;
    }

    if (sourceData.kind === "group") {
      if (event.canceled || targetData?.kind !== "group") {
        return;
      }

      const nextGroupIds = move(currentGroupIds, event);
      if (haveSameSessionOrder(authoritativeGroupIds, nextGroupIds)) {
        return;
      }

      vscode.postMessage({
        groupIds: nextGroupIds,
        type: "syncGroupOrder",
      });
      return;
    }

    if (sourceData.kind !== "session") {
      return;
    }

    if (sessionPointerDragState?.startPoint && !sessionPointerDragState.didMove) {
      postSidebarDebugLog("session.dragEndIgnoredWithoutPointerMovement", {
        point: getClientPoint(nativeEvent),
        sourceData,
      });
      return;
    }

    if (event.canceled) {
      return;
    }

    if (resolvedSessionDropTarget === null) {
      return;
    }

    if (!targetData && resolvedSessionDropTarget === undefined) {
      return;
    }

    const nextSessionIdsByGroup =
      resolvedSessionDropTarget !== undefined
        ? moveSessionIdsByDropTarget(
            currentSessionIdsByGroup,
            sourceData.sessionId,
            resolvedSessionDropTarget,
          )
        : move(currentSessionIdsByGroup, event);
    const nextListedSessionIds = new Set(Object.values(nextSessionIdsByGroup).flat());
    const omittedSessionIds = Object.values(currentSessionIdsByGroup)
      .flat()
      .filter((sessionId) => !nextListedSessionIds.has(sessionId));
    postSidebarDebugLog("session.dragComputedOrder", {
      currentSessionIdsByGroup,
      nextSessionIdsByGroup,
      omittedSessionIds,
      resolvedSessionDropTarget,
      sourceData,
      targetData,
    });
    const previousGroupId = findSessionGroupId(previousSessionIdsByGroup, sourceData.sessionId);
    const nextGroupId = findSessionGroupId(nextSessionIdsByGroup, sourceData.sessionId);
    if (!previousGroupId || !nextGroupId) {
      return;
    }

    if (previousGroupId !== nextGroupId) {
      const targetIndex = nextSessionIdsByGroup[nextGroupId]?.indexOf(sourceData.sessionId);
      if (targetIndex == null || targetIndex < 0) {
        return;
      }

      vscode.postMessage({
        groupId: nextGroupId,
        sessionId: sourceData.sessionId,
        targetIndex,
        type: "moveSessionToGroup",
      });
      return;
    }

    if (!isManualActiveSessionsSort) {
      return;
    }

    const previousSessionIds = previousSessionIdsByGroup[nextGroupId] ?? [];
    const nextSessionIds = nextSessionIdsByGroup[nextGroupId] ?? [];
    if (haveSameSessionOrder(previousSessionIds, nextSessionIds)) {
      return;
    }

    vscode.postMessage({
      groupId: nextGroupId,
      sessionIds: nextSessionIds,
      type: "syncSessionOrder",
    });
  }) satisfies DragDropEventHandlers["onDragEnd"];

  const openScratchPad = () => {
    setIsOverflowMenuOpen(false);
    setIsDaemonSessionsOpen(false);
    setIsPreviousSessionsOpen(false);
    setIsSessionSearchSelectionVisible(false);
    setIsSessionSearchOpen(false);
    setSessionSearchQuery("");
    setIsScratchPadOpen((previous) => !previous);
  };

  const openRunningSessions = () => {
    setIsOverflowMenuOpen(false);
    setIsPreviousSessionsOpen(false);
    setIsScratchPadOpen(false);
    setIsSessionSearchSelectionVisible(false);
    setIsSessionSearchOpen(false);
    setSessionSearchQuery("");
    setIsDaemonSessionsOpen(true);
    vscode.postMessage({ type: "refreshDaemonSessions" });
  };

  const openSidebarSettings = () => {
    setIsOverflowMenuOpen(false);
    vscode.postMessage({ type: "openSettings" });
  };

  const closeSessionSearch = () => {
    setIsSessionSearchSelectionVisible(false);
    setIsSessionSearchOpen(false);
    setSessionSearchQuery("");
  };

  const closeTopmostSidebarOverlay = useEffectEvent(() => {
    if (gitCommitDraft) {
      closeGitCommitModal(gitCommitDraft.requestId);
      return true;
    }

    if (isDaemonSessionsOpen) {
      setIsDaemonSessionsOpen(false);
      return true;
    }

    if (isPreviousSessionsOpen) {
      setIsPreviousSessionsOpen(false);
      return true;
    }

    if (isScratchPadOpen) {
      setIsScratchPadOpen(false);
      return true;
    }

    if (isOverflowMenuOpen) {
      setIsOverflowMenuOpen(false);
      return true;
    }

    if (isSessionSearchOpen) {
      closeSessionSearch();
      return true;
    }

    return false;
  });

  const toggleSessionSearch = () => {
    setIsDaemonSessionsOpen(false);
    setIsPreviousSessionsOpen(false);
    setIsScratchPadOpen(false);
    setIsSessionSearchOpen((previous) => {
      if (previous) {
        setIsSessionSearchSelectionVisible(false);
        setSessionSearchQuery("");
      }

      return !previous;
    });
  };

  const restoreSearchedPreviousSession = (historyId: string) => {
    vscode.postMessage({
      historyId,
      type: "restorePreviousSession",
    });
    closeSessionSearch();
  };

  const deleteSearchedPreviousSession = (historyId: string) => {
    vscode.postMessage({
      historyId,
      type: "deletePreviousSession",
    });
  };

  const activateSelectedSessionSearchResult = useEffectEvent(() => {
    if (!selectedSessionSearchResult) {
      return false;
    }

    if (selectedSessionSearchResult.kind === "previous") {
      restoreSearchedPreviousSession(selectedSessionSearchResult.historyId);
      return true;
    }

    const selectedResult = sidebarSessionSearchResults.find((result) =>
      isSidebarSessionSearchSelectionMatch(result, selectedSessionSearchResult),
    );
    if (!selectedResult || selectedResult.kind !== "session") {
      return false;
    }

    applyLocalFocus(selectedResult.groupId, selectedResult.sessionId);
    vscode.postMessage({
      sessionId: selectedResult.sessionId,
      type: "focusSession",
    });
    return true;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const searchInput = searchInputRef.current;
      const isSearchInputTarget = searchInput !== null && target === searchInput;

      if (event.key === "Escape") {
        if (!closeTopmostSidebarOverlay()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        event.defaultPrevented ||
        gitCommitDraft !== undefined ||
        isDaemonSessionsOpen ||
        isPreviousSessionsOpen ||
        isScratchPadOpen ||
        isOverflowMenuOpen ||
        (isEditableSidebarKeyboardTarget(target) && !isSearchInputTarget)
      ) {
        return;
      }

      if (
        isSessionSearchOpen &&
        isSidebarSessionSearchNavigationKey(event) &&
        (isSearchInputTarget || !isEditableSidebarKeyboardTarget(target))
      ) {
        const nextSelection = getNextSidebarSessionSearchSelection({
          currentSelection: selectedSessionSearchResult,
          direction: getSidebarSessionSearchNavigationDirection(event),
          results: sidebarSessionSearchResults,
        });
        if (!nextSelection) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        setSelectedSessionSearchResult(nextSelection);
        setIsSessionSearchSelectionVisible(true);
        return;
      }

      if (
        isSessionSearchOpen &&
        event.key === "Enter" &&
        (isSearchInputTarget || !isEditableSidebarKeyboardTarget(target))
      ) {
        if (!activateSelectedSessionSearchResult()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        setIsSessionSearchSelectionVisible(false);
        return;
      }

      if (isSearchInputTarget) {
        return;
      }

      if (isSessionSearchOpen && isTextEditingKey(event)) {
        const nextSearchState = applyTextEditingKey(
          {
            value: sessionSearchQuery,
          },
          event.key,
          event,
        );
        if (!nextSearchState) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        setSessionSearchQuery(nextSearchState.value);
        return;
      }

      if (!isSidebarSearchActivationKey(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsSessionSearchOpen(true);
      setSessionSearchQuery((previous) =>
        isSessionSearchOpen ? `${previous}${event.key}` : event.key,
      );
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activateSelectedSessionSearchResult,
    closeTopmostSidebarOverlay,
    gitCommitDraft,
    isDaemonSessionsOpen,
    isOverflowMenuOpen,
    isPreviousSessionsOpen,
    isScratchPadOpen,
    isSessionSearchOpen,
    selectedSessionSearchResult,
    sessionSearchQuery,
    sidebarSessionSearchResults,
  ]);

  const adjustTerminalFontSize = (delta: -1 | 1) => {
    vscode.postMessage({ delta, type: "adjustTerminalFontSize" });
  };

  const toggleCompletionBell = () => {
    setIsOverflowMenuOpen(false);
    vscode.postMessage({ type: "toggleCompletionBell" });
  };

  const toggleActiveSessionsSortMode = () => {
    setIsOverflowMenuOpen(false);
    vscode.postMessage({ type: "toggleActiveSessionsSortMode" });
  };

  const moveSidebar = () => {
    setIsOverflowMenuOpen(false);
    vscode.postMessage({ type: "moveSidebarToOtherSide" });
  };

  const openAddAgentModal = () => {
    setIsOverflowMenuOpen(false);
    setAgentCreateRequestId((previous) => previous + 1);
  };

  const openAddActionModal = () => {
    setIsOverflowMenuOpen(false);
    setCommandCreateActionType("terminal");
    setCommandCreateRequestId((previous) => previous + 1);
  };

  const openAddBrowserModal = () => {
    setIsOverflowMenuOpen(false);
    setCommandCreateActionType("browser");
    setCommandCreateRequestId((previous) => previous + 1);
  };

  const openWorkspaceWelcome = () => {
    setIsOverflowMenuOpen(false);
    vscode.postMessage({ type: "openWorkspaceWelcome" });
  };

  const topControlOptions = {
    completionBellEnabled,
    isManualActiveSessionsSort,
    isOverflowMenuOpen,
    isPreviousSessionsOpen,
    isScratchPadOpen,
    isSessionSearchOpen,
    onAdjustTerminalFontSize: adjustTerminalFontSize,
    onMoveSidebar: moveSidebar,
    onOpenHelp: openWorkspaceWelcome,
    onOpenSettings: openSidebarSettings,
    onShowRunning: openRunningSessions,
    onTogglePreviousSessions: () => {
      setIsDaemonSessionsOpen(false);
      setIsScratchPadOpen(false);
      setIsSessionSearchSelectionVisible(false);
      setIsSessionSearchOpen(false);
      setSessionSearchQuery("");
      setIsPreviousSessionsOpen((previous) => !previous);
    },
    onToggleSessionSearch: toggleSessionSearch,
    onToggleActiveSessionsSortMode: toggleActiveSessionsSortMode,
    onToggleBell: toggleCompletionBell,
    onToggleMenu: toggleOverflowMenu,
    onToggleScratchPad: openScratchPad,
    overflowMenuPosition,
    overflowMenuRef,
  } satisfies RenderSidebarTopControlsOptions;

  return (
    <Tooltip.Provider delay={TOOLTIP_DELAY_MS}>
      <div
        className="stack"
        data-dimmed={String(isStartupInteractionBlocked)}
        data-sidebar-theme={theme}
        onDoubleClick={handleSidebarDoubleClick}
      >
        <div className="sidebar-top-panels">
          <CommandsPanel
            createActionType={commandCreateActionType}
            createRequestId={commandCreateRequestId}
            titlebarActions={
              shouldShowActionsPanel ? renderSidebarTopControls(topControlOptions) : undefined
            }
            isCollapsed={collapsedSections.actions}
            isVisible={shouldShowActionsPanel}
            onToggleCollapsed={(collapsed) => {
              setSectionCollapsed("actions", collapsed);
              vscode.postMessage({
                collapsed,
                section: "actions",
                type: "setSidebarSectionCollapsed",
              });
            }}
            showGitButton={sectionVisibility.git}
            vscode={vscode}
          />
          <AgentsPanel
            createRequestId={agentCreateRequestId}
            titlebarActions={
              shouldShowAgentsPanel
                ? renderSidebarTopControls({
                    ...topControlOptions,
                    showMenu: !shouldShowActionsPanel,
                  })
                : undefined
            }
            isCollapsed={collapsedSections.agents}
            isVisible={shouldShowAgentsPanel}
            onToggleCollapsed={(collapsed) => {
              setSectionCollapsed("agents", collapsed);
              vscode.postMessage({
                collapsed,
                section: "agents",
                type: "setSidebarSectionCollapsed",
              });
            }}
            vscode={vscode}
          />
        </div>
        <section className="session-groups-panel" ref={sessionGroupsPanelRef}>
          <div className="session-groups-top">
            {!shouldShowActionsPanel && !shouldShowAgentsPanel
              ? renderSidebarTopControls(topControlOptions)
              : null}
            {isSessionSearchOpen ? (
              <SidebarSessionSearchField
                inputRef={searchInputRef}
                query={sessionSearchQuery}
                setQuery={setSessionSearchQuery}
              />
            ) : null}
          </div>
          <div
            className="session-groups-scroll-shell"
            data-scroll-glow-bottom={String(showSessionGroupsBottomGlow)}
            data-scroll-glow-top={String(showSessionGroupsTopGlow)}
          >
            <div
              aria-hidden="true"
              className="session-groups-scroll-glow session-groups-scroll-glow-top"
            />
            <div className="session-groups-content" ref={sessionGroupsContentRef}>
              {displayedBrowserGroupIds.length > 0 ? (
                <div className="group-list browser-group-list">
                  {displayedBrowserGroupIds.map((groupId) => (
                    <SessionGroupSection
                      autoEdit={false}
                      canClose={false}
                      completionFlashNonceBySessionId={completionFlashNonceBySessionId}
                      draggingDisabled={isSessionSearchOpen}
                      groupId={groupId}
                      index={-1}
                      isCollapsed={collapsedGroupsById[groupId] === true}
                      key={groupId}
                      onAutoEditHandled={() => undefined}
                      onCollapsedChange={setGroupCollapsed}
                      orderedSessionIds={displayedBrowserSessionIdsByGroup[groupId] ?? []}
                      selectedSearchSessionId={
                        isSessionSearchSelectionVisible &&
                        selectedSessionSearchResult?.kind === "session"
                          ? selectedSessionSearchResult.sessionId
                          : undefined
                      }
                      vscode={vscode}
                    />
                  ))}
                </div>
              ) : null}
              <DragDropProvider
                key={dragStructureKey}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                sensors={sensors}
              >
                <div className="group-list workspace-group-list">
                  {displayedWorkspaceGroupIds.map((groupId, groupIndex) => (
                    <SessionGroupSection
                      autoEdit={autoEditingGroupId === groupId}
                      canClose={effectiveGroupIds.length > 1}
                      completionFlashNonceBySessionId={completionFlashNonceBySessionId}
                      draggingDisabled={isSessionSearchOpen}
                      groupId={groupId}
                      index={groupIndex}
                      isCollapsed={collapsedGroupsById[groupId] === true}
                      key={groupId}
                      onAutoEditHandled={() => setAutoEditingGroupId(undefined)}
                      onCollapsedChange={setGroupCollapsed}
                      onFocusRequested={applyLocalFocus}
                      orderedSessionIds={displayedWorkspaceSessionIdsByGroup[groupId] ?? []}
                      selectedSearchSessionId={
                        isSessionSearchSelectionVisible &&
                        selectedSessionSearchResult?.kind === "session"
                          ? selectedSessionSearchResult.sessionId
                          : undefined
                      }
                      sessionDropIndicatorGroupId={sessionDropIndicatorGroupId}
                      showSessionDropPositionIndicators={
                        !isSessionSearchOpen && isManualActiveSessionsSort
                      }
                      vscode={vscode}
                    />
                  ))}
                </div>
              </DragDropProvider>
              {isSessionSearchFiltering ? (
                <SidebarPreviousSessionsSearchGroup
                  onDeletePreviousSession={deleteSearchedPreviousSession}
                  onRestorePreviousSession={restoreSearchedPreviousSession}
                  previousSessions={filteredPreviousSessions}
                  selectedHistoryId={
                    isSessionSearchSelectionVisible &&
                    selectedSessionSearchResult?.kind === "previous"
                      ? selectedSessionSearchResult.historyId
                      : undefined
                  }
                  showDebugSessionNumbers={debuggingMode}
                  showHotkeys={showHotkeysOnSessionCards}
                />
              ) : null}
              {!isSessionSearchOpen ? (
                <div className="group group-create-shell" data-empty-space-blocking="true">
                  <div className="group-head">
                    <button
                      aria-label="Create a new group"
                      className="group-create-button"
                      disabled={effectiveGroupIds.length >= MAX_GROUP_COUNT}
                      onClick={() => {
                        pendingCreateGroupRef.current = true;
                        vscode.postMessage({ type: "createGroup" });
                      }}
                      type="button"
                    >
                      <IconPlus
                        aria-hidden="true"
                        className="group-create-button-icon"
                        size={14}
                        stroke={2}
                      />
                      <span className="group-create-button-label section-titlebar-label">
                        New Group
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
              {shouldShowSessionSearchEmptyState ? (
                <div className="empty session-search-empty-state" data-empty-space-blocking="true">
                  No current or previous sessions match that search.
                </div>
              ) : displayedBrowserGroupIds.length === 0 &&
                displayedWorkspaceGroupIds.every(
                  (groupId) => (displayedWorkspaceSessionIdsByGroup[groupId] ?? []).length === 0,
                ) &&
                !isSessionSearchOpen ? (
                <div className="empty" data-empty-space-blocking="true">
                  Create the first session to start the workspace.
                </div>
              ) : null}
            </div>
            <div
              aria-hidden="true"
              className="session-groups-scroll-glow session-groups-scroll-glow-bottom"
            />
          </div>
        </section>
        <PreviousSessionsModal
          isOpen={isPreviousSessionsOpen}
          onClose={() => setIsPreviousSessionsOpen(false)}
          vscode={vscode}
        />
        <DaemonSessionsModal
          isOpen={isDaemonSessionsOpen}
          onClose={() => setIsDaemonSessionsOpen(false)}
          vscode={vscode}
        />
        <ScratchPadModal
          isOpen={isScratchPadOpen}
          onClose={() => setIsScratchPadOpen(false)}
          onSave={(content) => {
            vscode.postMessage({
              content,
              type: "saveScratchPad",
            });
          }}
        />
        <GitCommitModal
          draft={
            gitCommitDraft ?? {
              confirmLabel: "Commit",
              description: "",
              requestId: "",
              suggestedBody: undefined,
              suggestedSubject: "",
            }
          }
          isOpen={gitCommitDraft !== undefined}
          onCancel={(requestId) => {
            closeGitCommitModal(requestId);
          }}
          onConfirm={(requestId, message) => {
            setGitCommitDraft(undefined);
            vscode.postMessage({
              message,
              requestId,
              type: "confirmSidebarGitCommit",
            });
          }}
        />
      </div>
    </Tooltip.Provider>
  );
}

function isEmptySidebarDoubleClick(
  target: EventTarget | null,
  currentTarget: HTMLElement,
): boolean {
  if (target === currentTarget) {
    return true;
  }

  const targetNode = target instanceof Node ? target : undefined;
  const targetElement =
    targetNode instanceof Element ? targetNode : (targetNode?.parentElement ?? undefined);
  if (!targetElement || !currentTarget.contains(targetElement)) {
    return false;
  }

  return targetElement.closest(SIDEBAR_EMPTY_SPACE_BLOCKER_SELECTOR) === null;
}

type ToolbarIconButtonProps = {
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaHasPopup?: "dialog" | "menu";
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  dataDimmed?: string;
  isDisabled?: boolean;
  isDimmed?: boolean;
  isSelected?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  tooltip: string;
  triggerDataName?: string;
};

function ToolbarIconButton({
  ariaControls,
  ariaExpanded,
  ariaHasPopup,
  ariaLabel,
  children,
  className,
  dataDimmed,
  isDisabled = false,
  isDimmed = false,
  isSelected = false,
  onClick,
  tabIndex,
  tooltip,
  triggerDataName,
}: ToolbarIconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            aria-controls={ariaControls}
            aria-disabled={isDisabled}
            aria-expanded={ariaExpanded}
            aria-haspopup={ariaHasPopup}
            aria-label={ariaLabel}
            className={className ? `toolbar-button ${className}` : "toolbar-button"}
            data-disabled={String(isDisabled)}
            data-dimmed={dataDimmed ?? String(isDimmed)}
            data-sidebar-overflow-trigger={triggerDataName}
            data-selected={String(isSelected)}
            onClick={(event) => {
              if (isDisabled) {
                return;
              }

              onClick(event);
            }}
            tabIndex={tabIndex}
            type="button"
          >
            {children}
          </button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="tooltip-positioner" sideOffset={8}>
          <Tooltip.Popup className="tooltip-popup">{tooltip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function createWorkspaceSessionIdsByGroup(
  workspaceGroupIds: readonly string[],
  sessionIdsByGroup: SessionIdsByGroup,
): SessionIdsByGroup {
  return Object.fromEntries(
    workspaceGroupIds.map((groupId) => [groupId, sessionIdsByGroup[groupId] ?? []]),
  );
}

function createDragStructureKey(
  groupIds: readonly string[],
  sessionIdsByGroup: SessionIdsByGroup,
): string {
  return groupIds
    .map((groupId) => `${groupId}:${(sessionIdsByGroup[groupId] ?? []).join(",")}`)
    .join("|");
}

function findSessionGroupId(
  sessionIdsByGroup: SessionIdsByGroup,
  sessionId: string,
): string | undefined {
  return Object.entries(sessionIdsByGroup).find(([, sessionIds]) =>
    sessionIds.includes(sessionId),
  )?.[0];
}

function haveSameSessionOrder(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((sessionId, index) => sessionId === right[index]);
}

function findCreatedGroupId(
  previousGroups: readonly string[],
  nextGroups: readonly string[],
): string | undefined {
  const previousGroupIds = new Set(previousGroups);
  return nextGroups.find((groupId) => !previousGroupIds.has(groupId));
}

function OverflowIcon() {
  return (
    <svg aria-hidden="true" className="toolbar-icon" viewBox="0 0 16 16">
      <circle cx="3.5" cy="8" fill="currentColor" r="1.1" />
      <circle cx="8" cy="8" fill="currentColor" r="1.1" />
      <circle cx="12.5" cy="8" fill="currentColor" r="1.1" />
    </svg>
  );
}

function getCompletionBellMenuLabel(completionBellEnabled: boolean): string {
  return completionBellEnabled ? "Disable Notifying" : "Enable Notifying";
}

function getActiveSessionsSortMenuLabel(isManualActiveSessionsSort: boolean): string {
  return isManualActiveSessionsSort ? "Sort: Manual" : "Sort: Last Activity";
}

function getScratchPadMenuLabel(isScratchPadOpen: boolean): string {
  return isScratchPadOpen ? "Hide Scratch Pad" : "Scratch Pad";
}

type RenderSidebarTopControlsOptions = {
  completionBellEnabled: boolean;
  isManualActiveSessionsSort: boolean;
  isOverflowMenuOpen: boolean;
  isPreviousSessionsOpen: boolean;
  isScratchPadOpen: boolean;
  isSessionSearchOpen: boolean;
  onAdjustTerminalFontSize: (delta: -1 | 1) => void;
  onMoveSidebar: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onShowRunning: () => void;
  onTogglePreviousSessions: () => void;
  onToggleSessionSearch: () => void;
  onToggleActiveSessionsSortMode: () => void;
  onToggleBell: () => void;
  onToggleMenu: (trigger: HTMLElement) => void;
  onToggleScratchPad: () => void;
  overflowMenuPosition?: FloatingMenuPosition;
  overflowMenuRef: RefObject<HTMLDivElement | null>;
  showMenu?: boolean;
};

function renderSidebarTopControls({
  completionBellEnabled,
  isManualActiveSessionsSort,
  isOverflowMenuOpen,
  isPreviousSessionsOpen,
  isScratchPadOpen,
  isSessionSearchOpen,
  onAdjustTerminalFontSize,
  onMoveSidebar: _onMoveSidebar,
  onOpenHelp,
  onOpenSettings,
  onShowRunning,
  onTogglePreviousSessions,
  onToggleSessionSearch,
  onToggleActiveSessionsSortMode,
  onToggleBell,
  onToggleMenu,
  onToggleScratchPad,
  overflowMenuPosition,
  overflowMenuRef,
  showMenu = true,
}: RenderSidebarTopControlsOptions) {
  if (!showMenu) {
    return undefined;
  }

  return (
    <div
      className="sidebar-titlebar-controls"
      data-controls-visible={String(
        isOverflowMenuOpen || isPreviousSessionsOpen || isSessionSearchOpen,
      )}
      data-empty-space-blocking="true"
      data-menu-open={String(isOverflowMenuOpen)}
    >
      <ToolbarIconButton
        ariaExpanded={isSessionSearchOpen}
        ariaLabel="Search sessions"
        className="floating-toolbar-button section-titlebar-action-button"
        isSelected={isSessionSearchOpen}
        onClick={() => {
          onToggleSessionSearch();
        }}
        tooltip="Search"
      >
        <IconSearch aria-hidden="true" className="toolbar-tabler-icon" stroke={1.8} />
      </ToolbarIconButton>
      <ToolbarIconButton
        ariaExpanded={isPreviousSessionsOpen}
        ariaHasPopup="dialog"
        ariaLabel="Show previous sessions"
        className="floating-toolbar-button section-titlebar-action-button"
        isSelected={isPreviousSessionsOpen}
        onClick={() => {
          onTogglePreviousSessions();
        }}
        tooltip="Previous Sessions"
      >
        <IconHistory aria-hidden="true" className="toolbar-tabler-icon" stroke={1.8} />
      </ToolbarIconButton>
      <ToolbarIconButton
        ariaControls="sidebar-overflow-menu"
        ariaExpanded={isOverflowMenuOpen}
        ariaHasPopup="menu"
        ariaLabel="Open sidebar menu"
        className="floating-toolbar-button section-titlebar-action-button"
        isSelected={isOverflowMenuOpen}
        onClick={(event) => onToggleMenu(event.currentTarget)}
        tooltip="More"
        triggerDataName="true"
      >
        <OverflowIcon />
      </ToolbarIconButton>
      {isOverflowMenuOpen && overflowMenuPosition
        ? createPortal(
            <div
              aria-label="Sidebar actions"
              className="session-context-menu"
              data-empty-space-blocking="true"
              id="sidebar-overflow-menu"
              ref={overflowMenuRef}
              role="menu"
              style={{
                left: overflowMenuPosition.left,
                top: overflowMenuPosition.top,
                transform: "translateX(-100%)",
                zIndex: 250,
              }}
            >
              <div className="session-context-menu-group">
                <div
                  className="session-context-menu-split-row"
                  role="group"
                  aria-label="Terminal zoom controls"
                >
                  <button
                    aria-label="Zoom Out"
                    className="session-context-menu-split-item"
                    onClick={() => onAdjustTerminalFontSize(-1)}
                    role="menuitem"
                    type="button"
                  >
                    <IconMinus
                      aria-hidden="true"
                      className="session-context-menu-icon"
                      size={14}
                      stroke={1.8}
                    />
                  </button>
                  <button
                    aria-label="Zoom In"
                    className="session-context-menu-split-item"
                    onClick={() => onAdjustTerminalFontSize(1)}
                    role="menuitem"
                    type="button"
                  >
                    <IconPlus aria-hidden="true" className="session-context-menu-icon" size={14} />
                  </button>
                </div>
                <button
                  className="session-context-menu-item"
                  onClick={onToggleBell}
                  role="menuitem"
                  type="button"
                >
                  {completionBellEnabled ? (
                    <IconBellOff
                      aria-hidden="true"
                      className="session-context-menu-icon"
                      size={14}
                    />
                  ) : (
                    <IconBell aria-hidden="true" className="session-context-menu-icon" size={14} />
                  )}
                  {getCompletionBellMenuLabel(completionBellEnabled)}
                </button>
              </div>
              <div className="session-context-menu-divider" role="separator" />
              <div className="session-context-menu-group">
                <button
                  className="session-context-menu-item"
                  onClick={onToggleActiveSessionsSortMode}
                  role="menuitem"
                  type="button"
                >
                  <IconArrowsSort
                    aria-hidden="true"
                    className="session-context-menu-icon"
                    size={14}
                    stroke={1.8}
                  />
                  {getActiveSessionsSortMenuLabel(isManualActiveSessionsSort)}
                </button>
                <button
                  className="session-context-menu-item"
                  onClick={onToggleScratchPad}
                  role="menuitem"
                  type="button"
                >
                  <IconPencil
                    aria-hidden="true"
                    className="session-context-menu-icon"
                    size={14}
                    stroke={1.8}
                  />
                  {getScratchPadMenuLabel(isScratchPadOpen)}
                </button>
              </div>
              <div className="session-context-menu-divider" role="separator" />
              <div className="session-context-menu-group">
                <button
                  className="session-context-menu-item"
                  onClick={onShowRunning}
                  role="menuitem"
                  type="button"
                >
                  <IconHistory aria-hidden="true" className="session-context-menu-icon" size={14} />
                  Running
                </button>
                <button
                  className="session-context-menu-item"
                  onClick={onOpenHelp}
                  role="menuitem"
                  type="button"
                >
                  <IconHelpCircle
                    aria-hidden="true"
                    className="session-context-menu-icon"
                    size={14}
                    stroke={1.8}
                  />
                  Tips &amp; Tricks
                </button>
                <button
                  className="session-context-menu-item"
                  onClick={onOpenSettings}
                  role="menuitem"
                  type="button"
                >
                  <IconSettings
                    aria-hidden="true"
                    className="session-context-menu-icon"
                    size={14}
                    stroke={1.8}
                  />
                  VSmux Settings
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function resolveSessionDropTargetFromPoint(
  nativeEvent: Event | undefined,
  sessionIdsByGroup: SessionIdsByGroup,
  targetData: ReturnType<typeof getSidebarDropData>,
  sourceData: Extract<ReturnType<typeof getSidebarDropData>, { kind: "session" }> | undefined,
) {
  const point = getClientPoint(nativeEvent);
  const candidates = [
    getSidebarSessionDropTarget(targetData),
    getSidebarSessionDropTargetFromDropData(targetData, point),
    point ? getSidebarSessionDropTargetAtPoint(document, point.x, point.y) : undefined,
    getSidebarSessionDropTargetFromEvent(nativeEvent),
  ];

  for (const candidate of candidates) {
    if (!candidate || isSourceSessionDropTarget(candidate, sourceData)) {
      continue;
    }

    const groupSessionIds = sessionIdsByGroup[candidate.groupId];
    if (!groupSessionIds) {
      continue;
    }

    if (candidate.kind === "session" && !groupSessionIds.includes(candidate.sessionId)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function isSourceSessionDropTarget(
  candidate: SidebarSessionDropTarget,
  sourceData: Extract<ReturnType<typeof getSidebarDropData>, { kind: "session" }> | undefined,
): boolean {
  return Boolean(
    sourceData &&
    candidate.kind === "session" &&
    candidate.groupId === sourceData.groupId &&
    candidate.sessionId === sourceData.sessionId,
  );
}

function getSidebarSessionDropTargetFromDropData(
  targetData: ReturnType<typeof getSidebarDropData>,
  point: ReturnType<typeof getClientPoint>,
): SidebarSessionDropTarget | undefined {
  if (targetData?.kind === "session") {
    const sessionElement = getTargetSessionElement(targetData.sessionId, point);
    if (!sessionElement) {
      return undefined;
    }

    const bounds = sessionElement.getBoundingClientRect();
    const relativeY = point?.y ?? bounds.top + bounds.height / 2;
    const position: "after" | "before" =
      relativeY > bounds.top + bounds.height / 2 ? "after" : "before";
    return {
      groupId: targetData.groupId,
      kind: "session",
      position,
      sessionId: targetData.sessionId,
    };
  }

  if (targetData?.kind === "group") {
    const groupElement = document.querySelector<HTMLElement>(
      `[data-sidebar-group-id="${targetData.groupId}"]`,
    );
    if (!groupElement) {
      return undefined;
    }

    const bounds = groupElement.getBoundingClientRect();
    const relativeY = point?.y ?? bounds.top;
    const position: "end" | "start" = relativeY > bounds.top + bounds.height / 2 ? "end" : "start";
    return {
      groupId: targetData.groupId,
      kind: "group",
      position,
    };
  }

  return undefined;
}

function getTargetSessionElement(
  sessionId: string,
  point: ReturnType<typeof getClientPoint>,
): HTMLElement | undefined {
  const selector = `[data-sidebar-session-id="${sessionId}"]`;
  if (point) {
    for (const element of document.elementsFromPoint(point.x, point.y)) {
      const sessionElement = element.closest<HTMLElement>(selector);
      if (sessionElement && sessionElement.dataset.dragging !== "true") {
        return sessionElement;
      }
    }
  }

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (sessionElement) => sessionElement.dataset.dragging !== "true",
  );
}

function getDragNativeEvent(value: unknown): Event | undefined {
  return isObjectRecord(value) && value.nativeEvent instanceof Event
    ? value.nativeEvent
    : undefined;
}

function createSessionPointerDragState(
  sourceData: Extract<ReturnType<typeof getSidebarDropData>, { kind: "session" }>,
  pointerDownSessionTarget: SidebarPointerDownSessionTarget | undefined,
  nativeEvent: Event | undefined,
): SidebarSessionPointerDragState {
  const startPoint =
    pointerDownSessionTarget &&
    pointerDownSessionTarget.groupId === sourceData.groupId &&
    pointerDownSessionTarget.sessionId === sourceData.sessionId
      ? pointerDownSessionTarget.point
      : undefined;

  return {
    didMove: hasPointerDragMovedPastThreshold(startPoint, getClientPoint(nativeEvent)),
    startPoint,
  };
}

function updateSessionPointerDragState(
  pointerDragState: SidebarSessionPointerDragState | undefined,
  nativeEvent: Event | undefined,
): void {
  if (!pointerDragState || pointerDragState.didMove) {
    return;
  }

  pointerDragState.didMove = hasPointerDragMovedPastThreshold(
    pointerDragState.startPoint,
    getClientPoint(nativeEvent),
  );
}

function hasPointerDragMovedPastThreshold(
  startPoint: { x: number; y: number } | undefined,
  currentPoint: { x: number; y: number } | undefined,
): boolean {
  if (!startPoint || !currentPoint) {
    return false;
  }

  return (
    Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) >=
    SIDEBAR_POINTER_DRAG_REORDER_THRESHOLD_PX
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createDisplayedSessionIdsByGroup({
  groupIds,
  query,
  sessionIdsByGroup,
  sessionsById,
  shouldFilter,
}: {
  groupIds: readonly string[];
  query: string;
  sessionIdsByGroup: SessionIdsByGroup;
  sessionsById: ReturnType<typeof useSidebarStore.getState>["sessionsById"];
  shouldFilter: boolean;
}): SessionIdsByGroup {
  const displayedSessionIdsByGroup: SessionIdsByGroup = {};

  for (const groupId of groupIds) {
    const sessionIds = sessionIdsByGroup[groupId] ?? [];
    displayedSessionIdsByGroup[groupId] = !shouldFilter
      ? [...sessionIds]
      : sessionIds.filter((sessionId) => {
          const session = sessionsById[sessionId];
          return session ? matchesSidebarSessionSearchQuery(session, query) : false;
        });
  }

  return displayedSessionIdsByGroup;
}

function createDisplayedGroupIds(
  groupIds: readonly string[],
  sessionIdsByGroup: SessionIdsByGroup,
  shouldFilter: boolean,
): string[] {
  if (!shouldFilter) {
    return [...groupIds];
  }

  return groupIds.filter((groupId) => (sessionIdsByGroup[groupId] ?? []).length > 0);
}

function isSidebarSearchActivationKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    /^[\p{L}\p{N}]$/u.test(event.key)
  );
}

function isSidebarSessionSearchNavigationKey(event: KeyboardEvent): boolean {
  return (
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Tab")
  );
}

function getSidebarSessionSearchNavigationDirection(event: KeyboardEvent): -1 | 1 {
  return event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
}

function isEditableSidebarKeyboardTarget(target: Node): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable]"));
}
