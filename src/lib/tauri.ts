import { invoke } from "@tauri-apps/api/core";

type MockRecord = Record<string, unknown>;

const STORAGE_KEYS = {
  settings: "promptcraft_settings",
  conversations: "promptcraft_mock_conversations",
  prompts: "promptcraft_mock_prompts",
  customFrameworks: "promptcraft_mock_custom_frameworks",
};

function isObject(value: unknown): value is MockRecord {
  return typeof value === "object" && value !== null;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getArg<T>(args: MockRecord | undefined, key: string): T | undefined {
  return isObject(args) ? (args[key] as T | undefined) : undefined;
}

async function mockInvoke<T>(command: string, args?: MockRecord): Promise<T> {
  switch (command) {
    case "get_settings":
      return {
        api_key: "",
        api_endpoint: "https://api.deepseek.com",
        model: "deepseek-chat",
        language: "zh",
        temperature: 0.7,
        max_tokens: 2000,
        request_timeout_secs: 60,
        enable_streaming: false,
        framework_mode: "auto",
        default_framework: null,
        ...readJson<MockRecord>(STORAGE_KEYS.settings, {}),
      } as T;
    case "save_settings":
      writeJson(STORAGE_KEYS.settings, {
        ...(getArg<MockRecord>(args, "settings") ?? {}),
        api_key: "",
      });
      return undefined as T;
    case "get_conversations":
      return readJson<T>(STORAGE_KEYS.conversations, [] as T);
    case "save_conversation": {
      const conv = getArg<MockRecord>(args, "conv");
      const conversations = readJson<MockRecord[]>(STORAGE_KEYS.conversations, []);
      const next = conv
        ? [conv, ...conversations.filter((item) => item.id !== conv.id)]
        : conversations;
      writeJson(STORAGE_KEYS.conversations, next);
      return undefined as T;
    }
    case "delete_conversation": {
      const id = getArg<string>(args, "id");
      const conversations = readJson<MockRecord[]>(STORAGE_KEYS.conversations, []);
      writeJson(STORAGE_KEYS.conversations, conversations.filter((item) => item.id !== id));
      return undefined as T;
    }
    case "get_prompts":
      return readJson<T>(STORAGE_KEYS.prompts, [] as T);
    case "save_prompt": {
      const prompt = getArg<MockRecord>(args, "prompt");
      const prompts = readJson<MockRecord[]>(STORAGE_KEYS.prompts, []);
      const next = prompt ? [prompt, ...prompts.filter((item) => item.id !== prompt.id)] : prompts;
      writeJson(STORAGE_KEYS.prompts, next);
      return undefined as T;
    }
    case "delete_prompt": {
      const id = getArg<string>(args, "id");
      const prompts = readJson<MockRecord[]>(STORAGE_KEYS.prompts, []);
      writeJson(STORAGE_KEYS.prompts, prompts.filter((item) => item.id !== id));
      return undefined as T;
    }
    case "get_custom_frameworks":
      return readJson<T>(STORAGE_KEYS.customFrameworks, [] as T);
    case "save_custom_framework": {
      const framework = getArg<MockRecord>(args, "framework");
      const frameworks = readJson<MockRecord[]>(STORAGE_KEYS.customFrameworks, []);
      const next = framework
        ? [framework, ...frameworks.filter((item) => item.id !== framework.id)]
        : frameworks;
      writeJson(STORAGE_KEYS.customFrameworks, next);
      return undefined as T;
    }
    case "delete_custom_framework": {
      const id = getArg<string>(args, "id");
      const frameworks = readJson<MockRecord[]>(STORAGE_KEYS.customFrameworks, []);
      writeJson(STORAGE_KEYS.customFrameworks, frameworks.filter((item) => item.id !== id));
      return undefined as T;
    }
    case "cancel_ai_request":
      return false as T;
    default:
      throw new Error("请使用 npm run tauri dev 启动完整桌面功能。");
  }
}

export async function safeInvoke<T>(command: string, args?: MockRecord): Promise<T> {
  if (!isTauriRuntime()) {
    return mockInvoke<T>(command, args);
  }

  return invoke<T>(command, args);
}
