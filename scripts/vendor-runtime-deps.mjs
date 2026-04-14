import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outNodeModulesDir = path.join(repoRoot, "out", "extension", "node_modules");
const require = createRequire(import.meta.url);

const runtimePackages = ["ws", "@xterm/addon-serialize", "@xterm/headless"];

async function main() {
  await rm(outNodeModulesDir, { force: true, recursive: true });
  await mkdir(outNodeModulesDir, { recursive: true });

  for (const packageName of runtimePackages) {
    await copyPackage(packageName);
  }
}

async function copyPackage(packageName) {
  const sourceDir = await resolvePackageDir(packageName);
  const destinationDir = path.join(outNodeModulesDir, packageName);
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { dereference: true, recursive: true });
}

async function resolvePackageDir(packageName) {
  const packageEntryPath = require.resolve(packageName, {
    paths: [repoRoot],
  });
  let currentDir = path.dirname(packageEntryPath);
  const repoRootPath = path.parse(currentDir).root;

  while (currentDir !== repoRootPath) {
    const packageJsonPath = path.join(currentDir, "package.json");
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      if (packageJson?.name === packageName) {
        return currentDir;
      }
    } catch {
      // Keep walking upward until the package root is found.
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error(`Unable to resolve package root for ${packageName}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
