import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_AUTO_ALIGN_HEIGHT_UNIT,
  DEFAULT_AUTO_ALIGN_HEIGHT_VALUE,
  DEFAULT_AUTO_ALIGN_WIDTH_UNIT,
  DEFAULT_AUTO_ALIGN_WIDTH_VALUE,
  DEFAULT_PAN_MODE,
  DEFAULT_PAN_SNAP_HYSTERESIS,
  DEFAULT_PAN_SNAP_RADIUS,
  DEFAULT_PAN_SNAP_SETTLE_DELAY,
  DEFAULT_PAN_SNAP_SETTLE_STRENGTH,
  DEFAULT_PAN_SNAP_STRENGTH,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_NAVIGATION_WRAP,
  clampTerminalPerformanceSettings,
  clampAutoAlignSizeValue,
  clampPanSnapHysteresis,
  createDefaultTerminalPerformanceSettings,
  type CanvasAssetUris,
  type CanvasAutoAlignHeightUnit,
  type CanvasTerminalPerformanceSettings,
  type CanvasPanMode,
  type CanvasThemeMode,
  type CanvasUiSettings,
  type CanvasAutoAlignWidthUnit,
  type CanvasWorkspaceSnapshot,
  type ExtensionToWebviewMessage,
  clampPanSnapSettleDelay,
  clampPanSnapSettleStrength,
  clampPanSnapRadius,
  clampPanSnapStrength,
  createDefaultWorkspaceSnapshot,
} from "../shared/canvas-contract";
import type { TerminalSessionsByTileId } from "../shared/terminal-host-protocol";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CanvasWorkspace } from "@/components/canvas-workspace";
import {
  createSessionActivityFromSessions,
  markSessionOutput,
  type SessionActivityByTileId,
  updateSessionActivityFromState,
} from "@/lib/session-activity";
import { getVsCodeApi } from "@/lib/vscode";

const SNAPSHOT_PERSIST_DEBOUNCE_MS = 160;
export const App = () => {
  const vscode = useMemo(() => getVsCodeApi(), []);
  const hydratedSnapshot = vscode.getState() ?? createDefaultWorkspaceSnapshot();

  const [snapshot, setSnapshot] = useState<CanvasWorkspaceSnapshot>(hydratedSnapshot);
  const [assetUris, setAssetUris] = useState<CanvasAssetUris>({
    ghosttyWasm: "",
  });
  const [settings, setSettings] = useState<CanvasUiSettings>({
    autoAlignHeightUnit: DEFAULT_AUTO_ALIGN_HEIGHT_UNIT,
    autoAlignHeightValue: DEFAULT_AUTO_ALIGN_HEIGHT_VALUE,
    autoAlignWidthUnit: DEFAULT_AUTO_ALIGN_WIDTH_UNIT,
    autoAlignWidthValue: DEFAULT_AUTO_ALIGN_WIDTH_VALUE,
    panMode: DEFAULT_PAN_MODE,
    panSnapHysteresis: DEFAULT_PAN_SNAP_HYSTERESIS,
    panSnapRadius: DEFAULT_PAN_SNAP_RADIUS,
    panSnapSettleDelay: DEFAULT_PAN_SNAP_SETTLE_DELAY,
    panSnapSettleStrength: DEFAULT_PAN_SNAP_SETTLE_STRENGTH,
    panSnapStrength: DEFAULT_PAN_SNAP_STRENGTH,
    terminalNavigationWrap: DEFAULT_TERMINAL_NAVIGATION_WRAP,
    terminalPerformance: createDefaultTerminalPerformanceSettings(),
    terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
    themeMode: "light",
    uiScale: 0.6,
  });
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionsByTileId>({});
  const [sessionActivityByTileId, setSessionActivityByTileId] = useState<SessionActivityByTileId>(
    {},
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const persistTimerRef = useRef<number | undefined>(undefined);
  const isHydratedRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  const terminalSessionsRef = useRef(terminalSessions);
  const sessionActivityRef = useRef(sessionActivityByTileId);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    terminalSessionsRef.current = terminalSessions;
  }, [terminalSessions]);

  useEffect(() => {
    sessionActivityRef.current = sessionActivityByTileId;
  }, [sessionActivityByTileId]);

  useEffect(() => {
    isHydratedRef.current = isHydrated;
  }, [isHydrated]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;

      if (message?.type === "hydrate") {
        const nextSessionActivity = createSessionActivityFromSessions(message.terminalSessions);
        setAssetUris(message.assetUris);
        setSettings(message.settings);
        setSnapshot(message.snapshot);
        setTerminalSessions(message.terminalSessions);
        setSessionActivityByTileId(nextSessionActivity);
        terminalSessionsRef.current = message.terminalSessions;
        sessionActivityRef.current = nextSessionActivity;
        vscode.setState(message.snapshot);
        setIsHydrated(true);
        return;
      }

      if (message?.type === "terminalSessionState") {
        const previousSession = terminalSessionsRef.current[message.session.tileId];
        const nextSession = {
          ...previousSession,
          ...message.session,
        };
        const nextTerminalSessions = {
          ...terminalSessionsRef.current,
          [message.session.tileId]: nextSession,
        };
        const nextSessionActivity = updateSessionActivityFromState(
          sessionActivityRef.current,
          previousSession,
          nextSession,
        );

        terminalSessionsRef.current = nextTerminalSessions;
        sessionActivityRef.current = nextSessionActivity;
        setTerminalSessions(nextTerminalSessions);
        setSessionActivityByTileId(nextSessionActivity);
        return;
      }

      if (message?.type === "terminalOutput" && message.data.length > 0) {
        const session = terminalSessionsRef.current[message.tileId];
        if (!session) {
          return;
        }

        const nextSessionActivity = markSessionOutput(
          sessionActivityRef.current,
          message.tileId,
          session.startedAt,
        );

        sessionActivityRef.current = nextSessionActivity;
        setSessionActivityByTileId(nextSessionActivity);
      }
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [vscode]);

  // useEffect(() => {
  //   let isDisposed = false;
  //   let instrucktInstance: { destroy: () => void } | undefined;

  //   void import("instruckt").then(({ init }) => {
  //     if (isDisposed) {
  //       return;
  //     }

  //     instrucktInstance = init({
  //       adapters: ["react"],
  //       endpoint: "/instruckt",
  //       position: "bottom-left",
  //       theme: "auto",
  //     });
  //   });

  //   return () => {
  //     isDisposed = true;
  //     instrucktInstance?.destroy();
  //   };
  // }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.themeMode === "dark");
    document.documentElement.style.colorScheme = settings.themeMode;
  }, [settings.themeMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      vscode.setState(snapshot);
      vscode.postMessage({ type: "workspaceSnapshot", snapshot });
    }, SNAPSHOT_PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(persistTimerRef.current);
    };
  }, [isHydrated, snapshot, vscode]);

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimerRef.current);
      if (!isHydratedRef.current) {
        return;
      }

      vscode.setState(snapshotRef.current);
      vscode.postMessage({ type: "workspaceSnapshot", snapshot: snapshotRef.current });
    };
  }, [vscode]);

  const handleThemeModeChange = (themeMode: CanvasThemeMode) => {
    setSettings((current) => ({ ...current, themeMode }));
    vscode.postMessage({ type: "updateThemeMode", themeMode });
  };

  const handleAutoAlignSizeChange = (
    autoAlignWidthValue: number,
    autoAlignWidthUnit: CanvasAutoAlignWidthUnit,
    autoAlignHeightValue: number,
    autoAlignHeightUnit: CanvasAutoAlignHeightUnit,
  ) => {
    const nextAutoAlignWidthValue = clampAutoAlignSizeValue(
      autoAlignWidthValue,
      autoAlignWidthUnit,
    );
    const nextAutoAlignHeightValue = clampAutoAlignSizeValue(
      autoAlignHeightValue,
      autoAlignHeightUnit,
    );

    setSettings((current) => ({
      ...current,
      autoAlignHeightUnit,
      autoAlignHeightValue: nextAutoAlignHeightValue,
      autoAlignWidthUnit,
      autoAlignWidthValue: nextAutoAlignWidthValue,
    }));
    vscode.postMessage({
      autoAlignHeightUnit,
      autoAlignHeightValue: nextAutoAlignHeightValue,
      autoAlignWidthUnit,
      autoAlignWidthValue: nextAutoAlignWidthValue,
      type: "updateAutoAlignSize",
    });
  };

  const handleTerminalNavigationChange = (terminalNavigationWrap: boolean) => {
    setSettings((current) => ({
      ...current,
      terminalNavigationWrap,
    }));
    vscode.postMessage({
      terminalNavigationWrap,
      type: "updateTerminalNavigation",
    });
  };

  const handlePanBehaviorChange = (
    panMode: CanvasPanMode,
    panSnapStrength: number,
    panSnapRadius: number,
    panSnapSettleStrength: number,
    panSnapSettleDelay: number,
    panSnapHysteresis: number,
  ) => {
    const nextPanMode = panMode === "sticky" ? "sticky" : "free";
    const nextPanSnapHysteresis = clampPanSnapHysteresis(panSnapHysteresis);
    const nextPanSnapStrength = clampPanSnapStrength(panSnapStrength);
    const nextPanSnapRadius = clampPanSnapRadius(panSnapRadius);
    const nextPanSnapSettleStrength = clampPanSnapSettleStrength(panSnapSettleStrength);
    const nextPanSnapSettleDelay = clampPanSnapSettleDelay(panSnapSettleDelay);

    setSettings((current) => ({
      ...current,
      panMode: nextPanMode,
      panSnapHysteresis: nextPanSnapHysteresis,
      panSnapRadius: nextPanSnapRadius,
      panSnapSettleDelay: nextPanSnapSettleDelay,
      panSnapSettleStrength: nextPanSnapSettleStrength,
      panSnapStrength: nextPanSnapStrength,
    }));
    vscode.postMessage({
      panMode: nextPanMode,
      panSnapHysteresis: nextPanSnapHysteresis,
      panSnapRadius: nextPanSnapRadius,
      panSnapSettleDelay: nextPanSnapSettleDelay,
      panSnapSettleStrength: nextPanSnapSettleStrength,
      panSnapStrength: nextPanSnapStrength,
      type: "updatePanBehavior",
    });
  };

  const handleRestartTerminal = (tileId: string) => {
    vscode.postMessage({
      tileId,
      type: "restartTerminal",
    });
  };

  const handleTerminalPerformanceChange = (
    terminalPerformance: CanvasTerminalPerformanceSettings,
  ) => {
    const nextTerminalPerformance = clampTerminalPerformanceSettings(terminalPerformance);

    setSettings((current) => ({
      ...current,
      terminalPerformance: nextTerminalPerformance,
    }));
    vscode.postMessage({
      terminalPerformance: nextTerminalPerformance,
      type: "updateTerminalPerformance",
    });
  };

  return (
    <TooltipProvider delay={120}>
      <CanvasWorkspace
        assetUris={assetUris}
        isHydrated={isHydrated}
        onAutoAlignSizeChange={handleAutoAlignSizeChange}
        onPanBehaviorChange={handlePanBehaviorChange}
        onRestartTerminal={handleRestartTerminal}
        onTerminalNavigationChange={handleTerminalNavigationChange}
        onTerminalPerformanceChange={handleTerminalPerformanceChange}
        onThemeModeChange={handleThemeModeChange}
        settings={settings}
        sessionActivityByTileId={sessionActivityByTileId}
        snapshot={snapshot}
        terminalSessions={terminalSessions}
        onSnapshotChange={setSnapshot}
      />
    </TooltipProvider>
  );
};
