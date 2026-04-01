import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outNodeModulesDir = path.join(repoRoot, "out", "extension", "node_modules");
const require = createRequire(import.meta.url);

const runtimePackages = [
  "ws",
  "@lydell/node-pty",
];

async function main() {
  await rm(outNodeModulesDir, { force: true, recursive: true });
  await mkdir(outNodeModulesDir, { recursive: true });

  for (const packageName of runtimePackages) {
    await copyPackage(packageName);
  }

  await copyInstalledNodePtyPlatformPackages();
}

async function copyPackage(packageName) {
  const sourceDir = resolvePackageDir(packageName);
  const destinationDir = path.join(outNodeModulesDir, packageName);
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { dereference: true, recursive: true });
}

async function copyInstalledNodePtyPlatformPackages() {
  const nodePtyDir = resolvePackageDir("@lydell/node-pty");
  const lydellDir = path.join(nodePtyDir, "..");
  const entries = await readdir(lydellDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (!entry.name.startsWith("node-pty-")) {
      continue;
    }
    const sourceDir = path.join(lydellDir, entry.name);
    const destinationDir = path.join(outNodeModulesDir, "@lydell", entry.name);
    await mkdir(path.dirname(destinationDir), { recursive: true });
    await cp(sourceDir, destinationDir, { dereference: true, recursive: true });
  }
}

function resolvePackageDir(packageName) {
  const packageEntryPath = require.resolve(packageName, {
    paths: [repoRoot],
  });
  return path.dirname(packageEntryPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
