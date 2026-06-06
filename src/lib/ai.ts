import { getSystemPrompt } from "./prompts";
import { FRAMEWORKS, type PromptFramework } from "./frameworks";
import { safeInvoke } from "./tauri";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: ChatMessage[];
  model: string;
  api_key: string;
  api_endpoint: string;
  request_id: string;
  temperature: number;
  max_tokens: number;
  request_timeout_secs: number;
  stream: boolean;
}

export interface AiResponse {
  content: string;
  request_id: string;
  stream_used: boolean;
}

export interface AiSettings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  requestTimeoutSecs: number;
  enableStreaming: boolean;
}

export interface ContextTrimInfo {
  trimmed: boolean;
  originalMessages: number;
  sentMessages: number;
  omittedMessages: number;
  maxHistoryMessages: number;
  maxHistoryChars: number;
  note?: string;
}

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 6000;
const MAX_MESSAGE_CHARS = 2500;

function trimContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n\n[内容过长，已截断以控制上下文长度]`;
}

function getCompactHistory(history: ChatMessage[]): { messages: ChatMessage[]; trimInfo: ContextTrimInfo } {
  const recentMessages = history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    ...message,
    content: trimContent(message.content, MAX_MESSAGE_CHARS),
  }));

  let usedChars = 0;
  const compactHistory: ChatMessage[] = [];

  for (let i = recentMessages.length - 1; i >= 0; i -= 1) {
    const message = recentMessages[i];
    const messageChars = message.content.length;
    if (usedChars + messageChars > MAX_HISTORY_CHARS) {
      break;
    }
    usedChars += messageChars;
    compactHistory.unshift(message);
  }

  if (compactHistory.length < history.length) {
    compactHistory.unshift({
      role: "system",
      content: "较早的对话已省略。请基于当前用户输入和最近上下文继续完成提示词打磨。",
    });
  }

  const omittedMessages = Math.max(0, history.length - compactHistory.filter((message) => message.role !== "system").length);
  const trimmed = omittedMessages > 0 || recentMessages.some((message, index) => message.content !== history.slice(-MAX_HISTORY_MESSAGES)[index]?.content);

  return {
    messages: compactHistory,
    trimInfo: {
      trimmed,
      originalMessages: history.length,
      sentMessages: compactHistory.length,
      omittedMessages,
      maxHistoryMessages: MAX_HISTORY_MESSAGES,
      maxHistoryChars: MAX_HISTORY_CHARS,
      note: trimmed ? `已裁剪上下文：发送 ${compactHistory.length}/${history.length} 条历史消息。` : undefined,
    },
  };
}

// 从本地存储获取设置
function getStoredSettings(): AiSettings | null {
  try {
    const stored = localStorage.getItem("promptcraft_settings");
    if (stored) {
      const raw = JSON.parse(stored);
      return {
        apiKey: raw.apiKey ?? raw.api_key ?? "",
        apiEndpoint: raw.apiEndpoint ?? raw.api_endpoint ?? "https://api.deepseek.com",
        model: raw.model ?? "deepseek-chat",
        temperature: raw.temperature ?? 0.7,
        maxTokens: raw.maxTokens ?? raw.max_tokens ?? 2000,
        requestTimeoutSecs: raw.requestTimeoutSecs ?? raw.request_timeout_secs ?? 60,
        enableStreaming: raw.enableStreaming ?? raw.enable_streaming ?? false,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[],
  settings?: AiSettings | null,
  framework?: PromptFramework | null,
  requestId?: string,
  availableFrameworks: PromptFramework[] = FRAMEWORKS,
  frameworkSelectionReason?: string,
  onContextTrim?: (trimInfo: ContextTrimInfo) => void
): Promise<AiResponse | null> {
  // 如果没有传入设置，尝试从存储中获取
  const effectiveSettings = settings || getStoredSettings();

  if (!effectiveSettings?.apiKey) {
    throw new Error("API Key 缺失：请先在设置中填写并保存 API Key。");
  }

  // 根据用户输入和选定框架生成系统提示词
  const systemPrompt = getSystemPrompt(userMessage, framework, availableFrameworks, frameworkSelectionReason);

  const { messages: compactHistory, trimInfo } = getCompactHistory(history);
  onContextTrim?.(trimInfo);
  if (trimInfo.trimmed) {
    console.info("PromptCraft context trimmed", trimInfo);
  }

  if (effectiveSettings.enableStreaming) {
    console.info("PromptCraft streaming requested, using non-streaming fallback for current Tauri command path.");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...compactHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await safeInvoke<AiResponse>("call_ai_api", {
      request: {
        messages,
        model: effectiveSettings.model || "deepseek-chat",
        api_key: effectiveSettings.apiKey,
        api_endpoint: effectiveSettings.apiEndpoint || "https://api.deepseek.com",
        request_id: requestId || crypto.randomUUID(),
        temperature: effectiveSettings.temperature ?? 0.7,
        max_tokens: effectiveSettings.maxTokens ?? 2000,
        request_timeout_secs: effectiveSettings.requestTimeoutSecs ?? 60,
        stream: effectiveSettings.enableStreaming ?? false,
      },
    });

    return response;
  } catch (error) {
    // 如果是取消请求，返回 null
    if (error === "REQUEST_CANCELLED") {
      return null;
    }
    throw error;
  }
}
