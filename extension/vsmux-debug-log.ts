import * as vscode from "vscode";

const SETTINGS_SECTION = "VSmux";
const DEBUGGING_MODE_SETTING = "debuggingMode";

let outputChannel: vscode.OutputChannel | undefined;

export function resetVSmuxDebugLog(): void {
  if (!isDebugLoggingEnabled()) {
    outputChannel?.clear();
    return;
  }

  getOutputChannel().clear();
}

export function logVSmuxDebug(event: string, details?: unknown): void {
  if (!isDebugLoggingEnabled()) {
    return;
  }

  const output = getOutputChannel();
  const suffix = details === undefined ? "" : ` ${safeSerialize(details)}`;
  output.appendLine(`${new Date().toISOString()} ${event}${suffix}`);
}

export function disposeVSmuxDebugLog(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}

function getOutputChannel(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel("VSmux Debug");
  return outputChannel;
}

function isDebugLoggingEnabled(): boolean {
  return (
    vscode.workspace.getConfiguration(SETTINGS_SECTION).get<boolean>(DEBUGGING_MODE_SETTING) ??
    false
  );
}

function safeSerialize(details: unknown): string {
  try {
    return JSON.stringify(details);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      unserializable: true,
    });
  }
}
