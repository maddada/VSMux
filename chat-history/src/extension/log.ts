import { prefixLogMessageWithVscodeWorkspace } from "../../../shared/vscode-workspace-log-context";

export function logChatHistoryInfo(message: string, ...args: unknown[]): void {
  console.log(prefixLogMessageWithVscodeWorkspace(message), ...args);
}

export function logChatHistoryWarn(message: string, ...args: unknown[]): void {
  console.warn(prefixLogMessageWithVscodeWorkspace(message), ...args);
}

export function logChatHistoryError(message: string, ...args: unknown[]): void {
  console.error(prefixLogMessageWithVscodeWorkspace(message), ...args);
}
