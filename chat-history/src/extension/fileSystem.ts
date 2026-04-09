import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logChatHistoryError, logChatHistoryWarn } from "./log";

export const MIN_FILE_SIZE = 1 * 1024; // 1KB minimum
export const MAX_FILE_SIZE_FOR_FULL_READ = 50 * 1024 * 1024; // 50MB limit for full file reads
export const SUMMARY_CHUNK_SIZE = 50 * 1024; // 50KB for summary extraction
export const CODEX_SUMMARY_CHUNK_SIZE = 200 * 1024; // Codex files often start with large instructions

const CODEX_UNKNOWN_FOLDER = "__codex_unknown__";

export type ConversationSource = "Claude" | "Codex";
export type ConversationProfile = "Work" | "Personal";

export interface ConversationFile {
  name: string;
  path: string;
  folder: string;
  size: number;
  summary: string | null; // null means summary not yet loaded
  lastModified: Date;
  source?: ConversationSource;
  profile?: ConversationProfile;
}

export interface FolderNode {
  name: string;
  path: string;
  files: ConversationFile[];
}

interface CodexSessionContext {
  sessionId: string;
  cwd: string;
  version: string;
  model: string;
  agentId?: string;
}

type JsonRecord = Record<string, unknown>;

/**
 * Get the home directory
 */
export function getHomeDirectory(): string {
  return os.homedir();
}

/**
 * Get the Claude projects directory path
 */
export function getClaudeProjectsPath(): string {
  return path.join(getHomeDirectory(), ".claude", "projects");
}

/**
 * Get all Claude projects directory paths (default + profile roots)
 */
export function getClaudeProjectsPaths(): string[] {
  const home = getHomeDirectory();
  return [
    path.join(home, ".claude", "projects"),
    path.join(home, ".claude-profiles", "work", "projects"),
    path.join(home, ".claude-profiles", "personal", "projects"),
  ];
}

/**
 * Get the Codex root directory path
 */
export function getCodexPath(): string {
  return path.join(getHomeDirectory(), ".codex");
}

/**
 * Get all Codex base directories (default + profile roots)
 */
export function getCodexPaths(): string[] {
  const home = getHomeDirectory();
  return [
    path.join(home, ".codex"),
    path.join(home, ".codex-profiles", "work"),
    path.join(home, ".codex-profiles", "personal"),
  ];
}

/**
 * Get all Codex session roots we should scan for JSONL conversations
 */
export function getCodexSessionRoots(): string[] {
  const sessionRoots = getCodexPaths().flatMap((codexPath) => [
    path.join(codexPath, "sessions"),
    path.join(codexPath, "archived_sessions"),
  ]);
  return Array.from(new Set(sessionRoots));
}

/**
 * Check if the Claude projects directory exists
 */
export function claudeProjectsExist(): boolean {
  return getClaudeProjectsPaths().some((projectsPath) => fs.existsSync(projectsPath));
}

/**
 * Check if Codex sessions exist
 */
export function codexSessionsExist(): boolean {
  return getCodexSessionRoots().some((rootPath) => fs.existsSync(rootPath));
}

/**
 * Check if any supported conversation store exists
 */
export function conversationStoresExist(): boolean {
  return claudeProjectsExist() || codexSessionsExist();
}

function parseJsonLine(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function detectConversationProfile(basePath: string): ConversationProfile | undefined {
  const normalized = basePath.replace(/\\/g, "/");

  if (
    normalized.endsWith("/.claude-profiles/work/projects") ||
    normalized.includes("/.claude-profiles/work/") ||
    normalized.endsWith("/.codex-profiles/work") ||
    normalized.includes("/.codex-profiles/work/")
  ) {
    return "Work";
  }

  if (
    normalized.endsWith("/.claude-profiles/personal/projects") ||
    normalized.includes("/.claude-profiles/personal/") ||
    normalized.endsWith("/.codex-profiles/personal") ||
    normalized.includes("/.codex-profiles/personal/")
  ) {
    return "Personal";
  }

  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function normalizeSummaryCandidate(text: string): string {
  return text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function isMetaConversationText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const metaPrefixes = [
    "<command",
    "<environment_context",
    "<permissions instructions>",
    "<user_instructions>",
    "<INSTRUCTIONS>",
    "<collaboration_mode>",
    "<app-context>",
    "<turn_aborted>",
    "<ide_opened_file>",
    "<local-",
    "[Tool Result]",
    "Caveat:",
  ];

  if (metaPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }

  if (trimmed.startsWith("# AGENTS")) {
    return true;
  }

  if (trimmed.includes("tool_use_id")) {
    return true;
  }

  return false;
}

function extractClaudeSummaryCandidate(entry: JsonRecord): string | null {
  if (entry.type !== "user") return null;

  const message = asRecord(entry.message);
  if (!message) return null;

  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block.type === "text" && typeof block.text === "string") {
        return block.text;
      }
    }
  }

  return null;
}

function extractCodexMessageText(content: unknown): string {
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];

  for (const block of content) {
    if (!isRecord(block)) continue;

    const blockType = getString(block.type);
    if (!blockType) continue;

    if (
      (blockType === "input_text" || blockType === "output_text") &&
      typeof block.text === "string"
    ) {
      parts.push(block.text);
      continue;
    }

    if (blockType === "input_image") {
      const imageUrl = getString(block.image_url) ?? getString(block.url);
      parts.push(imageUrl ? `[Image] ${imageUrl}` : "[Image]");
    }
  }

  return parts.join("\n\n").trim();
}

function extractCodexSummaryCandidates(entry: JsonRecord): string[] {
  const candidates: string[] = [];

  if (entry.type === "response_item") {
    const payload = asRecord(entry.payload);
    if (!payload) return candidates;

    if (payload.type === "message" && payload.role === "user") {
      const text = extractCodexMessageText(payload.content);
      if (text) candidates.push(text);
    }

    return candidates;
  }

  if (entry.type === "message" && entry.role === "user") {
    const text = extractCodexMessageText(entry.content);
    if (text) candidates.push(text);
    return candidates;
  }

  if (entry.type === "event_msg") {
    const payload = asRecord(entry.payload);
    if (!payload) return candidates;

    if (payload.type === "user_message" && typeof payload.message === "string") {
      candidates.push(payload.message);
    }
  }

  return candidates;
}

function looksLikeCodexEntry(entry: JsonRecord): boolean {
  if (typeof entry.type === "string") {
    if (
      [
        "session_meta",
        "response_item",
        "event_msg",
        "turn_context",
        "compacted",
        "message",
      ].includes(entry.type)
    ) {
      return true;
    }

    if (
      [
        "user",
        "assistant",
        "system",
        "summary",
        "file-history-snapshot",
        "queue-operation",
      ].includes(entry.type)
    ) {
      return false;
    }
  }

  if (typeof entry.id === "string" && typeof entry.instructions === "string") {
    return true;
  }

  if (entry.record_type === "state") {
    return true;
  }

  return false;
}

function isLikelyCodexJsonl(content: string, filePath?: string): boolean {
  const codexRoots = getCodexPaths().map((codexPath) => `${codexPath}${path.sep}`);
  if (filePath && codexRoots.some((codexRoot) => filePath.startsWith(codexRoot))) {
    return true;
  }

  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) continue;
    return looksLikeCodexEntry(parsed);
  }

  return false;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return new Date().toISOString();
}

function parseToolInput(raw: unknown): Record<string, unknown> {
  if (isRecord(raw)) {
    return raw;
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed)) {
      return parsed;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function normalizeToolOutput(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw === undefined) {
    return "";
  }

  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function createBaseEntry(
  context: CodexSessionContext,
  timestamp: unknown,
  isMeta?: boolean,
): {
  isSidechain: boolean;
  userType: "external";
  cwd: string;
  sessionId: string;
  version: string;
  uuid: string;
  timestamp: string;
  parentUuid: null;
  isMeta?: boolean;
  agentId?: string;
} {
  return {
    isSidechain: false,
    userType: "external",
    cwd: context.cwd,
    sessionId: context.sessionId,
    version: context.version,
    uuid: randomUUID(),
    timestamp: normalizeTimestamp(timestamp),
    parentUuid: null,
    ...(isMeta ? { isMeta: true } : {}),
    ...(context.agentId ? { agentId: context.agentId } : {}),
  };
}

function createAssistantMessage(
  context: CodexSessionContext,
  timestamp: unknown,
  content: Array<Record<string, unknown>>,
  isMeta?: boolean,
): JsonRecord {
  return {
    ...createBaseEntry(context, timestamp, isMeta),
    type: "assistant",
    message: {
      id: randomUUID(),
      type: "message",
      role: "assistant",
      model: context.model,
      content,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    },
  };
}

function createUserMessage(
  context: CodexSessionContext,
  timestamp: unknown,
  content: string | Array<Record<string, unknown>>,
  isMeta?: boolean,
): JsonRecord {
  return {
    ...createBaseEntry(context, timestamp, isMeta),
    type: "user",
    message: {
      role: "user",
      content,
    },
  };
}

function createSystemMessage(
  context: CodexSessionContext,
  timestamp: unknown,
  content: string,
  isMeta?: boolean,
): JsonRecord {
  return {
    ...createBaseEntry(context, timestamp, isMeta),
    type: "system",
    content,
    toolUseID: randomUUID(),
    level: "info",
  };
}

function pushAssistantText(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  entries.push(createAssistantMessage(context, timestamp, [{ type: "text", text: trimmed }]));
}

function pushAssistantThinking(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  entries.push(
    createAssistantMessage(context, timestamp, [{ type: "thinking", thinking: trimmed }]),
  );
}

function pushAssistantToolUse(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  toolId: string,
  toolName: string,
  input: Record<string, unknown>,
): void {
  entries.push(
    createAssistantMessage(
      context,
      timestamp,
      [
        {
          type: "tool_use",
          id: toolId,
          name: toolName,
          input,
        },
      ],
      true,
    ),
  );
}

function pushUserToolResult(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  toolUseId: string,
  output: string,
  isError?: boolean,
): void {
  entries.push(
    createUserMessage(
      context,
      timestamp,
      [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: output,
          ...(isError ? { is_error: true } : {}),
        },
      ],
      true,
    ),
  );
}

function pushUserText(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  entries.push(createUserMessage(context, timestamp, trimmed, isMetaConversationText(trimmed)));
}

function pushDeveloperAsSystem(
  entries: JsonRecord[],
  context: CodexSessionContext,
  timestamp: unknown,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  entries.push(createSystemMessage(context, timestamp, trimmed, true));
}

function extractReasoningSummary(payload: JsonRecord): string {
  const summary = payload.summary;
  if (Array.isArray(summary)) {
    const parts: string[] = [];
    for (const item of summary) {
      if (!isRecord(item)) continue;
      if (typeof item.text === "string") {
        parts.push(item.text);
      }
    }
    return parts.join("\n\n").trim();
  }

  return "";
}

function updateContextFromSessionMeta(context: CodexSessionContext, entry: JsonRecord): void {
  if (entry.type !== "session_meta") return;

  const payload = asRecord(entry.payload);
  if (!payload) return;

  const sessionId = getString(payload.id);
  if (sessionId) {
    context.sessionId = sessionId;
  }

  const cwd = getString(payload.cwd);
  if (cwd) {
    context.cwd = cwd;
  }

  const cliVersion = getString(payload.cli_version);
  if (cliVersion) {
    context.version = cliVersion;
  }

  const model = getString(payload.model);
  if (model) {
    context.model = model;
  }

  const source = asRecord(payload.source);
  const subagent = source ? asRecord(source.subagent) : undefined;
  const threadSpawn = subagent ? asRecord(subagent.thread_spawn) : undefined;
  const parentThreadId = threadSpawn ? getString(threadSpawn.parent_thread_id) : undefined;
  if (parentThreadId) {
    context.agentId = parentThreadId;
  }
}

function updateContextFromTurnContext(context: CodexSessionContext, entry: JsonRecord): void {
  if (entry.type !== "turn_context") return;

  const payload = asRecord(entry.payload);
  if (!payload) return;

  const cwd = getString(payload.cwd);
  if (cwd && !context.cwd) {
    context.cwd = cwd;
  }

  const model = getString(payload.model);
  if (model) {
    context.model = model;
  }
}

function extractCodexSessionMeta(content: string): { cwd?: string } {
  const result: { cwd?: string } = {};

  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;

    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) continue;

    if (parsed.type === "session_meta") {
      const payload = asRecord(parsed.payload);
      const cwd = payload ? getString(payload.cwd) : undefined;
      if (cwd) {
        result.cwd = cwd;
        return result;
      }
    }

    if (parsed.type === "turn_context") {
      const payload = asRecord(parsed.payload);
      const cwd = payload ? getString(payload.cwd) : undefined;
      if (cwd) {
        result.cwd = cwd;
        return result;
      }
    }
  }

  return result;
}

function convertCodexJsonlToConversationJsonl(content: string): string {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  const hasResponseMessages = lines.some((line) => {
    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) return false;
    if (parsed.type !== "response_item") return false;
    const payload = asRecord(parsed.payload);
    return payload?.type === "message";
  });

  const context: CodexSessionContext = {
    sessionId: randomUUID(),
    cwd: "",
    version: "codex",
    model: "gpt-5-codex",
  };

  const entries: JsonRecord[] = [];

  for (const line of lines) {
    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) continue;

    updateContextFromSessionMeta(context, parsed);
    updateContextFromTurnContext(context, parsed);

    if (parsed.type === "response_item") {
      const payload = asRecord(parsed.payload);
      if (!payload) continue;

      if (payload.type === "message") {
        const role = getString(payload.role);
        const text = extractCodexMessageText(payload.content);
        const timestamp = parsed.timestamp;

        if (role === "assistant") {
          pushAssistantText(entries, context, timestamp, text);
        } else if (role === "user") {
          pushUserText(entries, context, timestamp, text);
        } else if (role === "developer") {
          pushDeveloperAsSystem(entries, context, timestamp, text);
        }

        continue;
      }

      if (payload.type === "reasoning") {
        const summaryText = extractReasoningSummary(payload);
        if (summaryText) {
          pushAssistantThinking(entries, context, parsed.timestamp, summaryText);
        }
        continue;
      }

      if (payload.type === "function_call" || payload.type === "custom_tool_call") {
        const toolId = getString(payload.call_id) ?? randomUUID();
        const toolName = getString(payload.name) ?? "tool_call";
        const rawInput = payload.arguments ?? payload.input;
        pushAssistantToolUse(
          entries,
          context,
          parsed.timestamp,
          toolId,
          toolName,
          parseToolInput(rawInput),
        );
        continue;
      }

      if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
        const toolId = getString(payload.call_id) ?? randomUUID();
        const output = normalizeToolOutput(payload.output);
        pushUserToolResult(entries, context, parsed.timestamp, toolId, output);
        continue;
      }

      if (payload.type === "web_search_call") {
        const toolId = randomUUID();
        const action = asRecord(payload.action);
        const input = action ?? {};
        pushAssistantToolUse(entries, context, parsed.timestamp, toolId, "web_search", input);
        if (typeof payload.status === "string") {
          pushUserToolResult(
            entries,
            context,
            parsed.timestamp,
            toolId,
            `status: ${payload.status}`,
          );
        }
      }

      continue;
    }

    if (parsed.type === "message") {
      const role = getString(parsed.role);
      const text = extractCodexMessageText(parsed.content);
      const timestamp = parsed.timestamp;

      if (role === "assistant") {
        pushAssistantText(entries, context, timestamp, text);
      } else if (role === "user") {
        pushUserText(entries, context, timestamp, text);
      } else if (role === "developer") {
        pushDeveloperAsSystem(entries, context, timestamp, text);
      }

      continue;
    }

    if (parsed.type === "event_msg" && !hasResponseMessages) {
      const payload = asRecord(parsed.payload);
      if (!payload) continue;

      if (payload.type === "user_message" && typeof payload.message === "string") {
        pushUserText(entries, context, parsed.timestamp, payload.message);
        continue;
      }

      if (payload.type === "agent_message" && typeof payload.message === "string") {
        pushAssistantText(entries, context, parsed.timestamp, payload.message);
        continue;
      }

      if (payload.type === "agent_reasoning" && typeof payload.text === "string") {
        pushAssistantThinking(entries, context, parsed.timestamp, payload.text);
      }
    }
  }

  if (entries.length === 0) {
    return content;
  }

  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

/**
 * Normalize a conversation file so the webview can parse it with the existing conversation schema.
 * Claude JSONL is returned as-is; Codex JSONL is converted to Claude-shaped entries.
 */
export function normalizeConversationContent(content: string, filePath?: string): string {
  if (!isLikelyCodexJsonl(content, filePath)) {
    return content;
  }

  return convertCodexJsonlToConversationJsonl(content);
}

/**
 * Extract a summary from the first user message in a JSONL file
 */
export function extractSummary(content: string): string {
  const lines = content.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) continue;

    const claudeCandidate = extractClaudeSummaryCandidate(parsed);
    if (claudeCandidate) {
      const cleaned = normalizeSummaryCandidate(claudeCandidate);
      if (cleaned.length > 0 && !isMetaConversationText(cleaned)) {
        return cleaned.slice(0, 100);
      }
    }

    const codexCandidates = extractCodexSummaryCandidates(parsed);
    for (const candidate of codexCandidates) {
      const cleaned = normalizeSummaryCandidate(candidate);
      if (cleaned.length > 0 && !isMetaConversationText(cleaned)) {
        return cleaned.slice(0, 100);
      }
    }
  }

  return "";
}

/**
 * Read the content of a JSONL file
 * Returns null if file is too large
 */
export function readJsonlFile(filePath: string): string | null {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_FOR_FULL_READ) {
      logChatHistoryWarn(`File too large to read: ${filePath} (${formatFileSize(stats.size)})`);
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return normalizeConversationContent(content, filePath);
  } catch (error) {
    logChatHistoryError(`Error reading file: ${filePath}`, error);
    return null;
  }
}

/**
 * Read the content of a JSONL file asynchronously
 * Returns null if file is too large
 */
export async function readJsonlFileAsync(filePath: string): Promise<string | null> {
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_FILE_SIZE_FOR_FULL_READ) {
      logChatHistoryWarn(`File too large to read: ${filePath} (${formatFileSize(stats.size)})`);
      return null;
    }

    const content = await fs.promises.readFile(filePath, "utf-8");
    return normalizeConversationContent(content, filePath);
  } catch (error) {
    logChatHistoryError(`Error reading file: ${filePath}`, error);
    return null;
  }
}

/**
 * Read just the first chunk of a file for summary extraction (sync)
 */
export function readFileChunk(filePath: string, maxBytes: number = SUMMARY_CHUNK_SIZE): string {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(maxBytes);
  const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
  fs.closeSync(fd);
  return buffer.slice(0, bytesRead).toString("utf-8");
}

/**
 * Read just the first chunk of a file for summary extraction (async)
 */
export async function readFileChunkAsync(
  filePath: string,
  maxBytes: number = SUMMARY_CHUNK_SIZE,
): Promise<string> {
  const fd = await fs.promises.open(filePath, "r");
  const buffer = Buffer.alloc(maxBytes);
  const { bytesRead } = await fd.read(buffer, 0, maxBytes, 0);
  await fd.close();
  return buffer.slice(0, bytesRead).toString("utf-8");
}

function isCodexConversationPath(filePath: string): boolean {
  const codexRoots = getCodexPaths().map((codexPath) => `${codexPath}${path.sep}`);
  return codexRoots.some((codexRoot) => filePath.startsWith(codexRoot));
}

/**
 * Load summary for a single file (async, for lazy loading)
 */
export async function loadFileSummary(file: ConversationFile): Promise<string> {
  if (file.summary !== null) {
    return file.summary;
  }

  try {
    const maxBytes = isCodexConversationPath(file.path)
      ? CODEX_SUMMARY_CHUNK_SIZE
      : SUMMARY_CHUNK_SIZE;

    const chunk = await readFileChunkAsync(file.path, maxBytes);
    const summary = extractSummary(chunk);
    file.summary = summary;
    return summary;
  } catch (error) {
    logChatHistoryError(`Error loading summary for ${file.path}:`, error);
    file.summary = "";
    return "";
  }
}

function ensureFolderNode(
  folders: Map<string, FolderNode>,
  name: string,
  folderPath: string,
): FolderNode {
  const existing = folders.get(name);
  if (existing) {
    return existing;
  }

  const folderNode: FolderNode = {
    name,
    path: folderPath,
    files: [],
  };

  folders.set(name, folderNode);
  return folderNode;
}

function addConversationFile(
  folders: Map<string, FolderNode>,
  folderName: string,
  folderPath: string,
  file: ConversationFile,
): void {
  const folderNode = ensureFolderNode(folders, folderName, folderPath);

  const exists = folderNode.files.some((existing) => existing.path === file.path);
  if (exists) {
    return;
  }

  folderNode.files.push(file);
}

function sortFolderFilesByDate(folders: Map<string, FolderNode>): void {
  for (const folderNode of folders.values()) {
    folderNode.files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }
}

function scanClaudeConversationsSync(folders: Map<string, FolderNode>): void {
  const projectsPaths = getClaudeProjectsPaths();

  for (const projectsPath of projectsPaths) {
    if (!fs.existsSync(projectsPath)) {
      continue;
    }
    const profile = detectConversationProfile(projectsPath);

    const entries = fs.readdirSync(projectsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderPath = path.join(projectsPath, entry.name);

      try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });

        for (const file of files) {
          if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;

          const filePath = path.join(folderPath, file.name);
          const stats = fs.statSync(filePath);
          if (stats.size < MIN_FILE_SIZE) continue;

          addConversationFile(folders, entry.name, folderPath, {
            name: file.name,
            path: filePath,
            folder: entry.name,
            size: stats.size,
            summary: null,
            lastModified: stats.mtime,
            source: "Claude",
            profile,
          });
        }
      } catch (err) {
        logChatHistoryError(`Error reading folder ${folderPath}:`, err);
      }
    }
  }
}

async function scanClaudeConversationsAsync(folders: Map<string, FolderNode>): Promise<void> {
  const projectsPaths = getClaudeProjectsPaths();

  for (const projectsPath of projectsPaths) {
    try {
      await fs.promises.access(projectsPath);
    } catch {
      continue;
    }
    const profile = detectConversationProfile(projectsPath);

    const entries = await fs.promises.readdir(projectsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderPath = path.join(projectsPath, entry.name);

      try {
        const files = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const file of files) {
          if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;

          const filePath = path.join(folderPath, file.name);
          const stats = await fs.promises.stat(filePath);
          if (stats.size < MIN_FILE_SIZE) continue;

          addConversationFile(folders, entry.name, folderPath, {
            name: file.name,
            path: filePath,
            folder: entry.name,
            size: stats.size,
            summary: null,
            lastModified: stats.mtime,
            source: "Claude",
            profile,
          });
        }
      } catch (err) {
        logChatHistoryError(`Error reading folder ${folderPath}:`, err);
      }
    }
  }
}

function collectJsonlFilesSync(rootDir: string, files: string[]): void {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      collectJsonlFilesSync(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
}

async function collectJsonlFilesAsync(rootDir: string): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) continue;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function getFolderNameForCodexFile(filePath: string): { name: string; folderPath: string } {
  try {
    const chunk = readFileChunk(filePath, CODEX_SUMMARY_CHUNK_SIZE);
    const meta = extractCodexSessionMeta(chunk);

    if (meta.cwd) {
      return {
        name: encodeWorkspacePath(meta.cwd),
        folderPath: meta.cwd,
      };
    }
  } catch {
    // Fall through to unknown folder
  }

  return {
    name: CODEX_UNKNOWN_FOLDER,
    folderPath: path.dirname(filePath),
  };
}

async function getFolderNameForCodexFileAsync(
  filePath: string,
): Promise<{ name: string; folderPath: string }> {
  try {
    const chunk = await readFileChunkAsync(filePath, CODEX_SUMMARY_CHUNK_SIZE);
    const meta = extractCodexSessionMeta(chunk);

    if (meta.cwd) {
      return {
        name: encodeWorkspacePath(meta.cwd),
        folderPath: meta.cwd,
      };
    }
  } catch {
    // Fall through to unknown folder
  }

  return {
    name: CODEX_UNKNOWN_FOLDER,
    folderPath: path.dirname(filePath),
  };
}

function scanCodexConversationsSync(folders: Map<string, FolderNode>): void {
  for (const rootPath of getCodexSessionRoots()) {
    if (!fs.existsSync(rootPath)) {
      continue;
    }
    const profile = detectConversationProfile(rootPath);

    const files: string[] = [];

    try {
      collectJsonlFilesSync(rootPath, files);
    } catch (err) {
      logChatHistoryError(`Error scanning Codex sessions in ${rootPath}:`, err);
      continue;
    }

    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size < MIN_FILE_SIZE) continue;

        const folderInfo = getFolderNameForCodexFile(filePath);
        addConversationFile(folders, folderInfo.name, folderInfo.folderPath, {
          name: path.basename(filePath),
          path: filePath,
          folder: folderInfo.name,
          size: stats.size,
          summary: null,
          lastModified: stats.mtime,
          source: "Codex",
          profile,
        });
      } catch (err) {
        logChatHistoryError(`Error reading Codex conversation ${filePath}:`, err);
      }
    }
  }
}

async function scanCodexConversationsAsync(folders: Map<string, FolderNode>): Promise<void> {
  for (const rootPath of getCodexSessionRoots()) {
    try {
      await fs.promises.access(rootPath);
    } catch {
      continue;
    }
    const profile = detectConversationProfile(rootPath);

    const files = await collectJsonlFilesAsync(rootPath);

    for (const filePath of files) {
      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.size < MIN_FILE_SIZE) continue;

        const folderInfo = await getFolderNameForCodexFileAsync(filePath);
        addConversationFile(folders, folderInfo.name, folderInfo.folderPath, {
          name: path.basename(filePath),
          path: filePath,
          folder: folderInfo.name,
          size: stats.size,
          summary: null,
          lastModified: stats.mtime,
          source: "Codex",
          profile,
        });
      } catch (err) {
        logChatHistoryError(`Error reading Codex conversation ${filePath}:`, err);
      }
    }
  }
}

/**
 * Scan the supported conversation directories for JSONL files
 * Returns a map of folder names to their conversation files
 * Note: summaries are NOT loaded here - they are lazy loaded when folders are expanded
 */
export function scanForConversations(): Map<string, FolderNode> {
  const folders = new Map<string, FolderNode>();

  scanClaudeConversationsSync(folders);
  scanCodexConversationsSync(folders);
  sortFolderFilesByDate(folders);

  return folders;
}

/**
 * Scan for conversations asynchronously (better for large directories)
 */
export async function scanForConversationsAsync(): Promise<Map<string, FolderNode>> {
  const folders = new Map<string, FolderNode>();

  await scanClaudeConversationsAsync(folders);
  await scanCodexConversationsAsync(folders);
  sortFolderFilesByDate(folders);

  return folders;
}

/**
 * Load summaries for all files in a folder (async, for lazy loading)
 */
export async function loadFolderSummaries(folderNode: FolderNode): Promise<void> {
  const promises = folderNode.files.map((file) => loadFileSummary(file));
  await Promise.all(promises);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "Today";
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Encode a workspace path to match Claude's folder naming convention
 * Claude replaces / with - in the path
 */
export function encodeWorkspacePath(workspacePath: string): string {
  return workspacePath.replace(/\//g, "-");
}

/**
 * Get the Claude project folder path for a given workspace path
 */
export function getClaudeFolderForWorkspace(workspacePath: string): string | null {
  const encodedPath = encodeWorkspacePath(workspacePath);
  for (const projectsPath of getClaudeProjectsPaths()) {
    const claudeFolder = path.join(projectsPath, encodedPath);
    if (fs.existsSync(claudeFolder)) {
      return claudeFolder;
    }
  }
  return null;
}

/**
 * Scan only the current project's conversations
 * Note: summaries are NOT loaded here - they are lazy loaded when needed
 */
export function scanCurrentProjectConversations(workspacePath: string): FolderNode | null {
  const encodedPath = encodeWorkspacePath(workspacePath);
  const folders = scanForConversations();
  return folders.get(encodedPath) ?? null;
}
