import { create } from "zustand";
import { sendMessage, type ChatMessage, type ContextTrimInfo } from "../lib/ai";
import { FRAMEWORKS, matchFrameworkRecommendation, type FrameworkMatchResult, type PromptFramework } from "../lib/frameworks";
import { safeInvoke } from "../lib/tauri";

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
  is_pinned: boolean;
  source_session_id: string | null;
  source_session_title: string | null;
  source_framework: string | null;
  user_input: string | null;
  use_case: string | null;
  rating: number | null;
  use_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  concept: string;
  messages: ChatMessage[];
  framework: string | null;
  created_at: string;
}

export interface Settings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  language: string;
  temperature: number;
  maxTokens: number;
  requestTimeoutSecs: number;
  enableStreaming: boolean;
  frameworkMode: "auto" | "manual";
  defaultFramework: string | null;
}

export interface CustomFramework {
  id: string;
  name: string;
  description: string;
  best_for: string[];
  template: string;
  created_at: string;
}

export interface DataBackup {
  version: number;
  exported_at: string;
  conversations: Conversation[];
  prompts: Prompt[];
  custom_frameworks: CustomFramework[];
  settings: {
    api_key?: string;
    api_endpoint: string;
    model: string;
    language: string;
    temperature: number;
    max_tokens: number;
    request_timeout_secs: number;
    enable_streaming: boolean;
    framework_mode: string;
    default_framework: string | null;
  };
}

export interface ImportResult {
  conversations: number;
  prompts: number;
  custom_frameworks: number;
}

interface AppState {
  // 多会话管理
  conversations: Conversation[];
  currentConversationId: string | null;
  currentConversation: Conversation | null;

  // 框架选择
  frameworkMode: "auto" | "manual";
  selectedFramework: PromptFramework | null;
  lastFrameworkMatch: FrameworkMatchResult | null;
  customFrameworks: CustomFramework[];
  availableFrameworks: PromptFramework[];

  // 当前消息
  messages: ChatMessage[];
  isLoading: boolean;
  lastContextTrim: ContextTrimInfo | null;

  // Prompt library
  prompts: Prompt[];
  searchQuery: string;
  selectedCategory: string | null;
  selectedTag: string | null;
  showFavoritesOnly: boolean;

  // Settings
  settings: Settings;
  settingsLoaded: boolean;
  dataError: string | null;

  // 会话管理 Actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<void>;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;

  // 框架选择 Actions
  setFrameworkMode: (mode: "auto" | "manual") => void;
  selectFramework: (framework: PromptFramework | null) => void;
  loadCustomFrameworks: () => Promise<void>;

  // 聊天 Actions
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearCurrentChat: () => Promise<void>;

  // Prompt library Actions
  loadPrompts: () => Promise<void>;
  savePrompt: (prompt: Prompt) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  exportData: () => Promise<DataBackup>;
  importData: (backup: DataBackup, mode: "merge" | "overwrite") => Promise<ImportResult>;

  // Settings Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<boolean>;
  clearDataError: () => void;
}

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 用于取消请求
let isCancelled = false;
let currentRequestId: string | null = null;

function customFrameworkToPromptFramework(framework: CustomFramework): PromptFramework {
  return {
    id: `custom:${framework.id}`,
    name: framework.name,
    fullName: framework.name,
    description: framework.description,
    bestFor: framework.best_for,
    keywords: [
      framework.name,
      framework.description,
      ...framework.best_for,
    ].filter(Boolean),
    template: framework.template,
  };
}

function getAvailableFrameworks(customFrameworks: CustomFramework[]): PromptFramework[] {
  return [...FRAMEWORKS, ...customFrameworks.map(customFrameworkToPromptFramework)];
}

function getUserFacingAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("AI request failed:", error);

  if (message.includes("API Key 缺失")) {
    return "API Key 缺失：请先到设置页填写并保存 API Key。";
  }
  if (message.includes("401") || message.includes("API Key 无效")) {
    return "API Key 无效或已过期：请检查设置中的 API Key 是否正确。";
  }
  if (message.includes("403") || message.includes("没有权限") || message.includes("额度不足")) {
    return "当前 API Key 没有权限、余额不足或账号受限，请检查服务商控制台。";
  }
  if (message.includes("404") || message.includes("模型") || message.includes("Endpoint 不存在")) {
    return "模型或 API Endpoint 不存在：请检查设置里的模型名称和 API 端点。";
  }
  if (message.includes("Endpoint") || message.includes("API 端点")) {
    return `API Endpoint 配置有误：${message}`;
  }
  if (message.includes("超时")) {
    return "网络超时：请求没有在设定时间内完成，请检查网络或调大请求超时。";
  }
  if (message.includes("响应格式不兼容") || message.includes("有效 JSON") || message.includes("提取内容")) {
    return `响应格式不兼容：服务商返回的数据不是标准 OpenAI-compatible chat completions 格式。${message}`;
  }

  return `抱歉，AI 请求失败：${message}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  conversations: [],
  currentConversationId: null,
  currentConversation: null,
  frameworkMode: "auto",
  selectedFramework: null,
  lastFrameworkMatch: null,
  customFrameworks: [],
  availableFrameworks: FRAMEWORKS,
  messages: [],
  isLoading: false,
  lastContextTrim: null,
  prompts: [],
  searchQuery: "",
  selectedCategory: null,
  selectedTag: null,
  showFavoritesOnly: false,
  settings: {
    apiKey: "",
    apiEndpoint: "https://api.deepseek.com",
    model: "deepseek-chat",
    language: "zh",
    temperature: 0.7,
    maxTokens: 2000,
    requestTimeoutSecs: 60,
    enableStreaming: false,
    frameworkMode: "auto",
    defaultFramework: null,
  },
  settingsLoaded: false,
  dataError: null,

  // 加载会话历史
  loadConversations: async () => {
    try {
      const conversations = await safeInvoke<Conversation[]>("get_conversations");
      if (conversations.length > 0) {
        set({
          conversations,
          currentConversationId: conversations[0].id,
          currentConversation: conversations[0],
          messages: conversations[0].messages,
        });
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      set({ dataError: `读取对话历史失败：${error}` });
      throw error;
    }
  },

  // 创建新会话（幂等 - 如果已有空会话则不重复创建）
  createConversation: async (title?: string) => {
    const { conversations } = get();

    // 如果没有标题，检查是否已有空会话
    if (!title) {
      const emptyConv = conversations.find(
        (c) => c.messages.length === 0 && c.title === "新对话"
      );
      if (emptyConv) {
        // 切换到已有空会话，不创建新的
        set({
          currentConversationId: emptyConv.id,
          currentConversation: emptyConv,
          messages: [],
        });
        return;
      }
    }

    const newConv: Conversation = {
      id: generateId(),
      title: title || "新对话",
      concept: "",
      messages: [],
      framework: null,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      conversations: [newConv, ...state.conversations],
      currentConversationId: newConv.id,
      currentConversation: newConv,
      messages: [],
    }));

    // 保存到后端
    try {
      await safeInvoke("save_conversation", { conv: newConv });
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  },

  // 切换会话
  switchConversation: (id: string) => {
    const { conversations } = get();
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      set({
        currentConversationId: id,
        currentConversation: conv,
        messages: conv.messages,
      });
    }
  },

  // 删除会话
  deleteConversation: async (id: string) => {
    set((state) => {
      const newConvs = state.conversations.filter((c) => c.id !== id);
      const isCurrent = state.currentConversationId === id;
      return {
        conversations: newConvs,
        currentConversationId: isCurrent ? (newConvs[0]?.id || null) : state.currentConversationId,
        currentConversation: isCurrent ? (newConvs[0] || null) : state.currentConversation,
        messages: isCurrent ? (newConvs[0]?.messages || []) : state.messages,
      };
    });

    // 从后端删除
    try {
      await safeInvoke("delete_conversation", { id });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  },

  // 更新会话标题
  updateConversationTitle: async (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
      currentConversation: state.currentConversation?.id === id
        ? { ...state.currentConversation, title }
        : state.currentConversation,
    }));

    // 保存到后端
    const { conversations } = get();
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      try {
        await safeInvoke("save_conversation", { conv: { ...conv, title } });
      } catch (error) {
        console.error("Failed to update conversation title:", error);
      }
    }
  },

  // 设置框架选择模式
  setFrameworkMode: (mode: "auto" | "manual") => {
    set({ frameworkMode: mode });
    get().updateSettings({ frameworkMode: mode });
  },

  // 手动选择框架
  selectFramework: (framework: PromptFramework | null) => {
    set({ selectedFramework: framework });
  },

  loadCustomFrameworks: async () => {
    try {
      const customFrameworks = await safeInvoke<CustomFramework[]>("get_custom_frameworks");
      const availableFrameworks = getAvailableFrameworks(customFrameworks);
      set((state) => ({
        customFrameworks,
        availableFrameworks,
        selectedFramework: state.selectedFramework && availableFrameworks.some((fw) => fw.id === state.selectedFramework?.id)
          ? state.selectedFramework
          : null,
      }));
    } catch (error) {
      console.error("Failed to load custom frameworks:", error);
      set({ dataError: `读取自定义框架失败：${error}` });
    }
  },

  // 发送消息
  sendMessage: async (content: string) => {
    const { messages, settings, frameworkMode, selectedFramework, currentConversationId, availableFrameworks, prompts } = get();

    // 如果没有当前会话，创建一个
    if (!currentConversationId) {
      await get().createConversation(content.slice(0, 20));
    }

    const convId = get().currentConversationId!;

    if (currentRequestId) {
      const previousRequestId = currentRequestId;
      isCancelled = true;
      try {
        await safeInvoke("cancel_ai_request", { requestId: previousRequestId });
      } catch (error) {
        console.error("Failed to cancel previous request:", error);
      }
    }

    // 重置取消标志
    isCancelled = false;
    const requestId = crypto.randomUUID();
    currentRequestId = requestId;

    // 添加用户消息
    const userMessage: ChatMessage = { role: "user", content };
    const newMessages = [...messages, userMessage];
    set({ messages: newMessages, isLoading: true });

    // 更新会话的消息
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId
          ? { ...c, messages: newMessages, concept: c.concept || content }
          : c
      ),
      currentConversation: state.currentConversation?.id === convId
        ? { ...state.currentConversation, messages: newMessages }
        : state.currentConversation,
    }));

    try {
      // 确定使用的框架
      let framework: PromptFramework | null = null;
      let frameworkSelectionReason: string | undefined;
      if (frameworkMode === "manual" && selectedFramework) {
        framework = selectedFramework;
        set({ lastFrameworkMatch: null });
      } else {
        const recommendation = matchFrameworkRecommendation(content, availableFrameworks, prompts);
        framework = recommendation.framework;
        frameworkSelectionReason = recommendation.isFallback
          ? `低置信兜底：${recommendation.reason}`
          : recommendation.reason;
        set({ lastFrameworkMatch: recommendation });
      }

      // 检查是否已取消
      if (isCancelled) {
        set({ isLoading: false });
        return;
      }

      const result = await sendMessage(
        content,
        messages,
        settings,
        framework,
        requestId,
        availableFrameworks,
        frameworkSelectionReason,
        (trimInfo) => set({ lastContextTrim: trimInfo })
      );

      // 检查是否被取消（后端返回 REQUEST_CANCELLED）
      if (result === null || isCancelled || currentRequestId !== requestId) {
        set({ isLoading: false });
        if (currentRequestId === requestId) {
          currentRequestId = null;
        }
        return;
      }

      const response = result.content;

      const assistantMessage: ChatMessage = { role: "assistant", content: response };
      const finalMessages = [...newMessages, assistantMessage];

      set({
        messages: finalMessages,
        isLoading: false,
      });

      // 更新会话
      const updatedConv = {
        ...get().conversations.find((c) => c.id === convId)!,
        messages: finalMessages,
        framework: framework?.name || "auto",
      };

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId ? updatedConv : c
        ),
        currentConversation: state.currentConversation?.id === convId
          ? updatedConv
          : state.currentConversation,
      }));

      // 保存到后端
      try {
        await safeInvoke("save_conversation", { conv: updatedConv });
      } catch (error) {
        console.error("Failed to save conversation:", error);
      } finally {
        if (currentRequestId === requestId) {
          currentRequestId = null;
        }
      }
    } catch (error) {
      if (currentRequestId === requestId) {
        currentRequestId = null;
      }
      // 如果是用户主动取消，不显示错误
      if (isCancelled) {
        set({ isLoading: false });
        return;
      }

      const userMessage = getUserFacingAiError(error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: userMessage,
      };
      const finalMessages = [...newMessages, errorMessage];
      set({ messages: finalMessages, isLoading: false });

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId ? { ...c, messages: finalMessages } : c
        ),
      }));
    }
  },

  // 停止生成（真正取消后端请求）
  stopGeneration: async () => {
    isCancelled = true;
    set({ isLoading: false });

    // 调用后端取消请求
    if (currentRequestId) {
      try {
        await safeInvoke("cancel_ai_request", { requestId: currentRequestId });
      } catch (error) {
        console.error("Failed to cancel request:", error);
      }
      currentRequestId = null;
    }
  },

  // 清空当前聊天
  clearCurrentChat: async () => {
    const { currentConversationId } = get();
    if (currentConversationId) {
      const updatedConv = {
        ...get().conversations.find((c) => c.id === currentConversationId)!,
        messages: [],
        concept: "",
      };

      set((state) => ({
        messages: [],
        conversations: state.conversations.map((c) =>
          c.id === currentConversationId ? updatedConv : c
        ),
        currentConversation: state.currentConversation?.id === currentConversationId
          ? updatedConv
          : state.currentConversation,
      }));

      // 保存到后端
      try {
        await safeInvoke("save_conversation", { conv: updatedConv });
      } catch (error) {
        console.error("Failed to save conversation:", error);
      }
    }
  },

  // Load prompts from database
  loadPrompts: async () => {
    try {
      const prompts = await safeInvoke<Prompt[]>("get_prompts");
      set({ prompts });
    } catch (error) {
      console.error("Failed to load prompts:", error);
      set({ dataError: `读取提示词库失败：${error}` });
    }
  },

  // Save prompt to database
  savePrompt: async (prompt: Prompt) => {
    try {
      await safeInvoke("save_prompt", { prompt });
      await get().loadPrompts();
    } catch (error) {
      console.error("Failed to save prompt:", error);
    }
  },

  // Delete prompt from database
  deletePrompt: async (id: string) => {
    try {
      await safeInvoke("delete_prompt", { id });
      await get().loadPrompts();
    } catch (error) {
      console.error("Failed to delete prompt:", error);
    }
  },

  // Set search query
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  // Set selected category
  setSelectedCategory: (category: string | null) => set({ selectedCategory: category }),

  setSelectedTag: (tag: string | null) => set({ selectedTag: tag }),

  setShowFavoritesOnly: (show: boolean) => set({ showFavoritesOnly: show }),

  exportData: async () => safeInvoke<DataBackup>("export_data"),

  importData: async (backup: DataBackup, mode: "merge" | "overwrite") => {
    const result = await safeInvoke<ImportResult>("import_data", { backup, mode });
    set({ settingsLoaded: false });
    await Promise.all([
      get().loadConversations(),
      get().loadPrompts(),
      get().loadCustomFrameworks(),
      get().loadSettings(),
    ]);
    return result;
  },

  // Load settings
  loadSettings: async () => {
    if (get().settingsLoaded) return; // 防止重复加载
    try {
      const raw = await safeInvoke<{
        api_key: string;
        api_endpoint: string;
        model: string;
        language: string;
        temperature?: number;
        max_tokens?: number;
        request_timeout_secs?: number;
        enable_streaming?: boolean;
        framework_mode?: string;
        default_framework?: string;
      }>("get_settings");
      set({
        settings: {
          apiKey: raw.api_key || "",
          apiEndpoint: raw.api_endpoint || "https://api.deepseek.com",
          model: raw.model || "deepseek-chat",
          language: raw.language || "zh",
          temperature: raw.temperature ?? 0.7,
          maxTokens: raw.max_tokens ?? 2000,
          requestTimeoutSecs: raw.request_timeout_secs ?? 60,
          enableStreaming: raw.enable_streaming ?? false,
          frameworkMode: (raw.framework_mode as "auto" | "manual") || "auto",
          defaultFramework: raw.default_framework || null,
        },
        frameworkMode: (raw.framework_mode as "auto" | "manual") || "auto",
        settingsLoaded: true,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ dataError: `读取设置失败：${error}` });
      set({ settingsLoaded: true }); // 即使失败也标记为已加载
    }
  },

  // Update settings - 返回是否成功
  updateSettings: async (newSettings: Partial<Settings>) => {
    const { settings } = get();
    const updatedSettings = { ...settings, ...newSettings };
    set({ settings: updatedSettings });
    try {
      await safeInvoke("save_settings", {
        settings: {
          api_key: updatedSettings.apiKey,
          api_endpoint: updatedSettings.apiEndpoint,
          model: updatedSettings.model,
          language: updatedSettings.language,
          temperature: updatedSettings.temperature,
          max_tokens: updatedSettings.maxTokens,
          request_timeout_secs: updatedSettings.requestTimeoutSecs,
          enable_streaming: updatedSettings.enableStreaming,
          framework_mode: updatedSettings.frameworkMode,
          default_framework: updatedSettings.defaultFramework,
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      // 回滚设置状态
      set({ settings });
      return false;
    }
  },

  clearDataError: () => set({ dataError: null }),
}));
