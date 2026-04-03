type T3FrameBootstrap = {
  scriptSrc: string;
  sessionId: string;
  sessionRecordTitle: string;
  serverOrigin: string;
  styleHref?: string;
  threadId: string;
  workspaceRoot: string;
  wsUrl: string;
};

declare global {
  interface Window {
    __VSMUX_T3_BOOTSTRAP__?: {
      embedMode: "vsmux-mobile";
      httpOrigin: string;
      sessionId: string;
      threadId: string;
      workspaceRoot: string;
      wsUrl: string;
    };
  }
}

const bootstrap = readBootstrap();
document.title = bootstrap.sessionRecordTitle;
window.__VSMUX_T3_BOOTSTRAP__ = {
  embedMode: "vsmux-mobile",
  httpOrigin: bootstrap.serverOrigin,
  sessionId: bootstrap.sessionId,
  threadId: bootstrap.threadId,
  workspaceRoot: bootstrap.workspaceRoot,
  wsUrl: bootstrap.wsUrl,
};

installWebSocketUrlPatch(bootstrap.wsUrl);

if (bootstrap.styleHref) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = bootstrap.styleHref;
  document.head.append(stylesheet);
}

const root = document.getElementById("root");
if (root) {
  root.id = "root";
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "focusComposer") {
    return;
  }

  focusComposerEditor();
});

window.addEventListener("focus", () => {
  notifyParentFocus();
});

document.addEventListener(
  "pointerdown",
  () => {
    notifyParentFocus();
  },
  true,
);

const script = document.createElement("script");
script.type = "module";
script.src = bootstrap.scriptSrc;
document.body.append(script);

function readBootstrap(): T3FrameBootstrap {
  const bootstrapElement = document.getElementById("vsmux-t3-bootstrap");
  const encoded = bootstrapElement?.textContent;
  if (!encoded) {
    throw new Error("Missing VSmux T3 iframe bootstrap payload.");
  }

  return JSON.parse(encoded) as T3FrameBootstrap;
}

function focusComposerEditor() {
  const maxAttempts = 10;
  let attempt = 0;

  const tryFocus = () => {
    const composer = document.querySelector(
      '[data-testid="composer-editor"][contenteditable="true"]',
    );
    if (!(composer instanceof HTMLElement)) {
      if (attempt < maxAttempts) {
        attempt += 1;
        window.setTimeout(tryFocus, 50);
      }
      return;
    }

    composer.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  tryFocus();
}

function notifyParentFocus() {
  window.parent?.postMessage(
    {
      sessionId: bootstrap.sessionId,
      type: "vsmuxT3Focus",
    },
    "*",
  );
}

function installWebSocketUrlPatch(wsBaseUrl: string) {
  const NativeWebSocket = window.WebSocket;
  const baseUrl = new URL(wsBaseUrl);

  class VSmuxWebSocket extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(resolveWebSocketUrl(url, baseUrl), protocols);
    }
  }

  Object.defineProperties(VSmuxWebSocket, {
    CONNECTING: { value: NativeWebSocket.CONNECTING },
    OPEN: { value: NativeWebSocket.OPEN },
    CLOSING: { value: NativeWebSocket.CLOSING },
    CLOSED: { value: NativeWebSocket.CLOSED },
  });

  Object.defineProperty(VSmuxWebSocket, "name", {
    value: NativeWebSocket.name,
  });

  const patchedWebSocket = VSmuxWebSocket as typeof WebSocket;
  window.WebSocket = patchedWebSocket;
  globalThis.WebSocket = patchedWebSocket;
}

function resolveWebSocketUrl(url: string | URL, baseUrl: URL): string | URL {
  const raw = typeof url === "string" ? url : url.toString();

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
      return url;
    }
  } catch {
    // Fall through to relative URL handling.
  }

  if (raw.startsWith("/")) {
    return new URL(raw, `${baseUrl.toString()}/`).toString();
  }

  if (raw.startsWith("./") || raw.startsWith("../") || !raw.includes(":")) {
    return new URL(raw, `${baseUrl.toString()}/`).toString();
  }

  return url;
}
