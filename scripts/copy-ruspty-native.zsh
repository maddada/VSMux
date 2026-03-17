#!/usr/bin/env zsh

set -euo pipefail

const_script_dir=${0:A:h}
const_repo_root=${const_script_dir:h}

cd "$const_repo_root"

const_os=$(uname -s)
const_arch=$(uname -m)

case "$const_os:$const_arch" in
  Darwin:arm64)
    const_native_binary_name="ruspty.darwin-arm64.node"
    const_native_package_dir="ruspty-darwin-arm64"
    ;;
  Darwin:x86_64)
    const_native_binary_name="ruspty.darwin-x64.node"
    const_native_package_dir="ruspty-darwin-x64"
    ;;
  Linux:x86_64)
    const_native_binary_name="ruspty.linux-x64-gnu.node"
    const_native_package_dir="ruspty-linux-x64-gnu"
    ;;
  *)
    echo "Unsupported local platform for ruspty packaging: $const_os/$const_arch" >&2
    exit 1
    ;;
esac

const_native_binary_source="node_modules/.pnpm/node_modules/@replit/${const_native_package_dir}/${const_native_binary_name}"
const_native_binary_target="out/extension/${const_native_binary_name}"

if [[ ! -f "$const_native_binary_source" ]]; then
  echo "Missing native ruspty binary: $const_native_binary_source" >&2
  exit 1
fi

mkdir -p out/extension
cp "$const_native_binary_source" "$const_native_binary_target"

echo "Copied ruspty native binary to $const_native_binary_target"
