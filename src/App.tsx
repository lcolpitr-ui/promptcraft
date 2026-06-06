import { useState, useEffect } from "react";
import { ChatView } from "./components/ChatView";
import { PromptLibrary } from "./components/PromptLibrary";
import { Settings } from "./components/Settings";
import { ConversationList } from "./components/ConversationList";
import { FrameworkSubmit } from "./components/FrameworkSubmit";
import { useAppStore } from "./stores/appStore";
import {
  MessageSquare,
  BookOpen,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

type Page = "chat" | "library" | "settings" | "frameworks";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("chat");
  const { loadSettings, loadConversations, createConversation } = useAppStore();

  useEffect(() => {
    // 加载设置和会话历史
    loadSettings();
    loadConversations().then(() => {
      // 如果没有历史会话，创建一个新的
      const { conversations } = useAppStore.getState();
      if (conversations.length === 0) {
        createConversation();
      }
    });
  }, [createConversation, loadConversations, loadSettings]); // 只在组件挂载时执行一次

  const navItems = [
    { id: "chat" as Page, label: "对话", icon: MessageSquare },
    { id: "library" as Page, label: "提示词库", icon: BookOpen },
    { id: "frameworks" as Page, label: "框架管理", icon: Sparkles },
    { id: "settings" as Page, label: "设置", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-background">
      {/* Sidebar */}
      <nav className="flex w-16 shrink-0 flex-col border-r border-border sm:w-64">
        <div className="p-4 border-b border-border">
          <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
            <Sparkles className="h-6 w-6 shrink-0 text-primary" />
            <h1 className="hidden min-w-0 text-lg font-bold sm:block sm:truncate">PromptCraft</h1>
          </div>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block sm:truncate">AI 提示词打磨工具</p>
        </div>

        {/* Navigation */}
        <div className="p-2 border-b border-border space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full min-w-0 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentPage === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden truncate sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Conversation List */}
        {currentPage === "chat" && (
          <div className="hidden flex-1 overflow-hidden sm:flex sm:flex-col">
            <div className="flex-1 overflow-y-auto">
              <ConversationList />
            </div>
          </div>
        )}

        <div className="hidden border-t border-border p-4 sm:block">
          <p className="text-xs text-muted-foreground text-center">v0.2.4</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-hidden">
        {currentPage === "chat" && <ChatView />}
        {currentPage === "library" && <PromptLibrary />}
        {currentPage === "frameworks" && <FrameworkSubmit />}
        {currentPage === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
