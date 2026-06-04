import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { Search, Copy, Trash2, Tag } from "lucide-react";

const CATEGORIES = ["全部", "代码生成", "写作", "分析", "设计", "对话生成"];

export function PromptLibrary() {
  const {
    prompts,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    loadPrompts,
    deletePrompt,
  } = useAppStore();

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "全部" ||
      p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold mb-4">提示词库</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索提示词..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === "全部" ? null : cat)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                (cat === "全部" && !selectedCategory) || selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Tag className="w-12 h-12 mb-4 opacity-50" />
            <p>还没有保存的提示词</p>
            <p className="text-sm">在对话中生成提示词后，点击保存即可在这里找到</p>
          </div>
        ) : (
          filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-sm">{prompt.title}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopy(prompt.content)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="复制"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePrompt(prompt.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                {prompt.content}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {prompt.category && (
                  <span className="px-2 py-0.5 bg-secondary rounded-full">
                    {prompt.category}
                  </span>
                )}
                {prompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-secondary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                <span className="ml-auto">
                  {new Date(prompt.created_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
