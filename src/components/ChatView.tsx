import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { Send, Trash2, Copy, Save, Sparkles, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { FrameworkSelector } from "./FrameworkSelector";

export function ChatView() {
  const { messages, isLoading, sendMessage, stopGeneration, clearCurrentChat, savePrompt, selectedFramework } = useAppStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const content = input.trim();
    setInput("");
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleSaveAsPrompt = (content: string) => {
    const title = content.slice(0, 50).replace(/\n/g, " ");
    const prompt = {
      id: Date.now().toString(),
      title: title || "未命名提示词",
      content,
      category: "对话生成",
      tags: [selectedFramework?.name || "自动"],
      created_at: new Date().toISOString(),
    };
    savePrompt(prompt);
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
      {/* Header with framework selector - 固定在顶部 */}
      <div className="relative z-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
        <FrameworkSelector />
        <div className="min-w-0 text-xs text-muted-foreground text-wrap-anywhere">
          {selectedFramework ? `使用 ${selectedFramework.name} 框架` : "自动匹配框架"}
        </div>
      </div>

      {/* Messages area */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-start pt-16 text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 text-primary/50" />
            <h2 className="mb-2 text-center text-xl font-semibold text-foreground text-wrap-anywhere">
              开始打磨你的提示词
            </h2>
            <p className="mb-2 max-w-md text-center text-sm text-wrap-anywhere">
              描述你的想法，AI 会帮你追问细节，最终生成高质量的结构化提示词
            </p>
            <p className="mb-8 text-center text-xs text-muted-foreground text-wrap-anywhere">
              当前模式：{selectedFramework ? `手动 - ${selectedFramework.name}` : "自动匹配"}
            </p>
            <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="min-w-0 rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-accent text-wrap-anywhere"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex min-w-0 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-wrap-anywhere sm:max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
                  <div className="markdown-content prose prose-sm dark:prose-invert max-w-none text-wrap-anywhere [&_*]:text-wrap-anywhere">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
                      <button
                        onClick={() => handleCopy(msg.content)}
                        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Copy className="w-3 h-3" />
                        复制
                      </button>
                      <button
                        onClick={() => handleSaveAsPrompt(msg.content)}
                        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Save className="w-3 h-3" />
                        保存
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="flex min-w-0 gap-2">
          <button
            onClick={clearCurrentChat}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="清空对话"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedFramework ? `使用 ${selectedFramework.name} 框架生成提示词...` : "描述你的想法..."}
            className="min-h-[44px] min-w-0 flex-1 resize-none rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-[120px] text-wrap-anywhere"
            rows={1}
          />
          {isLoading ? (
            <button
              onClick={stopGeneration}
              className="shrink-0 rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
