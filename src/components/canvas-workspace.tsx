import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  LayoutGridIcon,
  MenuIcon,
  MinusIcon,
  MoonIcon,
  PauseIcon,
  PlusIcon,
  PlayIcon,
  RefreshCwIcon,
  Settings2Icon,
  SunIcon,
  TerminalSquareIcon,
  XIcon,
} from "lucide-react";
import type {
  CanvasAssetUris,
  CanvasAutoAlignHeightUnit,
  CanvasTerminalPerformanceSettings,
  CanvasPanMode,
  TerminalPerformanceProfile,
  TerminalRenderPriority,
  CanvasThemeMode,
  CanvasUiSettings,
  CanvasViewport,
  CanvasWorkspaceSnapshot,
  TerminalTileModel,
  CanvasAutoAlignWidthUnit,
} from "../../shared/canvas-contract";
import {
  clampAutoAlignSizeValue,
  clampPanSnapHysteresis,
  clampPanSnapRadius,
  clampPanSnapSettleDelay,
  clampPanSnapSettleStrength,
  clampPanSnapStrength,
  clampTerminalMaxFps,
  clampTerminalWriteBatchIntervalMs,
} from "../../shared/canvas-contract";
import type { TerminalSessionsByTileId } from "../../shared/terminal-host-protocol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TerminalTile } from "@/components/terminal-tile";
import {
  getSessionActivityIndicator,
  type SessionActivityByTileId,
  type SessionActivityIndicator,
} from "@/lib/session-activity";
import { cn } from "@/lib/utils";

const TILE_HEIGHT = 450;
const TILE_WIDTH = 870;
const TILE_PLACEMENT_GAP = 28;
const TILE_START_X = 120;
const TILE_START_Y = 96;
const MAX_ZOOM = 1.8;
const MIN_ZOOM = 0.25;
const PINCH_ZOOM_SENSITIVITY = 0.009;
const SNAP_THRESHOLD = 18;
const AUTO_ALIGN_GAP = 28;
const AUTO_ALIGN_GRID = 16;
const AUTO_ALIGN_PADDING = 64;
const FOCUS_REVEAL_MIN_VISIBLE_RATIO = 0.5;
const WHEEL_LINE_PIXELS = 16;
const WHEEL_PAGE_PIXELS = 800;
const TILE_FOCUS_ZOOM = 1;
const COMPACT_SIDEBAR_MEDIA_QUERY = "(max-width: 1279px)";
const COMPACT_SESSION_MAP_MIN_VISIBLE_RATIO = 0.14;
const TERMINAL_SURFACE_SELECTOR = "[data-terminal-surface='true']";

type CanvasWorkspaceProps = {
  assetUris: CanvasAssetUris;
  isHydrated: boolean;
  onAutoAlignSizeChange: (
    autoAlignWidthValue: number,
    autoAlignWidthUnit: CanvasAutoAlignWidthUnit,
    autoAlignHeightValue: number,
    autoAlignHeightUnit: CanvasAutoAlignHeightUnit,
  ) => void;
  onPanBehaviorChange: (
    panMode: CanvasPanMode,
    panSnapStrength: number,
    panSnapRadius: number,
    panSnapSettleStrength: number,
    panSnapSettleDelay: number,
    panSnapHysteresis: number,
  ) => void;
  onRestartTerminal: (tileId: string) => void;
  onTerminalNavigationChange: (terminalNavigationWrap: boolean) => void;
  onTerminalPerformanceChange: (terminalPerformance: CanvasTerminalPerformanceSettings) => void;
  onThemeModeChange: (themeMode: CanvasThemeMode) => void;
  settings: CanvasUiSettings;
  sessionActivityByTileId: SessionActivityByTileId;
  onSnapshotChange: (
    update:
      | CanvasWorkspaceSnapshot
      | ((current: CanvasWorkspaceSnapshot) => CanvasWorkspaceSnapshot),
  ) => void;
  snapshot: CanvasWorkspaceSnapshot;
  terminalSessions: TerminalSessionsByTileId;
};

const LEFT_LOCKED_TOOLTIP_COLLISION_AVOIDANCE = {
  align: "shift",
  fallbackAxisSide: "none",
  side: "shift",
} as const;

const LEFT_LOCKED_TOOLTIP_SIDE_OFFSET = 10;

type Interaction =
  | {
      kind: "drag";
      pointerId: number;
      startPointerX: number;
      startPointerY: number;
      startX: number;
      startY: number;
      tileId: string;
    }
  | {
      kind: "pan";
      pointerId: number;
      startPointerX: number;
      startPointerY: number;
      startViewport: CanvasViewport;
    }
  | {
      kind: "resize";
      pointerId: number;
      startHeight: number;
      startPointerX: number;
      startPointerY: number;
      startWidth: number;
      tileId: string;
    };

type AcknowledgedCompletedSession = {
  lastOutputAt?: number;
  startedAt: string;
};

type TerminalJumpDirection = "down" | "left" | "right" | "up";

export const CanvasWorkspace = ({
  assetUris,
  isHydrated,
  onAutoAlignSizeChange,
  onPanBehaviorChange,
  onRestartTerminal,
  onTerminalNavigationChange,
  onTerminalPerformanceChange,
  onThemeModeChange,
  settings,
  sessionActivityByTileId,
  onSnapshotChange,
  snapshot,
  terminalSessions,
}: CanvasWorkspaceProps) => {
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<Interaction | undefined>(undefined);
  const [isCompactSidebar, setIsCompactSidebar] = useState(getCompactSidebarState);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingTileId, setRenamingTileId] = useState<string | undefined>(undefined);
  const [panModeDraft, setPanModeDraft] = useState<CanvasPanMode>(settings.panMode);
  const [panSnapHysteresisDraft, setPanSnapHysteresisDraft] = useState(
    String(settings.panSnapHysteresis),
  );
  const [panSnapRadiusDraft, setPanSnapRadiusDraft] = useState(String(settings.panSnapRadius));
  const [panSnapSettleDelayDraft, setPanSnapSettleDelayDraft] = useState(
    String(settings.panSnapSettleDelay),
  );
  const [panSnapSettleStrengthDraft, setPanSnapSettleStrengthDraft] = useState(
    settings.panSnapSettleStrength.toFixed(2),
  );
  const [panSnapStrengthDraft, setPanSnapStrengthDraft] = useState(
    settings.panSnapStrength.toFixed(2),
  );
  const [autoAlignWidthValueDraft, setAutoAlignWidthValueDraft] = useState(
    String(settings.autoAlignWidthValue),
  );
  const [autoAlignWidthUnitDraft, setAutoAlignWidthUnitDraft] = useState<CanvasAutoAlignWidthUnit>(
    settings.autoAlignWidthUnit,
  );
  const [autoAlignHeightValueDraft, setAutoAlignHeightValueDraft] = useState(
    String(settings.autoAlignHeightValue),
  );
  const [autoAlignHeightUnitDraft, setAutoAlignHeightUnitDraft] =
    useState<CanvasAutoAlignHeightUnit>(settings.autoAlignHeightUnit);
  const [terminalNavigationWrapDraft, setTerminalNavigationWrapDraft] = useState(
    settings.terminalNavigationWrap,
  );
  const [terminalActiveMaxFpsDraft, setTerminalActiveMaxFpsDraft] = useState(
    settings.terminalPerformance.active.maxFps.toFixed(2),
  );
  const [terminalActiveWriteBatchIntervalDraft, setTerminalActiveWriteBatchIntervalDraft] =
    useState(String(settings.terminalPerformance.active.writeBatchIntervalMs));
  const [terminalVisibleMaxFpsDraft, setTerminalVisibleMaxFpsDraft] = useState(
    settings.terminalPerformance.visible.maxFps.toFixed(2),
  );
  const [terminalVisibleWriteBatchIntervalDraft, setTerminalVisibleWriteBatchIntervalDraft] =
    useState(String(settings.terminalPerformance.visible.writeBatchIntervalMs));
  const [terminalOffscreenMaxFpsDraft, setTerminalOffscreenMaxFpsDraft] = useState(
    settings.terminalPerformance.offscreen.maxFps.toFixed(2),
  );
  const [terminalOffscreenWriteBatchIntervalDraft, setTerminalOffscreenWriteBatchIntervalDraft] =
    useState(String(settings.terminalPerformance.offscreen.writeBatchIntervalMs));
  const [acknowledgedCompletedSessions, setAcknowledgedCompletedSessions] = useState<
    Record<string, AcknowledgedCompletedSession>
  >({});
  const [sessionActivityNow, setSessionActivityNow] = useState(() => Date.now());
  const panSettleTimerRef = useRef<number | undefined>(undefined);
  const stickyTargetTileIdRef = useRef<string | undefined>(undefined);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const clearPanSettleTimer = () => {
    window.clearTimeout(panSettleTimerRef.current);
    panSettleTimerRef.current = undefined;
  };

  const settlePanViewport = () => {
    const surface = getSurfaceSize(surfaceRef.current);
    if (!surface) {
      stickyTargetTileIdRef.current = undefined;
      return;
    }

    onSnapshotChange((current) => {
      const result = getSettledStickyViewportResult(
        current.viewport,
        current.tiles,
        surface,
        settings,
        stickyTargetTileIdRef.current,
      );

      return {
        ...current,
        viewport: result.viewport,
      };
    });
    stickyTargetTileIdRef.current = undefined;
  };

  const schedulePanSettle = () => {
    clearPanSettleTimer();

    if (settings.panMode !== "sticky" || settings.panSnapSettleStrength <= 0) {
      stickyTargetTileIdRef.current = undefined;
      return;
    }

    panSettleTimerRef.current = window.setTimeout(() => {
      settlePanViewport();
      panSettleTimerRef.current = undefined;
    }, settings.panSnapSettleDelay);
  };

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      if (interaction.kind === "pan") {
        const surface = getSurfaceSize(surfaceRef.current);

        onSnapshotChange((current) => {
          const nextViewport = {
            ...current.viewport,
            x: interaction.startViewport.x + event.clientX - interaction.startPointerX,
            y: interaction.startViewport.y + event.clientY - interaction.startPointerY,
          };
          const result = getStickyViewportResult(
            nextViewport,
            current.tiles,
            surface,
            settings,
            stickyTargetTileIdRef.current,
          );

          stickyTargetTileIdRef.current = result.targetTileId;

          return {
            ...current,
            viewport: result.viewport,
          };
        });
        return;
      }

      const deltaX = (event.clientX - interaction.startPointerX) / snapshot.viewport.zoom;
      const deltaY = (event.clientY - interaction.startPointerY) / snapshot.viewport.zoom;

      onSnapshotChange((current) => ({
        ...current,
        focusedTileId: interaction.tileId,
        tiles: current.tiles.map((tile) => {
          if (tile.id !== interaction.tileId) {
            return tile;
          }

          if (interaction.kind === "drag") {
            const otherTiles = current.tiles.filter((candidate) => candidate.id !== tile.id);
            const snappedPosition = getSnappedTilePosition(
              {
                ...tile,
                x: interaction.startX + deltaX,
                y: interaction.startY + deltaY,
              },
              otherTiles,
            );

            return {
              ...tile,
              x: snappedPosition.x,
              y: snappedPosition.y,
            };
          }

          const otherTiles = current.tiles.filter((candidate) => candidate.id !== tile.id);
          const snappedSize = getSnappedTileSize(
            {
              ...tile,
              height: Math.max(220, interaction.startHeight + deltaY),
              width: Math.max(320, interaction.startWidth + deltaX),
            },
            otherTiles,
          );

          return {
            ...tile,
            height: snappedSize.height,
            width: snappedSize.width,
          };
        }),
      }));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === interaction.pointerId) {
        if (interaction.kind === "pan") {
          schedulePanSettle();
        }
        setInteraction(undefined);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [interaction, onSnapshotChange, settings, snapshot.viewport.zoom]);

  useEffect(() => {
    return () => {
      window.clearTimeout(panSettleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (settings.panMode === "sticky") {
      return;
    }

    window.clearTimeout(panSettleTimerRef.current);
    panSettleTimerRef.current = undefined;
    stickyTargetTileIdRef.current = undefined;
  }, [settings.panMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactSidebar(event.matches);
    };

    setIsCompactSidebar(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isCompactSidebar) {
      setIsSidebarOpen(false);
    }
  }, [isCompactSidebar]);

  useEffect(() => {
    if (!isCompactSidebar || !isSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCompactSidebar, isSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSettingsOpen) {
        return;
      }

      const direction = getTerminalJumpDirection(event);
      if (!direction) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && isEditableHotkeyTarget(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      onSnapshotChange((current) => {
        const surface = getSurfaceSize(surfaceRef.current);
        if (!surface) {
          return current;
        }

        const currentTile = getTileForKeyboardJump(
          current.tiles,
          current.focusedTileId,
          current.viewport,
          surface,
        );
        if (!currentTile) {
          return current;
        }

        const targetTile = getDirectionalNeighborTile(
          current.tiles,
          currentTile,
          direction,
          settings.terminalNavigationWrap,
        );
        if (!targetTile) {
          return current;
        }

        return {
          ...current,
          focusedTileId: targetTile.id,
          tiles: bringTileToFront(current.tiles, targetTile.id),
          viewport: getViewportCenteredOnTile(current.viewport, targetTile, surface),
        };
      });
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isSettingsOpen, onSnapshotChange, snapshot.focusedTileId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSessionActivityNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!snapshot.focusedTileId) {
      return;
    }

    acknowledgeCompletedSession(snapshot.focusedTileId);
  }, [
    acknowledgedCompletedSessions,
    sessionActivityByTileId,
    sessionActivityNow,
    snapshot.focusedTileId,
  ]);

  const parsedPanSnapHysteresisDraft = Number(panSnapHysteresisDraft);
  const parsedPanSnapRadiusDraft = Number(panSnapRadiusDraft);
  const parsedPanSnapSettleDelayDraft = Number(panSnapSettleDelayDraft);
  const parsedPanSnapSettleStrengthDraft = Number(panSnapSettleStrengthDraft);
  const parsedPanSnapStrengthDraft = Number(panSnapStrengthDraft);
  const parsedAutoAlignWidthValueDraft = Number(autoAlignWidthValueDraft);
  const parsedAutoAlignHeightValueDraft = Number(autoAlignHeightValueDraft);
  const parsedTerminalActiveMaxFpsDraft = Number(terminalActiveMaxFpsDraft);
  const parsedTerminalActiveWriteBatchIntervalDraft = Number(terminalActiveWriteBatchIntervalDraft);
  const parsedTerminalVisibleMaxFpsDraft = Number(terminalVisibleMaxFpsDraft);
  const parsedTerminalVisibleWriteBatchIntervalDraft = Number(
    terminalVisibleWriteBatchIntervalDraft,
  );
  const parsedTerminalOffscreenMaxFpsDraft = Number(terminalOffscreenMaxFpsDraft);
  const parsedTerminalOffscreenWriteBatchIntervalDraft = Number(
    terminalOffscreenWriteBatchIntervalDraft,
  );
  const hasValidPanSnapHysteresisDraft = Number.isFinite(parsedPanSnapHysteresisDraft);
  const hasValidPanSnapRadiusDraft = Number.isFinite(parsedPanSnapRadiusDraft);
  const hasValidPanSnapSettleDelayDraft = Number.isFinite(parsedPanSnapSettleDelayDraft);
  const hasValidPanSnapSettleStrengthDraft = Number.isFinite(parsedPanSnapSettleStrengthDraft);
  const hasValidPanSnapStrengthDraft = Number.isFinite(parsedPanSnapStrengthDraft);
  const hasValidAutoAlignWidthValueDraft = Number.isFinite(parsedAutoAlignWidthValueDraft);
  const hasValidAutoAlignHeightValueDraft = Number.isFinite(parsedAutoAlignHeightValueDraft);
  const hasValidTerminalActiveMaxFpsDraft = Number.isFinite(parsedTerminalActiveMaxFpsDraft);
  const hasValidTerminalActiveWriteBatchIntervalDraft = Number.isFinite(
    parsedTerminalActiveWriteBatchIntervalDraft,
  );
  const hasValidTerminalVisibleMaxFpsDraft = Number.isFinite(parsedTerminalVisibleMaxFpsDraft);
  const hasValidTerminalVisibleWriteBatchIntervalDraft = Number.isFinite(
    parsedTerminalVisibleWriteBatchIntervalDraft,
  );
  const hasValidTerminalOffscreenMaxFpsDraft = Number.isFinite(parsedTerminalOffscreenMaxFpsDraft);
  const hasValidTerminalOffscreenWriteBatchIntervalDraft = Number.isFinite(
    parsedTerminalOffscreenWriteBatchIntervalDraft,
  );
  const normalizedPanSnapHysteresisDraft = hasValidPanSnapHysteresisDraft
    ? clampPanSnapHysteresis(parsedPanSnapHysteresisDraft)
    : undefined;
  const normalizedPanSnapRadiusDraft = hasValidPanSnapRadiusDraft
    ? clampPanSnapRadius(parsedPanSnapRadiusDraft)
    : undefined;
  const normalizedPanSnapSettleDelayDraft = hasValidPanSnapSettleDelayDraft
    ? clampPanSnapSettleDelay(parsedPanSnapSettleDelayDraft)
    : undefined;
  const normalizedPanSnapSettleStrengthDraft = hasValidPanSnapSettleStrengthDraft
    ? clampPanSnapSettleStrength(parsedPanSnapSettleStrengthDraft)
    : undefined;
  const normalizedPanSnapStrengthDraft = hasValidPanSnapStrengthDraft
    ? clampPanSnapStrength(parsedPanSnapStrengthDraft)
    : undefined;
  const normalizedAutoAlignWidthValueDraft = hasValidAutoAlignWidthValueDraft
    ? clampAutoAlignSizeValue(parsedAutoAlignWidthValueDraft, autoAlignWidthUnitDraft)
    : undefined;
  const normalizedAutoAlignHeightValueDraft = hasValidAutoAlignHeightValueDraft
    ? clampAutoAlignSizeValue(parsedAutoAlignHeightValueDraft, autoAlignHeightUnitDraft)
    : undefined;
  const normalizedTerminalActiveMaxFpsDraft = hasValidTerminalActiveMaxFpsDraft
    ? clampTerminalMaxFps(parsedTerminalActiveMaxFpsDraft)
    : undefined;
  const normalizedTerminalActiveWriteBatchIntervalDraft =
    hasValidTerminalActiveWriteBatchIntervalDraft
      ? clampTerminalWriteBatchIntervalMs(parsedTerminalActiveWriteBatchIntervalDraft)
      : undefined;
  const normalizedTerminalVisibleMaxFpsDraft = hasValidTerminalVisibleMaxFpsDraft
    ? clampTerminalMaxFps(parsedTerminalVisibleMaxFpsDraft)
    : undefined;
  const normalizedTerminalVisibleWriteBatchIntervalDraft =
    hasValidTerminalVisibleWriteBatchIntervalDraft
      ? clampTerminalWriteBatchIntervalMs(parsedTerminalVisibleWriteBatchIntervalDraft)
      : undefined;
  const normalizedTerminalOffscreenMaxFpsDraft = hasValidTerminalOffscreenMaxFpsDraft
    ? clampTerminalMaxFps(parsedTerminalOffscreenMaxFpsDraft)
    : undefined;
  const normalizedTerminalOffscreenWriteBatchIntervalDraft =
    hasValidTerminalOffscreenWriteBatchIntervalDraft
      ? clampTerminalWriteBatchIntervalMs(parsedTerminalOffscreenWriteBatchIntervalDraft)
      : undefined;
  const isSettingsSaveDisabled =
    normalizedPanSnapHysteresisDraft === undefined ||
    normalizedPanSnapRadiusDraft === undefined ||
    normalizedPanSnapSettleDelayDraft === undefined ||
    normalizedPanSnapSettleStrengthDraft === undefined ||
    normalizedPanSnapStrengthDraft === undefined ||
    normalizedAutoAlignWidthValueDraft === undefined ||
    normalizedAutoAlignHeightValueDraft === undefined ||
    normalizedTerminalActiveMaxFpsDraft === undefined ||
    normalizedTerminalActiveWriteBatchIntervalDraft === undefined ||
    normalizedTerminalVisibleMaxFpsDraft === undefined ||
    normalizedTerminalVisibleWriteBatchIntervalDraft === undefined ||
    normalizedTerminalOffscreenMaxFpsDraft === undefined ||
    normalizedTerminalOffscreenWriteBatchIntervalDraft === undefined ||
    (autoAlignWidthUnitDraft === settings.autoAlignWidthUnit &&
      normalizedAutoAlignWidthValueDraft === settings.autoAlignWidthValue &&
      autoAlignHeightUnitDraft === settings.autoAlignHeightUnit &&
      normalizedAutoAlignHeightValueDraft === settings.autoAlignHeightValue &&
      terminalNavigationWrapDraft === settings.terminalNavigationWrap &&
      panModeDraft === settings.panMode &&
      normalizedPanSnapHysteresisDraft === settings.panSnapHysteresis &&
      normalizedPanSnapRadiusDraft === settings.panSnapRadius &&
      normalizedPanSnapSettleDelayDraft === settings.panSnapSettleDelay &&
      normalizedPanSnapSettleStrengthDraft === settings.panSnapSettleStrength &&
      normalizedPanSnapStrengthDraft === settings.panSnapStrength &&
      normalizedTerminalActiveMaxFpsDraft === settings.terminalPerformance.active.maxFps &&
      normalizedTerminalActiveWriteBatchIntervalDraft ===
        settings.terminalPerformance.active.writeBatchIntervalMs &&
      normalizedTerminalVisibleMaxFpsDraft === settings.terminalPerformance.visible.maxFps &&
      normalizedTerminalVisibleWriteBatchIntervalDraft ===
        settings.terminalPerformance.visible.writeBatchIntervalMs &&
      normalizedTerminalOffscreenMaxFpsDraft === settings.terminalPerformance.offscreen.maxFps &&
      normalizedTerminalOffscreenWriteBatchIntervalDraft ===
        settings.terminalPerformance.offscreen.writeBatchIntervalMs);

  useEffect(() => {
    setAutoAlignHeightUnitDraft(settings.autoAlignHeightUnit);
    setAutoAlignHeightValueDraft(String(settings.autoAlignHeightValue));
    setAutoAlignWidthUnitDraft(settings.autoAlignWidthUnit);
    setAutoAlignWidthValueDraft(String(settings.autoAlignWidthValue));
    setTerminalNavigationWrapDraft(settings.terminalNavigationWrap);
    setPanModeDraft(settings.panMode);
    setPanSnapHysteresisDraft(String(settings.panSnapHysteresis));
    setPanSnapRadiusDraft(String(settings.panSnapRadius));
    setPanSnapSettleDelayDraft(String(settings.panSnapSettleDelay));
    setPanSnapSettleStrengthDraft(settings.panSnapSettleStrength.toFixed(2));
    setPanSnapStrengthDraft(settings.panSnapStrength.toFixed(2));
    setTerminalActiveMaxFpsDraft(settings.terminalPerformance.active.maxFps.toFixed(2));
    setTerminalActiveWriteBatchIntervalDraft(
      String(settings.terminalPerformance.active.writeBatchIntervalMs),
    );
    setTerminalVisibleMaxFpsDraft(settings.terminalPerformance.visible.maxFps.toFixed(2));
    setTerminalVisibleWriteBatchIntervalDraft(
      String(settings.terminalPerformance.visible.writeBatchIntervalMs),
    );
    setTerminalOffscreenMaxFpsDraft(settings.terminalPerformance.offscreen.maxFps.toFixed(2));
    setTerminalOffscreenWriteBatchIntervalDraft(
      String(settings.terminalPerformance.offscreen.writeBatchIntervalMs),
    );
  }, [
    settings.autoAlignHeightUnit,
    settings.autoAlignHeightValue,
    settings.autoAlignWidthUnit,
    settings.autoAlignWidthValue,
    settings.terminalNavigationWrap,
    settings.panMode,
    settings.panSnapHysteresis,
    settings.panSnapRadius,
    settings.panSnapSettleDelay,
    settings.panSnapSettleStrength,
    settings.panSnapStrength,
    settings.terminalPerformance.active.maxFps,
    settings.terminalPerformance.active.writeBatchIntervalMs,
    settings.terminalPerformance.offscreen.maxFps,
    settings.terminalPerformance.offscreen.writeBatchIntervalMs,
    settings.terminalPerformance.visible.maxFps,
    settings.terminalPerformance.visible.writeBatchIntervalMs,
  ]);

  const handleAddTile = () => {
    const surfaceWidth = surfaceRef.current?.clientWidth ?? 1200;
    const surfaceHeight = surfaceRef.current?.clientHeight ?? 800;

    onSnapshotChange((current) => {
      const tileSize = getAutoAlignTileSize(settings, current.viewport.zoom);
      const tile = createTerminalTileAtPosition(
        current.nextTileIndex,
        getNextOpenTilePosition(current.tiles, tileSize),
        tileSize,
      );

      return {
        ...current,
        focusedTileId: tile.id,
        nextTileIndex: current.nextTileIndex + 1,
        tiles: [...current.tiles, tile],
        viewport: getViewportCenteredOnTile(current.viewport, tile, {
          height: surfaceHeight,
          width: surfaceWidth,
        }),
      };
    });
  };

  const handleCloseTile = (tileId: string) => {
    onSnapshotChange((current) => {
      const remainingTiles = current.tiles.filter((tile) => tile.id !== tileId);

      return {
        ...current,
        focusedTileId: remainingTiles.at(-1)?.id,
        tiles: remainingTiles,
      };
    });

    if (renamingTileId === tileId) {
      setRenamingTileId(undefined);
      setRenameDraft("");
    }
  };

  const handleFocusTile = (tileId: string) => {
    onSnapshotChange((current) => {
      const tile = current.tiles.find((candidate) => candidate.id === tileId);
      if (!tile) {
        return current;
      }

      const surface = getSurfaceSize(surfaceRef.current);
      const tiles = bringTileToFront(current.tiles, tileId);
      if (!surface) {
        return { ...current, focusedTileId: tileId, tiles };
      }

      const visibleRatio = getTileVisibleRatio(tile, current.viewport, surface);

      return {
        ...current,
        focusedTileId: tileId,
        tiles,
        viewport:
          visibleRatio < FOCUS_REVEAL_MIN_VISIBLE_RATIO
            ? getViewportCenteredOnTile(current.viewport, tile, surface)
            : current.viewport,
      };
    });
  };

  const handleZoomToTile = (tileId: string) => {
    onSnapshotChange((current) => {
      const tile = current.tiles.find((candidate) => candidate.id === tileId);
      if (!tile) {
        return current;
      }

      const surface = getSurfaceSize(surfaceRef.current);
      const tiles = bringTileToFront(current.tiles, tileId);
      if (!surface) {
        return {
          ...current,
          focusedTileId: tileId,
          tiles,
        };
      }

      const nextZoom = clampZoom(TILE_FOCUS_ZOOM);
      const zoomedViewport = {
        ...current.viewport,
        zoom: nextZoom,
      };

      return {
        ...current,
        focusedTileId: tileId,
        tiles,
        viewport: getViewportCenteredOnTile(zoomedViewport, tile, surface),
      };
    });
  };

  const getDisplayedSessionActivityIndicator = (tileId: string) => {
    const activity = sessionActivityByTileId[tileId];
    const indicator = getSessionActivityIndicator(activity, sessionActivityNow);
    const acknowledgedSession = acknowledgedCompletedSessions[tileId];

    if (
      indicator === "done" &&
      acknowledgedSession?.startedAt === activity?.startedAt &&
      acknowledgedSession?.lastOutputAt === activity?.lastOutputAt
    ) {
      return "paused";
    }

    return indicator;
  };

  const acknowledgeCompletedSession = (tileId: string) => {
    const activity = sessionActivityByTileId[tileId];

    if (!activity || getSessionActivityIndicator(activity) !== "done") {
      return;
    }

    const acknowledgedSession = acknowledgedCompletedSessions[tileId];
    if (
      acknowledgedSession?.startedAt === activity.startedAt &&
      acknowledgedSession?.lastOutputAt === activity.lastOutputAt
    ) {
      return;
    }

    setAcknowledgedCompletedSessions((current) => ({
      ...current,
      [tileId]: {
        lastOutputAt: activity.lastOutputAt,
        startedAt: activity.startedAt,
      },
    }));
  };

  const handleRecenterTile = (tileId: string) => {
    onSnapshotChange((current) => {
      const tile = current.tiles.find((candidate) => candidate.id === tileId);
      if (!tile) {
        return current;
      }

      const surface = surfaceRef.current;
      const surfaceWidth = surface?.clientWidth ?? 1200;
      const surfaceHeight = surface?.clientHeight ?? 800;

      return {
        ...current,
        focusedTileId: tileId,
        tiles: bringTileToFront(current.tiles, tileId),
        viewport: getViewportCenteredOnTile(current.viewport, tile, {
          height: surfaceHeight,
          width: surfaceWidth,
        }),
      };
    });
  };

  const handleSelectSession = (tileId: string) => {
    acknowledgeCompletedSession(tileId);
    handleRecenterTile(tileId);
  };

  const handleStartRename = (tileId: string) => {
    const tile = snapshot.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) {
      return;
    }

    setRenamingTileId(tileId);
    setRenameDraft(tile.title);
    handleFocusTile(tileId);
  };

  const handleCommitRename = () => {
    if (!renamingTileId) {
      return;
    }

    const nextTitle = renameDraft.trim();

    onSnapshotChange((current) => ({
      ...current,
      tiles: current.tiles.map((tile) => {
        if (tile.id !== renamingTileId) {
          return tile;
        }

        return {
          ...tile,
          title: nextTitle || tile.title,
        };
      }),
    }));

    setRenamingTileId(undefined);
    setRenameDraft("");
  };

  const handleCancelRename = () => {
    setRenamingTileId(undefined);
    setRenameDraft("");
  };

  const handleZoom = (direction: "in" | "out" | "reset") => {
    onSnapshotChange((current) => {
      if (direction === "reset") {
        return {
          ...current,
          viewport: { ...current.viewport, zoom: 1 },
        };
      }

      const delta = direction === "in" ? 0.1 : -0.1;
      return {
        ...current,
        viewport: {
          ...current.viewport,
          zoom: clampZoom(current.viewport.zoom + delta),
        },
      };
    });
  };

  const handleSaveWorkspaceSettings = () => {
    if (
      normalizedPanSnapHysteresisDraft === undefined ||
      normalizedPanSnapRadiusDraft === undefined ||
      normalizedPanSnapSettleDelayDraft === undefined ||
      normalizedPanSnapSettleStrengthDraft === undefined ||
      normalizedPanSnapStrengthDraft === undefined ||
      normalizedAutoAlignWidthValueDraft === undefined ||
      normalizedAutoAlignHeightValueDraft === undefined ||
      normalizedTerminalActiveMaxFpsDraft === undefined ||
      normalizedTerminalActiveWriteBatchIntervalDraft === undefined ||
      normalizedTerminalVisibleMaxFpsDraft === undefined ||
      normalizedTerminalVisibleWriteBatchIntervalDraft === undefined ||
      normalizedTerminalOffscreenMaxFpsDraft === undefined ||
      normalizedTerminalOffscreenWriteBatchIntervalDraft === undefined
    ) {
      return;
    }

    onAutoAlignSizeChange(
      normalizedAutoAlignWidthValueDraft,
      autoAlignWidthUnitDraft,
      normalizedAutoAlignHeightValueDraft,
      autoAlignHeightUnitDraft,
    );
    onTerminalNavigationChange(terminalNavigationWrapDraft);
    onPanBehaviorChange(
      panModeDraft,
      normalizedPanSnapStrengthDraft,
      normalizedPanSnapRadiusDraft,
      normalizedPanSnapSettleStrengthDraft,
      normalizedPanSnapSettleDelayDraft,
      normalizedPanSnapHysteresisDraft,
    );
    onTerminalPerformanceChange({
      active: {
        maxFps: normalizedTerminalActiveMaxFpsDraft,
        writeBatchIntervalMs: normalizedTerminalActiveWriteBatchIntervalDraft,
      },
      offscreen: {
        maxFps: normalizedTerminalOffscreenMaxFpsDraft,
        writeBatchIntervalMs: normalizedTerminalOffscreenWriteBatchIntervalDraft,
      },
      visible: {
        maxFps: normalizedTerminalVisibleMaxFpsDraft,
        writeBatchIntervalMs: normalizedTerminalVisibleWriteBatchIntervalDraft,
      },
    });
  };

  const handleAutoAlign = () => {
    handleCancelRename();

    onSnapshotChange((current) => {
      if (current.tiles.length === 0) {
        return current;
      }

      const surface = getSurfaceSize(surfaceRef.current) ?? { height: 800, width: 1200 };
      const anchoredTileId =
        getMostVisibleTileId(current.tiles, current.viewport, surface) ?? current.focusedTileId;
      const surfaceWidth = surface.width;
      const worldWidth = surfaceWidth / current.viewport.zoom;
      const tileSize = getAutoAlignTileSize(settings, current.viewport.zoom);
      const alignedTiles = getAutoAlignedTiles(current.tiles, worldWidth, tileSize);
      const anchoredTile =
        alignedTiles.find((tile) => tile.id === anchoredTileId) ?? alignedTiles[0];
      const orderedTiles = anchoredTile
        ? bringTileToFront(alignedTiles, anchoredTile.id)
        : alignedTiles;

      return {
        ...current,
        focusedTileId: anchoredTile?.id ?? current.focusedTileId,
        tiles: orderedTiles,
        viewport: anchoredTile
          ? getViewportCenteredOnTile(current.viewport, anchoredTile, surface)
          : current.viewport,
      };
    });
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-canvas-tile='true']")) {
      return;
    }

    clearPanSettleTimer();
    stickyTargetTileIdRef.current = undefined;
    setInteraction({
      kind: "pan",
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startViewport: snapshot.viewport,
    });
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-canvas-tile='true']")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;

    onSnapshotChange((current) => {
      const worldX = (pointerX - current.viewport.x) / current.viewport.zoom;
      const worldY = (pointerY - current.viewport.y) / current.viewport.zoom;
      const tileSize = getAutoAlignTileSize(settings, current.viewport.zoom);
      const tile = createTerminalTileAtPosition(
        current.nextTileIndex,
        getNearestOpenTilePositionAroundPoint(
          current.tiles,
          {
            x: worldX,
            y: worldY,
          },
          tileSize,
        ),
        tileSize,
      );

      return {
        ...current,
        focusedTileId: tile.id,
        nextTileIndex: current.nextTileIndex + 1,
        tiles: [...current.tiles, tile],
      };
    });
  };

  useEffect(() => {
    if (!canvasElement) {
      return;
    }

    const handleCanvasWheel = (event: WheelEvent) => {
      const isTerminalSurface = isEventWithinSelector(event, TERMINAL_SURFACE_SELECTOR);

      if (isTerminalSurface && event.altKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      const bounds = surface.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;

      if (event.ctrlKey) {
        clearPanSettleTimer();
        stickyTargetTileIdRef.current = undefined;
        const normalizedDeltaY = getNormalizedWheelDelta(event.deltaY, event.deltaMode);

        onSnapshotChange((current) => {
          const nextZoom = clampZoom(
            current.viewport.zoom * Math.exp(-normalizedDeltaY * PINCH_ZOOM_SENSITIVITY),
          );

          if (nextZoom === current.viewport.zoom) {
            return current;
          }

          const worldX = (pointerX - current.viewport.x) / current.viewport.zoom;
          const worldY = (pointerY - current.viewport.y) / current.viewport.zoom;

          return {
            ...current,
            viewport: {
              x: pointerX - worldX * nextZoom,
              y: pointerY - worldY * nextZoom,
              zoom: nextZoom,
            },
          };
        });
        return;
      }

      onSnapshotChange((current) => {
        const nextViewport = {
          ...current.viewport,
          x: current.viewport.x - event.deltaX,
          y: current.viewport.y - event.deltaY,
        };
        const result = getStickyViewportResult(
          nextViewport,
          current.tiles,
          getSurfaceSize(surface),
          settings,
          stickyTargetTileIdRef.current,
        );

        stickyTargetTileIdRef.current = result.targetTileId;

        return {
          ...current,
          viewport: result.viewport,
        };
      });
      schedulePanSettle();
    };

    canvasElement.addEventListener("wheel", handleCanvasWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      canvasElement.removeEventListener("wheel", handleCanvasWheel, true);
    };
  }, [canvasElement, onSnapshotChange, settings]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>, tileId: string) => {
    event.preventDefault();
    const tile = snapshot.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) {
      return;
    }

    setInteraction({
      kind: "drag",
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: tile.x,
      startY: tile.y,
      tileId,
    });
    handleFocusTile(tileId);
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>, tileId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const tile = snapshot.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) {
      return;
    }

    setInteraction({
      kind: "resize",
      pointerId: event.pointerId,
      startHeight: tile.height,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startWidth: tile.width,
      tileId,
    });
    handleFocusTile(tileId);
  };

  const handleResizeReset = (event: ReactMouseEvent<HTMLButtonElement>, tileId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setInteraction(undefined);

    onSnapshotChange((current) => {
      const resizedTiles = current.tiles.map((tile) => {
        if (tile.id !== tileId) {
          return tile;
        }

        return {
          ...tile,
          height: TILE_HEIGHT,
          width: TILE_WIDTH,
        };
      });

      return {
        ...current,
        focusedTileId: tileId,
        tiles: bringTileToFront(resizedTiles, tileId),
      };
    });
  };

  const compactSessionMapLayout = getCompactSessionMapLayout(snapshot.tiles);
  const compactSessionMapViewportIndicator = getCompactSessionMapViewportIndicator(
    compactSessionMapLayout,
    snapshot.tiles,
    snapshot.viewport,
    getSurfaceSize(surfaceRef.current),
  );
  const terminalSurfaceSize = getSurfaceSize(surfaceRef.current);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_24%),linear-gradient(180deg,_rgba(255,251,235,0.94),_rgba(245,245,244,0.88))] text-foreground dark:bg-[linear-gradient(180deg,_rgba(12,16,22,0.98),_rgba(9,12,16,1))]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)]" />
      {isCompactSidebar ? (
        <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {!isSidebarOpen ? (
              <WorkspaceQuickActions
                autoAlignHeightUnitDraft={autoAlignHeightUnitDraft}
                autoAlignHeightValueDraft={autoAlignHeightValueDraft}
                autoAlignWidthUnitDraft={autoAlignWidthUnitDraft}
                autoAlignWidthValueDraft={autoAlignWidthValueDraft}
                compact
                isSettingsOpen={isSettingsOpen}
                isSettingsSaveDisabled={isSettingsSaveDisabled}
                onAddTile={handleAddTile}
                onAutoAlign={handleAutoAlign}
                onAutoAlignHeightUnitDraftChange={setAutoAlignHeightUnitDraft}
                onAutoAlignHeightValueDraftChange={setAutoAlignHeightValueDraft}
                onAutoAlignWidthUnitDraftChange={setAutoAlignWidthUnitDraft}
                onAutoAlignWidthValueDraftChange={setAutoAlignWidthValueDraft}
                onTerminalNavigationWrapDraftChange={setTerminalNavigationWrapDraft}
                onPanModeDraftChange={setPanModeDraft}
                onPanSnapHysteresisDraftChange={setPanSnapHysteresisDraft}
                onPanSnapRadiusDraftChange={setPanSnapRadiusDraft}
                onPanSnapSettleDelayDraftChange={setPanSnapSettleDelayDraft}
                onPanSnapSettleStrengthDraftChange={setPanSnapSettleStrengthDraft}
                onPanSnapStrengthDraftChange={setPanSnapStrengthDraft}
                onTerminalActiveMaxFpsDraftChange={setTerminalActiveMaxFpsDraft}
                onTerminalActiveWriteBatchIntervalDraftChange={
                  setTerminalActiveWriteBatchIntervalDraft
                }
                onTerminalVisibleMaxFpsDraftChange={setTerminalVisibleMaxFpsDraft}
                onTerminalVisibleWriteBatchIntervalDraftChange={
                  setTerminalVisibleWriteBatchIntervalDraft
                }
                onTerminalOffscreenMaxFpsDraftChange={setTerminalOffscreenMaxFpsDraft}
                onTerminalOffscreenWriteBatchIntervalDraftChange={
                  setTerminalOffscreenWriteBatchIntervalDraft
                }
                onSaveSettings={handleSaveWorkspaceSettings}
                onSettingsOpenChange={setIsSettingsOpen}
                onThemeModeChange={onThemeModeChange}
                onZoom={handleZoom}
                panModeDraft={panModeDraft}
                panSnapHysteresisDraft={panSnapHysteresisDraft}
                panSnapRadiusDraft={panSnapRadiusDraft}
                panSnapSettleDelayDraft={panSnapSettleDelayDraft}
                panSnapSettleStrengthDraft={panSnapSettleStrengthDraft}
                panSnapStrengthDraft={panSnapStrengthDraft}
                settings={settings}
                snapshot={snapshot}
                terminalNavigationWrapDraft={terminalNavigationWrapDraft}
                terminalActiveMaxFpsDraft={terminalActiveMaxFpsDraft}
                terminalActiveWriteBatchIntervalDraft={terminalActiveWriteBatchIntervalDraft}
                terminalVisibleMaxFpsDraft={terminalVisibleMaxFpsDraft}
                terminalVisibleWriteBatchIntervalDraft={terminalVisibleWriteBatchIntervalDraft}
                terminalOffscreenMaxFpsDraft={terminalOffscreenMaxFpsDraft}
                terminalOffscreenWriteBatchIntervalDraft={terminalOffscreenWriteBatchIntervalDraft}
              />
            ) : null}
            <Button
              aria-controls="canvas-sidebar"
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((current) => !current)}
              size="icon-sm"
              variant="outline"
            >
              {isSidebarOpen ? <XIcon /> : <MenuIcon />}
              <span className="sr-only">{isSidebarOpen ? "Hide sidebar" : "Show sidebar"}</span>
            </Button>
          </div>
          {!isSidebarOpen && snapshot.tiles.length > 0 ? (
            <div
              className="relative w-32 overflow-hidden rounded-2xl border border-border/60 bg-background/82 shadow-lg backdrop-blur-xl"
              style={{
                height: compactSessionMapLayout.heightRem
                  ? `${compactSessionMapLayout.heightRem}rem`
                  : undefined,
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:18px_18px] dark:bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)]" />
              {compactSessionMapViewportIndicator ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-[1.05rem] border border-sky-400/80 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_8px_20px_rgba(14,165,233,0.12)] backdrop-blur-[1px] dark:border-sky-300/75 dark:bg-sky-300/10"
                  style={{
                    height: `${compactSessionMapViewportIndicator.heightPercent}%`,
                    left: `${compactSessionMapViewportIndicator.leftPercent}%`,
                    top: `${compactSessionMapViewportIndicator.topPercent}%`,
                    width: `${compactSessionMapViewportIndicator.widthPercent}%`,
                  }}
                />
              ) : null}
              {snapshot.tiles.map((tile) => {
                const isFocusedTile = tile.id === snapshot.focusedTileId;
                const activityIndicator = getDisplayedSessionActivityIndicator(tile.id);
                const layoutItem = compactSessionMapLayout.items.find(
                  (item) => item.tileId === tile.id,
                );

                if (!layoutItem) {
                  return null;
                }

                return (
                  <Tooltip key={tile.id}>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-current={isFocusedTile ? "true" : undefined}
                          aria-label={`Jump to ${tile.title}`}
                          className={cn(
                            "absolute border shadow-sm transition-[background-color,border-color,box-shadow,color,transform] duration-150",
                            isFocusedTile
                              ? "z-10 border-sky-400/90 bg-background/90 text-foreground shadow-[0_0_0_2px_rgba(14,165,233,0.95)] dark:border-sky-300/90 dark:bg-[#161b21] dark:text-white"
                              : "border-border/70 bg-background/65 text-foreground/75 hover:border-border hover:bg-background/90 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/12",
                          )}
                          onClick={() => handleSelectSession(tile.id)}
                          size="icon-sm"
                          style={{
                            left: `${layoutItem.leftPercent}%`,
                            top: `${layoutItem.topPercent}%`,
                            transform: `translate(-50%, -50%) scale(${isFocusedTile ? 1.1 : 1})`,
                          }}
                          variant="ghost"
                        />
                      }
                    >
                      <SessionActivityIcon
                        className={
                          isFocusedTile ? "drop-shadow-[0_1px_2px_rgba(15,23,42,0.28)]" : undefined
                        }
                        indicator={activityIndicator}
                      />
                      <span className="sr-only">{tile.title}</span>
                    </TooltipTrigger>
                    <TooltipContent
                      className="pointer-events-none select-none"
                      side="left"
                      sideOffset={8}
                    >
                      {tile.title}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1">
        <section className="relative min-h-0 flex-1" ref={surfaceRef}>
          {!isHydrated ? (
            <LoadingSurface />
          ) : snapshot.tiles.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <Empty className="max-w-xl rounded-[2rem] border border-stone-300/80 bg-background/88 shadow-lg dark:border-white/10 dark:bg-background/92">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TerminalSquareIcon />
                  </EmptyMedia>
                  <EmptyTitle>No terminals yet</EmptyTitle>
                  <EmptyDescription>
                    Create a live shell tile to validate terminal sessions alongside drag, resize,
                    pan, zoom, and reopen.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <ToolbarButton
                    label="Create first tile"
                    onClick={handleAddTile}
                    tooltip="Create the first live terminal tile"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Create first tile
                  </ToolbarButton>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <div
              ref={setCanvasElement}
              className="relative h-full overflow-hidden"
              onDoubleClick={handleCanvasDoubleClick}
              onPointerDown={handleCanvasPointerDown}
              style={{
                cursor: interaction?.kind === "pan" ? "grabbing" : "grab",
                touchAction: "none",
              }}
            >
              <div
                className="absolute left-0 top-0 h-full min-w-full origin-top-left"
                style={{
                  transform: `translate(${snapshot.viewport.x}px, ${snapshot.viewport.y}px) scale(${snapshot.viewport.zoom})`,
                }}
              >
                {snapshot.tiles.map((tile) => (
                  <TerminalTile
                    assetUris={assetUris}
                    isFocused={snapshot.focusedTileId === tile.id}
                    isRenaming={renamingTileId === tile.id}
                    key={tile.id}
                    onClose={handleCloseTile}
                    onRestart={onRestartTerminal}
                    onRenameCancel={handleCancelRename}
                    onRenameCommit={handleCommitRename}
                    onRenameStart={handleStartRename}
                    onRenameValueChange={setRenameDraft}
                    onDragStart={handleDragStart}
                    onFocus={handleFocusTile}
                    onResizeReset={handleResizeReset}
                    onResizeStart={handleResizeStart}
                    onZoomToTile={handleZoomToTile}
                    renameValue={renamingTileId === tile.id ? renameDraft : tile.title}
                    renderPerformance={getTerminalPerformanceProfile(
                      settings.terminalPerformance,
                      getTerminalRenderPriority(
                        tile,
                        snapshot.focusedTileId,
                        snapshot.viewport,
                        terminalSurfaceSize ?? null,
                      ),
                    )}
                    session={terminalSessions[tile.id]}
                    settings={settings}
                    tile={tile}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
        {isCompactSidebar ? null : (
          <WorkspaceSidebar
            autoAlignHeightUnitDraft={autoAlignHeightUnitDraft}
            autoAlignHeightValueDraft={autoAlignHeightValueDraft}
            autoAlignWidthUnitDraft={autoAlignWidthUnitDraft}
            autoAlignWidthValueDraft={autoAlignWidthValueDraft}
            isSettingsOpen={isSettingsOpen}
            isSettingsSaveDisabled={isSettingsSaveDisabled}
            onAddTile={handleAddTile}
            onAutoAlign={handleAutoAlign}
            onAutoAlignHeightUnitDraftChange={setAutoAlignHeightUnitDraft}
            onAutoAlignHeightValueDraftChange={setAutoAlignHeightValueDraft}
            onAutoAlignWidthUnitDraftChange={setAutoAlignWidthUnitDraft}
            onAutoAlignWidthValueDraftChange={setAutoAlignWidthValueDraft}
            onTerminalNavigationWrapDraftChange={setTerminalNavigationWrapDraft}
            onCancelRename={handleCancelRename}
            onCommitRename={handleCommitRename}
            onPanModeDraftChange={setPanModeDraft}
            onPanSnapHysteresisDraftChange={setPanSnapHysteresisDraft}
            onPanSnapRadiusDraftChange={setPanSnapRadiusDraft}
            onPanSnapSettleDelayDraftChange={setPanSnapSettleDelayDraft}
            onPanSnapSettleStrengthDraftChange={setPanSnapSettleStrengthDraft}
            onPanSnapStrengthDraftChange={setPanSnapStrengthDraft}
            onTerminalActiveMaxFpsDraftChange={setTerminalActiveMaxFpsDraft}
            onTerminalActiveWriteBatchIntervalDraftChange={setTerminalActiveWriteBatchIntervalDraft}
            onTerminalVisibleMaxFpsDraftChange={setTerminalVisibleMaxFpsDraft}
            onTerminalVisibleWriteBatchIntervalDraftChange={
              setTerminalVisibleWriteBatchIntervalDraft
            }
            onTerminalOffscreenMaxFpsDraftChange={setTerminalOffscreenMaxFpsDraft}
            onTerminalOffscreenWriteBatchIntervalDraftChange={
              setTerminalOffscreenWriteBatchIntervalDraft
            }
            getDisplayedSessionActivityIndicator={getDisplayedSessionActivityIndicator}
            onSelectSession={handleSelectSession}
            onRenameValueChange={setRenameDraft}
            onSaveSettings={handleSaveWorkspaceSettings}
            onSettingsOpenChange={setIsSettingsOpen}
            onStartRename={handleStartRename}
            onThemeModeChange={onThemeModeChange}
            onZoom={handleZoom}
            panModeDraft={panModeDraft}
            panSnapHysteresisDraft={panSnapHysteresisDraft}
            panSnapRadiusDraft={panSnapRadiusDraft}
            panSnapSettleDelayDraft={panSnapSettleDelayDraft}
            panSnapSettleStrengthDraft={panSnapSettleStrengthDraft}
            panSnapStrengthDraft={panSnapStrengthDraft}
            renameValue={renameDraft}
            renamingTileId={renamingTileId}
            settings={settings}
            sidebarClassName="flex w-64 shrink-0 flex-col border-l border-sidebar-border/70 bg-sidebar/92 px-2.5 pb-2.5 pt-0 text-sidebar-foreground backdrop-blur-xl"
            sidebarRef={sidebarRef}
            snapshot={snapshot}
            terminalNavigationWrapDraft={terminalNavigationWrapDraft}
            terminalActiveMaxFpsDraft={terminalActiveMaxFpsDraft}
            terminalActiveWriteBatchIntervalDraft={terminalActiveWriteBatchIntervalDraft}
            terminalVisibleMaxFpsDraft={terminalVisibleMaxFpsDraft}
            terminalVisibleWriteBatchIntervalDraft={terminalVisibleWriteBatchIntervalDraft}
            terminalOffscreenMaxFpsDraft={terminalOffscreenMaxFpsDraft}
            terminalOffscreenWriteBatchIntervalDraft={terminalOffscreenWriteBatchIntervalDraft}
          />
        )}
      </div>
      {isCompactSidebar && isSidebarOpen ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 bg-stone-950/12 backdrop-blur-[2px]"
            onPointerDown={() => setIsSidebarOpen(false)}
          />
          <WorkspaceSidebar
            autoAlignHeightUnitDraft={autoAlignHeightUnitDraft}
            autoAlignHeightValueDraft={autoAlignHeightValueDraft}
            autoAlignWidthUnitDraft={autoAlignWidthUnitDraft}
            autoAlignWidthValueDraft={autoAlignWidthValueDraft}
            isSettingsOpen={isSettingsOpen}
            isSettingsSaveDisabled={isSettingsSaveDisabled}
            onAddTile={handleAddTile}
            onAutoAlign={handleAutoAlign}
            onAutoAlignHeightUnitDraftChange={setAutoAlignHeightUnitDraft}
            onAutoAlignHeightValueDraftChange={setAutoAlignHeightValueDraft}
            onAutoAlignWidthUnitDraftChange={setAutoAlignWidthUnitDraft}
            onAutoAlignWidthValueDraftChange={setAutoAlignWidthValueDraft}
            onTerminalNavigationWrapDraftChange={setTerminalNavigationWrapDraft}
            onCancelRename={handleCancelRename}
            onCommitRename={handleCommitRename}
            onPanModeDraftChange={setPanModeDraft}
            onPanSnapHysteresisDraftChange={setPanSnapHysteresisDraft}
            onPanSnapRadiusDraftChange={setPanSnapRadiusDraft}
            onPanSnapSettleDelayDraftChange={setPanSnapSettleDelayDraft}
            onPanSnapSettleStrengthDraftChange={setPanSnapSettleStrengthDraft}
            onPanSnapStrengthDraftChange={setPanSnapStrengthDraft}
            onTerminalActiveMaxFpsDraftChange={setTerminalActiveMaxFpsDraft}
            onTerminalActiveWriteBatchIntervalDraftChange={setTerminalActiveWriteBatchIntervalDraft}
            onTerminalVisibleMaxFpsDraftChange={setTerminalVisibleMaxFpsDraft}
            onTerminalVisibleWriteBatchIntervalDraftChange={
              setTerminalVisibleWriteBatchIntervalDraft
            }
            onTerminalOffscreenMaxFpsDraftChange={setTerminalOffscreenMaxFpsDraft}
            onTerminalOffscreenWriteBatchIntervalDraftChange={
              setTerminalOffscreenWriteBatchIntervalDraft
            }
            getDisplayedSessionActivityIndicator={getDisplayedSessionActivityIndicator}
            onSelectSession={handleSelectSession}
            onRenameValueChange={setRenameDraft}
            onSaveSettings={handleSaveWorkspaceSettings}
            onSettingsOpenChange={setIsSettingsOpen}
            onStartRename={handleStartRename}
            onThemeModeChange={onThemeModeChange}
            onZoom={handleZoom}
            panModeDraft={panModeDraft}
            panSnapHysteresisDraft={panSnapHysteresisDraft}
            panSnapRadiusDraft={panSnapRadiusDraft}
            panSnapSettleDelayDraft={panSnapSettleDelayDraft}
            panSnapSettleStrengthDraft={panSnapSettleStrengthDraft}
            panSnapStrengthDraft={panSnapStrengthDraft}
            renameValue={renameDraft}
            renamingTileId={renamingTileId}
            settings={settings}
            sidebarClassName="absolute right-3 top-14 bottom-3 z-30 flex w-[min(19.2rem,calc(100vw-1.5rem))] max-w-[19.2rem] flex-col overflow-hidden rounded-[1.75rem] border border-sidebar-border/70 bg-sidebar/95 px-2.5 pb-2.5 pt-2.5 text-sidebar-foreground shadow-2xl backdrop-blur-2xl"
            sidebarRef={sidebarRef}
            snapshot={snapshot}
            terminalNavigationWrapDraft={terminalNavigationWrapDraft}
            terminalActiveMaxFpsDraft={terminalActiveMaxFpsDraft}
            terminalActiveWriteBatchIntervalDraft={terminalActiveWriteBatchIntervalDraft}
            terminalVisibleMaxFpsDraft={terminalVisibleMaxFpsDraft}
            terminalVisibleWriteBatchIntervalDraft={terminalVisibleWriteBatchIntervalDraft}
            terminalOffscreenMaxFpsDraft={terminalOffscreenMaxFpsDraft}
            terminalOffscreenWriteBatchIntervalDraft={terminalOffscreenWriteBatchIntervalDraft}
          />
        </>
      ) : null}
    </main>
  );
};

type WorkspaceSidebarProps = {
  autoAlignHeightUnitDraft: CanvasAutoAlignHeightUnit;
  autoAlignHeightValueDraft: string;
  autoAlignWidthUnitDraft: CanvasAutoAlignWidthUnit;
  autoAlignWidthValueDraft: string;
  terminalNavigationWrapDraft: boolean;
  isSettingsOpen: boolean;
  isSettingsSaveDisabled: boolean;
  onAddTile: () => void;
  onAutoAlign: () => void;
  onAutoAlignHeightUnitDraftChange: (value: CanvasAutoAlignHeightUnit) => void;
  onAutoAlignHeightValueDraftChange: (value: string) => void;
  onAutoAlignWidthUnitDraftChange: (value: CanvasAutoAlignWidthUnit) => void;
  onAutoAlignWidthValueDraftChange: (value: string) => void;
  onTerminalNavigationWrapDraftChange: (value: boolean) => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onPanModeDraftChange: (value: CanvasPanMode) => void;
  onPanSnapHysteresisDraftChange: (value: string) => void;
  onPanSnapRadiusDraftChange: (value: string) => void;
  onPanSnapSettleDelayDraftChange: (value: string) => void;
  onPanSnapSettleStrengthDraftChange: (value: string) => void;
  onPanSnapStrengthDraftChange: (value: string) => void;
  onTerminalActiveMaxFpsDraftChange: (value: string) => void;
  onTerminalActiveWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalVisibleMaxFpsDraftChange: (value: string) => void;
  onTerminalVisibleWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalOffscreenMaxFpsDraftChange: (value: string) => void;
  onTerminalOffscreenWriteBatchIntervalDraftChange: (value: string) => void;
  getDisplayedSessionActivityIndicator: (tileId: string) => SessionActivityIndicator | "paused";
  onSelectSession: (tileId: string) => void;
  onRenameValueChange: (value: string) => void;
  onSaveSettings: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onStartRename: (tileId: string) => void;
  onThemeModeChange: (themeMode: CanvasThemeMode) => void;
  onZoom: (direction: "in" | "out" | "reset") => void;
  panModeDraft: CanvasPanMode;
  panSnapHysteresisDraft: string;
  panSnapRadiusDraft: string;
  panSnapSettleDelayDraft: string;
  panSnapSettleStrengthDraft: string;
  panSnapStrengthDraft: string;
  renameValue: string;
  renamingTileId?: string;
  settings: CanvasUiSettings;
  sidebarClassName: string;
  sidebarRef: React.RefObject<HTMLDivElement | null>;
  snapshot: CanvasWorkspaceSnapshot;
  terminalActiveMaxFpsDraft: string;
  terminalActiveWriteBatchIntervalDraft: string;
  terminalVisibleMaxFpsDraft: string;
  terminalVisibleWriteBatchIntervalDraft: string;
  terminalOffscreenMaxFpsDraft: string;
  terminalOffscreenWriteBatchIntervalDraft: string;
};

function WorkspaceSidebar({
  autoAlignHeightUnitDraft,
  autoAlignHeightValueDraft,
  autoAlignWidthUnitDraft,
  autoAlignWidthValueDraft,
  terminalNavigationWrapDraft,
  isSettingsOpen,
  isSettingsSaveDisabled,
  onAddTile,
  onAutoAlign,
  onAutoAlignHeightUnitDraftChange,
  onAutoAlignHeightValueDraftChange,
  onAutoAlignWidthUnitDraftChange,
  onAutoAlignWidthValueDraftChange,
  onTerminalNavigationWrapDraftChange,
  onCancelRename,
  onCommitRename,
  onPanModeDraftChange,
  onPanSnapHysteresisDraftChange,
  onPanSnapRadiusDraftChange,
  onPanSnapSettleDelayDraftChange,
  onPanSnapSettleStrengthDraftChange,
  onPanSnapStrengthDraftChange,
  onTerminalActiveMaxFpsDraftChange,
  onTerminalActiveWriteBatchIntervalDraftChange,
  onTerminalVisibleMaxFpsDraftChange,
  onTerminalVisibleWriteBatchIntervalDraftChange,
  onTerminalOffscreenMaxFpsDraftChange,
  onTerminalOffscreenWriteBatchIntervalDraftChange,
  getDisplayedSessionActivityIndicator,
  onSelectSession,
  onRenameValueChange,
  onSaveSettings,
  onSettingsOpenChange,
  onStartRename,
  onThemeModeChange,
  onZoom,
  panModeDraft,
  panSnapHysteresisDraft,
  panSnapRadiusDraft,
  panSnapSettleDelayDraft,
  panSnapSettleStrengthDraft,
  panSnapStrengthDraft,
  renameValue,
  renamingTileId,
  settings,
  sidebarClassName,
  sidebarRef,
  snapshot,
  terminalActiveMaxFpsDraft,
  terminalActiveWriteBatchIntervalDraft,
  terminalVisibleMaxFpsDraft,
  terminalVisibleWriteBatchIntervalDraft,
  terminalOffscreenMaxFpsDraft,
  terminalOffscreenWriteBatchIntervalDraft,
}: WorkspaceSidebarProps) {
  return (
    <aside className={sidebarClassName} id="canvas-sidebar" ref={sidebarRef}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Card className="border border-sidebar-border/70 bg-background/70 py-3 shadow-sm" size="sm">
          <CardContent className="flex flex-col gap-3 pt-0">
            <WorkspaceQuickActions
              autoAlignHeightUnitDraft={autoAlignHeightUnitDraft}
              autoAlignHeightValueDraft={autoAlignHeightValueDraft}
              autoAlignWidthUnitDraft={autoAlignWidthUnitDraft}
              autoAlignWidthValueDraft={autoAlignWidthValueDraft}
              terminalNavigationWrapDraft={terminalNavigationWrapDraft}
              isSettingsOpen={isSettingsOpen}
              isSettingsSaveDisabled={isSettingsSaveDisabled}
              onAddTile={onAddTile}
              onAutoAlign={onAutoAlign}
              onAutoAlignHeightUnitDraftChange={onAutoAlignHeightUnitDraftChange}
              onAutoAlignHeightValueDraftChange={onAutoAlignHeightValueDraftChange}
              onAutoAlignWidthUnitDraftChange={onAutoAlignWidthUnitDraftChange}
              onAutoAlignWidthValueDraftChange={onAutoAlignWidthValueDraftChange}
              onTerminalNavigationWrapDraftChange={onTerminalNavigationWrapDraftChange}
              onPanModeDraftChange={onPanModeDraftChange}
              onPanSnapHysteresisDraftChange={onPanSnapHysteresisDraftChange}
              onPanSnapRadiusDraftChange={onPanSnapRadiusDraftChange}
              onPanSnapSettleDelayDraftChange={onPanSnapSettleDelayDraftChange}
              onPanSnapSettleStrengthDraftChange={onPanSnapSettleStrengthDraftChange}
              onPanSnapStrengthDraftChange={onPanSnapStrengthDraftChange}
              onTerminalActiveMaxFpsDraftChange={onTerminalActiveMaxFpsDraftChange}
              onTerminalActiveWriteBatchIntervalDraftChange={
                onTerminalActiveWriteBatchIntervalDraftChange
              }
              onTerminalVisibleMaxFpsDraftChange={onTerminalVisibleMaxFpsDraftChange}
              onTerminalVisibleWriteBatchIntervalDraftChange={
                onTerminalVisibleWriteBatchIntervalDraftChange
              }
              onTerminalOffscreenMaxFpsDraftChange={onTerminalOffscreenMaxFpsDraftChange}
              onTerminalOffscreenWriteBatchIntervalDraftChange={
                onTerminalOffscreenWriteBatchIntervalDraftChange
              }
              onSaveSettings={onSaveSettings}
              onSettingsOpenChange={onSettingsOpenChange}
              onThemeModeChange={onThemeModeChange}
              onZoom={onZoom}
              panModeDraft={panModeDraft}
              panSnapHysteresisDraft={panSnapHysteresisDraft}
              panSnapRadiusDraft={panSnapRadiusDraft}
              panSnapSettleDelayDraft={panSnapSettleDelayDraft}
              panSnapSettleStrengthDraft={panSnapSettleStrengthDraft}
              panSnapStrengthDraft={panSnapStrengthDraft}
              settings={settings}
              snapshot={snapshot}
              terminalActiveMaxFpsDraft={terminalActiveMaxFpsDraft}
              terminalActiveWriteBatchIntervalDraft={terminalActiveWriteBatchIntervalDraft}
              terminalVisibleMaxFpsDraft={terminalVisibleMaxFpsDraft}
              terminalVisibleWriteBatchIntervalDraft={terminalVisibleWriteBatchIntervalDraft}
              terminalOffscreenMaxFpsDraft={terminalOffscreenMaxFpsDraft}
              terminalOffscreenWriteBatchIntervalDraft={terminalOffscreenWriteBatchIntervalDraft}
              tooltipContainer={sidebarRef.current}
              tooltipSide="left"
            />
          </CardContent>
        </Card>

        <Card className="min-h-0 flex-1 border border-sidebar-border/70 bg-background/70 shadow-sm">
          <CardHeader className="border-b border-border/60">
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 pt-1">
            {snapshot.tiles.length === 0 ? (
              <Empty className="h-full border border-dashed border-border/70 bg-muted/25 p-5">
                <EmptyHeader className="max-w-none">
                  <EmptyMedia variant="icon">
                    <TerminalSquareIcon />
                  </EmptyMedia>
                  <EmptyTitle>No tiles to inspect</EmptyTitle>
                  <EmptyDescription>
                    Create a terminal tile and it will appear here for quick recentering.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="h-full min-h-0">
                <div className="flex flex-col gap-2 pr-3">
                  {snapshot.tiles.map((tile) => {
                    const isFocusedTile = tile.id === snapshot.focusedTileId;
                    const isRenamingTile = tile.id === renamingTileId;
                    const activityIndicator = getDisplayedSessionActivityIndicator(tile.id);

                    return (
                      <div
                        className={cn(
                          "flex w-full flex-col gap-2 rounded-xl border px-3 py-3 text-left transition",
                          isFocusedTile
                            ? "border-primary/30 bg-accent text-accent-foreground shadow-sm"
                            : "border-border/70 bg-muted/25 hover:bg-muted/50",
                        )}
                        key={tile.id}
                      >
                        {isRenamingTile ? (
                          <Input
                            aria-label={`Rename ${tile.title}`}
                            autoFocus
                            className="h-auto border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0"
                            onBlur={onCommitRename}
                            onChange={(event) => onRenameValueChange(event.target.value)}
                            onFocus={(event) => {
                              event.currentTarget.select();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                onCommitRename();
                              }

                              if (event.key === "Escape") {
                                onCancelRename();
                              }
                            }}
                            value={renameValue}
                          />
                        ) : (
                          <button
                            className="flex w-full flex-col gap-2 text-left"
                            onClick={(event) => {
                              if (event.detail === 2) {
                                onStartRename(tile.id);
                                return;
                              }

                              onSelectSession(tile.id);
                            }}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <SessionActivityIcon
                                  className="shrink-0 text-muted-foreground"
                                  indicator={activityIndicator}
                                />
                                <span className="truncate text-sm font-medium">{tile.title}</span>
                              </div>
                              <Badge variant={isFocusedTile ? "secondary" : "outline"}>
                                {isFocusedTile ? "Focused" : "Tile"}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span>
                                {Math.round(tile.width)} × {Math.round(tile.height)}
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

type WorkspaceQuickActionsProps = {
  autoAlignHeightUnitDraft: CanvasAutoAlignHeightUnit;
  autoAlignHeightValueDraft: string;
  autoAlignWidthUnitDraft: CanvasAutoAlignWidthUnit;
  autoAlignWidthValueDraft: string;
  terminalNavigationWrapDraft: boolean;
  compact?: boolean;
  isSettingsOpen: boolean;
  isSettingsSaveDisabled: boolean;
  onAddTile: () => void;
  onAutoAlign: () => void;
  onAutoAlignHeightUnitDraftChange: (value: CanvasAutoAlignHeightUnit) => void;
  onAutoAlignHeightValueDraftChange: (value: string) => void;
  onAutoAlignWidthUnitDraftChange: (value: CanvasAutoAlignWidthUnit) => void;
  onAutoAlignWidthValueDraftChange: (value: string) => void;
  onTerminalNavigationWrapDraftChange: (value: boolean) => void;
  onPanModeDraftChange: (value: CanvasPanMode) => void;
  onPanSnapHysteresisDraftChange: (value: string) => void;
  onPanSnapRadiusDraftChange: (value: string) => void;
  onPanSnapSettleDelayDraftChange: (value: string) => void;
  onPanSnapSettleStrengthDraftChange: (value: string) => void;
  onPanSnapStrengthDraftChange: (value: string) => void;
  onTerminalActiveMaxFpsDraftChange: (value: string) => void;
  onTerminalActiveWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalVisibleMaxFpsDraftChange: (value: string) => void;
  onTerminalVisibleWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalOffscreenMaxFpsDraftChange: (value: string) => void;
  onTerminalOffscreenWriteBatchIntervalDraftChange: (value: string) => void;
  onSaveSettings: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onThemeModeChange: (themeMode: CanvasThemeMode) => void;
  onZoom: (direction: "in" | "out" | "reset") => void;
  panModeDraft: CanvasPanMode;
  panSnapHysteresisDraft: string;
  panSnapRadiusDraft: string;
  panSnapSettleDelayDraft: string;
  panSnapSettleStrengthDraft: string;
  panSnapStrengthDraft: string;
  settings: CanvasUiSettings;
  snapshot: CanvasWorkspaceSnapshot;
  terminalActiveMaxFpsDraft: string;
  terminalActiveWriteBatchIntervalDraft: string;
  terminalVisibleMaxFpsDraft: string;
  terminalVisibleWriteBatchIntervalDraft: string;
  terminalOffscreenMaxFpsDraft: string;
  terminalOffscreenWriteBatchIntervalDraft: string;
  tooltipContainer?: HTMLDivElement | null;
  tooltipSide?: "bottom" | "inline-end" | "inline-start" | "left" | "right" | "top";
};

function WorkspaceQuickActions({
  autoAlignHeightUnitDraft,
  autoAlignHeightValueDraft,
  autoAlignWidthUnitDraft,
  autoAlignWidthValueDraft,
  terminalNavigationWrapDraft,
  compact = false,
  isSettingsOpen,
  isSettingsSaveDisabled,
  onAddTile,
  onAutoAlign,
  onAutoAlignHeightUnitDraftChange,
  onAutoAlignHeightValueDraftChange,
  onAutoAlignWidthUnitDraftChange,
  onAutoAlignWidthValueDraftChange,
  onTerminalNavigationWrapDraftChange,
  onPanModeDraftChange,
  onPanSnapHysteresisDraftChange,
  onPanSnapRadiusDraftChange,
  onPanSnapSettleDelayDraftChange,
  onPanSnapSettleStrengthDraftChange,
  onPanSnapStrengthDraftChange,
  onTerminalActiveMaxFpsDraftChange,
  onTerminalActiveWriteBatchIntervalDraftChange,
  onTerminalVisibleMaxFpsDraftChange,
  onTerminalVisibleWriteBatchIntervalDraftChange,
  onTerminalOffscreenMaxFpsDraftChange,
  onTerminalOffscreenWriteBatchIntervalDraftChange,
  onSaveSettings,
  onSettingsOpenChange,
  onThemeModeChange,
  onZoom,
  panModeDraft,
  panSnapHysteresisDraft,
  panSnapRadiusDraft,
  panSnapSettleDelayDraft,
  panSnapSettleStrengthDraft,
  panSnapStrengthDraft,
  settings,
  snapshot,
  terminalActiveMaxFpsDraft,
  terminalActiveWriteBatchIntervalDraft,
  terminalVisibleMaxFpsDraft,
  terminalVisibleWriteBatchIntervalDraft,
  terminalOffscreenMaxFpsDraft,
  terminalOffscreenWriteBatchIntervalDraft,
  tooltipContainer,
  tooltipSide = "top",
}: WorkspaceQuickActionsProps) {
  const autoAlignDisabled = snapshot.tiles.length === 0;
  const tooltipSideOffset = compact ? 6 : 4;

  return (
    <div className="flex items-center gap-2">
      {compact ? (
        <>
          <ToolbarIconButton
            label="New tile"
            onClick={onAddTile}
            tooltip="Create a new live terminal tile"
            tooltipContainer={tooltipContainer}
            tooltipSide={tooltipSide}
            tooltipSideOffset={tooltipSideOffset}
          >
            <PlusIcon />
          </ToolbarIconButton>
          <ToolbarIconButton
            disabled={autoAlignDisabled}
            label="Auto align"
            onClick={onAutoAlign}
            tooltip="Align and resize all tiles into a clean grid"
            tooltipContainer={tooltipContainer}
            tooltipSide={tooltipSide}
            tooltipSideOffset={tooltipSideOffset}
          >
            <LayoutGridIcon />
          </ToolbarIconButton>
        </>
      ) : (
        <>
          <ToolbarButton
            buttonClassName="flex-1 justify-start"
            label="Create tile"
            lockTooltipSide
            onClick={onAddTile}
            tooltip="Create a new live terminal tile"
            tooltipContainer={tooltipContainer}
            tooltipSide={tooltipSide}
          >
            <PlusIcon data-icon="inline-start" />
            New tile
          </ToolbarButton>
          <ToolbarButton
            buttonClassName="flex-1 justify-start"
            disabled={autoAlignDisabled}
            label="Auto align"
            lockTooltipSide
            onClick={onAutoAlign}
            tooltip="Align and resize all tiles into a clean grid"
            tooltipContainer={tooltipContainer}
            tooltipSide={tooltipSide}
            variant="outline"
          >
            <LayoutGridIcon data-icon="inline-start" />
            Auto align
          </ToolbarButton>
        </>
      )}

      <WorkspaceSettingsDialog
        autoAlignHeightUnitDraft={autoAlignHeightUnitDraft}
        autoAlignHeightValueDraft={autoAlignHeightValueDraft}
        autoAlignWidthUnitDraft={autoAlignWidthUnitDraft}
        autoAlignWidthValueDraft={autoAlignWidthValueDraft}
        terminalNavigationWrapDraft={terminalNavigationWrapDraft}
        compact={compact}
        isOpen={isSettingsOpen}
        isSaveDisabled={isSettingsSaveDisabled}
        onOpenChange={onSettingsOpenChange}
        onAutoAlignHeightUnitDraftChange={onAutoAlignHeightUnitDraftChange}
        onAutoAlignHeightValueDraftChange={onAutoAlignHeightValueDraftChange}
        onAutoAlignWidthUnitDraftChange={onAutoAlignWidthUnitDraftChange}
        onAutoAlignWidthValueDraftChange={onAutoAlignWidthValueDraftChange}
        onTerminalNavigationWrapDraftChange={onTerminalNavigationWrapDraftChange}
        onPanModeDraftChange={onPanModeDraftChange}
        onPanSnapHysteresisDraftChange={onPanSnapHysteresisDraftChange}
        onPanSnapRadiusDraftChange={onPanSnapRadiusDraftChange}
        onPanSnapSettleDelayDraftChange={onPanSnapSettleDelayDraftChange}
        onPanSnapSettleStrengthDraftChange={onPanSnapSettleStrengthDraftChange}
        onPanSnapStrengthDraftChange={onPanSnapStrengthDraftChange}
        onTerminalActiveMaxFpsDraftChange={onTerminalActiveMaxFpsDraftChange}
        onTerminalActiveWriteBatchIntervalDraftChange={
          onTerminalActiveWriteBatchIntervalDraftChange
        }
        onTerminalVisibleMaxFpsDraftChange={onTerminalVisibleMaxFpsDraftChange}
        onTerminalVisibleWriteBatchIntervalDraftChange={
          onTerminalVisibleWriteBatchIntervalDraftChange
        }
        onTerminalOffscreenMaxFpsDraftChange={onTerminalOffscreenMaxFpsDraftChange}
        onTerminalOffscreenWriteBatchIntervalDraftChange={
          onTerminalOffscreenWriteBatchIntervalDraftChange
        }
        onSave={onSaveSettings}
        onThemeModeChange={onThemeModeChange}
        onZoom={onZoom}
        panModeDraft={panModeDraft}
        panSnapHysteresisDraft={panSnapHysteresisDraft}
        panSnapRadiusDraft={panSnapRadiusDraft}
        panSnapSettleDelayDraft={panSnapSettleDelayDraft}
        panSnapSettleStrengthDraft={panSnapSettleStrengthDraft}
        panSnapStrengthDraft={panSnapStrengthDraft}
        settings={settings}
        snapshot={snapshot}
        terminalActiveMaxFpsDraft={terminalActiveMaxFpsDraft}
        terminalActiveWriteBatchIntervalDraft={terminalActiveWriteBatchIntervalDraft}
        terminalVisibleMaxFpsDraft={terminalVisibleMaxFpsDraft}
        terminalVisibleWriteBatchIntervalDraft={terminalVisibleWriteBatchIntervalDraft}
        terminalOffscreenMaxFpsDraft={terminalOffscreenMaxFpsDraft}
        terminalOffscreenWriteBatchIntervalDraft={terminalOffscreenWriteBatchIntervalDraft}
        tooltipContainer={tooltipContainer}
        tooltipSide={tooltipSide}
        tooltipSideOffset={tooltipSideOffset}
      />
    </div>
  );
}

type WorkspaceSettingsDialogProps = {
  autoAlignHeightUnitDraft: CanvasAutoAlignHeightUnit;
  autoAlignHeightValueDraft: string;
  autoAlignWidthUnitDraft: CanvasAutoAlignWidthUnit;
  autoAlignWidthValueDraft: string;
  terminalNavigationWrapDraft: boolean;
  compact?: boolean;
  isOpen: boolean;
  isSaveDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onAutoAlignHeightUnitDraftChange: (value: CanvasAutoAlignHeightUnit) => void;
  onAutoAlignHeightValueDraftChange: (value: string) => void;
  onAutoAlignWidthUnitDraftChange: (value: CanvasAutoAlignWidthUnit) => void;
  onAutoAlignWidthValueDraftChange: (value: string) => void;
  onTerminalNavigationWrapDraftChange: (value: boolean) => void;
  onPanModeDraftChange: (value: CanvasPanMode) => void;
  onPanSnapHysteresisDraftChange: (value: string) => void;
  onPanSnapRadiusDraftChange: (value: string) => void;
  onPanSnapSettleDelayDraftChange: (value: string) => void;
  onPanSnapSettleStrengthDraftChange: (value: string) => void;
  onPanSnapStrengthDraftChange: (value: string) => void;
  onTerminalActiveMaxFpsDraftChange: (value: string) => void;
  onTerminalActiveWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalVisibleMaxFpsDraftChange: (value: string) => void;
  onTerminalVisibleWriteBatchIntervalDraftChange: (value: string) => void;
  onTerminalOffscreenMaxFpsDraftChange: (value: string) => void;
  onTerminalOffscreenWriteBatchIntervalDraftChange: (value: string) => void;
  onSave: () => void;
  onThemeModeChange: (themeMode: CanvasThemeMode) => void;
  onZoom: (direction: "in" | "out" | "reset") => void;
  panModeDraft: CanvasPanMode;
  panSnapHysteresisDraft: string;
  panSnapRadiusDraft: string;
  panSnapSettleDelayDraft: string;
  panSnapSettleStrengthDraft: string;
  panSnapStrengthDraft: string;
  settings: CanvasUiSettings;
  snapshot: CanvasWorkspaceSnapshot;
  terminalActiveMaxFpsDraft: string;
  terminalActiveWriteBatchIntervalDraft: string;
  terminalVisibleMaxFpsDraft: string;
  terminalVisibleWriteBatchIntervalDraft: string;
  terminalOffscreenMaxFpsDraft: string;
  terminalOffscreenWriteBatchIntervalDraft: string;
  tooltipContainer?: HTMLDivElement | null;
  tooltipSide: "bottom" | "inline-end" | "inline-start" | "left" | "right" | "top";
  tooltipSideOffset: number;
};

function WorkspaceSettingsDialog({
  autoAlignHeightUnitDraft,
  autoAlignHeightValueDraft,
  autoAlignWidthUnitDraft,
  autoAlignWidthValueDraft,
  terminalNavigationWrapDraft,
  compact = false,
  isOpen,
  isSaveDisabled,
  onOpenChange,
  onAutoAlignHeightUnitDraftChange,
  onAutoAlignHeightValueDraftChange,
  onAutoAlignWidthUnitDraftChange,
  onAutoAlignWidthValueDraftChange,
  onTerminalNavigationWrapDraftChange,
  onPanModeDraftChange,
  onPanSnapHysteresisDraftChange,
  onPanSnapRadiusDraftChange,
  onPanSnapSettleDelayDraftChange,
  onPanSnapSettleStrengthDraftChange,
  onPanSnapStrengthDraftChange,
  onTerminalActiveMaxFpsDraftChange,
  onTerminalActiveWriteBatchIntervalDraftChange,
  onTerminalVisibleMaxFpsDraftChange,
  onTerminalVisibleWriteBatchIntervalDraftChange,
  onTerminalOffscreenMaxFpsDraftChange,
  onTerminalOffscreenWriteBatchIntervalDraftChange,
  onSave,
  onThemeModeChange,
  onZoom,
  panModeDraft,
  panSnapHysteresisDraft,
  panSnapRadiusDraft,
  panSnapSettleDelayDraft,
  panSnapSettleStrengthDraft,
  panSnapStrengthDraft,
  settings,
  snapshot,
  terminalActiveMaxFpsDraft,
  terminalActiveWriteBatchIntervalDraft,
  terminalVisibleMaxFpsDraft,
  terminalVisibleWriteBatchIntervalDraft,
  terminalOffscreenMaxFpsDraft,
  terminalOffscreenWriteBatchIntervalDraft,
  tooltipContainer,
  tooltipSide,
  tooltipSideOffset,
}: WorkspaceSettingsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<DialogTrigger render={<Button size="icon-sm" variant="outline" />} />}
        >
          <Settings2Icon />
          <span className="sr-only">Open canvas settings</span>
        </TooltipTrigger>
        <TooltipContent
          collisionAvoidance={compact ? undefined : LEFT_LOCKED_TOOLTIP_COLLISION_AVOIDANCE}
          container={tooltipContainer}
          side={tooltipSide}
          sideOffset={compact ? tooltipSideOffset : LEFT_LOCKED_TOOLTIP_SIDE_OFFSET}
        >
          Canvas settings
        </TooltipContent>
      </Tooltip>
      <DialogContent className="flex max-h-[90vh] w-[500px] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-[500px]">
        <div className="flex-1 overflow-y-auto">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Canvas settings</DialogTitle>
            <DialogDescription>
              Appearance changes apply immediately. Default tile size, terminal navigation, and pan
              behavior update when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Move between light and dark workspace chrome.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pt-0">
                <Button
                  className="justify-start"
                  onClick={() => onThemeModeChange("light")}
                  size="sm"
                  type="button"
                  variant={settings.themeMode === "light" ? "default" : "outline"}
                >
                  <SunIcon data-icon="inline-start" />
                  Light
                </Button>
                <Button
                  className="justify-start"
                  onClick={() => onThemeModeChange("dark")}
                  size="sm"
                  type="button"
                  variant={settings.themeMode === "dark" ? "default" : "outline"}
                >
                  <MoonIcon data-icon="inline-start" />
                  Dark
                </Button>
              </CardContent>
            </Card>
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Default tile size</CardTitle>
                <CardDescription>
                  Choose the size used for new tiles and auto-align. Use fixed pixels or
                  viewport-based sizing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Width
                    </p>
                    <Input
                      aria-label="Auto-align tile width"
                      min={1}
                      onChange={(event) => onAutoAlignWidthValueDraftChange(event.target.value)}
                      step={autoAlignWidthUnitDraft === "px" ? 1 : 0.5}
                      type="number"
                      value={autoAlignWidthValueDraft}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 self-end">
                    <Button
                      onClick={() => onAutoAlignWidthUnitDraftChange("px")}
                      size="sm"
                      type="button"
                      variant={autoAlignWidthUnitDraft === "px" ? "secondary" : "outline"}
                    >
                      px
                    </Button>
                    <Button
                      onClick={() => onAutoAlignWidthUnitDraftChange("vw")}
                      size="sm"
                      type="button"
                      variant={autoAlignWidthUnitDraft === "vw" ? "secondary" : "outline"}
                    >
                      vw
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Height
                    </p>
                    <Input
                      aria-label="Auto-align tile height"
                      min={1}
                      onChange={(event) => onAutoAlignHeightValueDraftChange(event.target.value)}
                      step={autoAlignHeightUnitDraft === "px" ? 1 : 0.5}
                      type="number"
                      value={autoAlignHeightValueDraft}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 self-end">
                    <Button
                      onClick={() => onAutoAlignHeightUnitDraftChange("px")}
                      size="sm"
                      type="button"
                      variant={autoAlignHeightUnitDraft === "px" ? "secondary" : "outline"}
                    >
                      px
                    </Button>
                    <Button
                      onClick={() => onAutoAlignHeightUnitDraftChange("vh")}
                      size="sm"
                      type="button"
                      variant={autoAlignHeightUnitDraft === "vh" ? "secondary" : "outline"}
                    >
                      vh
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Width supports <code>px</code> and <code>vw</code>. Height supports{" "}
                  <code>px</code> and <code>vh</code>.
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Terminal navigation</CardTitle>
                <CardDescription>
                  Use <code>Ctrl+Shift+Arrow</code> or <code>Ctrl+Shift+H/J/K/L</code> to jump to
                  the nearest terminal in that direction. These hotkeys are intercepted by the
                  canvas first so the active terminal does not consume them.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => onTerminalNavigationWrapDraftChange(false)}
                    size="sm"
                    type="button"
                    variant={terminalNavigationWrapDraft ? "outline" : "secondary"}
                  >
                    Stop at edges
                  </Button>
                  <Button
                    onClick={() => onTerminalNavigationWrapDraftChange(true)}
                    size="sm"
                    type="button"
                    variant={terminalNavigationWrapDraft ? "secondary" : "outline"}
                  >
                    Loop around
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  When loop around is enabled, moving past the outer edge wraps to the opposite side
                  of the canvas while staying as close as possible to your current row or column.
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Pan behavior</CardTitle>
                <CardDescription>
                  Choose between fully manual panning and sticky centering that pulls the nearest
                  tile toward the viewport center.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="justify-start"
                    onClick={() => onPanModeDraftChange("free")}
                    size="sm"
                    type="button"
                    variant={panModeDraft === "free" ? "default" : "outline"}
                  >
                    Free
                  </Button>
                  <Button
                    className="justify-start"
                    onClick={() => onPanModeDraftChange("sticky")}
                    size="sm"
                    type="button"
                    variant={panModeDraft === "sticky" ? "default" : "outline"}
                  >
                    Sticky
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Snap strength
                    </p>
                    <Input
                      aria-label="Sticky pan snap strength"
                      max={1}
                      min={0}
                      onChange={(event) => onPanSnapStrengthDraftChange(event.target.value)}
                      step={0.05}
                      type="number"
                      value={panSnapStrengthDraft}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Snap radius
                    </p>
                    <Input
                      aria-label="Sticky pan snap radius"
                      max={1600}
                      min={120}
                      onChange={(event) => onPanSnapRadiusDraftChange(event.target.value)}
                      step={10}
                      type="number"
                      value={panSnapRadiusDraft}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Settle strength
                    </p>
                    <Input
                      aria-label="Sticky pan settle strength"
                      max={1}
                      min={0}
                      onChange={(event) => onPanSnapSettleStrengthDraftChange(event.target.value)}
                      step={0.05}
                      type="number"
                      value={panSnapSettleStrengthDraft}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Settle delay
                    </p>
                    <Input
                      aria-label="Sticky pan settle delay"
                      max={1000}
                      min={0}
                      onChange={(event) => onPanSnapSettleDelayDraftChange(event.target.value)}
                      step={10}
                      type="number"
                      value={panSnapSettleDelayDraft}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Switch resistance
                  </p>
                  <Input
                    aria-label="Sticky pan target switch resistance"
                    max={400}
                    min={0}
                    onChange={(event) => onPanSnapHysteresisDraftChange(event.target.value)}
                    step={5}
                    type="number"
                    value={panSnapHysteresisDraft}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  `Snap strength` controls pull while moving. `Settle strength` controls the final
                  recenter after you stop. `Settle delay` waits before that recenter starts. `Switch
                  resistance` makes sticky mode less eager to jump to a different nearby tile.
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Advanced terminal performance</CardTitle>
                <CardDescription>
                  Tune output batching and render cadence by tile priority. `Max FPS` accepts
                  decimals. Set `0` to remove the FPS cap. Batch interval is in milliseconds.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                <TerminalPerformanceSection
                  fpsValue={terminalActiveMaxFpsDraft}
                  intervalValue={terminalActiveWriteBatchIntervalDraft}
                  onFpsChange={onTerminalActiveMaxFpsDraftChange}
                  onIntervalChange={onTerminalActiveWriteBatchIntervalDraftChange}
                  title="Active tile"
                />
                <TerminalPerformanceSection
                  fpsValue={terminalVisibleMaxFpsDraft}
                  intervalValue={terminalVisibleWriteBatchIntervalDraft}
                  onFpsChange={onTerminalVisibleMaxFpsDraftChange}
                  onIntervalChange={onTerminalVisibleWriteBatchIntervalDraftChange}
                  title="Visible but not active"
                />
                <TerminalPerformanceSection
                  fpsValue={terminalOffscreenMaxFpsDraft}
                  intervalValue={terminalOffscreenWriteBatchIntervalDraft}
                  onFpsChange={onTerminalOffscreenMaxFpsDraftChange}
                  onIntervalChange={onTerminalOffscreenWriteBatchIntervalDraftChange}
                  title="Off-screen"
                />
                <p className="text-xs text-muted-foreground">
                  Use higher FPS and shorter batching for the focused tile, then slow the visible
                  and off-screen tiers to keep noisy CLIs from pushing the GPU too hard.
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/70 bg-muted/35 shadow-none">
              <CardHeader>
                <CardTitle>Canvas zoom</CardTitle>
                <CardDescription>
                  Adjust the workspace view without changing tile size.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Current zoom
                  </p>
                  <p className="text-sm font-medium">{Math.round(snapshot.viewport.zoom * 100)}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <ToolbarIconButton
                    label="Zoom out"
                    lockTooltipSide
                    onClick={() => onZoom("out")}
                    tooltip="Zoom out"
                    tooltipContainer={tooltipContainer}
                    tooltipSide="left"
                  >
                    <MinusIcon />
                  </ToolbarIconButton>
                  <ToolbarButton
                    buttonClassName="min-w-16"
                    label={`${Math.round(snapshot.viewport.zoom * 100)}%`}
                    lockTooltipSide
                    onClick={() => onZoom("reset")}
                    tooltip="Reset zoom"
                    tooltipContainer={tooltipContainer}
                    tooltipSide="left"
                    variant="outline"
                  />
                  <ToolbarIconButton
                    label="Zoom in"
                    lockTooltipSide
                    onClick={() => onZoom("in")}
                    tooltip="Zoom in"
                    tooltipContainer={tooltipContainer}
                    tooltipSide="left"
                  >
                    <PlusIcon />
                  </ToolbarIconButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 flex-row justify-end border-t bg-background/95 px-5 py-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <Button className="shadow-lg" disabled={isSaveDisabled} onClick={onSave} type="button">
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminalPerformanceSection({
  fpsValue,
  intervalValue,
  onFpsChange,
  onIntervalChange,
  title,
}: {
  fpsValue: string;
  intervalValue: string;
  onFpsChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/65 p-3">
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Max FPS
          </p>
          <Input
            aria-label={`${title} max FPS`}
            max={60}
            min={0}
            onChange={(event) => onFpsChange(event.target.value)}
            step={0.5}
            type="number"
            value={fpsValue}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Batch interval
          </p>
          <Input
            aria-label={`${title} write batch interval`}
            max={10000}
            min={0}
            onChange={(event) => onIntervalChange(event.target.value)}
            step={10}
            type="number"
            value={intervalValue}
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  disabled = false,
  label,
  lockTooltipSide = false,
  onClick,
  tooltip,
  tooltipContainer,
  tooltipSide = "top",
  tooltipSideOffset = 4,
  variant = "default",
  buttonClassName,
}: {
  children?: ReactNode;
  disabled?: boolean;
  label: string;
  lockTooltipSide?: boolean;
  onClick: () => void;
  buttonClassName?: string;
  tooltip: string;
  tooltipContainer?: HTMLDivElement | null;
  tooltipSide?: "bottom" | "inline-end" | "inline-start" | "left" | "right" | "top";
  tooltipSideOffset?: number;
  variant?: "default" | "outline";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={buttonClassName}
            disabled={disabled}
            onClick={onClick}
            variant={variant}
          />
        }
      >
        {children ?? label}
      </TooltipTrigger>
      <TooltipContent
        collisionAvoidance={lockTooltipSide ? LEFT_LOCKED_TOOLTIP_COLLISION_AVOIDANCE : undefined}
        container={tooltipContainer}
        side={tooltipSide}
        sideOffset={lockTooltipSide ? LEFT_LOCKED_TOOLTIP_SIDE_OFFSET : tooltipSideOffset}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarIconButton({
  children,
  disabled = false,
  label,
  lockTooltipSide = false,
  onClick,
  tooltip,
  tooltipContainer,
  tooltipSide = "top",
  tooltipSideOffset = 4,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  lockTooltipSide?: boolean;
  onClick: () => void;
  tooltip: string;
  tooltipContainer?: HTMLDivElement | null;
  tooltipSide?: "bottom" | "inline-end" | "inline-start" | "left" | "right" | "top";
  tooltipSideOffset?: number;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button disabled={disabled} onClick={onClick} size="icon-sm" variant="outline" />}
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent
        collisionAvoidance={lockTooltipSide ? LEFT_LOCKED_TOOLTIP_COLLISION_AVOIDANCE : undefined}
        container={tooltipContainer}
        side={tooltipSide}
        sideOffset={lockTooltipSide ? LEFT_LOCKED_TOOLTIP_SIDE_OFFSET : tooltipSideOffset}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function LoadingSurface() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="grid w-full max-w-5xl grid-cols-2 gap-5">
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-80 rounded-[2rem]" />
        <Skeleton className="col-span-2 h-28 rounded-[2rem]" />
      </div>
    </div>
  );
}

function SessionActivityIcon({
  className,
  indicator,
}: {
  className?: string;
  indicator: SessionActivityIndicator | "paused";
}) {
  if (indicator === "active") {
    return <RefreshCwIcon className={cn("size-3.5 animate-spin", className)} />;
  }

  if (indicator === "done") {
    return <AlertTriangleIcon className={cn("size-3.5", className)} />;
  }

  if (indicator === "paused") {
    return <PauseIcon className={cn("size-3.5", className)} />;
  }

  return <PlayIcon className={cn("size-3.5", className)} />;
}

function getCompactSessionMapLayout(tiles: TerminalTileModel[]) {
  if (tiles.length === 0) {
    return {
      bounds: undefined,
      heightRem: 0,
      items: [] as Array<{
        leftPercent: number;
        tileId: string;
        topPercent: number;
      }>,
    };
  }

  const minX = Math.min(...tiles.map((tile) => tile.x));
  const minY = Math.min(...tiles.map((tile) => tile.y));
  const maxX = Math.max(...tiles.map((tile) => tile.x + tile.width));
  const maxY = Math.max(...tiles.map((tile) => tile.y + tile.height));
  const worldWidth = Math.max(1, maxX - minX);
  const worldHeight = Math.max(1, maxY - minY);
  const aspectRatio = worldHeight / worldWidth;
  const heightRem = Math.min(9, Math.max(5.25, Number((8 * aspectRatio).toFixed(2))));

  return {
    bounds: {
      maxX,
      maxY,
      minX,
      minY,
      worldHeight,
      worldWidth,
    },
    heightRem,
    items: tiles.map((tile) => ({
      leftPercent: clampPercentage(((tile.x + tile.width / 2 - minX) / worldWidth) * 100),
      tileId: tile.id,
      topPercent: clampPercentage(((tile.y + tile.height / 2 - minY) / worldHeight) * 100),
    })),
  };
}

function getCompactSessionMapViewportIndicator(
  layout: ReturnType<typeof getCompactSessionMapLayout>,
  tiles: TerminalTileModel[],
  viewport: CanvasViewport,
  surface: { width: number; height: number } | undefined,
) {
  if (!surface || !layout.bounds) {
    return undefined;
  }

  const viewportBounds = getViewportBounds(viewport, surface);
  const visibleTileBounds = tiles
    .map((tile) => {
      const visibleBounds = getTileVisibleBounds(tile, viewportBounds);
      if (!visibleBounds) {
        return undefined;
      }

      const visibleArea =
        (visibleBounds.right - visibleBounds.left) * (visibleBounds.bottom - visibleBounds.top);
      const visibleRatio = visibleArea / Math.max(1, tile.width * tile.height);

      return visibleRatio >= COMPACT_SESSION_MAP_MIN_VISIBLE_RATIO ? visibleBounds : undefined;
    })
    .filter((bounds) => bounds !== undefined);

  if (visibleTileBounds.length === 0) {
    return undefined;
  }

  const visibleMinX = Math.min(...visibleTileBounds.map((bounds) => bounds.left));
  const visibleMinY = Math.min(...visibleTileBounds.map((bounds) => bounds.top));
  const visibleMaxX = Math.max(...visibleTileBounds.map((bounds) => bounds.right));
  const visibleMaxY = Math.max(...visibleTileBounds.map((bounds) => bounds.bottom));
  const leftPercent = clampPercent(
    ((visibleMinX - layout.bounds.minX) / layout.bounds.worldWidth) * 100 - 2,
  );
  const topPercent = clampPercent(
    ((visibleMinY - layout.bounds.minY) / layout.bounds.worldHeight) * 100 - 2,
  );
  const rawWidthPercent =
    ((visibleMaxX - visibleMinX) / Math.max(1, layout.bounds.worldWidth)) * 100 + 4;
  const rawHeightPercent =
    ((visibleMaxY - visibleMinY) / Math.max(1, layout.bounds.worldHeight)) * 100 + 4;
  const widthPercent = Math.min(96 - leftPercent, Math.max(16, rawWidthPercent));
  const heightPercent = Math.min(96 - topPercent, Math.max(16, rawHeightPercent));

  return {
    heightPercent,
    leftPercent,
    topPercent,
    widthPercent,
  };
}

function clampPercentage(value: number) {
  return clampPercent(value, 8, 92);
}

function clampPercent(value: number, minimum = 2, maximum = 98) {
  return Math.min(maximum, Math.max(minimum, Number(value.toFixed(2))));
}

function getCompactSidebarState() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches;
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 1000) / 1000));
}

function getSurfaceSize(surface: HTMLDivElement | null) {
  if (!surface || surface.clientWidth <= 0 || surface.clientHeight <= 0) {
    return undefined;
  }

  return {
    height: surface.clientHeight,
    width: surface.clientWidth,
  };
}

function getStickyViewportResult(
  viewport: CanvasViewport,
  tiles: TerminalTileModel[],
  surface: { width: number; height: number } | undefined,
  settings: CanvasUiSettings,
  preferredTileId?: string,
) {
  if (
    settings.panMode !== "sticky" ||
    settings.panSnapStrength <= 0 ||
    !surface ||
    tiles.length === 0
  ) {
    return {
      targetTileId: undefined,
      viewport,
    };
  }

  const candidate = getStickySnapCandidate(
    viewport,
    tiles,
    surface,
    settings.panSnapRadius,
    preferredTileId,
    settings.panSnapHysteresis,
  );
  if (!candidate) {
    return {
      targetTileId: undefined,
      viewport,
    };
  }

  const centeredViewport = getViewportCenteredOnTile(viewport, candidate.tile, surface);
  const appliedStrength = clampToRange(settings.panSnapStrength * candidate.influence, 0, 1);

  return {
    targetTileId: candidate.tile.id,
    viewport: {
      ...viewport,
      x: lerp(viewport.x, centeredViewport.x, appliedStrength),
      y: lerp(viewport.y, centeredViewport.y, appliedStrength),
    },
  };
}

function getSettledStickyViewportResult(
  viewport: CanvasViewport,
  tiles: TerminalTileModel[],
  surface: { width: number; height: number } | undefined,
  settings: CanvasUiSettings,
  preferredTileId?: string,
) {
  if (
    settings.panMode !== "sticky" ||
    settings.panSnapSettleStrength <= 0 ||
    !surface ||
    tiles.length === 0
  ) {
    return {
      targetTileId: undefined,
      viewport,
    };
  }

  const candidate = getStickySnapCandidate(
    viewport,
    tiles,
    surface,
    settings.panSnapRadius,
    preferredTileId,
    settings.panSnapHysteresis,
  );
  if (!candidate) {
    return {
      targetTileId: undefined,
      viewport,
    };
  }

  const centeredViewport = getViewportCenteredOnTile(viewport, candidate.tile, surface);

  return {
    targetTileId: candidate.tile.id,
    viewport: {
      ...viewport,
      x: lerp(viewport.x, centeredViewport.x, settings.panSnapSettleStrength),
      y: lerp(viewport.y, centeredViewport.y, settings.panSnapSettleStrength),
    },
  };
}

function getStickySnapCandidate(
  viewport: CanvasViewport,
  tiles: TerminalTileModel[],
  surface: { width: number; height: number },
  snapRadius: number,
  preferredTileId?: string,
  hysteresis = 0,
) {
  if (snapRadius <= 0) {
    return undefined;
  }

  const viewportCenter = {
    x: surface.width / 2,
    y: surface.height / 2,
  };

  const candidates = tiles.reduce<
    Array<{
      distance: number;
      tile: TerminalTileModel;
    }>
  >((accumulator, tile) => {
    const tileCenter = {
      x: (tile.x + tile.width / 2) * viewport.zoom + viewport.x,
      y: (tile.y + tile.height / 2) * viewport.zoom + viewport.y,
    };
    const distance = Math.hypot(tileCenter.x - viewportCenter.x, tileCenter.y - viewportCenter.y);

    if (distance <= snapRadius) {
      accumulator.push({ distance, tile });
    }

    return accumulator;
  }, []);

  if (candidates.length === 0) {
    return undefined;
  }

  const bestCandidate = candidates.reduce<
    | {
        distance: number;
        tile: TerminalTileModel;
      }
    | undefined
  >((best, candidate) => {
    if (!best || candidate.distance < best.distance) {
      return candidate;
    }

    return best;
  }, undefined);

  const preferredCandidate = preferredTileId
    ? candidates.find((candidate) => candidate.tile.id === preferredTileId)
    : undefined;

  if (
    preferredCandidate &&
    bestCandidate &&
    preferredCandidate.distance <= bestCandidate.distance + Math.max(0, hysteresis)
  ) {
    return {
      influence: 1 - preferredCandidate.distance / snapRadius,
      tile: preferredCandidate.tile,
    };
  }

  if (!bestCandidate) {
    return undefined;
  }

  return {
    influence: 1 - bestCandidate.distance / snapRadius,
    tile: bestCandidate.tile,
  };
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function getAutoAlignedTiles(
  tiles: TerminalTileModel[],
  worldWidth: number,
  tileSize: { height: number; width: number },
) {
  const rows = groupTilesIntoRows(tiles).map((row) => normalizeRowTiles(row, tileSize));
  const columns = getAutoAlignColumns(rows, worldWidth);
  const alignedTiles: TerminalTileModel[] = [];
  let currentY = snapToGrid(AUTO_ALIGN_PADDING);

  for (const row of rows) {
    const assignedTiles = assignTilesToColumns(row, columns);
    const rowY = currentY;
    const rowHeight = Math.max(...assignedTiles.map(({ tile }) => tile.height));

    for (const { column, tile } of assignedTiles) {
      alignedTiles.push({
        ...tile,
        height: rowHeight,
        width: column.width,
        x: column.x,
        y: rowY,
      });
    }

    currentY = rowY + rowHeight + AUTO_ALIGN_GAP;
  }

  return alignedTiles;
}

function groupTilesIntoRows(tiles: TerminalTileModel[]) {
  const orderedTiles = [...tiles].sort((left, right) =>
    left.y === right.y ? left.x - right.x : left.y - right.y,
  );
  const rows: TerminalTileModel[][] = [];

  for (const tile of orderedTiles) {
    const currentRow = rows.at(-1);
    if (!currentRow) {
      rows.push([tile]);
      continue;
    }

    const rowCenterY = getMedian(currentRow.map((rowTile) => rowTile.y + rowTile.height / 2));
    const rowHeight = getMedian(currentRow.map((rowTile) => rowTile.height));
    const rowThreshold = Math.max(48, rowHeight * 0.6);
    const tileCenterY = tile.y + tile.height / 2;

    if (Math.abs(tileCenterY - rowCenterY) > rowThreshold) {
      rows.push([tile]);
      continue;
    }

    currentRow.push(tile);
  }

  return rows.map((row) => [...row].sort((left, right) => left.x - right.x));
}

function normalizeRowTiles(row: TerminalTileModel[], tileSize: { height: number; width: number }) {
  return row.map((tile) => ({
    ...tile,
    height: tileSize.height,
    width: tileSize.width,
    x: snapToGrid(tile.x),
    y: snapToGrid(tile.y),
  }));
}

function getAutoAlignTileSize(settings: CanvasUiSettings, zoom: number) {
  return {
    height: resolveAutoAlignDimension(
      settings.autoAlignHeightValue,
      settings.autoAlignHeightUnit,
      zoom,
    ),
    width: resolveAutoAlignDimension(
      settings.autoAlignWidthValue,
      settings.autoAlignWidthUnit,
      zoom,
    ),
  };
}

function resolveAutoAlignDimension(
  value: number,
  unit: CanvasAutoAlignHeightUnit | CanvasAutoAlignWidthUnit,
  zoom: number,
) {
  const viewportWidth = window.innerWidth || 1200;
  const viewportHeight = window.innerHeight || 900;
  const pixels =
    unit === "vw"
      ? (viewportWidth * value) / 100
      : unit === "vh"
        ? (viewportHeight * value) / 100
        : value;

  return Math.max(AUTO_ALIGN_GRID, snapToGrid(pixels / zoom));
}

function snapToGrid(value: number) {
  return Math.round(value / AUTO_ALIGN_GRID) * AUTO_ALIGN_GRID;
}

function getMedian(values: number[]) {
  const orderedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(orderedValues.length / 2);

  if (orderedValues.length % 2 === 0) {
    return (orderedValues[middleIndex - 1] + orderedValues[middleIndex]) / 2;
  }

  return orderedValues[middleIndex] ?? 0;
}

function getNormalizedWheelDelta(delta: number, deltaMode: number) {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return delta * WHEEL_LINE_PIXELS;
  }

  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * WHEEL_PAGE_PIXELS;
  }

  return delta;
}

function getAutoAlignColumns(rows: TerminalTileModel[][], worldWidth: number) {
  const columnSeeds = getColumnSeeds(rows);
  const totalWidth =
    columnSeeds.reduce((sum, seed) => sum + seed.width, 0) +
    AUTO_ALIGN_GAP * Math.max(0, columnSeeds.length - 1);
  const maxStartX = Math.max(
    snapToGrid(AUTO_ALIGN_PADDING),
    snapToGrid(worldWidth - totalWidth - AUTO_ALIGN_PADDING),
  );
  const startX = clampToRange(
    snapToGrid(columnSeeds[0]?.desiredX ?? AUTO_ALIGN_PADDING),
    snapToGrid(AUTO_ALIGN_PADDING),
    maxStartX,
  );

  let currentX = startX;

  return columnSeeds.map((seed) => {
    const column = {
      center: currentX + seed.width / 2,
      width: seed.width,
      x: currentX,
    };

    currentX += seed.width + AUTO_ALIGN_GAP;
    return column;
  });
}

function getColumnSeeds(rows: TerminalTileModel[][]) {
  const seeds: Array<{
    centers: number[];
    widths: number[];
    xs: number[];
  }> = [];
  const minimumColumnCount = Math.max(...rows.map((row) => row.length));
  const orderedTiles = rows
    .flat()
    .sort((left, right) => left.x + left.width / 2 - (right.x + right.width / 2));

  for (const tile of orderedTiles) {
    const tileCenter = tile.x + tile.width / 2;
    const closestSeed = seeds.reduce<
      | {
          distance: number;
          seed: {
            centers: number[];
            widths: number[];
            xs: number[];
          };
        }
      | undefined
    >((best, seed) => {
      const seedCenter = getMedian(seed.centers);
      const seedWidth = getMedian(seed.widths);
      const threshold = Math.max(80, Math.min(seedWidth, tile.width) * 0.5);
      const distance = Math.abs(tileCenter - seedCenter);

      if (distance > threshold) {
        return best;
      }

      if (!best || distance < best.distance) {
        return { distance, seed };
      }

      return best;
    }, undefined);

    if (!closestSeed) {
      seeds.push({
        centers: [tileCenter],
        widths: [tile.width],
        xs: [tile.x],
      });
      continue;
    }

    closestSeed.seed.centers.push(tileCenter);
    closestSeed.seed.widths.push(tile.width);
    closestSeed.seed.xs.push(tile.x);
  }

  const clusteredSeeds = seeds
    .map((seed) => ({
      center: getMedian(seed.centers),
      desiredX: snapToGrid(getMedian(seed.xs)),
      width: snapToGrid(getMedian(seed.widths)),
    }))
    .sort((left, right) => left.center - right.center);

  if (clusteredSeeds.length >= minimumColumnCount) {
    return clusteredSeeds;
  }

  return getIndexedColumnSeeds(rows);
}

function assignTilesToColumns(
  row: TerminalTileModel[],
  columns: Array<{ center: number; width: number; x: number }>,
) {
  const columnSpan = Math.min(row.length, columns.length);
  let bestStartIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let startIndex = 0; startIndex <= columns.length - columnSpan; startIndex += 1) {
    const score = row.slice(0, columnSpan).reduce((total, tile, tileIndex) => {
      const tileCenter = tile.x + tile.width / 2;
      return total + Math.abs(tileCenter - columns[startIndex + tileIndex].center);
    }, 0);

    if (score < bestScore) {
      bestStartIndex = startIndex;
      bestScore = score;
    }
  }

  return row.slice(0, columnSpan).map((tile, tileIndex) => ({
    column: columns[bestStartIndex + tileIndex],
    tile,
  }));
}

function clampToRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getIndexedColumnSeeds(rows: TerminalTileModel[][]) {
  const maxColumnCount = Math.max(...rows.map((row) => row.length));

  return Array.from({ length: maxColumnCount }, (_, columnIndex) => {
    const columnTiles = rows
      .map((row) => row[columnIndex])
      .filter((tile): tile is TerminalTileModel => tile !== undefined);

    return {
      center: getMedian(columnTiles.map((tile) => tile.x + tile.width / 2)),
      desiredX: snapToGrid(getMedian(columnTiles.map((tile) => tile.x))),
      width: snapToGrid(getMedian(columnTiles.map((tile) => tile.width))),
    };
  });
}

function getSnappedTilePosition(tile: TerminalTileModel, otherTiles: TerminalTileModel[]) {
  const leftCandidate = getClosestSnap(tile.x, getHorizontalSnapTargets(otherTiles));
  const rightCandidate = getClosestSnap(tile.x + tile.width, getHorizontalSnapTargets(otherTiles));
  const topCandidate = getClosestSnap(tile.y, getVerticalSnapTargets(otherTiles));
  const bottomCandidate = getClosestSnap(tile.y + tile.height, getVerticalSnapTargets(otherTiles));

  let nextX = tile.x;
  let nextY = tile.y;

  if (leftCandidate && (!rightCandidate || leftCandidate.distance <= rightCandidate.distance)) {
    nextX = leftCandidate.target;
  } else if (rightCandidate) {
    nextX = rightCandidate.target - tile.width;
  }

  if (topCandidate && (!bottomCandidate || topCandidate.distance <= bottomCandidate.distance)) {
    nextY = topCandidate.target;
  } else if (bottomCandidate) {
    nextY = bottomCandidate.target - tile.height;
  }

  return { x: nextX, y: nextY };
}

function getSnappedTileSize(tile: TerminalTileModel, otherTiles: TerminalTileModel[]) {
  const rightCandidate = getClosestSnap(tile.x + tile.width, getHorizontalSnapTargets(otherTiles));
  const bottomCandidate = getClosestSnap(tile.y + tile.height, getVerticalSnapTargets(otherTiles));

  return {
    height: bottomCandidate ? Math.max(220, bottomCandidate.target - tile.y) : tile.height,
    width: rightCandidate ? Math.max(320, rightCandidate.target - tile.x) : tile.width,
  };
}

function getHorizontalSnapTargets(otherTiles: TerminalTileModel[]) {
  return otherTiles.flatMap((tile) => [tile.x, tile.x + tile.width]);
}

function getVerticalSnapTargets(otherTiles: TerminalTileModel[]) {
  return otherTiles.flatMap((tile) => [tile.y, tile.y + tile.height]);
}

function getClosestSnap(value: number, targets: number[]) {
  let closestTarget: number | undefined;
  let closestDistance = SNAP_THRESHOLD + 1;

  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance <= SNAP_THRESHOLD && distance < closestDistance) {
      closestDistance = distance;
      closestTarget = target;
    }
  }

  if (closestTarget === undefined) {
    return undefined;
  }

  return {
    distance: closestDistance,
    target: closestTarget,
  };
}

function createTerminalTileAtPosition(
  tileIndex: number,
  position: Pick<TerminalTileModel, "x" | "y">,
  tileSize: Pick<TerminalTileModel, "height" | "width">,
): TerminalTileModel {
  const id = `tile-${crypto.randomUUID()}`;

  return {
    commandPreview: "login shell",
    height: tileSize.height,
    id,
    title: `Session ${tileIndex}`,
    width: tileSize.width,
    x: position.x,
    y: position.y,
  };
}

function getNearestOpenTilePositionAroundPoint(
  tiles: TerminalTileModel[],
  center: Pick<TerminalTileModel, "x" | "y">,
  tileSize: Pick<TerminalTileModel, "height" | "width">,
) {
  const preferredPosition = {
    x: center.x - tileSize.width / 2,
    y: center.y - tileSize.height / 2,
  };

  const preferredCandidate = {
    ...preferredPosition,
    height: tileSize.height,
    width: tileSize.width,
  };

  if (tiles.every((tile) => !doTilesOverlap(preferredCandidate, tile))) {
    return preferredPosition;
  }

  const xCandidates = [
    preferredPosition.x,
    TILE_START_X,
    ...tiles.flatMap((tile) => [tile.x - tileSize.width - TILE_PLACEMENT_GAP, getTileNextX(tile)]),
  ];
  const yCandidates = [
    preferredPosition.y,
    TILE_START_Y,
    ...tiles.flatMap((tile) => [tile.y - tileSize.height - TILE_PLACEMENT_GAP, getTileNextY(tile)]),
  ];

  const rankedCandidates = [...new Set(xCandidates)]
    .flatMap((x) =>
      [...new Set(yCandidates)].map((y) => ({
        x,
        y,
        distance: Math.hypot(x - preferredPosition.x, y - preferredPosition.y),
      })),
    )
    .sort((left, right) => left.distance - right.distance);

  for (const candidate of rankedCandidates) {
    const tileBounds = {
      ...candidate,
      height: tileSize.height,
      width: tileSize.width,
    };

    if (tiles.every((tile) => !doTilesOverlap(tileBounds, tile))) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  return getNextOpenTilePosition(tiles, tileSize);
}

function getViewportCenteredOnTile(
  viewport: CanvasViewport,
  tile: TerminalTileModel,
  surface: { width: number; height: number },
): CanvasViewport {
  return {
    ...viewport,
    x: surface.width / 2 - (tile.x + tile.width / 2) * viewport.zoom,
    y: surface.height / 2 - (tile.y + tile.height / 2) * viewport.zoom,
  };
}

function getTileVisibleRatio(
  tile: TerminalTileModel,
  viewport: CanvasViewport,
  surface: { width: number; height: number },
) {
  const visibleBounds = getTileVisibleBounds(tile, getViewportBounds(viewport, surface));
  const visibleArea = visibleBounds
    ? (visibleBounds.right - visibleBounds.left) * (visibleBounds.bottom - visibleBounds.top)
    : 0;
  const totalArea = Math.max(1, tile.width * tile.height);

  return visibleArea / totalArea;
}

function getTileVisibleBounds(
  tile: TerminalTileModel,
  viewportBounds: ReturnType<typeof getViewportBounds>,
) {
  const left = Math.max(viewportBounds.left, tile.x);
  const top = Math.max(viewportBounds.top, tile.y);
  const right = Math.min(viewportBounds.right, tile.x + tile.width);
  const bottom = Math.min(viewportBounds.bottom, tile.y + tile.height);

  if (right <= left || bottom <= top) {
    return undefined;
  }

  return {
    bottom,
    left,
    right,
    top,
  };
}

function getMostVisibleTileId(
  tiles: TerminalTileModel[],
  viewport: CanvasViewport,
  surface: { width: number; height: number },
) {
  const viewportBounds = getViewportBounds(viewport, surface);
  const viewportCenterX = (viewportBounds.left + viewportBounds.right) / 2;
  const viewportCenterY = (viewportBounds.top + viewportBounds.bottom) / 2;

  return tiles.reduce<string | undefined>((bestTileId, tile) => {
    const overlapWidth =
      Math.min(viewportBounds.right, tile.x + tile.width) - Math.max(viewportBounds.left, tile.x);
    const overlapHeight =
      Math.min(viewportBounds.bottom, tile.y + tile.height) - Math.max(viewportBounds.top, tile.y);
    const visibleArea = Math.max(0, overlapWidth) * Math.max(0, overlapHeight);

    if (visibleArea <= 0 && bestTileId) {
      return bestTileId;
    }

    if (!bestTileId) {
      return tile.id;
    }

    const bestTile = tiles.find((candidate) => candidate.id === bestTileId);
    if (!bestTile) {
      return tile.id;
    }

    const bestOverlapWidth =
      Math.min(viewportBounds.right, bestTile.x + bestTile.width) -
      Math.max(viewportBounds.left, bestTile.x);
    const bestOverlapHeight =
      Math.min(viewportBounds.bottom, bestTile.y + bestTile.height) -
      Math.max(viewportBounds.top, bestTile.y);
    const bestVisibleArea = Math.max(0, bestOverlapWidth) * Math.max(0, bestOverlapHeight);

    if (visibleArea !== bestVisibleArea) {
      return visibleArea > bestVisibleArea ? tile.id : bestTileId;
    }

    const tileCenterDistance = Math.hypot(
      tile.x + tile.width / 2 - viewportCenterX,
      tile.y + tile.height / 2 - viewportCenterY,
    );
    const bestTileCenterDistance = Math.hypot(
      bestTile.x + bestTile.width / 2 - viewportCenterX,
      bestTile.y + bestTile.height / 2 - viewportCenterY,
    );

    return tileCenterDistance < bestTileCenterDistance ? tile.id : bestTileId;
  }, undefined);
}

function getTerminalRenderPriority(
  tile: TerminalTileModel,
  focusedTileId: string | undefined,
  viewport: CanvasViewport,
  surface: { width: number; height: number } | null,
): TerminalRenderPriority {
  if (tile.id === focusedTileId) {
    return "active";
  }

  if (!surface) {
    return "visible";
  }

  return getTileVisibleRatio(tile, viewport, surface) > 0 ? "visible" : "offscreen";
}

function getTerminalPerformanceProfile(
  settings: CanvasTerminalPerformanceSettings,
  priority: TerminalRenderPriority,
): TerminalPerformanceProfile {
  return settings[priority];
}

function getTileForKeyboardJump(
  tiles: TerminalTileModel[],
  focusedTileId: string | undefined,
  viewport: CanvasViewport,
  surface: { width: number; height: number },
) {
  if (focusedTileId) {
    const focusedTile = tiles.find((tile) => tile.id === focusedTileId);
    if (focusedTile) {
      return focusedTile;
    }
  }

  const mostVisibleTileId = getMostVisibleTileId(tiles, viewport, surface);
  return mostVisibleTileId ? tiles.find((tile) => tile.id === mostVisibleTileId) : undefined;
}

function getDirectionalNeighborTile(
  tiles: TerminalTileModel[],
  currentTile: TerminalTileModel,
  direction: TerminalJumpDirection,
  wrapAround = false,
) {
  const currentCenterX = currentTile.x + currentTile.width / 2;
  const currentCenterY = currentTile.y + currentTile.height / 2;

  const directNeighbor = tiles.reduce<TerminalTileModel | undefined>((bestTile, tile) => {
    if (tile.id === currentTile.id) {
      return bestTile;
    }

    const candidateCenterX = tile.x + tile.width / 2;
    const candidateCenterY = tile.y + tile.height / 2;
    const deltaX = candidateCenterX - currentCenterX;
    const deltaY = candidateCenterY - currentCenterY;
    const isCandidateInDirection =
      (direction === "left" && deltaX < 0) ||
      (direction === "right" && deltaX > 0) ||
      (direction === "up" && deltaY < 0) ||
      (direction === "down" && deltaY > 0);

    if (!isCandidateInDirection) {
      return bestTile;
    }

    if (!bestTile) {
      return tile;
    }

    const bestDeltaX = bestTile.x + bestTile.width / 2 - currentCenterX;
    const bestDeltaY = bestTile.y + bestTile.height / 2 - currentCenterY;

    return compareDirectionalCandidate(deltaX, deltaY, bestDeltaX, bestDeltaY, direction) < 0
      ? tile
      : bestTile;
  }, undefined);

  if (directNeighbor || !wrapAround) {
    return directNeighbor;
  }

  return getWrappedNeighborTile(tiles, currentTile, direction, currentCenterX, currentCenterY);
}

function compareDirectionalCandidate(
  candidateDeltaX: number,
  candidateDeltaY: number,
  bestDeltaX: number,
  bestDeltaY: number,
  direction: TerminalJumpDirection,
) {
  const candidatePrimaryDistance = Math.abs(
    direction === "left" || direction === "right" ? candidateDeltaX : candidateDeltaY,
  );
  const candidateSecondaryDistance = Math.abs(
    direction === "left" || direction === "right" ? candidateDeltaY : candidateDeltaX,
  );
  const bestPrimaryDistance = Math.abs(
    direction === "left" || direction === "right" ? bestDeltaX : bestDeltaY,
  );
  const bestSecondaryDistance = Math.abs(
    direction === "left" || direction === "right" ? bestDeltaY : bestDeltaX,
  );

  const candidateScore = candidatePrimaryDistance * 1000 + candidateSecondaryDistance;
  const bestScore = bestPrimaryDistance * 1000 + bestSecondaryDistance;

  return candidateScore - bestScore;
}

function getWrappedNeighborTile(
  tiles: TerminalTileModel[],
  currentTile: TerminalTileModel,
  direction: TerminalJumpDirection,
  currentCenterX: number,
  currentCenterY: number,
) {
  const candidates = tiles.filter((tile) => tile.id !== currentTile.id);

  if (candidates.length === 0) {
    return undefined;
  }

  const edgeCoordinate = candidates.reduce<number | undefined>((bestCoordinate, tile) => {
    const candidateCenterX = tile.x + tile.width / 2;
    const candidateCenterY = tile.y + tile.height / 2;
    const tileCoordinate =
      direction === "left" || direction === "right" ? candidateCenterX : candidateCenterY;

    if (bestCoordinate === undefined) {
      return tileCoordinate;
    }

    if (direction === "right" || direction === "down") {
      return Math.min(bestCoordinate, tileCoordinate);
    }

    return Math.max(bestCoordinate, tileCoordinate);
  }, undefined);

  if (edgeCoordinate === undefined) {
    return undefined;
  }

  return candidates.reduce<TerminalTileModel | undefined>((bestTile, tile) => {
    const candidateCenterX = tile.x + tile.width / 2;
    const candidateCenterY = tile.y + tile.height / 2;
    const candidatePrimaryCoordinate =
      direction === "left" || direction === "right" ? candidateCenterX : candidateCenterY;

    if (candidatePrimaryCoordinate !== edgeCoordinate) {
      return bestTile;
    }

    if (!bestTile) {
      return tile;
    }

    const bestCenterX = bestTile.x + bestTile.width / 2;
    const bestCenterY = bestTile.y + bestTile.height / 2;
    const candidateSecondaryDistance = Math.abs(
      direction === "left" || direction === "right"
        ? candidateCenterY - currentCenterY
        : candidateCenterX - currentCenterX,
    );
    const bestSecondaryDistance = Math.abs(
      direction === "left" || direction === "right"
        ? bestCenterY - currentCenterY
        : bestCenterX - currentCenterX,
    );

    if (candidateSecondaryDistance !== bestSecondaryDistance) {
      return candidateSecondaryDistance < bestSecondaryDistance ? tile : bestTile;
    }

    const candidateWrappedDistance = Math.abs(
      direction === "left" || direction === "right"
        ? candidateCenterX - currentCenterX
        : candidateCenterY - currentCenterY,
    );
    const bestWrappedDistance = Math.abs(
      direction === "left" || direction === "right"
        ? bestCenterX - currentCenterX
        : bestCenterY - currentCenterY,
    );

    return candidateWrappedDistance < bestWrappedDistance ? tile : bestTile;
  }, undefined);
}

function getTerminalJumpDirection(event: KeyboardEvent): TerminalJumpDirection | undefined {
  if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
    return undefined;
  }

  switch (event.key.toLowerCase()) {
    case "arrowleft":
    case "h":
      return "left";
    case "arrowright":
    case "l":
      return "right";
    case "arrowup":
    case "k":
      return "up";
    case "arrowdown":
    case "j":
      return "down";
    default:
      return undefined;
  }
}

function isEditableHotkeyTarget(target: HTMLElement) {
  const editableTarget = target.closest("input, textarea, [contenteditable='true']");
  const terminalSurface = target.closest(TERMINAL_SURFACE_SELECTOR);

  return !!editableTarget && !terminalSurface;
}

function isEventWithinSelector(event: Event, selector: string) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  if (path.some((target) => target instanceof Element && target.closest(selector))) {
    return true;
  }

  return event.target instanceof Element && !!event.target.closest(selector);
}

function getViewportBounds(viewport: CanvasViewport, surface: { width: number; height: number }) {
  return {
    bottom: (-viewport.y + surface.height) / viewport.zoom,
    left: -viewport.x / viewport.zoom,
    right: (-viewport.x + surface.width) / viewport.zoom,
    top: -viewport.y / viewport.zoom,
  };
}

function getNextOpenTilePosition(
  tiles: TerminalTileModel[],
  tileSize: Pick<TerminalTileModel, "height" | "width"> = {
    height: TILE_HEIGHT,
    width: TILE_WIDTH,
  },
) {
  if (tiles.length === 0) {
    return { x: TILE_START_X, y: TILE_START_Y };
  }

  const xCandidates = [...new Set([TILE_START_X, ...tiles.map(getTileNextX)])].sort(
    (left, right) => left - right,
  );
  const yCandidates = [...new Set([TILE_START_Y, ...tiles.map(getTileNextY)])].sort(
    (top, bottom) => top - bottom,
  );

  for (const y of yCandidates) {
    for (const x of xCandidates) {
      const candidate = {
        x,
        y,
        width: tileSize.width,
        height: tileSize.height,
      };

      if (tiles.every((tile) => !doTilesOverlap(candidate, tile))) {
        return { x, y };
      }
    }
  }

  return {
    x: TILE_START_X,
    y: Math.max(...tiles.map(getTileNextY)),
  };
}

function getTileNextX(tile: TerminalTileModel) {
  return tile.x + tile.width + TILE_PLACEMENT_GAP;
}

function getTileNextY(tile: TerminalTileModel) {
  return tile.y + tile.height + TILE_PLACEMENT_GAP;
}

function bringTileToFront(tiles: TerminalTileModel[], tileId: string) {
  const tile = tiles.find((candidate) => candidate.id === tileId);
  if (!tile) {
    return tiles;
  }

  return [...tiles.filter((candidate) => candidate.id !== tileId), tile];
}

function doTilesOverlap(
  left: Pick<TerminalTileModel, "x" | "y" | "width" | "height">,
  right: Pick<TerminalTileModel, "x" | "y" | "width" | "height">,
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
