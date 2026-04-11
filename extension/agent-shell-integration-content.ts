import { quoteShellLiteral } from "./agent-shell-integration-utils";

export type AgentWrapperName = "claude" | "codex" | "gemini" | "opencode";

export function getAgentWrapperShellScriptContent(
  agentName: AgentWrapperName,
  options: {
    binDir: string;
    claudeSettingsPath: string;
    notifyPath: string;
    opencodeConfigDir: string;
    wrapperRunnerPath: string;
  },
): string {
  return `#!/bin/sh
export ELECTRON_RUN_AS_NODE=1
exec ${quoteShellLiteral(process.execPath)} ${quoteShellLiteral(options.wrapperRunnerPath)} --agent ${quoteShellLiteral(agentName)} --bin-dir ${quoteShellLiteral(options.binDir)} --claude-settings-path ${quoteShellLiteral(options.claudeSettingsPath)} --notify-runner-path ${quoteShellLiteral(options.notifyPath)} --opencode-config-dir ${quoteShellLiteral(options.opencodeConfigDir)} -- "$@"
`;
}

export function getAgentWrapperCmdContent(
  agentName: AgentWrapperName,
  options: {
    binDir: string;
    claudeSettingsPath: string;
    notifyPath: string;
    opencodeConfigDir: string;
    wrapperRunnerPath: string;
  },
): string {
  return `@echo off
setlocal
set "_vsmux_node="
for %%I in (node.exe) do set "_vsmux_node=%%~$PATH:I"
if defined _vsmux_node (
  "%_vsmux_node%" "${options.wrapperRunnerPath}" --agent ${agentName} --bin-dir "${options.binDir}" --claude-settings-path "${options.claudeSettingsPath}" --notify-runner-path "${options.notifyPath}" --opencode-config-dir "${options.opencodeConfigDir}" -- %*
) else (
  set ELECTRON_RUN_AS_NODE=1
  "${process.execPath}" "${options.wrapperRunnerPath}" --agent ${agentName} --bin-dir "${options.binDir}" --claude-settings-path "${options.claudeSettingsPath}" --notify-runner-path "${options.notifyPath}" --opencode-config-dir "${options.opencodeConfigDir}" -- %*
)
`;
}

export function getClaudeNotifyCommandContent(notifyPath: string): string {
  if (process.platform === "win32") {
    return `@echo off
setlocal
set VSMUX_AGENT=claude
set ELECTRON_RUN_AS_NODE=1
"${process.execPath}" "${notifyPath}" %*
`;
  }

  return `#!/bin/sh
export VSMUX_AGENT=claude
export ELECTRON_RUN_AS_NODE=1
exec ${quoteShellLiteral(process.execPath)} ${quoteShellLiteral(notifyPath)} "$@"
`;
}

export function getClaudeHookSettingsContent(
  notifyPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const command = platform === "win32" ? `"${notifyPath}"` : quoteShellLiteral(notifyPath);

  return `${JSON.stringify(
    {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command,
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command,
              },
            ],
          },
        ],
        StopFailure: [
          {
            hooks: [
              {
                type: "command",
                command,
              },
            ],
          },
        ],
        Notification: [
          {
            matcher: "permission_prompt|idle_prompt",
            hooks: [
              {
                type: "command",
                command,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  )}\n`;
}

export function getZshEnvShimContent(): string {
  return `if [ -f "$HOME/.zshenv" ]; then
  . "$HOME/.zshenv"
fi
`;
}

export function getZshPassThroughShimContent(
  fileName: ".zprofile" | ".zlogin" | ".zlogout",
): string {
  return `if [ -f "$HOME/${fileName}" ]; then
  . "$HOME/${fileName}"
fi
`;
}

export function getZshRcShimContent(binDir: string): string {
  const quotedBinDir = quoteShellLiteral(binDir);

  return `if [ -f "$HOME/.zshrc" ]; then
  . "$HOME/.zshrc"
fi

export PATH=${quotedBinDir}:$PATH
rehash 2>/dev/null || true
unalias claude 2>/dev/null || true
unalias codex 2>/dev/null || true
unalias gemini 2>/dev/null || true
unalias opencode 2>/dev/null || true

if [ -z "$__VSMUX_ZSH_HOOKS_INSTALLED" ]; then
  typeset -g __VSMUX_ZSH_HOOKS_INSTALLED=1

  __vsmux_read_state_value() {
    emulate -L zsh
    local state_file="\${VSMUX_SESSION_STATE_FILE:-}"
    local wanted_key="$1"

    [ -n "$state_file" ] || return 1
    [ -r "$state_file" ] || return 1

    local key value
    while IFS='=' read -r key value; do
      if [ "$key" = "$wanted_key" ]; then
        value=\${value//$'\\r'/ }
        value=\${value//$'\\n'/ }
        value=\${value//$'\\t'/ }
        if [ -n "$value" ]; then
          printf '%s' "$value"
          return 0
        fi

        return 1
      fi
    done < "$state_file"

    return 1
  }

  __vsmux_emit_session_title() {
    emulate -L zsh
    local title="$1"
    [ -n "$title" ] || return 0
    printf '\\033]0;%s\\007' "$title" > /dev/tty
  }

  __vsmux_read_session_title() {
    emulate -L zsh
    __vsmux_read_state_value title
  }

  __vsmux_restore_session_title() {
    emulate -L zsh
    local title="$(__vsmux_read_session_title)"
    [ -n "$title" ] || return 0
    __vsmux_emit_session_title "$title"
  }

  __vsmux_write_session_title() {
    emulate -L zsh
    local state_file="\${VSMUX_SESSION_STATE_FILE:-}"
    local title="$1"
    local session_status="idle"
    local session_agent="\${VSMUX_AGENT:-}"
    local session_last_activity=""

    [ -n "$state_file" ] || return 0

    title=\${title//$'\\r'/ }
    title=\${title//$'\\n'/ }
    title=\${title//$'\\t'/ }

    if [ -r "$state_file" ]; then
      local key value
      while IFS='=' read -r key value; do
        case "$key" in
          status) session_status="$value" ;;
          agent) session_agent="$value" ;;
          lastActivityAt) session_last_activity="$value" ;;
        esac
      done < "$state_file"
    fi

    mkdir -p -- "\${state_file:h}" >/dev/null 2>&1 || true
    local tmp_file="$state_file.tmp.$$"
    {
      printf 'status=%s\\n' "$session_status"
      printf 'agent=%s\\n' "$session_agent"
      printf 'lastActivityAt=%s\\n' "$session_last_activity"
      printf 'title=%s\\n' "$title"
    } >| "$tmp_file" && mv -f -- "$tmp_file" "$state_file"
  }

  vsmux_set_title() {
    emulate -L zsh
    __vsmux_write_session_title "$*"
    __vsmux_emit_session_title "$*"
  }

  alias vam-title='vsmux_set_title'

  autoload -Uz add-zsh-hook 2>/dev/null || true
  if typeset -f add-zsh-hook >/dev/null 2>&1; then
    add-zsh-hook preexec __vsmux_restore_session_title
    add-zsh-hook precmd __vsmux_restore_session_title
  fi
fi

claude() {
  command ${quotedBinDir}/claude "$@"
}
codex() {
  command ${quotedBinDir}/codex "$@"
}
gemini() {
  command ${quotedBinDir}/gemini "$@"
}
opencode() {
  command ${quotedBinDir}/opencode "$@"
}
`;
}

export function getOpenCodePluginContent(
  notifyPath: string,
  nodePath: string,
  logPath: string,
): string {
  return `/**
 * VSmux notification plugin for OpenCode.
 */
export const VSmuxNotifyPlugin = async ({ client }) => {
  if (globalThis.__vsmuxNotifyPluginV1) return {};
  globalThis.__vsmuxNotifyPluginV1 = true;

  const currentSessionId = process?.env?.VSMUX_SESSION_ID;
  if (!currentSessionId) return {};

  const notifyPath = ${JSON.stringify(notifyPath)};
  const nodePath = ${JSON.stringify(nodePath)};
  const logPath = ${JSON.stringify(logPath)};
  let currentState = "idle";
  let rootSessionId = null;
  let stopSent = false;
  const childSessionCache = new Map();

  const logDebug = async (eventName, details = {}) => {
    try {
      const [{ appendFile, mkdir }, { dirname }] = await Promise.all([
        import("node:fs/promises"),
        import("node:path"),
      ]);
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(
        logPath,
        \`\${new Date().toISOString()} \${eventName} \${JSON.stringify({
          ...details,
          currentSessionId,
          currentState,
          rootSessionId,
          stopSent,
        })}\\n\`,
        "utf8",
      );
    } catch {
      // best effort only
    }
  };

  await logDebug("plugin.init");

  const notify = async (eventName) => {
    const payload = JSON.stringify({
      agent: "opencode",
      hook_event_name: eventName,
    });

    await logDebug("notify.dispatch", {
      eventName,
    });

    try {
      const { spawn } = await import("node:child_process");
      await new Promise((resolve) => {
        const child = spawn(nodePath, [notifyPath, payload], {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            VSMUX_AGENT: "opencode",
          },
          stdio: "ignore",
        });
        child.once("error", async (error) => {
          await logDebug("notify.error", {
            eventName,
            error: error instanceof Error ? error.message : String(error),
          });
          resolve(undefined);
        });
        child.once("exit", async (code, signal) => {
          await logDebug("notify.exit", {
            code,
            eventName,
            signal,
          });
          resolve(undefined);
        });
      });
    } catch {
      await logDebug("notify.importError", {
        eventName,
      });
      // best effort only
    }
  };

  const isChildSession = async (sessionId) => {
    if (!sessionId) {
      await logDebug("session.child.skipMissingSessionId");
      return true;
    }
    if (!client?.session?.list) {
      await logDebug("session.child.skipMissingList", {
        sessionId,
      });
      return true;
    }
    if (childSessionCache.has(sessionId)) {
      const cachedResult = childSessionCache.get(sessionId);
      await logDebug("session.child.cacheHit", {
        isChild: cachedResult,
        sessionId,
      });
      return cachedResult;
    }

    try {
      const sessions = await client.session.list();
      const session = sessions.data?.find((candidate) => candidate.id === sessionId);
      const isChild = !!session?.parentID;
      childSessionCache.set(sessionId, isChild);
      await logDebug("session.child.resolved", {
        hasParentId: Boolean(session?.parentID),
        isChild,
        sessionId,
      });
      return isChild;
    } catch {
      await logDebug("session.child.error", {
        sessionId,
      });
      return true;
    }
  };

  const isSessionActive = (status) => status?.type && status.type !== "idle";

  const handleBusy = async (sessionId) => {
    if (!rootSessionId) {
      rootSessionId = sessionId;
    }

    if (sessionId !== rootSessionId) {
      await logDebug("session.busy.ignoredNonRoot", {
        sessionId,
      });
      return;
    }

    if (currentState === "idle") {
      currentState = "busy";
      stopSent = false;
      await logDebug("session.busy.transition", {
        sessionId,
      });
      await notify("Start");
      return;
    }

    await logDebug("session.busy.noopAlreadyBusy", {
      sessionId,
    });
  };

  const handleStop = async (sessionId) => {
    if (rootSessionId && sessionId !== rootSessionId) {
      await logDebug("session.stop.ignoredNonRoot", {
        sessionId,
      });
      return;
    }

    if (currentState === "busy" && !stopSent) {
      currentState = "idle";
      stopSent = true;
      rootSessionId = null;
      await logDebug("session.stop.transition", {
        sessionId,
      });
      await notify("Stop");
      return;
    }

    await logDebug("session.stop.noopAlreadyIdle", {
      sessionId,
    });
  };

  const syncInitialStatus = async () => {
    if (!client?.session?.status) {
      await logDebug("session.status.skipMissingStatusApi");
      return;
    }

    if (await isChildSession(currentSessionId)) {
      await logDebug("session.status.skipChildSession", {
        sessionId: currentSessionId,
      });
      return;
    }

    try {
      const statuses = await client.session.status();
      const status = statuses.data?.[currentSessionId];
      await logDebug("session.status.initial", {
        sessionId: currentSessionId,
        statusType: status?.type,
      });
      if (isSessionActive(status)) {
        await handleBusy(currentSessionId);
        return;
      }

      if (status?.type === "idle") {
        await handleStop(currentSessionId);
      }
    } catch {
      await logDebug("session.status.initialError", {
        sessionId: currentSessionId,
      });
      // best effort only
    }
  };

  setTimeout(() => {
    void syncInitialStatus();
  }, 0);

  return {
    event: async ({ event }) => {
      const sessionId = event.properties?.sessionID;
      await logDebug("session.event.received", {
        eventType: event.type,
        sessionId,
        statusType: event.properties?.status?.type,
      });
      if (await isChildSession(sessionId)) {
        await logDebug("session.event.ignoredChild", {
          eventType: event.type,
          sessionId,
        });
        return;
      }

      if (event.type === "session.status") {
        const status = event.properties?.status;
        if (isSessionActive(status)) {
          await handleBusy(sessionId);
        } else if (status?.type === "idle") {
          await handleStop(sessionId);
        }
      }

      if (event.type === "session.busy") {
        await handleBusy(sessionId);
      }

      if (event.type === "session.idle" || event.type === "session.error") {
        await handleStop(sessionId);
      }
    },
  };
};
`;
}
