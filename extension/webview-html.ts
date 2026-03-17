import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import * as vscode from "vscode";
import type { CanvasAssetUris } from "../shared/canvas-contract";

type GetCanvasWebviewHtmlParams = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
};

type CanvasBuildAssetPaths = {
  assetsRoot: vscode.Uri;
  scriptUri: vscode.Uri;
  styleUri: vscode.Uri;
  ghosttyWasmUri: vscode.Uri;
};

type GetCanvasBrowserHtmlParams = {
  bridgeToken: string;
  extensionUri: vscode.Uri;
  serverOrigin: string;
};

export async function getCanvasWebviewHtml({
  extensionUri,
  webview,
}: GetCanvasWebviewHtmlParams): Promise<string> {
  const { scriptUri, styleUri } = getCanvasBuildAssetPaths(extensionUri);
  const scriptSource = webview.asWebviewUri(scriptUri).toString();
  const styleSource = webview.asWebviewUri(styleUri).toString();

  if (!(await webviewBuildExists(extensionUri))) {
    return getMissingBuildHtml();
  }

  const nonce = getNonce();

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
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptSource}"></script>
  </body>
</html>`;
}

export async function getCanvasBrowserHtml({
  bridgeToken,
  extensionUri,
  serverOrigin,
}: GetCanvasBrowserHtmlParams): Promise<string> {
  if (!(await webviewBuildExists(extensionUri))) {
    return getMissingBuildHtml();
  }

  const bootstrapScript = getBrowserBridgeBootstrapScript(bridgeToken);
  const assetQuery = `?token=${encodeURIComponent(bridgeToken)}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${serverOrigin}/assets/index.css${assetQuery}" />
    <title>Agent Canvas X</title>
  </head>
  <body>
    <div id="root"></div>
    <script>${bootstrapScript}</script>
    <script type="module" src="${serverOrigin}/assets/index.js${assetQuery}"></script>
  </body>
</html>`;
}

export function getCanvasBuildAssetPaths(extensionUri: vscode.Uri): CanvasBuildAssetPaths {
  const assetsRoot = vscode.Uri.joinPath(extensionUri, "dist", "webview", "assets");

  return {
    assetsRoot,
    ghosttyWasmUri: vscode.Uri.joinPath(assetsRoot, "ghostty-vt.wasm"),
    scriptUri: vscode.Uri.joinPath(assetsRoot, "index.js"),
    styleUri: vscode.Uri.joinPath(assetsRoot, "index.css"),
  };
}

async function webviewBuildExists(extensionUri: vscode.Uri): Promise<boolean> {
  const { scriptUri, styleUri } = getCanvasBuildAssetPaths(extensionUri);

  try {
    await Promise.all([access(scriptUri.fsPath), access(styleUri.fsPath)]);
    return true;
  } catch {
    return false;
  }
}

export function getCanvasAssetUris({
  extensionUri,
  webview,
}: GetCanvasWebviewHtmlParams): CanvasAssetUris {
  const { ghosttyWasmUri } = getCanvasBuildAssetPaths(extensionUri);

  return {
    ghosttyWasm: webview.asWebviewUri(ghosttyWasmUri).toString(),
  };
}

export function getCanvasBrowserAssetUris(
  serverOrigin: string,
  bridgeToken: string,
): CanvasAssetUris {
  return {
    ghosttyWasm: `${serverOrigin}/assets/ghostty-vt.wasm?token=${encodeURIComponent(bridgeToken)}`,
  };
}

function getMissingBuildHtml(): string {
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

function getBrowserBridgeBootstrapScript(bridgeToken: string): string {
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

function getNonce(): string {
  return randomBytes(16).toString("hex");
}
