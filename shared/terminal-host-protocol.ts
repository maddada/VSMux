export const TERMINAL_HOST_PROTOCOL_VERSION = 3;

export type TerminalSessionStatus = "starting" | "running" | "exited" | "error" | "disconnected";

export type TerminalSessionRestoreState = "live" | "replayed";

export type TerminalSessionSnapshot = {
  tileId: string;
  cols: number;
  cwd: string;
  exitCode?: number;
  history?: string;
  restoreState: TerminalSessionRestoreState;
  rows: number;
  shell: string;
  startedAt: string;
  status: TerminalSessionStatus;
  workspaceId: string;
  endedAt?: string;
  errorMessage?: string;
};

export type TerminalSessionsByTileId = Record<string, TerminalSessionSnapshot>;

export type TerminalHostAuthenticateRequest = {
  type: "authenticate";
  token: string;
  version: typeof TERMINAL_HOST_PROTOCOL_VERSION;
};

export type TerminalHostCreateOrAttachRequest = {
  type: "createOrAttach";
  requestId: string;
  sessionId: string;
  workspaceId: string;
  cols: number;
  cwd: string;
  rows: number;
  shell: string;
};

export type TerminalHostWriteRequest = {
  type: "write";
  sessionId: string;
  data: string;
};

export type TerminalHostResizeRequest = {
  type: "resize";
  sessionId: string;
  cols: number;
  rows: number;
};

export type TerminalHostKillRequest = {
  type: "kill";
  sessionId: string;
};

export type TerminalHostListSessionsRequest = {
  type: "listSessions";
  requestId: string;
};

export type TerminalHostRequest =
  | TerminalHostAuthenticateRequest
  | TerminalHostCreateOrAttachRequest
  | TerminalHostWriteRequest
  | TerminalHostResizeRequest
  | TerminalHostKillRequest
  | TerminalHostListSessionsRequest;

export type TerminalHostAuthenticatedEvent = {
  type: "authenticated";
};

export type TerminalHostResponse =
  | {
      type: "response";
      requestId: string;
      ok: true;
      session: TerminalSessionSnapshot;
    }
  | {
      type: "response";
      requestId: string;
      ok: true;
      sessions: TerminalSessionSnapshot[];
    }
  | {
      type: "response";
      requestId: string;
      ok: false;
      error: string;
    };

export type TerminalHostSessionOutputEvent = {
  type: "sessionOutput";
  sessionId: string;
  data: string;
};

export type TerminalHostSessionStateEvent = {
  type: "sessionState";
  session: TerminalSessionSnapshot;
};

export type TerminalHostEvent =
  | TerminalHostAuthenticatedEvent
  | TerminalHostResponse
  | TerminalHostSessionOutputEvent
  | TerminalHostSessionStateEvent;

export type TerminalInputMessage = {
  type: "terminalInput";
  tileId: string;
  data: string;
};

export type TerminalResizeMessage = {
  type: "terminalResize";
  tileId: string;
  cols: number;
  rows: number;
};

export type TerminalStateMessage = {
  type: "terminalSessionState";
  session: TerminalSessionSnapshot;
};

export type TerminalOutputMessage = {
  type: "terminalOutput";
  tileId: string;
  data: string;
};
