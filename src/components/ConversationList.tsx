import { useState } from "react";
import { useAppStore } from "../stores/appStore";
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from "lucide-react";

export function ConversationList() {
  const {
    conversations,
    currentConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateConversationTitle(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "昨天";
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 新建按钮 */}
      <div className="p-2">
        <button
          onClick={() => createConversation()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-dashed border-border hover:bg-accent hover:border-solid transition-all"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p>暂无对话</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                currentConversationId === conv.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="flex-1 px-1 py-0.5 text-xs bg-background text-foreground rounded border border-input"
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="p-0.5">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={handleCancelEdit} className="p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm truncate">{conv.title}</div>
                    <div className={`text-[10px] ${
                      currentConversationId === conv.id
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}>
                      {conv.messages.length} 条消息 · {formatDate(conv.created_at)}
                      {conv.framework && conv.framework !== "auto" && (
                        <span className="ml-1 px-1 py-0.5 bg-secondary/50 rounded">
                          {conv.framework}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 操作按钮 */}
              {editingId !== conv.id && (
                <div className="hidden group-hover:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleStartEdit(conv.id, conv.title)}
                    className="p-1 hover:bg-background/50 rounded"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="p-1 hover:bg-destructive/20 hover:text-destructive rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
