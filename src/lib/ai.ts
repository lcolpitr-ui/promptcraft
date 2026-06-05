import { invoke } from "@tauri-apps/api/core";
import { getSystemPrompt } from "./prompts";
import type { PromptFramework } from "./frameworks";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: ChatMessage[];
  model: string;
  api_key: string;
  api_endpoint: string;
}

export interface AiResponse {
  content: string;
  request_id: string;
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
  framework?: PromptFramework | null
): Promise<string | null> {
  // 如果没有传入设置，尝试从存储中获取
  const effectiveSettings = settings || getStoredSettings();

  if (!effectiveSettings?.apiKey) {
    throw new Error("请先在设置中配置 API Key");
  }

  // 根据用户输入和选定框架生成系统提示词
  const systemPrompt = getSystemPrompt(userMessage, framework);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await invoke<AiResponse>("call_ai_api", {
      request: {
        messages,
        model: effectiveSettings.model || "deepseek-chat",
        api_key: effectiveSettings.apiKey,
        api_endpoint: effectiveSettings.apiEndpoint || "https://api.deepseek.com/v1/chat/completions",
      },
    });

    return response.content;
  } catch (error) {
    // 如果是取消请求，返回 null
    if (error === "REQUEST_CANCELLED") {
      return null;
    }
    throw error;
  }
}
