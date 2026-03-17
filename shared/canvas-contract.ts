import type {
  TerminalInputMessage,
  TerminalOutputMessage,
  TerminalResizeMessage,
  TerminalSessionsByTileId,
  TerminalStateMessage,
} from "./terminal-host-protocol";

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type TerminalTileModel = {
  id: string;
  title: string;
  commandPreview: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasWorkspaceSnapshot = {
  viewport: CanvasViewport;
  tiles: TerminalTileModel[];
  focusedTileId?: string;
  nextTileIndex: number;
};

export const DEFAULT_TERMINAL_FONT_FAMILY =
  '"MesloLGL Nerd Font Mono", "MesloLGS NF", "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export type CanvasThemeMode = "dark" | "light";
export type CanvasPanMode = "free" | "sticky";
export type CanvasAutoAlignUnit = "px" | "vh" | "vw";
export type CanvasAutoAlignWidthUnit = Extract<CanvasAutoAlignUnit, "px" | "vw">;
export type CanvasAutoAlignHeightUnit = Extract<CanvasAutoAlignUnit, "px" | "vh">;

export const DEFAULT_PAN_MODE: CanvasPanMode = "free";
export const DEFAULT_PAN_SNAP_HYSTERESIS = 80;
export const DEFAULT_PAN_SNAP_RADIUS = 520;
export const DEFAULT_PAN_SNAP_SETTLE_DELAY = 220;
export const DEFAULT_PAN_SNAP_SETTLE_STRENGTH = 0.65;
export const DEFAULT_PAN_SNAP_STRENGTH = 0.28;
export const DEFAULT_AUTO_ALIGN_WIDTH_UNIT: CanvasAutoAlignWidthUnit = "vw";
export const DEFAULT_AUTO_ALIGN_WIDTH_VALUE = 90;
export const DEFAULT_AUTO_ALIGN_HEIGHT_UNIT: CanvasAutoAlignHeightUnit = "vh";
export const DEFAULT_AUTO_ALIGN_HEIGHT_VALUE = 80;
export const DEFAULT_TERMINAL_NAVIGATION_WRAP = false;
export const DEFAULT_TERMINAL_ACTIVE_MAX_FPS = 30;
export const DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS = 16;
export const DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS = 1;
export const DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS = 1000;
export const DEFAULT_TERMINAL_VISIBLE_MAX_FPS = 12;
export const DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS = 100;
export const PAN_SNAP_HYSTERESIS_MAX = 400;
export const PAN_SNAP_HYSTERESIS_MIN = 0;
export const PAN_SNAP_RADIUS_MAX = 1600;
export const PAN_SNAP_RADIUS_MIN = 120;
export const PAN_SNAP_SETTLE_DELAY_MAX = 1000;
export const PAN_SNAP_SETTLE_DELAY_MIN = 0;
export const PAN_SNAP_STRENGTH_MAX = 1;
export const PAN_SNAP_STRENGTH_MIN = 0;
export const TERMINAL_MAX_FPS_MAX = 60;
export const TERMINAL_MAX_FPS_MIN = 0;
export const TERMINAL_WRITE_BATCH_INTERVAL_MS_MAX = 10000;
export const TERMINAL_WRITE_BATCH_INTERVAL_MS_MIN = 0;

export type TerminalRenderPriority = "active" | "offscreen" | "visible";

export type TerminalPerformanceProfile = {
  maxFps: number;
  writeBatchIntervalMs: number;
};

export type CanvasTerminalPerformanceSettings = {
  active: TerminalPerformanceProfile;
  offscreen: TerminalPerformanceProfile;
  visible: TerminalPerformanceProfile;
};

export type CanvasUiSettings = {
  autoAlignHeightUnit: CanvasAutoAlignHeightUnit;
  autoAlignHeightValue: number;
  autoAlignWidthUnit: CanvasAutoAlignWidthUnit;
  autoAlignWidthValue: number;
  panMode: CanvasPanMode;
  panSnapHysteresis: number;
  panSnapRadius: number;
  panSnapSettleDelay: number;
  panSnapSettleStrength: number;
  panSnapStrength: number;
  terminalNavigationWrap: boolean;
  terminalPerformance: CanvasTerminalPerformanceSettings;
  terminalFontFamily: string;
  themeMode: CanvasThemeMode;
  uiScale: number;
};

export type CanvasAssetUris = {
  ghosttyWasm: string;
};

export function createDefaultWorkspaceSnapshot(): CanvasWorkspaceSnapshot {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    tiles: [],
    focusedTileId: undefined,
    nextTileIndex: 1,
  };
}

export type HydrateMessage = {
  type: "hydrate";
  snapshot: CanvasWorkspaceSnapshot;
  settings: CanvasUiSettings;
  terminalSessions: TerminalSessionsByTileId;
  assetUris: CanvasAssetUris;
};

export type ExtensionToWebviewMessage =
  | HydrateMessage
  | TerminalStateMessage
  | TerminalOutputMessage;

export type WebviewToExtensionMessage =
  | {
      type: "ready";
    }
  | {
      type: "updatePanBehavior";
      panMode: CanvasPanMode;
      panSnapHysteresis: number;
      panSnapRadius: number;
      panSnapSettleDelay: number;
      panSnapSettleStrength: number;
      panSnapStrength: number;
    }
  | {
      type: "updateAutoAlignSize";
      autoAlignHeightUnit: CanvasAutoAlignHeightUnit;
      autoAlignHeightValue: number;
      autoAlignWidthUnit: CanvasAutoAlignWidthUnit;
      autoAlignWidthValue: number;
    }
  | {
      type: "updateTerminalNavigation";
      terminalNavigationWrap: boolean;
    }
  | {
      type: "updateUiScale";
      uiScale: number;
    }
  | {
      type: "updateThemeMode";
      themeMode: CanvasThemeMode;
    }
  | {
      type: "updateTerminalPerformance";
      terminalPerformance: CanvasTerminalPerformanceSettings;
    }
  | {
      type: "workspaceSnapshot";
      snapshot: CanvasWorkspaceSnapshot;
    }
  | {
      type: "notify";
      message: string;
    }
  | {
      type: "restartTerminal";
      tileId: string;
    }
  | TerminalInputMessage
  | TerminalResizeMessage;

export function clampPanSnapRadius(radius: number) {
  return Math.min(PAN_SNAP_RADIUS_MAX, Math.max(PAN_SNAP_RADIUS_MIN, Math.round(radius)));
}

export function clampPanSnapHysteresis(hysteresis: number) {
  return Math.min(
    PAN_SNAP_HYSTERESIS_MAX,
    Math.max(PAN_SNAP_HYSTERESIS_MIN, Math.round(hysteresis)),
  );
}

export function clampPanSnapSettleDelay(delay: number) {
  return Math.min(
    PAN_SNAP_SETTLE_DELAY_MAX,
    Math.max(PAN_SNAP_SETTLE_DELAY_MIN, Math.round(delay)),
  );
}

export function clampPanSnapStrength(strength: number) {
  return Math.min(
    PAN_SNAP_STRENGTH_MAX,
    Math.max(PAN_SNAP_STRENGTH_MIN, Number(strength.toFixed(2))),
  );
}

export function clampPanSnapSettleStrength(strength: number) {
  return Math.min(
    PAN_SNAP_STRENGTH_MAX,
    Math.max(PAN_SNAP_STRENGTH_MIN, Number(strength.toFixed(2))),
  );
}

export function clampAutoAlignSizeValue(value: number, unit: CanvasAutoAlignUnit) {
  if (unit === "px") {
    return Math.min(4096, Math.max(16, Math.round(value)));
  }

  return Math.min(100, Math.max(1, Number(value.toFixed(2))));
}

export function clampTerminalMaxFps(value: number) {
  return Math.min(TERMINAL_MAX_FPS_MAX, Math.max(TERMINAL_MAX_FPS_MIN, Number(value.toFixed(2))));
}

export function clampTerminalWriteBatchIntervalMs(value: number) {
  return Math.min(
    TERMINAL_WRITE_BATCH_INTERVAL_MS_MAX,
    Math.max(TERMINAL_WRITE_BATCH_INTERVAL_MS_MIN, Math.round(value)),
  );
}

export function clampTerminalPerformanceProfile(
  profile: TerminalPerformanceProfile,
): TerminalPerformanceProfile {
  return {
    maxFps: clampTerminalMaxFps(profile.maxFps),
    writeBatchIntervalMs: clampTerminalWriteBatchIntervalMs(profile.writeBatchIntervalMs),
  };
}

export function clampTerminalPerformanceSettings(
  settings: CanvasTerminalPerformanceSettings,
): CanvasTerminalPerformanceSettings {
  return {
    active: clampTerminalPerformanceProfile(settings.active),
    offscreen: clampTerminalPerformanceProfile(settings.offscreen),
    visible: clampTerminalPerformanceProfile(settings.visible),
  };
}

export function createDefaultTerminalPerformanceSettings(): CanvasTerminalPerformanceSettings {
  return {
    active: {
      maxFps: DEFAULT_TERMINAL_ACTIVE_MAX_FPS,
      writeBatchIntervalMs: DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS,
    },
    offscreen: {
      maxFps: DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS,
      writeBatchIntervalMs: DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS,
    },
    visible: {
      maxFps: DEFAULT_TERMINAL_VISIBLE_MAX_FPS,
      writeBatchIntervalMs: DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS,
    },
  };
}
