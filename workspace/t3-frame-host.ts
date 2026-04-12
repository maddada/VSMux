type T3FrameBootstrap = {
  browserBootstrapToken: string;
  scriptSrc: string;
  sessionId: string;
  sessionRecordTitle: string;
  serverOrigin: string;
  styleHref?: string;
  threadId: string;
  workspaceRoot: string;
  wsUrl: string;
};

type T3ClipboardFilePayload = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
};

type T3ClipboardPayload = {
  files: T3ClipboardFilePayload[];
  text: string;
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
    desktopBridge?: {
      browser: {
        close: (_input: unknown) => Promise<null>;
        closeTab: (_input: unknown) => Promise<null>;
        getState: (input: { threadId?: string } | undefined) => Promise<{
          activeTabId: null;
          lastError: null;
          open: false;
          tabs: [];
          threadId: string;
        }>;
        goBack: (_input: unknown) => Promise<null>;
        goForward: (_input: unknown) => Promise<null>;
        hide: (_input: unknown) => Promise<void>;
        navigate: (_input: unknown) => Promise<null>;
        newTab: (_input: unknown) => Promise<null>;
        onState: (_listener: (state: unknown) => void) => () => void;
        open: (_input: unknown) => Promise<null>;
        openDevTools: (_input: unknown) => Promise<void>;
        reload: (_input: unknown) => Promise<null>;
        selectTab: (_input: unknown) => Promise<null>;
        setPanelBounds: (_input: unknown) => Promise<null>;
      };
      confirm: (message: string) => Promise<boolean>;
      getClientSettings: () => Promise<null>;
      getLocalEnvironmentBootstrap: () => {
        bootstrapToken?: string;
        httpBaseUrl: string;
        label: string;
        wsBaseUrl: string;
      };
      getWsUrl: () => string;
      getSavedEnvironmentRegistry: () => Promise<readonly []>;
      getSavedEnvironmentSecret: () => Promise<null>;
      getServerExposureState: () => Promise<{
        advertisedHost: null;
        endpointUrl: null;
        mode: "local-only";
      }>;
      notifications: {
        isSupported: () => Promise<boolean>;
        show: (_input: unknown) => Promise<boolean>;
      };
      getUpdateState: () => Promise<{
        canRetry: false;
        checkedAt: null;
        checkedVersion: null;
        downloadPercent: null;
        downloadedVersion: null;
        errorContext: null;
        message: null;
        phase: "idle";
      }>;
      installUpdate: () => Promise<{
        accepted: false;
        completed: false;
        state: Awaited<ReturnType<NonNullable<Window["desktopBridge"]>["getUpdateState"]>>;
      }>;
      checkForUpdate: () => Promise<{
        checked: false;
        state: Awaited<ReturnType<NonNullable<Window["desktopBridge"]>["getUpdateState"]>>;
      }>;
      downloadUpdate: () => Promise<{
        accepted: false;
        completed: false;
        state: Awaited<ReturnType<NonNullable<Window["desktopBridge"]>["getUpdateState"]>>;
      }>;
      onMenuAction: (_listener: (action: string) => void) => () => void;
      onUpdateState: (_listener: (state: unknown) => void) => () => void;
      openExternal: (url: string) => Promise<boolean>;
      pickFolder: () => Promise<null>;
      removeSavedEnvironmentSecret: () => Promise<void>;
      setClientSettings: () => Promise<void>;
      setSavedEnvironmentRegistry: () => Promise<void>;
      setSavedEnvironmentSecret: () => Promise<boolean>;
      setServerExposureMode: () => Promise<{
        advertisedHost: null;
        endpointUrl: null;
        mode: "local-only";
      }>;
      setTheme: () => Promise<void>;
      showContextMenu: () => Promise<null>;
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
installDesktopBridge();

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

let nextClipboardRequestId = 0;
const pendingClipboardReads = new Map<number, (payload: T3ClipboardPayload) => void>();
let pendingPasteFallbackTimer: number | undefined;

window.addEventListener("message", (event) => {
  if (event.data?.type !== "vsmuxT3ClipboardReadResult") {
    return;
  }

  const requestId = typeof event.data.requestId === "number" ? event.data.requestId : undefined;
  if (requestId === undefined) {
    return;
  }

  const resolver = pendingClipboardReads.get(requestId);
  if (!resolver) {
    return;
  }

  pendingClipboardReads.delete(requestId);
  resolver({
    files: Array.isArray(event.data.files)
      ? event.data.files.filter((entry): entry is T3ClipboardFilePayload => {
          return (
            entry != null &&
            typeof entry.name === "string" &&
            typeof entry.type === "string" &&
            entry.buffer instanceof ArrayBuffer
          );
        })
      : [],
    text: typeof event.data.text === "string" ? event.data.text : "",
  });
});

document.addEventListener(
  "keydown",
  (event) => {
    const primaryModifier = navigator.platform.toLowerCase().includes("mac")
      ? event.metaKey
      : event.ctrlKey;
    if (!primaryModifier || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "c") {
      const text = readSelectedText();
      if (!text) {
        return;
      }
      event.preventDefault();
      writeClipboard(text);
      return;
    }

    if (key === "x") {
      const text = readSelectedText();
      if (!text || !isEditableTarget(document.activeElement)) {
        return;
      }
      event.preventDefault();
      writeClipboard(text);
      deleteSelectionFromActiveTarget();
      return;
    }

    if (key === "v" && isEditableTarget(document.activeElement)) {
      schedulePasteFallback();
    }
  },
  true,
);

document.addEventListener(
  "copy",
  (event) => {
    const text = readSelectedText();
    if (!text) {
      return;
    }
    event.preventDefault();
    writeClipboard(text);
  },
  true,
);

document.addEventListener(
  "cut",
  (event) => {
    const text = readSelectedText();
    if (!text || !isEditableTarget(document.activeElement)) {
      return;
    }
    event.preventDefault();
    writeClipboard(text);
    deleteSelectionFromActiveTarget();
  },
  true,
);

document.addEventListener(
  "paste",
  (event) => {
    if (!isEditableTarget(document.activeElement)) {
      return;
    }

    clearPasteFallback();

    const clipboardData = event.clipboardData;
    if (clipboardData?.files.length) {
      return;
    }

    if ((clipboardData?.getData("text/plain") ?? "").length > 0) {
      return;
    }

    event.preventDefault();
    void pasteFromClipboardBridge();
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

function installDesktopBridge() {
  const updateState = {
    canRetry: false,
    checkedAt: null,
    checkedVersion: null,
    downloadPercent: null,
    downloadedVersion: null,
    errorContext: null,
    message: null,
    phase: "idle" as const,
  };
  const serverExposureState = {
    advertisedHost: null,
    endpointUrl: null,
    mode: "local-only" as const,
  };

  window.desktopBridge = {
    browser: {
      close: async () => null,
      closeTab: async () => null,
      getState: async (input) => ({
        activeTabId: null,
        lastError: null,
        open: false,
        tabs: [],
        threadId: input?.threadId ?? bootstrap.threadId,
      }),
      goBack: async () => null,
      goForward: async () => null,
      hide: async () => undefined,
      navigate: async () => null,
      newTab: async () => null,
      onState: () => () => undefined,
      open: async () => null,
      openDevTools: async () => undefined,
      reload: async () => null,
      selectTab: async () => null,
      setPanelBounds: async () => null,
    },
    confirm: async (message: string) => window.confirm(message),
    getClientSettings: async () => null,
    getLocalEnvironmentBootstrap: () => ({
      bootstrapToken: bootstrap.browserBootstrapToken,
      httpBaseUrl: bootstrap.serverOrigin,
      label: bootstrap.sessionRecordTitle || "T3 Code",
      wsBaseUrl: bootstrap.wsUrl,
    }),
    getWsUrl: () => bootstrap.wsUrl,
    getSavedEnvironmentRegistry: async () => [],
    getSavedEnvironmentSecret: async () => null,
    getServerExposureState: async () => serverExposureState,
    notifications: {
      isSupported: async () => false,
      show: async () => false,
    },
    getUpdateState: async () => updateState,
    installUpdate: async () => ({ accepted: false, completed: false, state: updateState }),
    checkForUpdate: async () => ({ checked: false, state: updateState }),
    downloadUpdate: async () => ({ accepted: false, completed: false, state: updateState }),
    onMenuAction: () => () => undefined,
    onUpdateState: () => () => undefined,
    openExternal: async (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    },
    pickFolder: async () => null,
    removeSavedEnvironmentSecret: async () => undefined,
    setClientSettings: async () => undefined,
    setSavedEnvironmentRegistry: async () => undefined,
    setSavedEnvironmentSecret: async () => false,
    setServerExposureMode: async () => serverExposureState,
    setTheme: async () => undefined,
    showContextMenu: async () => null,
  };
}

function writeClipboard(text: string) {
  window.parent?.postMessage(
    {
      text,
      type: "vsmuxT3ClipboardWrite",
    },
    "*",
  );
}

function readClipboard(): Promise<T3ClipboardPayload> {
  const requestId = nextClipboardRequestId++;
  return new Promise((resolve) => {
    pendingClipboardReads.set(requestId, resolve);
    window.parent?.postMessage(
      {
        requestId,
        type: "vsmuxT3ClipboardReadRequest",
      },
      "*",
    );
  });
}

function readSelectedText(): string {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? start;
    return start === end ? "" : activeElement.value.slice(start, end);
  }

  return window.getSelection()?.toString() ?? "";
}

function schedulePasteFallback() {
  clearPasteFallback();
  pendingPasteFallbackTimer = window.setTimeout(() => {
    pendingPasteFallbackTimer = undefined;
    void pasteFromClipboardBridge();
  }, 75);
}

function clearPasteFallback() {
  if (pendingPasteFallbackTimer === undefined) {
    return;
  }

  window.clearTimeout(pendingPasteFallbackTimer);
  pendingPasteFallbackTimer = undefined;
}

async function pasteFromClipboardBridge() {
  if (!isEditableTarget(document.activeElement)) {
    return;
  }

  const payload = await readClipboard();
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    window.postMessage(
      {
        files: payload.files,
        text: payload.text,
        type: "vsmuxPastePayload",
      },
      "*",
    );
    return;
  }

  insertTextIntoActiveTarget(payload.text);
}

function isEditableTarget(
  target: Element | null,
): target is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function insertTextIntoActiveTarget(text: string) {
  if (!text) {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const start = activeElement.selectionStart ?? activeElement.value.length;
    const end = activeElement.selectionEnd ?? start;
    activeElement.setRangeText(text, start, end, "end");
    activeElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertFromPaste",
      }),
    );
    return;
  }

  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    activeElement.focus();
    if (
      typeof document.execCommand === "function" &&
      document.execCommand("insertText", false, text)
    ) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    if (selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(activeElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    activeElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertFromPaste",
      }),
    );
  }
}

function deleteSelectionFromActiveTarget() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? start;
    if (start === end) {
      return;
    }
    activeElement.setRangeText("", start, end, "start");
    activeElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "",
        inputType: "deleteByCut",
      }),
    );
    return;
  }

  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return;
    }
    range.deleteContents();
    activeElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "",
        inputType: "deleteByCut",
      }),
    );
  }
}
