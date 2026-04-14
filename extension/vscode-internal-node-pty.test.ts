import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  VSMUX_VSCODE_APP_ROOT_ENV,
  loadVsCodeInternalNodePty,
  resolveVsCodeInternalNodePtyPath,
} from "./vscode-internal-node-pty";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { force: true, recursive: true }),
      );
    }),
  );
});

describe("resolveVsCodeInternalNodePtyPath", () => {
  test("should prefer the unpacked node_modules path when present", async () => {
    const appRoot = await createTempAppRoot();
    const unpackedPath = path.join(appRoot, "node_modules", "node-pty");
    const asarPath = path.join(appRoot, "node_modules.asar", "node-pty");
    await mkdir(unpackedPath, { recursive: true });
    await mkdir(asarPath, { recursive: true });

    expect(resolveVsCodeInternalNodePtyPath(appRoot)).toBe(unpackedPath);
  });

  test("should fall back to node_modules.asar when needed", async () => {
    const appRoot = await createTempAppRoot();
    const asarPath = path.join(appRoot, "node_modules.asar", "node-pty");
    await mkdir(asarPath, { recursive: true });

    expect(resolveVsCodeInternalNodePtyPath(appRoot)).toBe(asarPath);
  });

  test("should throw when the app root env var is missing", () => {
    const originalAppRoot = process.env[VSMUX_VSCODE_APP_ROOT_ENV];
    delete process.env[VSMUX_VSCODE_APP_ROOT_ENV];

    try {
      expect(() => resolveVsCodeInternalNodePtyPath()).toThrow(
        `Missing ${VSMUX_VSCODE_APP_ROOT_ENV}`,
      );
    } finally {
      if (originalAppRoot) {
        process.env[VSMUX_VSCODE_APP_ROOT_ENV] = originalAppRoot;
      }
    }
  });
});

describe("loadVsCodeInternalNodePty", () => {
  test("should require the resolved VS Code internal path", async () => {
    const appRoot = await createTempAppRoot();
    const unpackedPath = path.join(appRoot, "node_modules", "node-pty");
    await mkdir(unpackedPath, { recursive: true });

    const moduleValue = { spawn: () => undefined };
    const requireCalls: string[] = [];
    const loaded = loadVsCodeInternalNodePty({
      appRoot,
      requireFn: ((specifier: string) => {
        requireCalls.push(specifier);
        return moduleValue;
      }) as NodeJS.Require,
    });

    expect(loaded).toBe(moduleValue);
    expect(requireCalls).toEqual([unpackedPath]);
  });
});

async function createTempAppRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "vsmux-node-pty-"));
  createdDirs.push(directory);
  return directory;
}
