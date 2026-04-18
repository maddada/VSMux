import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const LICENSE_FILE_NAME_PATTERN = /^(licen[sc]e|notice|copying)(\..+)?$/iu;
const PRUNABLE_MARKDOWN_FILE_NAME_PATTERN = /\.(md|markdown|mkd)$/iu;
const PRUNABLE_RUNTIME_FILE_SUFFIXES = [
  ".cts",
  ".d.ts",
  ".d.ts.map",
  ".js.map",
  ".map",
  ".mts",
  ".pdb",
  ".ts",
  ".tsbuildinfo",
  ".tsx",
];
const PRUNABLE_RUNTIME_FILE_NAMES = new Set([
  ".npmignore",
  ".travis.yml",
  ".vscodeignore",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.build.json",
  "tsconfig.json",
  "yarn.lock",
]);
const PRUNABLE_PACKAGE_DIRECTORY_NAMES = new Set([
  ".devcontainer",
  ".github",
  ".vscode",
  "__mocks__",
  "__tests__",
  "example",
  "examples",
  "fixture",
  "fixtures",
  "test",
  "tests",
]);
const PACKAGE_PRUNE_RULES = [
  {
    packageName: "@types",
    removePackageRoot: true,
  },
  {
    directories: ["src"],
    packageName: "effect",
  },
  {
    directories: ["deps", "scripts", "src", "third_party", "typings"],
    files: ["binding.gyp"],
    packageName: "node-pty",
  },
];

export function buildManagedT3Provider(input) {
  const repoRoot = process.cwd();
  const provider = input.provider;
  const displayName = input.displayName;
  const embedRoot = input.embedRoot;
  const vendorWebRoot = resolve(embedRoot, "apps", "web");
  const serverRoot = resolve(embedRoot, "apps", "server");
  const webDistRoot = resolve(vendorWebRoot, "dist");
  const serverDistRoot = resolve(serverRoot, "dist");
  const packagedWebDistRoot = resolve(repoRoot, "out", input.packagedWebDirectoryName);
  const packagedServerRoot = resolve(repoRoot, "out", input.packagedServerDirectoryName);
  const packagedServerDistRoot = resolve(packagedServerRoot, "dist");
  const packagedServerNodeModulesRoot = resolve(packagedServerRoot, "node_modules");
  const embedNodeModulesRoot = resolve(embedRoot, "node_modules");
  const embedPackageJsonPath = resolve(embedRoot, "package.json");
  const serverPackageJsonPath = resolve(serverRoot, "package.json");
  const embedLockfilePaths = [resolve(embedRoot, "bun.lock"), resolve(embedRoot, "bun.lockb")];
  const embedInstallStampPath = resolve(embedNodeModulesRoot, ".vsmux-install-stamp");

  if (!existsSync(vendorWebRoot)) {
    throw new Error(
      `Missing ${vendorWebRoot}. Sync the sibling ${provider}-embed checkout or set ${input.envVarName}.`,
    );
  }

  if (!existsSync(serverRoot)) {
    throw new Error(
      `Missing ${serverRoot}. Sync the sibling ${provider}-embed checkout or set ${input.envVarName}.`,
    );
  }

  ensureEmbedDependencies();
  run("bun", ["run", "build"], {
    cwd: vendorWebRoot,
    env: {
      ...process.env,
      T3CODE_WEB_SOURCEMAP: "false",
    },
  });
  run("bun", ["run", "build"], { cwd: serverRoot });
  pruneMaps(webDistRoot);
  pruneMaps(serverDistRoot);
  syncPackagedArtifacts(webDistRoot, packagedWebDistRoot);
  bundleServerRuntime();

  function copyTree(source, destination) {
    cpSync(source, destination, {
      dereference: true,
      force: true,
      recursive: true,
    });
  }

  function run(command, args, options) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      ...(options.env ? { env: options.env } : {}),
      stdio: "inherit",
    });

    if (result.status !== 0) {
      throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
  }

  function ensureEmbedDependencies() {
    if (!shouldInstallEmbedDependencies()) {
      return;
    }

    run("bun", ["install"], { cwd: embedRoot });
    writeInstallStamp();
  }

  function shouldInstallEmbedDependencies() {
    if (!existsSync(embedNodeModulesRoot)) {
      return true;
    }

    if (!existsSync(embedInstallStampPath)) {
      return true;
    }

    return readFileSync(embedInstallStampPath, "utf8") !== getDependencyFingerprint();
  }

  function writeInstallStamp() {
    writeFileSync(embedInstallStampPath, getDependencyFingerprint(), "utf8");
  }

  function getDependencyFingerprint() {
    const dependencyInputs = [
      embedPackageJsonPath,
      ...embedLockfilePaths.filter((filePath) => existsSync(filePath)),
    ];

    return JSON.stringify(
      dependencyInputs.map((filePath) => ({
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
        size: statSync(filePath).size,
      })),
    );
  }

  function pruneMaps(root) {
    for (const entry of readdirSync(root)) {
      const entryPath = resolve(root, entry);
      const stats = statSync(entryPath);
      if (stats.isDirectory()) {
        pruneMaps(entryPath);
        continue;
      }

      if (entry.endsWith(".map")) {
        rmSync(entryPath, { force: true });
      }
    }
  }

  function syncPackagedArtifacts(sourceRoot, destinationRoot) {
    rmSync(destinationRoot, { force: true, recursive: true });
    mkdirSync(destinationRoot, { recursive: true });
    copyTree(sourceRoot, destinationRoot);
  }

  function bundleServerRuntime() {
    syncPackagedArtifacts(serverDistRoot, packagedServerDistRoot);
    rmSync(packagedServerNodeModulesRoot, { force: true, recursive: true });
    mkdirSync(packagedServerNodeModulesRoot, { recursive: true });

    const serverPackageJson = JSON.parse(readFileSync(serverPackageJsonPath, "utf8"));
    const copiedPackageNames = new Set();
    for (const dependencyName of Object.keys(serverPackageJson.dependencies ?? {})) {
      copyInstalledDependencyClosure(dependencyName, copiedPackageNames);
    }
    if (input.prunePackagedRuntime !== false) {
      prunePackagedServerRuntime();
    }

    writeFileSync(
      resolve(packagedServerRoot, "package.json"),
      JSON.stringify(
        {
          name: `vsmux-${provider}-server`,
          private: true,
          type: "module",
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  function copyInstalledDependencyClosure(packageName, copiedPackageNames, parentPackageDir) {
    if (copiedPackageNames.has(packageName)) {
      return;
    }

    const sourceDir = resolveInstalledPackageDir(packageName, parentPackageDir);
    if (!sourceDir) {
      return;
    }
    const resolvedSourceDir = realpathSync(sourceDir);

    copiedPackageNames.add(packageName);
    const destinationDir = resolve(packagedServerNodeModulesRoot, packageName);
    mkdirSync(dirname(destinationDir), { recursive: true });
    copyTree(resolvedSourceDir, destinationDir);

    const packageJsonPath = resolve(resolvedSourceDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const dependencyNames = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ]);

    for (const dependencyName of dependencyNames) {
      copyInstalledDependencyClosure(dependencyName, copiedPackageNames, resolvedSourceDir);
    }
  }

  function resolveInstalledPackageDir(packageName, parentPackageDir) {
    let currentDir = parentPackageDir ?? serverRoot;
    const filesystemRoot = parse(currentDir).root;

    while (true) {
      const candidateDir = resolve(currentDir, "node_modules", packageName);
      if (existsSync(candidateDir)) {
        return candidateDir;
      }

      if (currentDir === filesystemRoot) {
        return undefined;
      }

      const nextDir = dirname(currentDir);
      if (nextDir === currentDir) {
        return undefined;
      }
      currentDir = nextDir;
    }
  }

  function prunePackagedServerRuntime() {
    const stats = {
      bytes: 0,
      directories: 0,
      files: 0,
    };

    for (const rule of PACKAGE_PRUNE_RULES) {
      prunePackagedDependency(rule, stats);
    }

    pruneRuntimeFiles(packagedServerNodeModulesRoot, stats);
    console.log(
      `[build-t3-embed] Pruned ${stats.files} files and ${stats.directories} directories (${formatBytes(stats.bytes)}) from bundled ${input.packagedServerDirectoryName} runtime.`,
    );
  }

  function prunePackagedDependency(rule, stats) {
    const packageRoot = resolve(packagedServerNodeModulesRoot, ...rule.packageName.split("/"));
    if (!existsSync(packageRoot)) {
      return;
    }

    if (rule.removePackageRoot) {
      removePath(packageRoot, stats);
      return;
    }

    for (const directoryName of rule.directories ?? []) {
      removePath(resolve(packageRoot, directoryName), stats);
    }

    for (const fileName of rule.files ?? []) {
      removePath(resolve(packageRoot, fileName), stats);
    }
  }

  function pruneRuntimeFiles(root, stats, insidePackage = false) {
    if (!existsSync(root)) {
      return;
    }

    const currentInsidePackage = insidePackage || existsSync(resolve(root, "package.json"));
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const entryPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        if (currentInsidePackage && PRUNABLE_PACKAGE_DIRECTORY_NAMES.has(entry.name)) {
          removePath(entryPath, stats);
          continue;
        }

        pruneRuntimeFiles(entryPath, stats, currentInsidePackage);

        if (readdirSync(entryPath).length === 0) {
          rmSync(entryPath, { force: true, recursive: true });
          stats.directories += 1;
        }
        continue;
      }

      if (!shouldPruneRuntimeFile(entry.name)) {
        continue;
      }

      removePath(entryPath, stats);
    }
  }

  function shouldPruneRuntimeFile(fileName) {
    if (PRUNABLE_RUNTIME_FILE_NAMES.has(fileName)) {
      return true;
    }

    if (
      PRUNABLE_MARKDOWN_FILE_NAME_PATTERN.test(fileName) &&
      !LICENSE_FILE_NAME_PATTERN.test(fileName)
    ) {
      return true;
    }

    return PRUNABLE_RUNTIME_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
  }

  function removePath(targetPath, stats) {
    if (!existsSync(targetPath)) {
      return;
    }

    const targetStats = statSync(targetPath);
    if (targetStats.isDirectory()) {
      const measured = measureDirectory(targetPath);
      rmSync(targetPath, { force: true, recursive: true });
      stats.bytes += measured.bytes;
      stats.files += measured.files;
      stats.directories += 1;
      return;
    }

    rmSync(targetPath, { force: true });
    stats.bytes += targetStats.size;
    stats.files += 1;
  }

  function measureDirectory(root) {
    let bytes = 0;
    let files = 0;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const entryPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        const child = measureDirectory(entryPath);
        bytes += child.bytes;
        files += child.files;
        continue;
      }

      bytes += statSync(entryPath).size;
      files += 1;
    }

    return { bytes, files };
  }

  function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  console.log(`[build-t3-embed] Bundled ${displayName} from ${embedRoot}.`);
}
