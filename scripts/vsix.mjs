import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const validModes = new Set(["package", "install"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function quoteCmdArg(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
}

function run(command, args, options = {}) {
  const useCmdShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const result = useCmdShim
    ? spawnSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", [quoteCmdArg(command), ...args.map(quoteCmdArg)].join(" ")],
        {
          cwd: repoRoot,
          stdio: "inherit",
          ...options,
        },
      )
    : spawnSync(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        shell: false,
        ...options,
      });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(command) {
  const which = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(which, [command], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  return result.status === 0;
}

function resolveVsixPath(installerDir, extensionName, extensionVersion) {
  const baseName = `${extensionName}-${extensionVersion}`;
  const defaultPath = join(installerDir, `${baseName}.vsix`);

  try {
    rmSync(defaultPath, { force: true });
    return defaultPath;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      const fallbackPath = join(installerDir, `${baseName}-${Date.now()}.vsix`);
      console.warn(`Existing VSIX is locked, using ${fallbackPath} instead.`);
      return fallbackPath;
    }

    throw error;
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const mode = process.argv[2];

if (!validModes.has(mode)) {
  fail("Usage: node ./scripts/vsix.mjs <package|install>");
}

const packageJson = await import(new URL("../package.json", import.meta.url), {
  with: { type: "json" },
});
const extensionName = packageJson.default.name;
const extensionVersion = packageJson.default.version;
const installerDir = join(repoRoot, "installer");

if (!existsSync(installerDir)) {
  mkdirSync(installerDir, { recursive: true });
}

const vsixPath = resolveVsixPath(installerDir, extensionName, extensionVersion);

run("vp", [
  "exec",
  "vsce",
  "package",
  "--no-dependencies",
  "--skip-license",
  "--allow-unused-files-pattern",
  "--out",
  vsixPath,
]);

console.log(`Packaged VSIX: ${vsixPath}`);

if (mode === "package") {
  process.exit(0);
}

const vscodeCliCandidates =
  process.platform === "win32"
    ? ["code.cmd", "code-insiders.cmd", "code", "code-insiders"]
    : ["code", "code-insiders"];

const vscodeCli = vscodeCliCandidates.find(commandExists);

if (!vscodeCli) {
  fail("Could not find a VS Code CLI. Install the 'code' command from VS Code and retry.");
}

run(vscodeCli, ["--install-extension", vsixPath, "--force"]);

console.log(`Installed extension with ${vscodeCli} from ${vsixPath}`);
