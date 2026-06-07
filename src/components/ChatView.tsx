import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore, type MaterialType, type Prompt } from "../stores/appStore";
import { Copy, Save, Send, Sparkles, Square, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { matchFrameworkRecommendation } from "../lib/frameworks";
import { FrameworkSelector } from "./FrameworkSelector";

const MATERIAL_TYPES: Array<{ id: MaterialType; label: string }> = [
  { id: "brief", label: "用户需求" },
  { id: "prompt", label: "完整提示词" },
  { id: "response", label: "AI 回复" },
  { id: "example", label: "成功案例" },
  { id: "anti_example", label: "失败案例" },
];

export function ChatView() {
  const {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearCurrentChat,
    savePrompt,
    frameworkMode,
    selectedFramework,
    availableFrameworks,
    lastFrameworkMatch,
    lastContextTrim,
    currentConversation,
    prompts,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [saveDraft, setSaveDraft] = useState<Prompt | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoFrameworkPreview = useMemo(() => {
    if (frameworkMode !== "auto") return null;
    const trimmed = input.trim();
    return trimmed ? matchFrameworkRecommendation(trimmed, availableFrameworks, prompts) : lastFrameworkMatch;
  }, [availableFrameworks, frameworkMode, input, lastFrameworkMatch, prompts]);

  const frameworkStatus = frameworkMode === "manual"
    ? (selectedFramework ? `使用 ${selectedFramework.name} 框架` : "手动选择框架")
    : autoFrameworkPreview
      ? `${autoFrameworkPreview.isFallback ? "默认框架" : "自动匹配"}：${autoFrameworkPreview.framework.name}`
      : "自动匹配框架";
  const frameworkReason = autoFrameworkPreview && frameworkMode === "auto"
    ? autoFrameworkPreview.reason.slice(0, 48)
    : "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const content = input.trim();
    setInput("");
    await sendMessage(content);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleCopy = (content: string) => {
    void navigator.clipboard.writeText(content);
  };

  const handleOpenSavePrompt = (content: string, messageIndex: number, materialType: MaterialType = "prompt") => {
    const title = content.slice(0, 50).replace(/\n/g, " ");
    const sourceFramework = selectedFramework?.name || lastFrameworkMatch?.framework.name || null;
    const previousUserMessage = [...messages]
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === "user");
    const isBrief = materialType === "brief";
    const now = new Date().toISOString();
    const prompt: Prompt = {
      id: crypto.randomUUID(),
      title: title || "未命名素材",
      content,
      material_type: materialType,
      category: isBrief ? "用户需求" : "对话生成",
      tags: [sourceFramework || "自动", isBrief ? "用户需求" : "聊天保存"],
      is_favorite: false,
      is_pinned: false,
      source_session_id: currentConversation?.id || null,
      source_session_title: currentConversation?.title || null,
      source_framework: sourceFramework,
      user_input: isBrief ? content : previousUserMessage?.content || null,
      use_case: isBrief ? "需求积累" : "提示词打磨",
      rating: null,
      use_count: 0,
      created_at: now,
      updated_at: now,
    };
    setSaveDraft(prompt);
  };

  const handleConfirmSavePrompt = async () => {
    if (!saveDraft) return;
    await savePrompt({
      ...saveDraft,
      title: saveDraft.title.trim() || "未命名素材",
      category: saveDraft.category.trim() || "未分类",
      tags: saveDraft.tags.filter(Boolean),
      updated_at: new Date().toISOString(),
    });
    setSaveDraft(null);
  };

  const suggestions = [
    "我想写一个用户登录功能",
    "帮我生成一个 API 文档",
    "设计一个数据库表结构",
    "写一篇技术博客文章",
    "制定一个项目计划",
    "分析这个业务问题",
  ];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="relative z-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
        <FrameworkSelector />
        <div className="min-w-0 text-xs text-muted-foreground text-wrap-anywhere">
          {frameworkStatus}
          {frameworkReason ? ` · ${frameworkReason}` : ""}
          {lastContextTrim?.trimmed ? ` · 已裁剪上下文 ${lastContextTrim.sentMessages}/${lastContextTrim.originalMessages}` : ""}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-start pt-16 text-muted-foreground">
            <Sparkles className="mb-4 h-12 w-12 text-primary/50" />
            <h2 className="mb-2 text-center text-xl font-semibold text-foreground text-wrap-anywhere">
              开始打磨你的提示词
            </h2>
            <p className="mb-2 max-w-md text-center text-sm text-wrap-anywhere">
              描述你的想法，AI 会结合框架、历史偏好和素材库帮你生成结构化提示词。
            </p>
            <p className="mb-8 text-center text-xs text-muted-foreground text-wrap-anywhere">
              当前模式：{frameworkStatus}
            </p>
            <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="min-w-0 rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-accent text-wrap-anywhere"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-wrap-anywhere sm:max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card"
                  }`}
                >
                  <div className="markdown-content prose prose-sm dark:prose-invert max-w-none text-wrap-anywhere [&_*]:text-wrap-anywhere">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <div className={`mt-2 flex flex-wrap gap-2 pt-2 ${message.role === "assistant" ? "border-t border-border" : "border-t border-primary-foreground/20"}`}>
                    <button
                      onClick={() => handleCopy(message.content)}
                      className={`flex shrink-0 items-center gap-1 text-xs transition-colors ${
                        message.role === "assistant" ? "text-muted-foreground hover:text-foreground" : "text-primary-foreground/75 hover:text-primary-foreground"
                      }`}
                    >
                      <Copy className="h-3 w-3" />
                      复制
                    </button>
                    <button
                      onClick={() => handleOpenSavePrompt(message.content, index, message.role === "user" ? "brief" : "prompt")}
                      className={`flex shrink-0 items-center gap-1 text-xs transition-colors ${
                        message.role === "assistant" ? "text-muted-foreground hover:text-foreground" : "text-primary-foreground/75 hover:text-primary-foreground"
                      }`}
                    >
                      <Save className="h-3 w-3" />
                      保存
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm">思考中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {saveDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">保存到素材库</h2>
              <button
                onClick={() => setSaveDraft(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="关闭"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium">标题</span>
                  <input
                    value={saveDraft.title}
                    onChange={(event) => setSaveDraft({ ...saveDraft, title: event.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">素材类型</span>
                  <select
                    value={saveDraft.material_type}
                    onChange={(event) => setSaveDraft({ ...saveDraft, material_type: event.target.value as MaterialType })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {MATERIAL_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="font-medium">内容</span>
                <textarea
                  value={saveDraft.content}
                  onChange={(event) => setSaveDraft({ ...saveDraft, content: event.target.value })}
                  rows={8}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">用户原始需求</span>
                <textarea
                  value={saveDraft.user_input || ""}
                  onChange={(event) => setSaveDraft({ ...saveDraft, user_input: event.target.value || null })}
                  rows={3}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">分类</span>
                  <input
                    value={saveDraft.category}
                    onChange={(event) => setSaveDraft({ ...saveDraft, category: event.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">标签</span>
                  <input
                    value={saveDraft.tags.join(", ")}
                    onChange={(event) => setSaveDraft({
                      ...saveDraft,
                      tags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
                    })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">用途类型</span>
                  <input
                    value={saveDraft.use_case || ""}
                    onChange={(event) => setSaveDraft({ ...saveDraft, use_case: event.target.value || null })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">框架</span>
                  <input
                    value={saveDraft.source_framework || ""}
                    onChange={(event) => setSaveDraft({ ...saveDraft, source_framework: event.target.value || null })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">评分</span>
                  <select
                    value={saveDraft.rating ?? ""}
                    onChange={(event) => setSaveDraft({
                      ...saveDraft,
                      rating: event.target.value ? Number(event.target.value) : null,
                    })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">未评分</option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>{rating} 星</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={saveDraft.is_favorite}
                    onChange={(event) => setSaveDraft({ ...saveDraft, is_favorite: event.target.checked })}
                  />
                  收藏
                </label>
                <span className="text-xs text-muted-foreground text-wrap-anywhere">
                  来源会话：{saveDraft.source_session_title || "当前会话"} · 使用次数：{saveDraft.use_count}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSaveDraft(null)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
              >
                取消
              </button>
              <button
                onClick={() => void handleConfirmSavePrompt()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border p-4">
        <div className="flex min-w-0 gap-2">
          <button
            onClick={clearCurrentChat}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="清空对话"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedFramework ? `使用 ${selectedFramework.name} 框架生成提示词...` : "描述你的想法..."}
            className="max-h-[120px] min-h-[44px] min-w-0 flex-1 resize-none rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
            rows={1}
          />
          {isLoading ? (
            <button
              onClick={stopGeneration}
              className="shrink-0 rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
              title="停止生成"
            >
              <Square className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
