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
}

export interface AiResponse {
  content: string;
  request_id: string;
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

function getCompactHistory(history: ChatMessage[]): ChatMessage[] {
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

  return compactHistory;
}

// 从本地存储获取设置
function getStoredSettings() {
  try {
    const stored = localStorage.getItem("promptcraft_settings");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[],
  settings?: { apiKey: string; apiEndpoint: string; model: string } | null,
  framework?: PromptFramework | null,
  requestId?: string,
  availableFrameworks: PromptFramework[] = FRAMEWORKS,
  frameworkSelectionReason?: string
): Promise<AiResponse | null> {
  // 如果没有传入设置，尝试从存储中获取
  const effectiveSettings = settings || getStoredSettings();

  if (!effectiveSettings?.apiKey) {
    throw new Error("请先在设置中配置 API Key");
  }

  // 根据用户输入和选定框架生成系统提示词
  const systemPrompt = getSystemPrompt(userMessage, framework, availableFrameworks, frameworkSelectionReason);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...getCompactHistory(history),
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
