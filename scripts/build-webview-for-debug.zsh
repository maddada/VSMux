#!/usr/bin/env zsh

set -euo pipefail

vp build --config vite.webview.config.ts &
build_pid=$!

cleanup() {
  if kill -0 "$build_pid" 2>/dev/null; then
    kill "$build_pid" 2>/dev/null || true
    wait "$build_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

for _ in {1..50}; do
  if ! kill -0 "$build_pid" 2>/dev/null; then
    wait "$build_pid"
    exit $?
  fi

  sleep 0.1
done

cleanup
trap - EXIT INT TERM
exit 0
