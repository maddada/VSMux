import type { CanvasWorkspaceSnapshot } from "../../shared/canvas-contract";

type VsCodeApi = ReturnType<typeof acquireVsCodeApi<CanvasWorkspaceSnapshot>>;

let vscodeApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  vscodeApi ||= acquireVsCodeApi<CanvasWorkspaceSnapshot>();
  return vscodeApi;
}
