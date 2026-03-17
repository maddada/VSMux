import { useEffect, useRef, useState } from "react";
import { FitAddon, Ghostty, Terminal } from "ghostty-web";
import type {
  CanvasAssetUris,
  ExtensionToWebviewMessage,
  TerminalPerformanceProfile,
} from "../../shared/canvas-contract";
import type { TerminalSessionSnapshot } from "../../shared/terminal-host-protocol";
import { Skeleton } from "@/components/ui/skeleton";
import { getVsCodeApi } from "@/lib/vscode";

const terminalTheme = {
  background: "#121417",
  foreground: "#f3efe7",
  cursor: "#f3efe7",
  cursorAccent: "#121417",
  selectionBackground: "#3b4b57",
  black: "#121417",
  red: "#f97316",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#f472b6",
  cyan: "#22d3ee",
  white: "#f5f5f4",
  brightBlack: "#475569",
  brightRed: "#fb923c",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#f9a8d4",
  brightCyan: "#67e8f9",
  brightWhite: "#fafaf9",
};

const SHIFT_ENTER_ESCAPE_SEQUENCE = "\u001b\r";

let ghosttyLoadPromise: Promise<Ghostty> | undefined;

export type LiveGhosttyTerminalActions = {
  copySelection: () => Promise<void>;
};

type LiveGhosttyTerminalProps = {
  assetUris: CanvasAssetUris;
  fontFamily: string;
  isFocused?: boolean;
  onTerminalActionsChange?: (actions: LiveGhosttyTerminalActions | undefined) => void;
  performanceProfile: TerminalPerformanceProfile;
  session?: TerminalSessionSnapshot;
  tileId: string;
};

export const LiveGhosttyTerminal = ({
  assetUris,
  fontFamily,
  isFocused = false,
  onTerminalActionsChange,
  performanceProfile,
  session,
  tileId,
}: LiveGhosttyTerminalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasSeededHistoryRef = useRef(false);
  const historyRef = useRef("");
  const latestSessionRef = useRef<TerminalSessionSnapshot | undefined>(session);
  const onTerminalActionsChangeRef = useRef(onTerminalActionsChange);
  const pendingOutputRef = useRef("");
  const outputFlushTimerRef = useRef<number | undefined>(undefined);
  const performanceProfileRef = useRef(performanceProfile);
  const sessionStatusRef = useRef(session?.status ?? "starting");
  const terminalRef = useRef<Terminal | undefined>(undefined);
  const [initError, setInitError] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    latestSessionRef.current = session;
    sessionStatusRef.current = session?.status ?? "starting";
  }, [session]);

  useEffect(() => {
    onTerminalActionsChangeRef.current = onTerminalActionsChange;
  }, [onTerminalActionsChange]);

  const clearOutputFlushTimer = () => {
    window.clearTimeout(outputFlushTimerRef.current);
    outputFlushTimerRef.current = undefined;
  };

  const flushPendingOutput = () => {
    clearOutputFlushTimer();

    if (
      !hasSeededHistoryRef.current ||
      !terminalRef.current ||
      pendingOutputRef.current.length === 0
    ) {
      return;
    }

    const nextChunk = pendingOutputRef.current;
    pendingOutputRef.current = "";
    terminalRef.current.write(nextChunk);
  };

  const schedulePendingOutputFlush = () => {
    if (
      !hasSeededHistoryRef.current ||
      !terminalRef.current ||
      pendingOutputRef.current.length === 0
    ) {
      return;
    }

    const batchIntervalMs = performanceProfileRef.current.writeBatchIntervalMs;
    if (batchIntervalMs <= 0) {
      flushPendingOutput();
      return;
    }

    if (outputFlushTimerRef.current !== undefined) {
      return;
    }

    outputFlushTimerRef.current = window.setTimeout(() => {
      outputFlushTimerRef.current = undefined;
      flushPendingOutput();
    }, batchIntervalMs);
  };

  useEffect(() => {
    performanceProfileRef.current = performanceProfile;
    if (terminalRef.current) {
      terminalRef.current.options.maxRenderFps = performanceProfile.maxFps;
      if (pendingOutputRef.current.length > 0) {
        clearOutputFlushTimer();
        schedulePendingOutputFlush();
      }
    }
  }, [performanceProfile]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const vscode = getVsCodeApi();
    let isDisposed = false;
    let fitAddon: FitAddon | undefined;
    let resizeDisposable: { dispose: () => void } | undefined;
    let inputDisposable: { dispose: () => void } | undefined;

    hasSeededHistoryRef.current = false;
    historyRef.current = "";
    pendingOutputRef.current = "";

    const mountTerminal = async () => {
      const ghosttyWasmUrl = assetUris.ghosttyWasm;
      if (!ghosttyWasmUrl) {
        setInitError("Missing ghostty WASM asset URI");
        return;
      }

      try {
        ghosttyLoadPromise ||= Ghostty.load(ghosttyWasmUrl);
        const ghostty = await ghosttyLoadPromise;

        if (isDisposed) {
          return;
        }

        const terminal = new Terminal({
          allowTransparency: true,
          cursorBlink: true,
          disableStdin: false,
          fontFamily,
          fontSize: 13,
          ghostty,
          smoothScrollDuration: 120,
          theme: terminalTheme,
        });

        terminalRef.current = terminal;
        fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        terminal.attachCustomKeyEventHandler((event) => {
          const isShiftEnter =
            event.type === "keydown" &&
            event.key === "Enter" &&
            event.shiftKey &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey;
          const isMetaCopy =
            event.type === "keydown" &&
            event.key.toLowerCase() === "c" &&
            event.metaKey &&
            !event.altKey &&
            !event.ctrlKey;

          if (isMetaCopy && terminal.hasSelection()) {
            void copyTextToClipboard(terminal.getSelection());
            return true;
          }

          if (!isShiftEnter || sessionStatusRef.current !== "running") {
            return false;
          }

          vscode.postMessage({
            data: SHIFT_ENTER_ESCAPE_SEQUENCE,
            tileId,
            type: "terminalInput",
          });

          return true;
        });
        fitAddon.fit();
        fitAddon.observeResize();
        disableSelectionAutoCopy(terminal);
        onTerminalActionsChangeRef.current?.({
          copySelection: async () => {
            await copyTextToClipboard(terminal.getSelection());
          },
        });

        const currentSession = latestSessionRef.current;
        if (currentSession?.history && historyRef.current !== currentSession.history) {
          terminal.write(currentSession.history);
          historyRef.current = currentSession.history;
        }

        hasSeededHistoryRef.current = true;
        if (pendingOutputRef.current) {
          schedulePendingOutputFlush();
        }

        inputDisposable = terminal.onData((data) => {
          if (sessionStatusRef.current !== "running" || data.length === 0) {
            return;
          }

          vscode.postMessage({
            data,
            tileId,
            type: "terminalInput",
          });
        });

        resizeDisposable = terminal.onResize(({ cols, rows }) => {
          vscode.postMessage({
            cols,
            rows,
            tileId,
            type: "terminalResize",
          });
        });

        vscode.postMessage({
          cols: terminal.cols,
          rows: terminal.rows,
          tileId,
          type: "terminalResize",
        });

        terminal.options.maxRenderFps = performanceProfileRef.current.maxFps;
        setIsReady(true);
        setInitError(undefined);
      } catch (error) {
        setInitError(error instanceof Error ? error.message : String(error));
      }
    };

    void mountTerminal();

    return () => {
      isDisposed = true;
      resizeDisposable?.dispose();
      inputDisposable?.dispose();
      fitAddon?.dispose();
      terminalRef.current?.dispose();
      terminalRef.current = undefined;
      clearOutputFlushTimer();
      onTerminalActionsChangeRef.current?.(undefined);
    };
  }, [assetUris.ghosttyWasm, fontFamily, tileId]);

  useEffect(() => {
    if (!session?.history || historyRef.current === session.history || !terminalRef.current) {
      return;
    }

    terminalRef.current.write(session.history);
    historyRef.current = session.history;
    hasSeededHistoryRef.current = true;

    if (pendingOutputRef.current) {
      schedulePendingOutputFlush();
    }
  }, [isReady, session?.history]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      if (event.data.type !== "terminalOutput" || event.data.tileId !== tileId) {
        return;
      }

      if (!hasSeededHistoryRef.current || !terminalRef.current) {
        pendingOutputRef.current += event.data.data;
        return;
      }

      pendingOutputRef.current += event.data.data;
      schedulePendingOutputFlush();
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [tileId]);

  useEffect(() => {
    if (!isFocused || !terminalRef.current) {
      return;
    }

    terminalRef.current.focus();
  }, [isFocused, isReady]);

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 cursor-text overflow-hidden rounded-none bg-[#121417]"
      data-terminal-surface="true"
    >
      {!isReady && (
        <div className="absolute inset-0 flex flex-col gap-2 p-3">
          <Skeleton className="h-4 w-28 bg-white/10" />
          <Skeleton className="h-4 w-40 bg-white/10" />
          <Skeleton className="h-4 w-32 bg-white/10" />
        </div>
      )}
      <div ref={containerRef} className="h-full min-h-0 flex-1 cursor-text" />
      {initError ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
          <div className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-stone-100 backdrop-blur-sm">
            {initError}
          </div>
        </div>
      ) : null}
      {session && session.status !== "running" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
          <div className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-stone-100 backdrop-blur-sm">
            {session.status === "starting"
              ? "Starting shell…"
              : session.status === "disconnected"
                ? "Disconnected. Restart to launch a new shell."
                : session.status === "error"
                  ? (session.errorMessage ?? "Shell failed to start")
                  : `Shell exited (${session.exitCode ?? 0})`}
          </div>
        </div>
      ) : null}
    </div>
  );
};

async function copyTextToClipboard(text: string): Promise<void> {
  if (text.length === 0) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback to execCommand when clipboard permissions are unavailable.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function disableSelectionAutoCopy(terminal: Terminal): void {
  const terminalWithSelectionManager = terminal as unknown as {
    selectionManager?: {
      copyToClipboard?: (text: string) => Promise<void>;
    };
  };
  const selectionManager = terminalWithSelectionManager.selectionManager;

  if (!selectionManager?.copyToClipboard) {
    return;
  }

  selectionManager.copyToClipboard = async () => {};
}
