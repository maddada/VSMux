#!/usr/bin/env zsh

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./scripts/vsix.zsh <package|install>" >&2
  exit 1
fi

const_script_dir=${0:A:h}
const_repo_root=${const_script_dir:h}

cd "$const_repo_root"

const_mode=$1

if [[ "$const_mode" != "package" && "$const_mode" != "install" ]]; then
  echo "Unknown mode: $const_mode" >&2
  exit 1
fi

const_extension_name=$(node -p "require('./package.json').name")
const_extension_version=$(node -p "require('./package.json').version")
const_vsix_path="installer/${const_extension_name}-${const_extension_version}.vsix"

mkdir -p installer
rm -f "$const_vsix_path"

vp exec vsce package --no-dependencies --skip-license --out "$const_vsix_path"

echo "Packaged VSIX: $const_vsix_path"

if [[ "$const_mode" == "package" ]]; then
  exit 0
fi

if command -v code >/dev/null 2>&1; then
  const_vscode_cli=code
elif command -v code-insiders >/dev/null 2>&1; then
  const_vscode_cli=code-insiders
else
  echo "Could not find a VS Code CLI. Install the 'code' command from VS Code and retry." >&2
  exit 1
fi

"$const_vscode_cli" --install-extension "$const_vsix_path" --force

echo "Installed extension with $const_vscode_cli from $const_vsix_path"
