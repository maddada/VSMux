import { resolve } from "node:path";
import { buildManagedT3Provider } from "./build-managed-t3-provider.mjs";

const repoRoot = process.cwd();

buildManagedT3Provider({
  displayName: "DP Code",
  embedRoot:
    process.env.VSMUX_DPCODE_REPO_ROOT?.trim() ||
    process.env.VSMUX_T3_REPO_ROOT?.trim() ||
    resolve(repoRoot, "..", "dpcode-embed"),
  envVarName: "VSMUX_DPCODE_REPO_ROOT",
  packagedServerDirectoryName: "dpcode-server",
  packagedWebDirectoryName: "dpcode-embed",
  provider: "dpcode",
  prunePackagedRuntime: false,
});

buildManagedT3Provider({
  displayName: "T3 Code",
  embedRoot: process.env.VSMUX_T3CODE_REPO_ROOT?.trim() || resolve(repoRoot, "..", "t3code-embed"),
  envVarName: "VSMUX_T3CODE_REPO_ROOT",
  packagedServerDirectoryName: "t3code-server",
  packagedWebDirectoryName: "t3code-embed",
  provider: "t3code",
  prunePackagedRuntime: false,
});
