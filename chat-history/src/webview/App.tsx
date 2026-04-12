import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import {
  Download,
  FileUp,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationSchema, type Conversation, type ErrorJsonl } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import {
  ChatNavigationButtons,
  ConversationList,
  ConversationSearchBar,
} from "@/components/custom-ui/conversation";
import { ExportDialog } from "@/components/custom-ui/ExportDialog";

// Declare the VS Code API type
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Get VS Code API instance
const vscode = acquireVsCodeApi();

type ParsedLine = Conversation | ErrorJsonl;
type ResumeSource = "Claude" | "Codex";
type ResumeMetadata = {
  cwd?: string;
  sessionId: string;
  source: ResumeSource;
};
type SearchableWindow = Window &
  typeof globalThis & {
    find?: (
      text: string,
      caseSensitive?: boolean,
      backwards?: boolean,
      wrapAround?: boolean,
      wholeWord?: boolean,
      searchInFrames?: boolean,
      showDialog?: boolean,
    ) => boolean;
  };

const parseJsonlContent = (content: string): ParsedLine[] => {
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
    try {
      const parsed = JSON.parse(line);
      const result = ConversationSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      return { type: "x-error" as const, line };
    } catch {
      return { type: "x-error" as const, line };
    }
  });
};

const THEME_KEY = "convo-viewer-theme";

function getInitialTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored !== null) {
    return stored === "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Initialize dark mode class on document before React hydrates
const initialDark = getInitialTheme();
if (initialDark) {
  document.documentElement.classList.add("dark");
}

function inferConversationSource(filePath: string | null): ResumeSource | undefined {
  if (!filePath) {
    return undefined;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/.codex/") || normalized.includes("/.codex-profiles/")) {
    return "Codex";
  }

  if (normalized.includes("/.claude/") || normalized.includes("/.claude-profiles/")) {
    return "Claude";
  }

  return undefined;
}

function hasSessionId(
  conversation: ParsedLine,
): conversation is Extract<Conversation, { sessionId: string }> {
  return conversation.type !== "x-error" && "sessionId" in conversation;
}

function hasCwd(
  conversation: ParsedLine,
): conversation is Extract<Conversation, { cwd: string; sessionId: string }> {
  return conversation.type !== "x-error" && "cwd" in conversation;
}

export function App() {
  const [conversations, setConversations] = useState<ParsedLine[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<string>();
  const [isDarkMode] = useState(getInitialTheme);
  const mainContainerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSearchQueryRef = useRef("");

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "conversationLoadStarted":
          setIsLoading(true);
          setLoadError(null);
          setFileName(message.fileName);
          setFilePath(message.filePath);
          return;
        case "conversationLoadFailed":
          setIsLoading(false);
          setIsRefreshing(false);
          setLoadError("Could not load this conversation.");
          return;
        case "loadConversation":
          setIsLoading(true);
          setIsRefreshing(false);
          setLoadError(null);
          try {
            const parsed = parseJsonlContent(message.content);
            setConversations(parsed);
            setFileName(message.fileName);
            setFilePath(message.filePath);
            setSearchStatus(undefined);
            lastSearchQueryRef.current = "";
          } finally {
            setIsLoading(false);
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Tell the extension we're ready to receive data
    vscode.postMessage({ command: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Refresh the current conversation
  const handleRefresh = useCallback(() => {
    if (!filePath) return;
    setIsRefreshing(true);
    vscode.postMessage({ command: "refreshConversation", filePath });
  }, [filePath]);

  const centerCurrentSearchMatch = useCallback(() => {
    const container = mainContainerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();
    const rect = selectionRect.height > 0 ? selectionRect : range.getClientRects()[0];
    if (!rect) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const isAboveViewport = rect.top < containerRect.top;
    const isBelowViewport = rect.bottom > containerRect.bottom;
    if (!isAboveViewport && !isBelowViewport) {
      return;
    }

    const offsetWithinContainer = rect.top - containerRect.top;
    const centeredTop =
      container.scrollTop + offsetWithinContainer - container.clientHeight / 2 + rect.height / 2;
    container.scrollTo({
      top: Math.max(0, centeredTop),
      behavior: "smooth",
    });
  }, []);

  const runSearch = useCallback(
    (direction: "next" | "previous") => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) {
        setSearchStatus("Enter search text.");
        return;
      }

      if (trimmedQuery !== lastSearchQueryRef.current) {
        window.getSelection()?.removeAllRanges();
        mainContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }

      const didFind =
        (window as SearchableWindow).find?.(
          trimmedQuery,
          false,
          direction === "previous",
          true,
          false,
          false,
          false,
        ) ?? false;

      lastSearchQueryRef.current = trimmedQuery;
      setSearchStatus(didFind ? undefined : "No matches found.");
      if (didFind) {
        requestAnimationFrame(() => {
          centerCurrentSearchMatch();
        });
      }
    },
    [centerCurrentSearchMatch, searchQuery],
  );

  const focusSearchInput = useCallback(() => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
    focusSearchInput();
  }, [focusSearchInput]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchStatus(undefined);
  }, []);

  const handleResumeSession = useCallback((resumeMetadata: ResumeMetadata) => {
    vscode.postMessage({
      command: "resumeSession",
      cwd: resumeMetadata.cwd,
      sessionId: resumeMetadata.sessionId,
      source: resumeMetadata.source,
    });
  }, []);

  // Detect if this is an agent file and extract agentId
  const agentId = useMemo(() => {
    for (const conv of conversations) {
      if (conv.type === "x-error") continue;
      if (
        conv.type === "summary" ||
        conv.type === "file-history-snapshot" ||
        conv.type === "queue-operation"
      )
        continue;
      if (conv.agentId) return conv.agentId;
    }
    return null;
  }, [conversations]);

  const resumeMetadata = useMemo<ResumeMetadata | undefined>(() => {
    const source = inferConversationSource(filePath);
    if (!source) {
      return undefined;
    }

    let sessionId: string | undefined;
    let cwd: string | undefined;
    for (const conversation of conversations) {
      if (!sessionId && hasSessionId(conversation)) {
        sessionId = conversation.sessionId;
      }

      if (!cwd && hasCwd(conversation)) {
        cwd = conversation.cwd;
      }

      if (sessionId && cwd) {
        break;
      }
    }

    if (!sessionId) {
      return undefined;
    }

    return { cwd, sessionId, source };
  }, [conversations, filePath]);

  // Build a map of tool_use_id -> tool_result for quick lookup
  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResultContent>();
    for (const conv of conversations) {
      if (conv.type === "x-error") continue;
      if (conv.type !== "user") continue;
      const content = conv.message.content;
      if (typeof content === "string") continue;

      for (const item of content) {
        if (typeof item === "string") continue;
        if (item.type === "tool_result") {
          map.set(item.tool_use_id, item);
        }
      }
    }
    return map;
  }, [conversations]);

  const getToolResult = useCallback(
    (toolUseId: string): ToolResultContent | undefined => {
      return toolResultMap.get(toolUseId);
    },
    [toolResultMap],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        handleOpenSearch();
        return;
      }

      if (event.key === "Escape" && isSearchOpen) {
        event.preventDefault();
        handleCloseSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCloseSearch, handleOpenSearch, isSearchOpen]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Empty state - no conversation loaded yet
  if (conversations.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              VSmux Search - Conversation Viewer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <MessageSquareText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No Conversation Loaded</p>
              <p className="text-sm text-muted-foreground mb-4">
                {loadError ?? "Select a conversation from the sidebar to view it here."}
              </p>
              <div className="text-xs text-muted-foreground space-y-1 mt-4">
                <p className="font-medium text-foreground/80">What you'll see:</p>
                <ul className="list-disc list-inside text-left inline-block">
                  <li>Full conversation history with Claude Code or Codex</li>
                  <li>All tool calls and their results</li>
                  <li>System messages and interactions</li>
                  <li>Behind-the-scenes details</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  // Conversation loaded - display it
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="font-semibold">
                {agentId ? `agent-${agentId}` : "Conversation Viewer"}
              </h1>
              <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {conversations.filter((c) => c.type !== "x-error").length} messages
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenSearch}
              title="Find in conversation"
            >
              <Search className="h-4 w-4 mr-2" />
              Find
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resumeMetadata && handleResumeSession(resumeMetadata)}
              disabled={!resumeMetadata}
              title={
                resumeMetadata
                  ? `Resume ${resumeMetadata.source} session ${resumeMetadata.sessionId}`
                  : "Resume unavailable for this conversation"
              }
            >
              <Terminal className="h-4 w-4 mr-2" />
              Resume
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || !filePath}
              title="Refresh conversation"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ExportDialog conversations={conversations} fileName={fileName || "conversation.jsonl"}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </ExportDialog>
          </div>
        </div>
      </header>
      <ConversationSearchBar
        inputRef={searchInputRef}
        isOpen={isSearchOpen}
        query={searchQuery}
        status={searchStatus}
        onChange={(value) => {
          setSearchQuery(value);
          setSearchStatus(undefined);
          lastSearchQueryRef.current = "";
        }}
        onClose={handleCloseSearch}
        onNext={() => runSearch("next")}
        onPrevious={() => runSearch("previous")}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            runSearch(event.shiftKey ? "previous" : "next");
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            handleCloseSearch();
          }
        }}
      />
      <main ref={mainContainerRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <ConversationList conversations={conversations} getToolResult={getToolResult} />
        </div>
      </main>
      <ChatNavigationButtons containerRef={mainContainerRef} />
      <Toaster />
    </div>
  );
}

export default App;
