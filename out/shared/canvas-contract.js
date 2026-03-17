"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MIN = exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MAX = exports.TERMINAL_MAX_FPS_MIN = exports.TERMINAL_MAX_FPS_MAX = exports.PAN_SNAP_STRENGTH_MIN = exports.PAN_SNAP_STRENGTH_MAX = exports.PAN_SNAP_SETTLE_DELAY_MIN = exports.PAN_SNAP_SETTLE_DELAY_MAX = exports.PAN_SNAP_RADIUS_MIN = exports.PAN_SNAP_RADIUS_MAX = exports.PAN_SNAP_HYSTERESIS_MIN = exports.PAN_SNAP_HYSTERESIS_MAX = exports.DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS = exports.DEFAULT_TERMINAL_VISIBLE_MAX_FPS = exports.DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS = exports.DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS = exports.DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS = exports.DEFAULT_TERMINAL_ACTIVE_MAX_FPS = exports.DEFAULT_TERMINAL_NAVIGATION_WRAP = exports.DEFAULT_AUTO_ALIGN_HEIGHT_VALUE = exports.DEFAULT_AUTO_ALIGN_HEIGHT_UNIT = exports.DEFAULT_AUTO_ALIGN_WIDTH_VALUE = exports.DEFAULT_AUTO_ALIGN_WIDTH_UNIT = exports.DEFAULT_PAN_SNAP_STRENGTH = exports.DEFAULT_PAN_SNAP_SETTLE_STRENGTH = exports.DEFAULT_PAN_SNAP_SETTLE_DELAY = exports.DEFAULT_PAN_SNAP_RADIUS = exports.DEFAULT_PAN_SNAP_HYSTERESIS = exports.DEFAULT_PAN_MODE = exports.DEFAULT_TERMINAL_FONT_FAMILY = void 0;
exports.createDefaultWorkspaceSnapshot = createDefaultWorkspaceSnapshot;
exports.clampPanSnapRadius = clampPanSnapRadius;
exports.clampPanSnapHysteresis = clampPanSnapHysteresis;
exports.clampPanSnapSettleDelay = clampPanSnapSettleDelay;
exports.clampPanSnapStrength = clampPanSnapStrength;
exports.clampPanSnapSettleStrength = clampPanSnapSettleStrength;
exports.clampAutoAlignSizeValue = clampAutoAlignSizeValue;
exports.clampTerminalMaxFps = clampTerminalMaxFps;
exports.clampTerminalWriteBatchIntervalMs = clampTerminalWriteBatchIntervalMs;
exports.clampTerminalPerformanceProfile = clampTerminalPerformanceProfile;
exports.clampTerminalPerformanceSettings = clampTerminalPerformanceSettings;
exports.createDefaultTerminalPerformanceSettings = createDefaultTerminalPerformanceSettings;
exports.DEFAULT_TERMINAL_FONT_FAMILY = '"MesloLGL Nerd Font Mono", "MesloLGS NF", "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
exports.DEFAULT_PAN_MODE = "free";
exports.DEFAULT_PAN_SNAP_HYSTERESIS = 80;
exports.DEFAULT_PAN_SNAP_RADIUS = 520;
exports.DEFAULT_PAN_SNAP_SETTLE_DELAY = 220;
exports.DEFAULT_PAN_SNAP_SETTLE_STRENGTH = 0.65;
exports.DEFAULT_PAN_SNAP_STRENGTH = 0.28;
exports.DEFAULT_AUTO_ALIGN_WIDTH_UNIT = "vw";
exports.DEFAULT_AUTO_ALIGN_WIDTH_VALUE = 90;
exports.DEFAULT_AUTO_ALIGN_HEIGHT_UNIT = "vh";
exports.DEFAULT_AUTO_ALIGN_HEIGHT_VALUE = 80;
exports.DEFAULT_TERMINAL_NAVIGATION_WRAP = false;
exports.DEFAULT_TERMINAL_ACTIVE_MAX_FPS = 30;
exports.DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS = 16;
exports.DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS = 1;
exports.DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS = 1000;
exports.DEFAULT_TERMINAL_VISIBLE_MAX_FPS = 12;
exports.DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS = 100;
exports.PAN_SNAP_HYSTERESIS_MAX = 400;
exports.PAN_SNAP_HYSTERESIS_MIN = 0;
exports.PAN_SNAP_RADIUS_MAX = 1600;
exports.PAN_SNAP_RADIUS_MIN = 120;
exports.PAN_SNAP_SETTLE_DELAY_MAX = 1000;
exports.PAN_SNAP_SETTLE_DELAY_MIN = 0;
exports.PAN_SNAP_STRENGTH_MAX = 1;
exports.PAN_SNAP_STRENGTH_MIN = 0;
exports.TERMINAL_MAX_FPS_MAX = 60;
exports.TERMINAL_MAX_FPS_MIN = 0;
exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MAX = 10000;
exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MIN = 0;
function createDefaultWorkspaceSnapshot() {
    return {
        viewport: { x: 0, y: 0, zoom: 1 },
        tiles: [],
        focusedTileId: undefined,
        nextTileIndex: 1,
    };
}
function clampPanSnapRadius(radius) {
    return Math.min(exports.PAN_SNAP_RADIUS_MAX, Math.max(exports.PAN_SNAP_RADIUS_MIN, Math.round(radius)));
}
function clampPanSnapHysteresis(hysteresis) {
    return Math.min(exports.PAN_SNAP_HYSTERESIS_MAX, Math.max(exports.PAN_SNAP_HYSTERESIS_MIN, Math.round(hysteresis)));
}
function clampPanSnapSettleDelay(delay) {
    return Math.min(exports.PAN_SNAP_SETTLE_DELAY_MAX, Math.max(exports.PAN_SNAP_SETTLE_DELAY_MIN, Math.round(delay)));
}
function clampPanSnapStrength(strength) {
    return Math.min(exports.PAN_SNAP_STRENGTH_MAX, Math.max(exports.PAN_SNAP_STRENGTH_MIN, Number(strength.toFixed(2))));
}
function clampPanSnapSettleStrength(strength) {
    return Math.min(exports.PAN_SNAP_STRENGTH_MAX, Math.max(exports.PAN_SNAP_STRENGTH_MIN, Number(strength.toFixed(2))));
}
function clampAutoAlignSizeValue(value, unit) {
    if (unit === "px") {
        return Math.min(4096, Math.max(16, Math.round(value)));
    }
    return Math.min(100, Math.max(1, Number(value.toFixed(2))));
}
function clampTerminalMaxFps(value) {
    return Math.min(exports.TERMINAL_MAX_FPS_MAX, Math.max(exports.TERMINAL_MAX_FPS_MIN, Number(value.toFixed(2))));
}
function clampTerminalWriteBatchIntervalMs(value) {
    return Math.min(exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MAX, Math.max(exports.TERMINAL_WRITE_BATCH_INTERVAL_MS_MIN, Math.round(value)));
}
function clampTerminalPerformanceProfile(profile) {
    return {
        maxFps: clampTerminalMaxFps(profile.maxFps),
        writeBatchIntervalMs: clampTerminalWriteBatchIntervalMs(profile.writeBatchIntervalMs),
    };
}
function clampTerminalPerformanceSettings(settings) {
    return {
        active: clampTerminalPerformanceProfile(settings.active),
        offscreen: clampTerminalPerformanceProfile(settings.offscreen),
        visible: clampTerminalPerformanceProfile(settings.visible),
    };
}
function createDefaultTerminalPerformanceSettings() {
    return {
        active: {
            maxFps: exports.DEFAULT_TERMINAL_ACTIVE_MAX_FPS,
            writeBatchIntervalMs: exports.DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS,
        },
        offscreen: {
            maxFps: exports.DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS,
            writeBatchIntervalMs: exports.DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS,
        },
        visible: {
            maxFps: exports.DEFAULT_TERMINAL_VISIBLE_MAX_FPS,
            writeBatchIntervalMs: exports.DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS,
        },
    };
}
//# sourceMappingURL=canvas-contract.js.map