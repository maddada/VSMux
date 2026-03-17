"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCanvasWebviewHtml = getCanvasWebviewHtml;
exports.getCanvasBrowserHtml = getCanvasBrowserHtml;
exports.getCanvasBuildAssetPaths = getCanvasBuildAssetPaths;
exports.getCanvasAssetUris = getCanvasAssetUris;
exports.getCanvasBrowserAssetUris = getCanvasBrowserAssetUris;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const vscode = require("vscode");
async function getCanvasWebviewHtml({ extensionUri, webview, }) {
    const { scriptUri, styleUri } = getCanvasBuildAssetPaths(extensionUri);
    const extraScripts = await getCanvasExtraScripts(extensionUri);
    const scriptSource = webview.asWebviewUri(scriptUri).toString();
    const styleSource = webview.asWebviewUri(styleUri).toString();
    if (!(await webviewBuildExists(extensionUri))) {
        return getMissingBuildHtml();
    }
    const nonce = getNonce();
    const extraScriptMarkup = renderExtraWebviewScripts(extraScripts, extensionUri, nonce, webview);
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; font-src ${webview.cspSource}; connect-src ${webview.cspSource}; worker-src blob:;"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleSource}" />
    <title>Agent Canvas X</title>
    ${extraScriptMarkup}
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptSource}"></script>
  </body>
</html>`;
}
async function getCanvasBrowserHtml({ bridgeToken, extensionUri, serverOrigin, }) {
    if (!(await webviewBuildExists(extensionUri))) {
        return getMissingBuildHtml();
    }
    const bootstrapScript = getBrowserBridgeBootstrapScript(bridgeToken);
    const assetQuery = `?token=${encodeURIComponent(bridgeToken)}`;
    const extraScripts = await getCanvasExtraScripts(extensionUri);
    const extraScriptMarkup = renderExtraBrowserScripts(extraScripts, bridgeToken, serverOrigin);
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${serverOrigin}/assets/index.css${assetQuery}" />
    <title>Agent Canvas X</title>
    ${extraScriptMarkup}
  </head>
  <body>
    <div id="root"></div>
    <script>${bootstrapScript}</script>
    <script type="module" src="${serverOrigin}/assets/index.js${assetQuery}"></script>
  </body>
</html>`;
}
function getCanvasBuildAssetPaths(extensionUri) {
    const buildRoot = vscode.Uri.joinPath(extensionUri, "dist", "webview");
    const assetsRoot = vscode.Uri.joinPath(buildRoot, "assets");
    return {
        htmlUri: vscode.Uri.joinPath(buildRoot, "index.html"),
        assetsRoot,
        ghosttyWasmUri: vscode.Uri.joinPath(assetsRoot, "ghostty-vt.wasm"),
        scriptUri: vscode.Uri.joinPath(assetsRoot, "index.js"),
        styleUri: vscode.Uri.joinPath(assetsRoot, "index.css"),
    };
}
async function webviewBuildExists(extensionUri) {
    const { htmlUri, scriptUri, styleUri } = getCanvasBuildAssetPaths(extensionUri);
    try {
        await Promise.all([(0, promises_1.access)(htmlUri.fsPath), (0, promises_1.access)(scriptUri.fsPath), (0, promises_1.access)(styleUri.fsPath)]);
        return true;
    }
    catch {
        return false;
    }
}
async function getCanvasExtraScripts(extensionUri) {
    const { htmlUri } = getCanvasBuildAssetPaths(extensionUri);
    const htmlContents = await (0, promises_1.readFile)(htmlUri.fsPath, "utf8");
    const scriptMatches = [...htmlContents.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    const extraScripts = [];
    for (const match of scriptMatches) {
        const attributes = match[1] ?? "";
        const content = match[2] ?? "";
        const sourceMatch = attributes.match(/\ssrc="([^"]+)"/);
        const sourcePath = sourceMatch?.[1];
        if (sourcePath) {
            if (sourcePath.endsWith("/assets/index.js") || sourcePath.endsWith("assets/index.js")) {
                continue;
            }
            extraScripts.push({
                attributes: attributes.replace(/\ssrc="[^"]+"/, "").trim(),
                kind: "external",
                path: sourcePath,
            });
            continue;
        }
        if (content.trim().length === 0) {
            continue;
        }
        extraScripts.push({
            content,
            kind: "inline",
        });
    }
    return extraScripts;
}
function renderExtraWebviewScripts(scripts, extensionUri, nonce, webview) {
    return scripts
        .map((script) => {
        if (script.kind === "inline") {
            return `<script nonce="${nonce}">${script.content}</script>`;
        }
        const source = webview.asWebviewUri(getBuiltAssetUri(extensionUri, script.path)).toString();
        const attributes = script.attributes ? ` ${script.attributes}` : "";
        return `<script nonce="${nonce}"${attributes} src="${source}"></script>`;
    })
        .join("\n    ");
}
function renderExtraBrowserScripts(scripts, bridgeToken, serverOrigin) {
    const assetQuery = `?token=${encodeURIComponent(bridgeToken)}`;
    return scripts
        .map((script) => {
        if (script.kind === "inline") {
            return `<script>${script.content}</script>`;
        }
        const source = `${serverOrigin}/${normalizeBuildAssetPath(script.path)}${assetQuery}`;
        const attributes = script.attributes ? ` ${script.attributes}` : "";
        return `<script${attributes} src="${source}"></script>`;
    })
        .join("\n    ");
}
function getBuiltAssetUri(extensionUri, assetPath) {
    return vscode.Uri.joinPath(extensionUri, "dist", "webview", normalizeBuildAssetPath(assetPath));
}
function normalizeBuildAssetPath(assetPath) {
    return assetPath.replace(/^[./]+/, "");
}
function getCanvasAssetUris({ extensionUri, webview, }) {
    const { ghosttyWasmUri } = getCanvasBuildAssetPaths(extensionUri);
    return {
        ghosttyWasm: webview.asWebviewUri(ghosttyWasmUri).toString(),
    };
}
function getCanvasBrowserAssetUris(serverOrigin, bridgeToken) {
    return {
        ghosttyWasm: `${serverOrigin}/assets/ghostty-vt.wasm?token=${encodeURIComponent(bridgeToken)}`,
    };
}
function getMissingBuildHtml() {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Canvas X</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
      }

      code {
        font-family: var(--vscode-editor-font-family);
      }
    </style>
  </head>
  <body>
    <h1>Webview Build Missing</h1>
    <p>Run <code>vp build --config vite.webview.config.ts</code> to generate the webview assets.</p>
  </body>
</html>`;
}
function getBrowserBridgeBootstrapScript(bridgeToken) {
    const bridgeTokenSource = JSON.stringify(bridgeToken);
    const bridgeStorageKeySource = JSON.stringify("agentCanvasX.browserDebugState");
    const bridgeStatusTypeSource = JSON.stringify("__agentCanvasXBridgeStatus");
    const bridgeReadyMessageSource = JSON.stringify({ type: "ready" });
    return `
(() => {
  const bridgeToken = ${bridgeTokenSource};
  const bridgeStorageKey = ${bridgeStorageKeySource};
  const bridgeStatusType = ${bridgeStatusTypeSource};
  const readyMessage = ${bridgeReadyMessageSource};
  const queuedMessages = [];
  let bridgeState;
  let eventSource = undefined;
  let reconnectTimer = undefined;
  let shouldReconnect = true;

  try {
    const rawState = window.localStorage.getItem(bridgeStorageKey);
    bridgeState = rawState ? JSON.parse(rawState) : undefined;
  } catch {
    bridgeState = undefined;
  }

  const statusElement = document.createElement("div");
  statusElement.setAttribute("data-agent-canvas-browser-status", "true");
  statusElement.style.position = "fixed";
  statusElement.style.right = "16px";
  statusElement.style.bottom = "16px";
  statusElement.style.zIndex = "9999";
  statusElement.style.maxWidth = "320px";
  statusElement.style.padding = "10px 14px";
  statusElement.style.borderRadius = "999px";
  statusElement.style.background = "rgba(18,20,23,0.92)";
  statusElement.style.color = "#f5f5f4";
  statusElement.style.font = "500 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  statusElement.style.boxShadow = "0 6px 24px rgba(0,0,0,0.22)";
  statusElement.style.display = "none";
  document.body.append(statusElement);

  const dispatchBridgeStatus = (status, message) => {
    window.dispatchEvent(new MessageEvent("message", {
      data: {
        message,
        status,
        type: bridgeStatusType,
      },
    }));
  };

  const setStatus = (message) => {
    if (!message) {
      statusElement.style.display = "none";
      statusElement.textContent = "";
      return;
    }

    statusElement.style.display = "block";
    statusElement.textContent = message;
  };

  const flushQueue = () => {
    if (queuedMessages.length === 0) {
      return;
    }

    const nextMessages = queuedMessages.splice(0, queuedMessages.length);
    void Promise.all(nextMessages.map((message) =>
      fetch(\`\${window.location.origin}/message?token=\${encodeURIComponent(bridgeToken)}\`, {
        body: JSON.stringify(message),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).catch(() => {
        queuedMessages.unshift(message);
      }),
    ));
  };

  const enqueueMessage = (message) => {
    queuedMessages.push(message);
    flushQueue();
    return true;
  };

  const api = {
    getState() {
      return bridgeState;
    },
    postMessage(message) {
      return enqueueMessage(message);
    },
    setState(nextState) {
      bridgeState = nextState;
      try {
        window.localStorage.setItem(bridgeStorageKey, JSON.stringify(nextState));
      } catch {
        // Ignore localStorage write failures in browser debug mode.
      }
    }
  };

  const connect = () => {
    eventSource = new EventSource(\`\${window.location.origin}/events?token=\${encodeURIComponent(bridgeToken)}\`);
    setStatus("Connecting to Agent Canvas X browser debug host…");
    dispatchBridgeStatus("connecting");

    eventSource.addEventListener("open", () => {
      setStatus("");
      dispatchBridgeStatus("active");
      enqueueMessage(readyMessage);
    });

    eventSource.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message?.type === bridgeStatusType) {
        if (message.status === "inactive") {
          shouldReconnect = false;
          setStatus(message.message ?? "This browser debug session is inactive.");
        } else if (message.status === "active") {
          setStatus("");
        } else {
          setStatus(message.message ?? "");
        }

        dispatchBridgeStatus(message.status, message.message);
        return;
      }

      window.dispatchEvent(new MessageEvent("message", { data: message }));
    });

    eventSource.addEventListener("error", () => {
      if (!shouldReconnect) {
        return;
      }

      setStatus("Browser debug host disconnected. Reconnecting…");
      dispatchBridgeStatus("disconnected");
      eventSource?.close();
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        connect();
      }, 600);
    });
  };

  window.acquireVsCodeApi = () => api;
  connect();
})();
`.trim();
}
function getNonce() {
    return (0, node_crypto_1.randomBytes)(16).toString("hex");
}
//# sourceMappingURL=webview-html.js.map