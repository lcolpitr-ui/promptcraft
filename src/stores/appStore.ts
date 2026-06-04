import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { sendMessage, type ChatMessage } from "../lib/ai";
import type { PromptFramework } from "../lib/frameworks";

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created_at: string;
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
  frameworkMode: "auto" | "manual";
  defaultFramework: string | null;
}

interface AppState {
  // 多会话管理
  conversations: Conversation[];
  currentConversationId: string | null;
  currentConversation: Conversation | null;

  // 框架选择
  frameworkMode: "auto" | "manual";
  selectedFramework: PromptFramework | null;

  // 当前消息
  messages: ChatMessage[];
  isLoading: boolean;

  // Prompt library
  prompts: Prompt[];
  searchQuery: string;
  selectedCategory: string | null;

  // Settings
  settings: Settings;

  // 会话管理 Actions
  createConversation: (title?: string) => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;

  // 框架选择 Actions
  setFrameworkMode: (mode: "auto" | "manual") => void;
  selectFramework: (framework: PromptFramework | null) => void;

  // 聊天 Actions
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearCurrentChat: () => void;

  // Prompt library Actions
  loadPrompts: () => Promise<void>;
  savePrompt: (prompt: Prompt) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;

  // Settings Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 用于取消请求的标志
let isCancelled = false;

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  conversations: [],
  currentConversationId: null,
  currentConversation: null,
  frameworkMode: "auto",
  selectedFramework: null,
  messages: [],
  isLoading: false,
  prompts: [],
  searchQuery: "",
  selectedCategory: null,
  settings: {
    apiKey: "",
    apiEndpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    language: "zh",
    frameworkMode: "auto",
    defaultFramework: null,
  },

  // 创建新会话
  createConversation: (title?: string) => {
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
  deleteConversation: (id: string) => {
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
  },

  // 更新会话标题
  updateConversationTitle: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
      currentConversation: state.currentConversation?.id === id
        ? { ...state.currentConversation, title }
        : state.currentConversation,
    }));
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

  // 发送消息
  sendMessage: async (content: string) => {
    const { messages, settings, frameworkMode, selectedFramework, currentConversationId } = get();

    // 如果没有当前会话，创建一个
    if (!currentConversationId) {
      get().createConversation(content.slice(0, 20));
    }

    const convId = get().currentConversationId!;

    // 重置取消标志
    isCancelled = false;

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
      if (frameworkMode === "manual" && selectedFramework) {
        framework = selectedFramework;
      }

      // 检查是否已取消
      if (isCancelled) {
        set({ isLoading: false });
        return;
      }

      const response = await sendMessage(content, messages, settings, framework);

      // 再次检查是否被取消
      if (isCancelled) {
        set({ isLoading: false });
        return;
      }

      const assistantMessage: ChatMessage = { role: "assistant", content: response };
      const finalMessages = [...newMessages, assistantMessage];

      set({
        messages: finalMessages,
        isLoading: false,
      });

      // 更新会话
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? { ...c, messages: finalMessages, framework: framework?.name || "auto" }
            : c
        ),
        currentConversation: state.currentConversation?.id === convId
          ? { ...state.currentConversation, messages: finalMessages }
          : state.currentConversation,
      }));
    } catch (error) {
      // 如果是用户主动取消，不显示错误
      if (isCancelled) {
        set({ isLoading: false });
        return;
      }

      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `抱歉，发生了错误：${error}`,
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

  // 停止生成
  stopGeneration: () => {
    isCancelled = true;
    set({ isLoading: false });
  },

  // 清空当前聊天
  clearCurrentChat: () => {
    const { currentConversationId } = get();
    if (currentConversationId) {
      set((state) => ({
        messages: [],
        conversations: state.conversations.map((c) =>
          c.id === currentConversationId
            ? { ...c, messages: [], concept: "" }
            : c
        ),
        currentConversation: state.currentConversation?.id === currentConversationId
          ? { ...state.currentConversation, messages: [], concept: "" }
          : state.currentConversation,
      }));
    }
  },

  // Load prompts from database
  loadPrompts: async () => {
    try {
      const prompts = await invoke<Prompt[]>("get_prompts");
      set({ prompts });
    } catch (error) {
      console.error("Failed to load prompts:", error);
    }
  },

  // Save prompt to database
  savePrompt: async (prompt: Prompt) => {
    try {
      await invoke("save_prompt", { prompt });
      await get().loadPrompts();
    } catch (error) {
      console.error("Failed to save prompt:", error);
    }
  },

  // Delete prompt from database
  deletePrompt: async (id: string) => {
    try {
      await invoke("delete_prompt", { id });
      await get().loadPrompts();
    } catch (error) {
      console.error("Failed to delete prompt:", error);
    }
  },

  // Set search query
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  // Set selected category
  setSelectedCategory: (category: string | null) => set({ selectedCategory: category }),

  // Load settings
  loadSettings: async () => {
    try {
      const raw = await invoke<{
        api_key: string;
        api_endpoint: string;
        model: string;
        language: string;
        framework_mode?: string;
        default_framework?: string;
      }>("get_settings");
      set({
        settings: {
          apiKey: raw.api_key || "",
          apiEndpoint: raw.api_endpoint || "https://api.deepseek.com/v1/chat/completions",
          model: raw.model || "deepseek-chat",
          language: raw.language || "zh",
          frameworkMode: (raw.framework_mode as "auto" | "manual") || "auto",
          defaultFramework: raw.default_framework || null,
        },
        frameworkMode: (raw.framework_mode as "auto" | "manual") || "auto",
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  },

  // Update settings
  updateSettings: async (newSettings: Partial<Settings>) => {
    const { settings } = get();
    const updatedSettings = { ...settings, ...newSettings };
    set({ settings: updatedSettings });
    try {
      await invoke("save_settings", {
        settings: {
          api_key: updatedSettings.apiKey,
          api_endpoint: updatedSettings.apiEndpoint,
          model: updatedSettings.model,
          language: updatedSettings.language,
          framework_mode: updatedSettings.frameworkMode,
          default_framework: updatedSettings.defaultFramework,
        },
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  },
}));
