import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

type AgentLifecycleEventType = "start" | "stop";

export type AgentLifecycleEvent = {
  agentName?: string;
  eventType: AgentLifecycleEventType;
};

export type ParsedAgentControlChunk = {
  events: AgentLifecycleEvent[];
  output: string;
  pending: string;
};

export type AgentShellIntegration = {
  binDir: string;
  claudeSettingsPath: string;
  notifyPath: string;
  opencodeConfigDir: string;
  zshDotDir: string;
};

const AGENT_CONTROL_COMMAND = "9001";
const AGENT_CONTROL_NAMESPACE = "VSmux";
const AGENT_SHELL_DIR_NAME = "agent-shell-integration";
const CLAUDE_SETTINGS_FILE_NAME = "settings.json";
const CLAUDE_NOTIFY_SCRIPT_STEM = "notify";
const NOTIFY_RUNNER_FILE_NAME = "agent-shell-notify-runner.js";
const OPENCODE_PLUGIN_FILE_NAME = "VSmux-notify.js";
const WRAPPER_RUNNER_FILE_NAME = "agent-shell-wrapper-runner.js";
const CODEX_START_LOG_PATTERNS = [
  [`"type":"event_msg"`, `"payload":{"type":"task_started"`],
  [`"msg":{"type":"task_started"`],
  [`"msg":{"type":"exec_command_begin"`],
] as const;
const CODEX_STOP_LOG_PATTERNS = [
  [`"type":"event_msg"`, `"payload":{"type":"task_complete"`],
  [`"msg":{"type":"task_complete"`],
  [`"msg":{"type":"turn_aborted"`],
] as const;

type AgentWrapperName = "claude" | "codex" | "opencode";

const integrationPromises = new Map<string, Promise<AgentShellIntegration>>();

export async function ensureAgentShellIntegration(
  daemonStateDir: string,
): Promise<AgentShellIntegration> {
  const cached = integrationPromises.get(daemonStateDir);
  if (cached) {
    return cached;
  }

  const pendingIntegration = createAgentShellIntegration(daemonStateDir);
  integrationPromises.set(daemonStateDir, pendingIntegration);

  try {
    return await pendingIntegration;
  } catch (error) {
    integrationPromises.delete(daemonStateDir);
    throw error;
  }
}

export function parseAgentControlChunk(data: string): ParsedAgentControlChunk {
  let index = 0;
  let output = "";
  const events: AgentLifecycleEvent[] = [];

  while (index < data.length) {
    if (data[index] !== "\u001b" || data[index + 1] !== "]") {
      output += data[index];
      index += 1;
      continue;
    }

    const controlStart = index;
    const terminator = findOscTerminator(data, controlStart + 2);
    if (!terminator) {
      return {
        events,
        output,
        pending: data.slice(controlStart),
      };
    }

    const controlBody = data.slice(controlStart + 2, terminator.contentEnd);
    const sequence = data.slice(controlStart, terminator.sequenceEnd);
    const parsedEvent = parseAgentControlEvent(controlBody);

    if (parsedEvent) {
      events.push(parsedEvent);
    } else {
      output += sequence;
    }

    index = terminator.sequenceEnd;
  }

  return {
    events,
    output,
    pending: "",
  };
}

export function detectCodexLifecycleEventFromLogLine(
  line: string,
): AgentLifecycleEventType | undefined {
  if (matchesLogPattern(line, CODEX_START_LOG_PATTERNS)) {
    return "start";
  }

  if (matchesLogPattern(line, CODEX_STOP_LOG_PATTERNS)) {
    return "stop";
  }

  return undefined;
}

async function createAgentShellIntegration(daemonStateDir: string): Promise<AgentShellIntegration> {
  const integrationRoot = path.join(daemonStateDir, AGENT_SHELL_DIR_NAME);
  const binDir = path.join(integrationRoot, "bin");
  const hooksDir = path.join(integrationRoot, "hooks");
  const claudeConfigDir = path.join(hooksDir, "claude");
  const claudeSettingsPath = path.join(claudeConfigDir, CLAUDE_SETTINGS_FILE_NAME);
  const notifyPath = path.join(__dirname, NOTIFY_RUNNER_FILE_NAME);
  const wrapperRunnerPath = path.join(__dirname, WRAPPER_RUNNER_FILE_NAME);
  const claudeNotifyCommandPath = path.join(
    claudeConfigDir,
    process.platform === "win32"
      ? `${CLAUDE_NOTIFY_SCRIPT_STEM}.cmd`
      : `${CLAUDE_NOTIFY_SCRIPT_STEM}.sh`,
  );
  const opencodeConfigDir = path.join(hooksDir, "opencode");
  const opencodePluginDir = path.join(opencodeConfigDir, "plugin");
  const opencodePluginPath = path.join(opencodePluginDir, OPENCODE_PLUGIN_FILE_NAME);
  const zshDotDir = path.join(integrationRoot, "zsh");

  await mkdir(binDir, { recursive: true });
  await mkdir(hooksDir, { recursive: true });
  await mkdir(claudeConfigDir, { recursive: true });
  await mkdir(opencodePluginDir, { recursive: true });
  await mkdir(zshDotDir, { recursive: true });

  await writeFileIfChanged(
    claudeNotifyCommandPath,
    getClaudeNotifyCommandContent(notifyPath),
    process.platform === "win32" ? 0o644 : 0o755,
  );
  await writeFileIfChanged(
    claudeSettingsPath,
    getClaudeHookSettingsContent(claudeNotifyCommandPath, process.platform),
    0o644,
  );

  for (const agentName of ["claude", "codex", "opencode"] as const) {
    await writeFileIfChanged(
      path.join(binDir, agentName),
      getAgentWrapperShellScriptContent(agentName, {
        binDir,
        claudeSettingsPath,
        notifyPath,
        opencodeConfigDir,
        wrapperRunnerPath,
      }),
      0o755,
    );
    if (process.platform === "win32") {
      await writeFileIfChanged(
        path.join(binDir, `${agentName}.cmd`),
        getAgentWrapperCmdContent(agentName, {
          binDir,
          claudeSettingsPath,
          notifyPath,
          opencodeConfigDir,
          wrapperRunnerPath,
        }),
        0o644,
      );
    }
  }

  await writeFileIfChanged(
    opencodePluginPath,
    getOpenCodePluginContent(notifyPath, process.execPath),
    0o644,
  );
  await writeFileIfChanged(path.join(zshDotDir, ".zshenv"), getZshEnvShimContent(), 0o644);
  await writeFileIfChanged(
    path.join(zshDotDir, ".zprofile"),
    getZshPassThroughShimContent(".zprofile"),
    0o644,
  );
  await writeFileIfChanged(path.join(zshDotDir, ".zshrc"), getZshRcShimContent(binDir), 0o644);
  await writeFileIfChanged(
    path.join(zshDotDir, ".zlogin"),
    getZshPassThroughShimContent(".zlogin"),
    0o644,
  );
  await writeFileIfChanged(
    path.join(zshDotDir, ".zlogout"),
    getZshPassThroughShimContent(".zlogout"),
    0o644,
  );

  return {
    binDir,
    claudeSettingsPath,
    notifyPath,
    opencodeConfigDir,
    zshDotDir,
  };
}

async function writeFileIfChanged(filePath: string, content: string, mode: number): Promise<void> {
  let existingContent: string | undefined;

  try {
    existingContent = await readFile(filePath, "utf8");
  } catch {
    existingContent = undefined;
  }

  if (existingContent === content) {
    return;
  }

  await writeFile(filePath, content, { mode });
}

function getAgentWrapperShellScriptContent(
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

function getAgentWrapperCmdContent(
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
set ELECTRON_RUN_AS_NODE=1
"${process.execPath}" "${options.wrapperRunnerPath}" --agent ${agentName} --bin-dir "${options.binDir}" --claude-settings-path "${options.claudeSettingsPath}" --notify-runner-path "${options.notifyPath}" --opencode-config-dir "${options.opencodeConfigDir}" -- %*
`;
}

function getClaudeNotifyCommandContent(notifyPath: string): string {
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

function parseAgentControlEvent(controlBody: string): AgentLifecycleEvent | undefined {
  const controlParts = controlBody.split(";");
  if (
    controlParts[0] !== AGENT_CONTROL_COMMAND ||
    controlParts[1] !== AGENT_CONTROL_NAMESPACE ||
    controlParts.length < 3
  ) {
    return undefined;
  }

  const normalizedEventType = normalizeLifecycleEventType(controlParts[2]);
  if (!normalizedEventType) {
    return undefined;
  }

  const agentName = controlParts[3]?.trim() || undefined;

  return {
    agentName,
    eventType: normalizedEventType,
  };
}

function normalizeLifecycleEventType(
  value: string | undefined,
): AgentLifecycleEventType | undefined {
  switch (value?.trim().toLowerCase()) {
    case "start":
      return "start";
    case "stop":
      return "stop";
    default:
      return undefined;
  }
}

function findOscTerminator(
  data: string,
  startIndex: number,
): { contentEnd: number; sequenceEnd: number } | undefined {
  for (let index = startIndex; index < data.length; index += 1) {
    const currentCharacter = data[index];
    if (currentCharacter === "\u0007") {
      return {
        contentEnd: index,
        sequenceEnd: index + 1,
      };
    }

    if (currentCharacter === "\u001b" && data[index + 1] === "\\") {
      return {
        contentEnd: index,
        sequenceEnd: index + 2,
      };
    }
  }

  return undefined;
}

function quoteShellLiteral(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function matchesLogPattern(line: string, patterns: readonly (readonly string[])[]): boolean {
  return patterns.some((pattern) => pattern.every((fragment) => line.includes(fragment)));
}

function getZshEnvShimContent(): string {
  return `if [ -f "$HOME/.zshenv" ]; then
  . "$HOME/.zshenv"
fi
`;
}

function getZshPassThroughShimContent(fileName: ".zprofile" | ".zlogin" | ".zlogout"): string {
  return `if [ -f "$HOME/${fileName}" ]; then
  . "$HOME/${fileName}"
fi
`;
}

function getZshRcShimContent(binDir: string): string {
  const quotedBinDir = quoteShellLiteral(binDir);

  return `if [ -f "$HOME/.zshrc" ]; then
  . "$HOME/.zshrc"
fi

export PATH=${quotedBinDir}:$PATH
rehash 2>/dev/null || true
unalias claude 2>/dev/null || true
unalias codex 2>/dev/null || true
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

  __vsmux_write_session_title() {
    emulate -L zsh
    local state_file="\${VSMUX_SESSION_STATE_FILE:-}"
    local title="$1"
    local session_status="idle"
    local session_agent="\${VSMUX_AGENT:-}"

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
        esac
      done < "$state_file"
    fi

    mkdir -p -- "\${state_file:h}" >/dev/null 2>&1 || true
    local tmp_file="$state_file.tmp.$$"
    {
      printf 'status=%s\\n' "$session_status"
      printf 'agent=%s\\n' "$session_agent"
      printf 'title=%s\\n' "$title"
    } >| "$tmp_file" && mv -f -- "$tmp_file" "$state_file"
  }

  vsmux_set_title() {
    emulate -L zsh
    __vsmux_write_session_title "$*"
    __vsmux_emit_session_title "$*"
  }

  alias vam-title='vsmux_set_title'
fi

claude() {
  command ${quotedBinDir}/claude "$@"
}
codex() {
  command ${quotedBinDir}/codex "$@"
}
opencode() {
  command ${quotedBinDir}/opencode "$@"
}
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

function getOpenCodePluginContent(notifyPath: string, nodePath: string): string {
  return `/**
 * VSmux notification plugin for OpenCode.
 */
export const VSmuxNotifyPlugin = async ({ client }) => {
  if (globalThis.__vsmuxNotifyPluginV1) return {};
  globalThis.__vsmuxNotifyPluginV1 = true;

  if (!process?.env?.VSMUX_SESSION_ID) return {};

  const notifyPath = ${JSON.stringify(notifyPath)};
  const nodePath = ${JSON.stringify(nodePath)};
  let currentState = "idle";
  let rootSessionId = null;
  let stopSent = false;
  const childSessionCache = new Map();

  const notify = async (eventName) => {
    const payload = JSON.stringify({
      agent: "opencode",
      hook_event_name: eventName,
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
        child.once("error", () => resolve(undefined));
        child.once("exit", () => resolve(undefined));
      });
    } catch {
      // best effort only
    }
  };

  const isChildSession = async (sessionId) => {
    if (!sessionId) return true;
    if (!client?.session?.list) return true;
    if (childSessionCache.has(sessionId)) {
      return childSessionCache.get(sessionId);
    }

    try {
      const sessions = await client.session.list();
      const session = sessions.data?.find((candidate) => candidate.id === sessionId);
      const isChild = !!session?.parentID;
      childSessionCache.set(sessionId, isChild);
      return isChild;
    } catch {
      return true;
    }
  };

  const handleBusy = async (sessionId) => {
    if (!rootSessionId) {
      rootSessionId = sessionId;
    }

    if (sessionId !== rootSessionId) {
      return;
    }

    if (currentState === "idle") {
      currentState = "busy";
      stopSent = false;
      await notify("Start");
    }
  };

  const handleStop = async (sessionId) => {
    if (rootSessionId && sessionId !== rootSessionId) {
      return;
    }

    if (currentState === "busy" && !stopSent) {
      currentState = "idle";
      stopSent = true;
      rootSessionId = null;
      await notify("Stop");
    }
  };

  return {
    event: async ({ event }) => {
      const sessionId = event.properties?.sessionID;
      if (await isChildSession(sessionId)) {
        return;
      }

      if (event.type === "session.status") {
        const status = event.properties?.status;
        if (status?.type === "busy") {
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
