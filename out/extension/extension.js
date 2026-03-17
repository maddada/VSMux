"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
const canvas_contract_1 = require("../shared/canvas-contract");
const browser_debug_server_1 = require("./browser-debug-server");
const terminal_session_controller_1 = require("./terminal-session-controller");
const webview_html_1 = require("./webview-html");
const BOTTOM_PANEL_CONTAINER_ID = "agentCanvasXPanel";
const BOTTOM_PANEL_VIEW_ID = "agentCanvasX.bottomPanel";
const BROWSER_DEBUG_BOTTOM_PANEL_INACTIVE_MESSAGE = "Canvas moved to bottom panel.";
const BROWSER_DEBUG_INACTIVE_MESSAGE = "Canvas moved to browser debug host.";
const BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE = "Canvas moved to editor panel.";
const PANEL_TITLE = "Agent Canvas X";
const PANEL_VIEW_TYPE = "agentCanvasX.canvas";
const WORKSPACE_SNAPSHOT_KEY = "agentCanvasX.workspaceSnapshot";
function activate(context) {
    const controller = new CanvasHostController(context);
    context.subscriptions.push(controller, vscode.commands.registerCommand("agentCanvasX.openCanvasPanel", () => {
        void controller.openCanvasPanel();
    }), vscode.commands.registerCommand("agentCanvasX.openCanvasBrowserDebug", () => {
        void controller.openCanvasBrowserDebug();
    }), vscode.commands.registerCommand("agentCanvasX.revealCanvasBottomPanel", () => {
        void controller.revealCanvasBottomPanel();
    }), vscode.commands.registerCommand("agentCanvasX.moveCanvasToPanel", () => {
        void controller.moveCanvasToPanel();
    }), vscode.commands.registerCommand("agentCanvasX.moveCanvasToBottomPanel", () => {
        void controller.moveCanvasToBottomPanel();
    }), vscode.commands.registerCommand("agentCanvasX.resetCanvasAndTerminals", () => {
        void controller.resetCanvasAndTerminals();
    }), vscode.window.registerWebviewPanelSerializer(PANEL_VIEW_TYPE, controller), vscode.window.registerWebviewViewProvider(BOTTOM_PANEL_VIEW_ID, controller), vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration("agentCanvasX.autoAlignWidthUnit") &&
            !event.affectsConfiguration("agentCanvasX.autoAlignWidthValue") &&
            !event.affectsConfiguration("agentCanvasX.autoAlignHeightUnit") &&
            !event.affectsConfiguration("agentCanvasX.autoAlignHeightValue") &&
            !event.affectsConfiguration("agentCanvasX.panMode") &&
            !event.affectsConfiguration("agentCanvasX.panSnapHysteresis") &&
            !event.affectsConfiguration("agentCanvasX.panSnapRadius") &&
            !event.affectsConfiguration("agentCanvasX.panSnapSettleDelay") &&
            !event.affectsConfiguration("agentCanvasX.panSnapSettleStrength") &&
            !event.affectsConfiguration("agentCanvasX.panSnapStrength") &&
            !event.affectsConfiguration("agentCanvasX.terminalNavigationWrap") &&
            !event.affectsConfiguration("agentCanvasX.terminalActiveMaxFps") &&
            !event.affectsConfiguration("agentCanvasX.terminalActiveWriteBatchIntervalMs") &&
            !event.affectsConfiguration("agentCanvasX.terminalVisibleMaxFps") &&
            !event.affectsConfiguration("agentCanvasX.terminalVisibleWriteBatchIntervalMs") &&
            !event.affectsConfiguration("agentCanvasX.terminalOffscreenMaxFps") &&
            !event.affectsConfiguration("agentCanvasX.terminalOffscreenWriteBatchIntervalMs") &&
            !event.affectsConfiguration("agentCanvasX.uiScale") &&
            !event.affectsConfiguration("agentCanvasX.terminalFontFamily") &&
            !event.affectsConfiguration("agentCanvasX.themeMode")) {
            return;
        }
        void controller.postHydrate();
    }));
}
class CanvasHostController {
    context;
    activeHostKind;
    bottomPanelDisposables = [];
    bottomPanelView;
    browserDebugServer;
    panel;
    panelDisposables = [];
    pendingBottomPanelDeactivationMessage;
    terminalSessions;
    workspaceSnapshot;
    constructor(context) {
        this.context = context;
        this.workspaceSnapshot = this.loadSnapshot();
        this.terminalSessions = new terminal_session_controller_1.TerminalSessionController({
            context,
            postMessage: async (message) => this.postMessage(message),
        });
        this.browserDebugServer = new browser_debug_server_1.BrowserDebugServer({
            extensionUri: context.extensionUri,
            onMessage: (message) => {
                if (!isWebviewMessage(message)) {
                    return;
                }
                void this.handleMessageFromHost("browser", message);
            },
        });
    }
    dispose() {
        void this.terminalSessions.handleHostDetached();
        this.disposeBottomPanelHost();
        this.disposePanelHost();
        this.browserDebugServer.dispose();
        this.terminalSessions.dispose();
    }
    async openCanvasPanel() {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (this.panel) {
            if (this.activeHostKind === "bottomPanel") {
                this.pendingBottomPanelDeactivationMessage = BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE;
            }
            if (this.activeHostKind === "browser") {
                this.browserDebugServer.setHostInactive(BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE);
            }
            this.activeHostKind = "panel";
            this.panel.title = PANEL_TITLE;
            this.panel.reveal(column);
            await this.postHydrate();
            return;
        }
        if (this.activeHostKind === "bottomPanel") {
            this.pendingBottomPanelDeactivationMessage = BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE;
        }
        if (this.activeHostKind === "browser") {
            this.browserDebugServer.setHostInactive(BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE);
        }
        const panel = vscode.window.createWebviewPanel(PANEL_VIEW_TYPE, PANEL_TITLE, column, this.getWebviewOptions());
        this.panel = panel;
        this.activeHostKind = "panel";
        this.registerPanel(panel);
        await this.render(panel.webview);
    }
    async openCanvasBrowserDebug() {
        const browserDebugUrl = await this.browserDebugServer.ensureStarted();
        this.activeHostKind = "browser";
        this.browserDebugServer.setHostActive();
        if (this.panel) {
            this.panel.dispose();
        }
        if (this.bottomPanelView) {
            this.deactivateBottomPanelHost(BROWSER_DEBUG_INACTIVE_MESSAGE);
        }
        await vscode.env.openExternal(vscode.Uri.parse(browserDebugUrl));
        void vscode.window.showInformationMessage(`Agent Canvas X browser debug host ready at ${browserDebugUrl}`);
    }
    async moveCanvasToBottomPanel() {
        await this.revealCanvasBottomPanel();
    }
    async moveCanvasToPanel() {
        await this.openCanvasPanel();
    }
    async resetCanvasAndTerminals() {
        const confirmation = await vscode.window.showWarningMessage("Reset Agent Canvas X canvas and terminals?", {
            detail: "This clears the saved canvas layout for the current workspace and closes every Agent Canvas X shell session tied to it.",
            modal: true,
        }, "Reset");
        if (!confirmation) {
            return;
        }
        try {
            await this.terminalSessions.resetWorkspace();
            this.workspaceSnapshot = (0, canvas_contract_1.createDefaultWorkspaceSnapshot)();
            this.persistSnapshot();
            await this.postHydrate();
            void vscode.window.showInformationMessage("Agent Canvas X canvas and terminals reset.");
        }
        catch (error) {
            void vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }
    async revealCanvasBottomPanel() {
        await vscode.commands.executeCommand(`workbench.view.extension.${BOTTOM_PANEL_CONTAINER_ID}`);
        if (!this.bottomPanelView) {
            return;
        }
        await this.activateBottomPanelHost();
        this.bottomPanelView.show(false);
    }
    async deserializeWebviewPanel(webviewPanel, state) {
        if (state) {
            this.workspaceSnapshot = state;
            this.persistSnapshot();
        }
        if (this.activeHostKind === "bottomPanel") {
            this.pendingBottomPanelDeactivationMessage = "Canvas restored in editor panel.";
        }
        if (this.activeHostKind === "browser") {
            this.browserDebugServer.setHostInactive(BROWSER_DEBUG_PANEL_INACTIVE_MESSAGE);
        }
        this.panel = webviewPanel;
        this.activeHostKind = "panel";
        webviewPanel.title = PANEL_TITLE;
        webviewPanel.webview.options = this.getWebviewOptions();
        this.registerPanel(webviewPanel);
        await this.render(webviewPanel.webview);
    }
    async resolveWebviewView(webviewView, _context, _token) {
        this.bottomPanelView = webviewView;
        webviewView.title = "Canvas";
        webviewView.webview.options = this.getWebviewOptions();
        this.registerBottomPanelView(webviewView);
        if (this.activeHostKind === "browser") {
            this.deactivateBottomPanelHost(BROWSER_DEBUG_INACTIVE_MESSAGE);
            return;
        }
        await this.activateBottomPanelHost();
    }
    async postHydrate() {
        const assetUris = this.getActiveAssetUris();
        if (!assetUris) {
            return;
        }
        try {
            await this.terminalSessions.initialize();
            await this.terminalSessions.reconcileSnapshot(this.workspaceSnapshot);
        }
        catch (error) {
            void vscode.window.showErrorMessage(getErrorMessage(error));
        }
        await this.postMessage({
            type: "hydrate",
            assetUris,
            settings: this.getUiSettings(),
            snapshot: this.workspaceSnapshot,
            terminalSessions: this.terminalSessions.getSessionsByTileId(),
        });
        if (this.activeHostKind === "panel") {
            this.finalizeBottomPanelDeactivation();
            return;
        }
        if (this.activeHostKind === "browser") {
            this.browserDebugServer.setHostActive();
        }
    }
    async activateBottomPanelHost() {
        const bottomPanelView = this.bottomPanelView;
        if (!bottomPanelView) {
            return;
        }
        if (this.activeHostKind === "panel") {
            this.panel?.dispose();
        }
        if (this.activeHostKind === "browser") {
            this.browserDebugServer.setHostInactive(BROWSER_DEBUG_BOTTOM_PANEL_INACTIVE_MESSAGE);
        }
        this.activeHostKind = "bottomPanel";
        await this.render(bottomPanelView.webview);
    }
    deactivateBottomPanelHost(message) {
        if (!this.bottomPanelView) {
            return;
        }
        if (this.activeHostKind === "bottomPanel") {
            this.activeHostKind = undefined;
        }
        this.bottomPanelView.webview.html = getInactiveHostHtml(this.bottomPanelView.webview, message, "Run `Agent Canvas X: Move Canvas to Bottom Panel` to reattach here.");
    }
    finalizeBottomPanelDeactivation() {
        const message = this.pendingBottomPanelDeactivationMessage;
        if (!message || !this.bottomPanelView) {
            return;
        }
        this.pendingBottomPanelDeactivationMessage = undefined;
        this.deactivateBottomPanelHost(message);
    }
    disposeBottomPanelHost() {
        while (this.bottomPanelDisposables.length > 0) {
            this.bottomPanelDisposables.pop()?.dispose();
        }
        this.bottomPanelView = undefined;
        if (this.activeHostKind === "bottomPanel") {
            this.activeHostKind = undefined;
            void this.terminalSessions.handleHostDetached();
        }
    }
    disposePanelHost() {
        while (this.panelDisposables.length > 0) {
            this.panelDisposables.pop()?.dispose();
        }
        this.panel = undefined;
        if (this.activeHostKind === "panel") {
            this.activeHostKind = undefined;
            void this.terminalSessions.handleHostDetached();
        }
    }
    getActiveWebview() {
        if (this.activeHostKind === "panel") {
            return this.panel?.webview;
        }
        if (this.activeHostKind === "bottomPanel") {
            return this.bottomPanelView?.webview;
        }
        return undefined;
    }
    getActiveAssetUris() {
        if (this.activeHostKind === "browser") {
            const serverOrigin = this.browserDebugServer.getServerOrigin();
            return serverOrigin
                ? (0, webview_html_1.getCanvasBrowserAssetUris)(serverOrigin, this.browserDebugServer.getBridgeToken())
                : undefined;
        }
        const activeWebview = this.getActiveWebview();
        if (!activeWebview) {
            return undefined;
        }
        return (0, webview_html_1.getCanvasAssetUris)({
            extensionUri: this.context.extensionUri,
            webview: activeWebview,
        });
    }
    getUiSettings() {
        const configuration = vscode.workspace.getConfiguration("agentCanvasX");
        const configuredAutoAlignWidthUnit = configuration.get("autoAlignWidthUnit", canvas_contract_1.DEFAULT_AUTO_ALIGN_WIDTH_UNIT);
        const configuredAutoAlignWidthValue = configuration.get("autoAlignWidthValue", canvas_contract_1.DEFAULT_AUTO_ALIGN_WIDTH_VALUE);
        const configuredAutoAlignHeightUnit = configuration.get("autoAlignHeightUnit", canvas_contract_1.DEFAULT_AUTO_ALIGN_HEIGHT_UNIT);
        const configuredAutoAlignHeightValue = configuration.get("autoAlignHeightValue", canvas_contract_1.DEFAULT_AUTO_ALIGN_HEIGHT_VALUE);
        const configuredPanMode = configuration.get("panMode", canvas_contract_1.DEFAULT_PAN_MODE);
        const configuredPanSnapHysteresis = configuration.get("panSnapHysteresis", canvas_contract_1.DEFAULT_PAN_SNAP_HYSTERESIS);
        const configuredPanSnapRadius = configuration.get("panSnapRadius", canvas_contract_1.DEFAULT_PAN_SNAP_RADIUS);
        const configuredPanSnapSettleDelay = configuration.get("panSnapSettleDelay", canvas_contract_1.DEFAULT_PAN_SNAP_SETTLE_DELAY);
        const configuredPanSnapSettleStrength = configuration.get("panSnapSettleStrength", canvas_contract_1.DEFAULT_PAN_SNAP_SETTLE_STRENGTH);
        const configuredPanSnapStrength = configuration.get("panSnapStrength", canvas_contract_1.DEFAULT_PAN_SNAP_STRENGTH);
        const configuredTerminalNavigationWrap = configuration.get("terminalNavigationWrap", canvas_contract_1.DEFAULT_TERMINAL_NAVIGATION_WRAP);
        const terminalPerformance = (0, canvas_contract_1.clampTerminalPerformanceSettings)({
            active: {
                maxFps: configuration.get("terminalActiveMaxFps", canvas_contract_1.DEFAULT_TERMINAL_ACTIVE_MAX_FPS),
                writeBatchIntervalMs: configuration.get("terminalActiveWriteBatchIntervalMs", canvas_contract_1.DEFAULT_TERMINAL_ACTIVE_WRITE_BATCH_INTERVAL_MS),
            },
            offscreen: {
                maxFps: configuration.get("terminalOffscreenMaxFps", canvas_contract_1.DEFAULT_TERMINAL_OFFSCREEN_MAX_FPS),
                writeBatchIntervalMs: configuration.get("terminalOffscreenWriteBatchIntervalMs", canvas_contract_1.DEFAULT_TERMINAL_OFFSCREEN_WRITE_BATCH_INTERVAL_MS),
            },
            visible: {
                maxFps: configuration.get("terminalVisibleMaxFps", canvas_contract_1.DEFAULT_TERMINAL_VISIBLE_MAX_FPS),
                writeBatchIntervalMs: configuration.get("terminalVisibleWriteBatchIntervalMs", canvas_contract_1.DEFAULT_TERMINAL_VISIBLE_WRITE_BATCH_INTERVAL_MS),
            },
        });
        const configuredScale = configuration.get("uiScale", 0.6);
        const configuredTerminalFontFamily = configuration.get("terminalFontFamily", canvas_contract_1.DEFAULT_TERMINAL_FONT_FAMILY)?.trim() ?? "";
        const configuredThemeMode = configuration.get("themeMode", "light");
        return {
            autoAlignHeightUnit: configuredAutoAlignHeightUnit === "px" ? "px" : "vh",
            autoAlignHeightValue: (0, canvas_contract_1.clampAutoAlignSizeValue)(configuredAutoAlignHeightValue, configuredAutoAlignHeightUnit === "px" ? "px" : "vh"),
            autoAlignWidthUnit: configuredAutoAlignWidthUnit === "px" ? "px" : "vw",
            autoAlignWidthValue: (0, canvas_contract_1.clampAutoAlignSizeValue)(configuredAutoAlignWidthValue, configuredAutoAlignWidthUnit === "px" ? "px" : "vw"),
            panMode: configuredPanMode === "sticky" ? "sticky" : "free",
            panSnapHysteresis: (0, canvas_contract_1.clampPanSnapHysteresis)(configuredPanSnapHysteresis),
            panSnapRadius: (0, canvas_contract_1.clampPanSnapRadius)(configuredPanSnapRadius),
            panSnapSettleDelay: (0, canvas_contract_1.clampPanSnapSettleDelay)(configuredPanSnapSettleDelay),
            panSnapSettleStrength: (0, canvas_contract_1.clampPanSnapSettleStrength)(configuredPanSnapSettleStrength),
            panSnapStrength: (0, canvas_contract_1.clampPanSnapStrength)(configuredPanSnapStrength),
            terminalNavigationWrap: configuredTerminalNavigationWrap,
            terminalPerformance,
            terminalFontFamily: configuredTerminalFontFamily || canvas_contract_1.DEFAULT_TERMINAL_FONT_FAMILY,
            themeMode: configuredThemeMode === "dark" ? "dark" : "light",
            uiScale: Math.min(1.5, Math.max(0.25, Number(configuredScale.toFixed(2)))),
        };
    }
    getWebviewOptions() {
        return {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
    }
    async handleMessageFromHost(hostKind, message) {
        const isActiveHost = hostKind === this.activeHostKind;
        if (!isActiveHost) {
            return;
        }
        switch (message.type) {
            case "ready":
                await this.postHydrate();
                return;
            case "updateAutoAlignSize":
                await this.updateAutoAlignSize(message.autoAlignWidthValue, message.autoAlignWidthUnit, message.autoAlignHeightValue, message.autoAlignHeightUnit);
                return;
            case "updatePanBehavior":
                await this.updatePanBehavior(message.panMode, message.panSnapHysteresis, message.panSnapStrength, message.panSnapRadius, message.panSnapSettleStrength, message.panSnapSettleDelay);
                return;
            case "updateTerminalNavigation":
                await this.updateTerminalNavigation(message.terminalNavigationWrap);
                return;
            case "updateUiScale":
                await this.updateUiScale(message.uiScale);
                return;
            case "updateThemeMode":
                await this.updateThemeMode(message.themeMode);
                return;
            case "updateTerminalPerformance":
                await this.updateTerminalPerformance(message.terminalPerformance);
                return;
            case "workspaceSnapshot":
                this.workspaceSnapshot = message.snapshot;
                this.persistSnapshot();
                await this.reconcileTerminalSessions(message.snapshot);
                return;
            case "notify":
                await vscode.window.showInformationMessage(message.message);
                return;
            case "restartTerminal":
                await this.restartTerminalSession(message.tileId);
                return;
            case "terminalInput":
                await this.terminalSessions.handleInput(message.tileId, message.data);
                return;
            case "terminalResize":
                this.terminalSessions.handleResize(message.tileId, message.cols, message.rows);
                return;
        }
    }
    loadSnapshot() {
        return (this.context.workspaceState.get(WORKSPACE_SNAPSHOT_KEY) ??
            (0, canvas_contract_1.createDefaultWorkspaceSnapshot)());
    }
    persistSnapshot() {
        void this.context.workspaceState.update(WORKSPACE_SNAPSHOT_KEY, this.workspaceSnapshot);
    }
    async postMessage(message) {
        if (this.activeHostKind === "browser") {
            return this.browserDebugServer.postMessage(message);
        }
        const activeWebview = this.getActiveWebview();
        if (!activeWebview) {
            return false;
        }
        return activeWebview.postMessage(message);
    }
    async reconcileTerminalSessions(snapshot) {
        try {
            await this.terminalSessions.reconcileSnapshot(snapshot);
        }
        catch (error) {
            void vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }
    registerBottomPanelView(webviewView) {
        while (this.bottomPanelDisposables.length > 0) {
            this.bottomPanelDisposables.pop()?.dispose();
        }
        webviewView.onDidDispose(() => {
            if (this.bottomPanelView === webviewView) {
                this.persistSnapshot();
                this.bottomPanelView = undefined;
                if (this.activeHostKind === "bottomPanel") {
                    this.activeHostKind = undefined;
                    void this.terminalSessions.handleHostDetached();
                }
            }
            this.disposeBottomPanelHost();
        }, undefined, this.bottomPanelDisposables);
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                if (this.activeHostKind === "browser") {
                    this.deactivateBottomPanelHost(BROWSER_DEBUG_INACTIVE_MESSAGE);
                    return;
                }
                void this.activateBottomPanelHost();
                return;
            }
            if (this.activeHostKind === "bottomPanel" && this.bottomPanelView === webviewView) {
                this.persistSnapshot();
                this.activeHostKind = undefined;
                void this.terminalSessions.handleHostDetached();
            }
        }, undefined, this.bottomPanelDisposables);
        webviewView.webview.onDidReceiveMessage((message) => {
            if (!isWebviewMessage(message)) {
                return;
            }
            void this.handleMessageFromHost("bottomPanel", message);
        }, undefined, this.bottomPanelDisposables);
    }
    registerPanel(panel) {
        while (this.panelDisposables.length > 0) {
            this.panelDisposables.pop()?.dispose();
        }
        panel.onDidDispose(() => {
            if (this.panel === panel) {
                this.persistSnapshot();
                this.panel = undefined;
                if (this.activeHostKind === "panel") {
                    this.activeHostKind = undefined;
                    void this.terminalSessions.handleHostDetached();
                }
            }
            this.disposePanelHost();
        }, undefined, this.panelDisposables);
        panel.webview.onDidReceiveMessage((message) => {
            if (!isWebviewMessage(message)) {
                return;
            }
            void this.handleMessageFromHost("panel", message);
        }, undefined, this.panelDisposables);
    }
    async render(webview) {
        webview.html = await (0, webview_html_1.getCanvasWebviewHtml)({
            extensionUri: this.context.extensionUri,
            webview,
        });
    }
    async restartTerminalSession(tileId) {
        try {
            await this.terminalSessions.handleRestart(tileId, this.workspaceSnapshot);
        }
        catch (error) {
            void vscode.window.showErrorMessage(getErrorMessage(error));
        }
    }
    async updateUiScale(uiScale) {
        const nextScale = Math.min(1.5, Math.max(0.25, Number(uiScale.toFixed(2))));
        await vscode.workspace
            .getConfiguration("agentCanvasX")
            .update("uiScale", nextScale, vscode.ConfigurationTarget.Global);
    }
    async updateAutoAlignSize(autoAlignWidthValue, autoAlignWidthUnit, autoAlignHeightValue, autoAlignHeightUnit) {
        const configuration = vscode.workspace.getConfiguration("agentCanvasX");
        const nextAutoAlignWidthUnit = autoAlignWidthUnit === "px" ? "px" : "vw";
        const nextAutoAlignHeightUnit = autoAlignHeightUnit === "px" ? "px" : "vh";
        await Promise.all([
            configuration.update("autoAlignWidthUnit", nextAutoAlignWidthUnit, vscode.ConfigurationTarget.Global),
            configuration.update("autoAlignWidthValue", (0, canvas_contract_1.clampAutoAlignSizeValue)(autoAlignWidthValue, nextAutoAlignWidthUnit), vscode.ConfigurationTarget.Global),
            configuration.update("autoAlignHeightUnit", nextAutoAlignHeightUnit, vscode.ConfigurationTarget.Global),
            configuration.update("autoAlignHeightValue", (0, canvas_contract_1.clampAutoAlignSizeValue)(autoAlignHeightValue, nextAutoAlignHeightUnit), vscode.ConfigurationTarget.Global),
        ]);
    }
    async updatePanBehavior(panMode, panSnapHysteresis, panSnapStrength, panSnapRadius, panSnapSettleStrength, panSnapSettleDelay) {
        const configuration = vscode.workspace.getConfiguration("agentCanvasX");
        await Promise.all([
            configuration.update("panMode", panMode === "sticky" ? "sticky" : "free", vscode.ConfigurationTarget.Global),
            configuration.update("panSnapHysteresis", (0, canvas_contract_1.clampPanSnapHysteresis)(panSnapHysteresis), vscode.ConfigurationTarget.Global),
            configuration.update("panSnapStrength", (0, canvas_contract_1.clampPanSnapStrength)(panSnapStrength), vscode.ConfigurationTarget.Global),
            configuration.update("panSnapRadius", (0, canvas_contract_1.clampPanSnapRadius)(panSnapRadius), vscode.ConfigurationTarget.Global),
            configuration.update("panSnapSettleStrength", (0, canvas_contract_1.clampPanSnapSettleStrength)(panSnapSettleStrength), vscode.ConfigurationTarget.Global),
            configuration.update("panSnapSettleDelay", (0, canvas_contract_1.clampPanSnapSettleDelay)(panSnapSettleDelay), vscode.ConfigurationTarget.Global),
        ]);
    }
    async updateThemeMode(themeMode) {
        await vscode.workspace
            .getConfiguration("agentCanvasX")
            .update("themeMode", themeMode === "dark" ? "dark" : "light", vscode.ConfigurationTarget.Global);
    }
    async updateTerminalNavigation(terminalNavigationWrap) {
        await vscode.workspace
            .getConfiguration("agentCanvasX")
            .update("terminalNavigationWrap", terminalNavigationWrap, vscode.ConfigurationTarget.Global);
    }
    async updateTerminalPerformance(terminalPerformance) {
        const configuration = vscode.workspace.getConfiguration("agentCanvasX");
        const nextTerminalPerformance = (0, canvas_contract_1.clampTerminalPerformanceSettings)(terminalPerformance);
        await Promise.all([
            configuration.update("terminalActiveMaxFps", nextTerminalPerformance.active.maxFps, vscode.ConfigurationTarget.Global),
            configuration.update("terminalActiveWriteBatchIntervalMs", nextTerminalPerformance.active.writeBatchIntervalMs, vscode.ConfigurationTarget.Global),
            configuration.update("terminalVisibleMaxFps", nextTerminalPerformance.visible.maxFps, vscode.ConfigurationTarget.Global),
            configuration.update("terminalVisibleWriteBatchIntervalMs", nextTerminalPerformance.visible.writeBatchIntervalMs, vscode.ConfigurationTarget.Global),
            configuration.update("terminalOffscreenMaxFps", nextTerminalPerformance.offscreen.maxFps, vscode.ConfigurationTarget.Global),
            configuration.update("terminalOffscreenWriteBatchIntervalMs", nextTerminalPerformance.offscreen.writeBatchIntervalMs, vscode.ConfigurationTarget.Global),
        ]);
    }
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function getInactiveHostHtml(webview, title, description) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PANEL_TITLE}</title>
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
      }

      .card {
        max-width: 520px;
        border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35));
        border-radius: 20px;
        padding: 20px 22px;
        background: color-mix(in srgb, var(--vscode-editor-background) 92%, white 8%);
      }

      h1 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      p {
        margin: 0;
        line-height: 1.5;
        color: var(--vscode-descriptionForeground, var(--vscode-editor-foreground));
      }

      code {
        font-family: var(--vscode-editor-font-family);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${description}</p>
    </div>
  </body>
</html>`;
}
function isWebviewMessage(message) {
    if (!message || typeof message !== "object") {
        return false;
    }
    const candidate = message;
    if (candidate.type === "ready") {
        return true;
    }
    if (candidate.type === "updateAutoAlignSize") {
        return ((candidate.autoAlignWidthUnit === "px" || candidate.autoAlignWidthUnit === "vw") &&
            typeof candidate.autoAlignWidthValue === "number" &&
            Number.isFinite(candidate.autoAlignWidthValue) &&
            (candidate.autoAlignHeightUnit === "px" || candidate.autoAlignHeightUnit === "vh") &&
            typeof candidate.autoAlignHeightValue === "number" &&
            Number.isFinite(candidate.autoAlignHeightValue));
    }
    if (candidate.type === "updateTerminalNavigation") {
        return typeof candidate.terminalNavigationWrap === "boolean";
    }
    if (candidate.type === "updateUiScale") {
        return typeof candidate.uiScale === "number" && Number.isFinite(candidate.uiScale);
    }
    if (candidate.type === "updatePanBehavior") {
        return ((candidate.panMode === "free" || candidate.panMode === "sticky") &&
            typeof candidate.panSnapHysteresis === "number" &&
            Number.isFinite(candidate.panSnapHysteresis) &&
            typeof candidate.panSnapStrength === "number" &&
            Number.isFinite(candidate.panSnapStrength) &&
            typeof candidate.panSnapRadius === "number" &&
            Number.isFinite(candidate.panSnapRadius) &&
            typeof candidate.panSnapSettleStrength === "number" &&
            Number.isFinite(candidate.panSnapSettleStrength) &&
            typeof candidate.panSnapSettleDelay === "number" &&
            Number.isFinite(candidate.panSnapSettleDelay));
    }
    if (candidate.type === "updateThemeMode") {
        return candidate.themeMode === "light" || candidate.themeMode === "dark";
    }
    if (candidate.type === "updateTerminalPerformance") {
        return isTerminalPerformanceSettings(candidate.terminalPerformance);
    }
    if (candidate.type === "notify") {
        return typeof candidate.message === "string";
    }
    if (candidate.type === "restartTerminal") {
        return typeof candidate.tileId === "string" && candidate.tileId.length > 0;
    }
    if (candidate.type === "terminalInput") {
        return (typeof candidate.tileId === "string" &&
            typeof candidate.data === "string" &&
            candidate.data.length > 0);
    }
    if (candidate.type === "terminalResize") {
        return (typeof candidate.tileId === "string" &&
            typeof candidate.cols === "number" &&
            Number.isFinite(candidate.cols) &&
            typeof candidate.rows === "number" &&
            Number.isFinite(candidate.rows));
    }
    return (candidate.type === "workspaceSnapshot" &&
        !!candidate.snapshot &&
        typeof candidate.snapshot === "object");
}
function isTerminalPerformanceSettings(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (isTerminalPerformanceProfile(candidate.active) &&
        isTerminalPerformanceProfile(candidate.visible) &&
        isTerminalPerformanceProfile(candidate.offscreen));
}
function isTerminalPerformanceProfile(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return (typeof candidate.maxFps === "number" &&
        Number.isFinite(candidate.maxFps) &&
        typeof candidate.writeBatchIntervalMs === "number" &&
        Number.isFinite(candidate.writeBatchIntervalMs));
}
//# sourceMappingURL=extension.js.map