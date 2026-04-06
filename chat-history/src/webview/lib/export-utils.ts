import type { Conversation, ErrorJsonl } from "./conversation-schema";
import type { ToolResultContent } from "./conversation-schema/content/ToolResultContentSchema";

// All possible export options
export interface ExportOptions {
  // Message types
  userMessages: boolean;
  assistantMessages: boolean;
  thinkingContent: boolean;
  systemMessages: boolean;
  summaryMessages: boolean;
  fileHistorySnapshots: boolean;
  queueOperations: boolean;

  // Tool content (parent toggle)
  toolContent: boolean;

  // Individual tools
  tools: {
    Bash: boolean;
    Read: boolean;
    Write: boolean;
    Edit: boolean;
    Glob: boolean;
    Grep: boolean;
    WebFetch: boolean;
    Task: boolean;
    TodoWrite: boolean;
    // MCP Browser tools
    mcp_computer: boolean;
    mcp_javascript: boolean;
    mcp_navigate: boolean;
    mcp_network: boolean;
    mcp_tabs: boolean;
    mcp_console: boolean;
    mcp_read_page: boolean;
    mcp_find: boolean;
    mcp_form_input: boolean;
    mcp_other: boolean; // catch-all for other MCP tools
  };
}

// Default export options (all enabled)
export const defaultExportOptions: ExportOptions = {
  userMessages: true,
  assistantMessages: true,
  thinkingContent: true,
  systemMessages: true,
  summaryMessages: true,
  fileHistorySnapshots: false,
  queueOperations: false,
  toolContent: true,
  tools: {
    Bash: true,
    Read: true,
    Write: true,
    Edit: true,
    Glob: true,
    Grep: true,
    WebFetch: true,
    Task: true,
    TodoWrite: true,
    mcp_computer: true,
    mcp_javascript: true,
    mcp_navigate: true,
    mcp_network: true,
    mcp_tabs: true,
    mcp_console: true,
    mcp_read_page: true,
    mcp_find: true,
    mcp_form_input: true,
    mcp_other: true,
  },
};

// Tool name categories
const CORE_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "Task",
  "TodoWrite",
] as const;
type CoreTool = (typeof CORE_TOOLS)[number];

export const TOOL_CATEGORIES = {
  core: CORE_TOOLS,
  mcpBrowser: [
    "mcp__claude-in-chrome__computer",
    "mcp__claude-in-chrome__javascript_tool",
    "mcp__claude-in-chrome__navigate",
    "mcp__claude-in-chrome__read_network_requests",
    "mcp__claude-in-chrome__tabs_context_mcp",
    "mcp__claude-in-chrome__tabs_create_mcp",
    "mcp__claude-in-chrome__read_console_messages",
    "mcp__claude-in-chrome__read_page",
    "mcp__claude-in-chrome__find",
    "mcp__claude-in-chrome__form_input",
  ],
} as const;

function isCoreToolName(name: string): name is CoreTool {
  return (CORE_TOOLS as readonly string[]).includes(name);
}

// Map tool names to export option keys
function getToolOptionKey(toolName: string): keyof ExportOptions["tools"] | null {
  // Core tools
  if (isCoreToolName(toolName)) {
    return toolName;
  }

  // MCP Browser tools
  if (toolName.startsWith("mcp__claude-in-chrome__")) {
    const mcpTool = toolName.replace("mcp__claude-in-chrome__", "");
    if (mcpTool === "computer") return "mcp_computer";
    if (mcpTool === "javascript_tool") return "mcp_javascript";
    if (mcpTool === "navigate") return "mcp_navigate";
    if (mcpTool === "read_network_requests") return "mcp_network";
    if (mcpTool.startsWith("tabs_")) return "mcp_tabs";
    if (mcpTool === "read_console_messages") return "mcp_console";
    if (mcpTool === "read_page") return "mcp_read_page";
    if (mcpTool === "find") return "mcp_find";
    if (mcpTool === "form_input") return "mcp_form_input";
    return "mcp_other";
  }

  // Other MCP tools
  if (toolName.startsWith("mcp__")) {
    return "mcp_other";
  }

  return null;
}

function isToolEnabled(toolName: string, options: ExportOptions): boolean {
  if (!options.toolContent) return false;
  const key = getToolOptionKey(toolName);
  if (!key) return true; // Unknown tools are included by default
  return options.tools[key];
}

// Separator
const SEPARATOR = "\n\n ------------- \n\n";

// Export tags for re-import
const TAGS = {
  header: "<!-- VSMUX-SEARCH-EXPORT-START -->",
  footer: "<!-- VSMUX-SEARCH-EXPORT-END -->",
  metadata: "<!-- METADATA",
  user: "<!-- USER-MESSAGE -->",
  assistant: "<!-- ASSISTANT-MESSAGE -->",
  thinking: "<!-- THINKING -->",
  system: "<!-- SYSTEM-MESSAGE -->",
  summary: "<!-- SUMMARY -->",
  fileHistory: "<!-- FILE-HISTORY-SNAPSHOT -->",
  queueOp: "<!-- QUEUE-OPERATION -->",
  toolUse: "<!-- TOOL-USE:",
  toolResult: "<!-- TOOL-RESULT:",
  image: "<!-- IMAGE -->",
};

// Format a single content item
function formatTextContent(text: string): string {
  return text.trim();
}

function formatThinkingContent(thinking: string): string {
  return `${TAGS.thinking}\n<thinking>\n${thinking.trim()}\n</thinking>`;
}

function formatToolUse(name: string, input: Record<string, unknown>): string {
  const inputStr = JSON.stringify(input, null, 2);
  return `${TAGS.toolUse} ${name} -->\n**Tool: ${name}**\n\`\`\`json\n${inputStr}\n\`\`\``;
}

function formatToolResult(
  toolName: string,
  content: ToolResultContent["content"],
  isError?: boolean,
): string {
  const prefix = isError ? "**Error:**\n" : "";

  if (typeof content === "string") {
    // Truncate very long results
    const truncated =
      content.length > 5000 ? content.substring(0, 5000) + "\n... (truncated)" : content;
    return `${TAGS.toolResult} ${toolName} -->\n${prefix}\`\`\`\n${truncated}\n\`\`\``;
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (item.type === "text") {
        const truncated =
          item.text.length > 5000 ? item.text.substring(0, 5000) + "\n... (truncated)" : item.text;
        parts.push(truncated);
      } else if (item.type === "image") {
        parts.push(`${TAGS.image}\n[Image: ${item.source?.type || "base64"}]`);
      }
    }
    return `${TAGS.toolResult} ${toolName} -->\n${prefix}\`\`\`\n${parts.join("\n")}\n\`\`\``;
  }

  return `${TAGS.toolResult} ${toolName} -->\n${prefix}(empty result)`;
}

// Build tool result map from conversations
function buildToolResultMap(
  conversations: (Conversation | ErrorJsonl)[],
): Map<string, { toolName: string; result: ToolResultContent }> {
  const map = new Map<string, { toolName: string; result: ToolResultContent }>();

  // First pass: collect tool_use names by ID
  const toolNames = new Map<string, string>();
  for (const conv of conversations) {
    if (conv.type === "x-error") continue;
    if (conv.type !== "assistant") continue;
    const content = conv.message.content;
    if (!Array.isArray(content)) continue;

    for (const item of content) {
      if (typeof item === "string") continue;
      if (item.type === "tool_use") {
        toolNames.set(item.id, item.name);
      }
    }
  }

  // Second pass: collect tool results with names
  for (const conv of conversations) {
    if (conv.type === "x-error") continue;
    if (conv.type !== "user") continue;
    const content = conv.message.content;
    if (typeof content === "string") continue;

    for (const item of content) {
      if (typeof item === "string") continue;
      if (item.type === "tool_result") {
        const toolName = toolNames.get(item.tool_use_id) || "unknown";
        map.set(item.tool_use_id, { toolName, result: item });
      }
    }
  }

  return map;
}

// Main export function
export function exportConversation(
  conversations: (Conversation | ErrorJsonl)[],
  options: ExportOptions,
  fileName: string,
): string {
  const toolResultMap = buildToolResultMap(conversations);
  const parts: string[] = [];

  // Header with metadata
  const sessionId = fileName.replace(".jsonl", "").replace("agent-", "");
  const timestamp = new Date().toISOString();

  parts.push(TAGS.header);
  parts.push(`${TAGS.metadata} sessionId="${sessionId}" exportedAt="${timestamp}" -->`);
  parts.push(`# Conversation Export: ${sessionId}`);
  parts.push(`Exported: ${new Date().toLocaleString()}`);

  // Process each conversation entry
  for (const conv of conversations) {
    if (conv.type === "x-error") continue;

    const entryParts: string[] = [];

    switch (conv.type) {
      case "user": {
        if (!options.userMessages) continue;

        const content = conv.message.content;
        if (typeof content === "string") {
          entryParts.push(`${TAGS.user}\n**User:**\n${formatTextContent(content)}`);
        } else {
          const textParts: string[] = [];
          const toolResults: string[] = [];

          for (const item of content) {
            if (typeof item === "string") {
              textParts.push(item);
            } else if (item.type === "text") {
              textParts.push(item.text);
            } else if (item.type === "image" && options.userMessages) {
              textParts.push(`${TAGS.image}\n[User shared an image]`);
            } else if (item.type === "tool_result") {
              const toolData = toolResultMap.get(item.tool_use_id);
              const toolName = toolData?.toolName || "unknown";

              if (options.toolContent && isToolEnabled(toolName, options)) {
                toolResults.push(formatToolResult(toolName, item.content, item.is_error));
              }
            }
          }

          if (textParts.length > 0) {
            entryParts.push(`${TAGS.user}\n**User:**\n${textParts.join("\n")}`);
          }

          if (toolResults.length > 0) {
            entryParts.push(...toolResults);
          }
        }
        break;
      }

      case "assistant": {
        if (!options.assistantMessages && !options.thinkingContent && !options.toolContent)
          continue;

        const content = conv.message.content;
        const textParts: string[] = [];
        const thinkingParts: string[] = [];
        const toolParts: string[] = [];

        if (Array.isArray(content)) {
          for (const item of content) {
            if (typeof item === "string") {
              if (options.assistantMessages) {
                textParts.push(item);
              }
            } else if (item.type === "text") {
              if (options.assistantMessages) {
                textParts.push(item.text);
              }
            } else if (item.type === "thinking") {
              if (options.thinkingContent) {
                thinkingParts.push(formatThinkingContent(item.thinking));
              }
            } else if (item.type === "tool_use") {
              if (options.toolContent && isToolEnabled(item.name, options)) {
                toolParts.push(formatToolUse(item.name, item.input));
              }
            }
          }
        }

        if (thinkingParts.length > 0) {
          entryParts.push(...thinkingParts);
        }

        if (textParts.length > 0) {
          entryParts.push(`${TAGS.assistant}\n**Assistant:**\n${textParts.join("\n")}`);
        }

        if (toolParts.length > 0) {
          entryParts.push(...toolParts);
        }
        break;
      }

      case "system": {
        if (!options.systemMessages) continue;
        entryParts.push(`${TAGS.system}\n**System:**\n${conv.content || "(no content)"}`);
        break;
      }

      case "summary": {
        if (!options.summaryMessages) continue;
        const summaryText =
          typeof conv.summary === "string" ? conv.summary : JSON.stringify(conv.summary, null, 2);
        entryParts.push(`${TAGS.summary}\n**Summary:**\n${summaryText}`);
        break;
      }

      case "file-history-snapshot": {
        if (!options.fileHistorySnapshots) continue;
        const snapshotStr = JSON.stringify(conv.snapshot, null, 2);
        entryParts.push(
          `${TAGS.fileHistory}\n**File History Snapshot:**\n\`\`\`json\n${snapshotStr}\n\`\`\``,
        );
        break;
      }

      case "queue-operation": {
        if (!options.queueOperations) continue;
        const opDetails = `Operation: ${conv.operation}`;
        entryParts.push(`${TAGS.queueOp}\n**Queue Operation:**\n${opDetails}`);
        break;
      }
    }

    if (entryParts.length > 0) {
      parts.push(SEPARATOR);
      parts.push(entryParts.join("\n\n"));
    }
  }

  parts.push(SEPARATOR);
  parts.push(TAGS.footer);

  return parts.join("\n");
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Save to file
export function saveToFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate default export filename
export function getExportFileName(originalFileName: string): string {
  const sessionId = originalFileName.replace(".jsonl", "");
  return `vsmux-search-export-${sessionId}.md`;
}
