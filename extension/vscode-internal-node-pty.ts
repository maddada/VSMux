import { existsSync } from "node:fs";
import * as path from "node:path";
import type * as NodePty from "node-pty";

export const VSMUX_VSCODE_APP_ROOT_ENV = "VSMUX_VSCODE_APP_ROOT";

export type NodePtyModule = typeof NodePty;
export type PtyProcess = NodePty.IPty;

type LoadVsCodeInternalNodePtyOptions = {
  appRoot?: string;
  requireFn?: NodeJS.Require;
};

declare const __non_webpack_require__: NodeJS.Require | undefined;

export function loadVsCodeInternalNodePty(
  options: LoadVsCodeInternalNodePtyOptions = {},
): NodePtyModule {
  const ptyPath = resolveVsCodeInternalNodePtyPath(options.appRoot);

  try {
    return resolveDynamicRequire(options.requireFn)(ptyPath) as NodePtyModule;
  } catch (error) {
    throw new Error(`Failed to load VS Code's internal node-pty from ${ptyPath}.`, {
      cause: error,
    });
  }
}

export function resolveVsCodeInternalNodePtyPath(
  appRoot = process.env[VSMUX_VSCODE_APP_ROOT_ENV],
): string {
  if (!appRoot) {
    throw new Error(
      `Missing ${VSMUX_VSCODE_APP_ROOT_ENV}; cannot resolve VS Code's internal node-pty package.`,
    );
  }

  const candidates = [
    path.join(appRoot, "node_modules", "node-pty"),
    path.join(appRoot, "node_modules.asar", "node-pty"),
    path.join(appRoot, "node_modules.asar.unpacked", "node-pty"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      "Unable to locate VS Code's internal node-pty package.",
      `appRoot: ${appRoot}`,
      ...candidates.map((candidate) => `checked: ${candidate}`),
    ].join("\n"),
  );
}

function resolveDynamicRequire(requireFn?: NodeJS.Require): NodeJS.Require {
  if (requireFn) {
    return requireFn;
  }

  if (typeof __non_webpack_require__ === "function") {
    return __non_webpack_require__;
  }

  return require;
}
