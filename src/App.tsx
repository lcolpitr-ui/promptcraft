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
  }, []); // 只在组件挂载时执行一次

  const navItems = [
    { id: "chat" as Page, label: "对话", icon: MessageSquare },
    { id: "library" as Page, label: "提示词库", icon: BookOpen },
    { id: "frameworks" as Page, label: "框架管理", icon: Sparkles },
    { id: "settings" as Page, label: "设置", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <nav className="w-64 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold">PromptCraft</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">AI 提示词打磨工具</p>
        </div>

        {/* Navigation */}
        <div className="p-2 border-b border-border space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentPage === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Conversation List */}
        {currentPage === "chat" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ConversationList />
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">v0.2.0</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {currentPage === "chat" && <ChatView />}
        {currentPage === "library" && <PromptLibrary />}
        {currentPage === "frameworks" && <FrameworkSubmit />}
        {currentPage === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
