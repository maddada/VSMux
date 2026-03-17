"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const node_crypto_1 = require("node:crypto");
const vscode = require("vscode");
const catSessions = {
    "Coding Cat": {
        badge: "Webview panel",
        focus: "Shipping a current VS Code webview sample with strict CSP and persisted state.",
        mode: "Focused",
        theme: "coding",
    },
    "Compiling Cat": {
        badge: "Build cycle",
        focus: "Waiting for TypeScript, linting, and the extension host to settle before the next run.",
        mode: "Patient",
        theme: "compiling",
    },
    "Testing Cat": {
        badge: "Review pass",
        focus: "Hunting regressions in the webview messaging flow and restore lifecycle.",
        mode: "Suspicious",
        theme: "testing",
    },
};
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("catCoding.start", () => {
        CatCodingPanel.createOrShow(context.extensionUri);
    }), vscode.commands.registerCommand("catCoding.doRefactor", () => {
        CatCodingPanel.currentPanel?.doRefactor();
    }), vscode.window.registerWebviewPanelSerializer(CatCodingPanel.viewType, new CatCodingSerializer(context.extensionUri)));
}
class CatCodingSerializer {
    extensionUri;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    async deserializeWebviewPanel(webviewPanel, state) {
        if (isCatCodingState(state)) {
            void state.count;
        }
        webviewPanel.webview.options = getWebviewOptions(this.extensionUri);
        CatCodingPanel.revive(webviewPanel, this.extensionUri);
    }
}
function getWebviewOptions(extensionUri) {
    return {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
    };
}
function getCatNameForColumn(column) {
    switch (column) {
        case vscode.ViewColumn.Two:
            return "Compiling Cat";
        case vscode.ViewColumn.Three:
            return "Testing Cat";
        case vscode.ViewColumn.One:
        default:
            return "Coding Cat";
    }
}
function isAlertMessage(message) {
    if (!message || typeof message !== "object") {
        return false;
    }
    const candidate = message;
    return candidate.type === "alert" && typeof candidate.text === "string";
}
function isCatCodingState(state) {
    if (!state || typeof state !== "object") {
        return false;
    }
    const candidate = state;
    return typeof candidate.count === "number";
}
class CatCodingPanel {
    static currentPanel;
    static viewType = "catCoding";
    panel;
    extensionUri;
    disposables = [];
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (CatCodingPanel.currentPanel) {
            CatCodingPanel.currentPanel.panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel(CatCodingPanel.viewType, "Cat Coding", column ?? vscode.ViewColumn.One, getWebviewOptions(extensionUri));
        CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
    }
    static revive(panel, extensionUri) {
        CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.update();
        this.panel.onDidDispose(() => {
            CatCodingPanel.currentPanel = undefined;
            this.disposeResources();
        }, undefined, this.disposables);
        this.panel.onDidChangeViewState(() => {
            if (this.panel.visible) {
                this.update();
            }
        }, undefined, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => {
            if (!isAlertMessage(message)) {
                return;
            }
            void vscode.window.showErrorMessage(message.text);
        }, undefined, this.disposables);
    }
    doRefactor() {
        const message = { type: "refactor" };
        void this.panel.webview.postMessage(message);
    }
    disposeResources() {
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
    update() {
        const catName = getCatNameForColumn(this.panel.viewColumn);
        this.panel.title = catName;
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, catName);
    }
    getHtmlForWebview(webview, catName) {
        const session = catSessions[catName];
        const scriptUri = webview
            .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "main.js"))
            .toString();
        const stylesResetUri = webview
            .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "reset.css"))
            .toString();
        const stylesMainUri = webview
            .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "vscode.css"))
            .toString();
        const catGifUri = webview
            .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "cat.gif"))
            .toString();
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta
		http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
	>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${stylesResetUri}" rel="stylesheet">
	<link href="${stylesMainUri}" rel="stylesheet">
	<title>Cat Coding</title>
</head>
<body data-cat-theme="${session.theme}">
	<main class="app">
		<section class="hero">
			<p class="eyebrow">${session.badge}</p>
			<h1>${catName}</h1>
			<p class="subtitle">${session.focus}</p>
		</section>

		<img
			class="cat-gif"
			src="${catGifUri}"
			alt="${catName} working inside the VS Code webview"
		>

		<section class="stats" aria-label="Cat coding session stats">
			<article class="stat">
				<span class="label">Lines of code</span>
				<strong id="lines-of-code-counter" aria-live="polite">0</strong>
			</article>
			<article class="stat">
				<span class="label">Current mode</span>
				<strong>${session.mode}</strong>
			</article>
		</section>

		<section class="actions">
			<button class="secondary" id="alert-button" type="button">Introduce a bug</button>
			<p class="hint">
				Run <code>Cat Coding: Do some refactoring</code> from the Command Palette to post a message from the extension host.
			</p>
		</section>
	</main>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
function getNonce() {
    return (0, node_crypto_1.randomUUID)().replace(/-/g, "");
}
//# sourceMappingURL=extension.js.map