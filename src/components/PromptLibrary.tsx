import { useEffect, useMemo, useState } from "react";
import { useAppStore, type Prompt } from "../stores/appStore";
import { Check, Copy, Edit2, Pin, Search, Star, Tag, Trash2, X } from "lucide-react";

const ALL = "全部";

type PromptDraft = Pick<Prompt, "title" | "content" | "category" | "tags" | "source_framework" | "user_input" | "use_case" | "rating">;

function getDraft(prompt: Prompt): PromptDraft {
  return {
    title: prompt.title,
    content: prompt.content,
    category: prompt.category,
    tags: prompt.tags,
    source_framework: prompt.source_framework,
    user_input: prompt.user_input,
    use_case: prompt.use_case,
    rating: prompt.rating,
  };
}

function parseTags(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function PromptLibrary() {
  const {
    prompts,
    searchQuery,
    selectedCategory,
    selectedTag,
    showFavoritesOnly,
    setSearchQuery,
    setSelectedCategory,
    setSelectedTag,
    setShowFavoritesOnly,
    loadPrompts,
    savePrompt,
    deletePrompt,
  } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft | null>(null);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const categories = useMemo(() => {
    const values = new Set(prompts.map((prompt) => prompt.category).filter(Boolean));
    return [ALL, ...Array.from(values)];
  }, [prompts]);

  const tags = useMemo(() => {
    const values = new Set(prompts.flatMap((prompt) => prompt.tags).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return prompts
      .filter((prompt) => {
        const searchable = [
          prompt.title,
          prompt.content,
          prompt.category,
          prompt.source_framework || "",
          prompt.user_input || "",
          prompt.use_case || "",
          ...prompt.tags,
        ].join(" ").toLowerCase();
        const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
        const matchesCategory = !selectedCategory || prompt.category === selectedCategory;
        const matchesTag = !selectedTag || prompt.tags.includes(selectedTag);
        const matchesFavorite = !showFavoritesOnly || prompt.is_favorite;
        return matchesSearch && matchesCategory && matchesTag && matchesFavorite;
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      });
  }, [prompts, searchQuery, selectedCategory, selectedTag, showFavoritesOnly]);

  const startEdit = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setDraft(getDraft(prompt));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (prompt: Prompt) => {
    if (!draft) return;
    await savePrompt({
      ...prompt,
      ...draft,
      title: draft.title.trim() || "未命名提示词",
      category: draft.category.trim() || "未分类",
      tags: draft.tags,
      updated_at: new Date().toISOString(),
    });
    cancelEdit();
  };

  const toggleFavorite = async (prompt: Prompt) => {
    await savePrompt({
      ...prompt,
      is_favorite: !prompt.is_favorite,
      updated_at: new Date().toISOString(),
    });
  };

  const togglePinned = async (prompt: Prompt) => {
    await savePrompt({
      ...prompt,
      is_pinned: !prompt.is_pinned,
      updated_at: new Date().toISOString(),
    });
  };

  const handleCopy = async (prompt: Prompt) => {
    await navigator.clipboard.writeText(prompt.content);
    await savePrompt({
      ...prompt,
      use_count: (prompt.use_count || 0) + 1,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-border p-4">
        <h1 className="mb-4 text-xl font-semibold text-wrap-anywhere">提示词库</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索标题、内容、分类或标签"
            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mb-3 flex min-w-0 flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category === ALL ? null : category)}
              className={`min-w-0 max-w-full rounded-full px-3 py-1 text-sm transition-colors text-wrap-anywhere ${
                (category === ALL && !selectedCategory) || selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {category}
            </button>
          ))}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${
              showFavoritesOnly
                ? "bg-yellow-500 text-white"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            收藏
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`rounded-full px-2.5 py-1 text-xs ${!selectedTag ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              全部标签
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`min-w-0 max-w-full rounded-full px-2.5 py-1 text-xs text-wrap-anywhere ${
                  selectedTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3 overflow-y-auto p-4">
        {filteredPrompts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Tag className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-wrap-anywhere">还没有匹配的提示词</p>
            <p className="text-sm text-wrap-anywhere">在对话结果中保存提示词后，可以在这里编辑、筛选和置顶。</p>
          </div>
        ) : (
          filteredPrompts.map((prompt) => {
            const isEditing = editingId === prompt.id && draft;
            return (
              <div
                key={prompt.id}
                className={`min-w-0 rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
                  prompt.is_pinned ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                  {isEditing ? (
                    <input
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium"
                    />
                  ) : (
                    <h3 className="min-w-0 flex-1 text-sm font-medium text-wrap-anywhere">{prompt.title}</h3>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => togglePinned(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-foreground" title="置顶">
                      <Pin className={`h-4 w-4 ${prompt.is_pinned ? "fill-current text-primary" : ""}`} />
                    </button>
                    <button onClick={() => toggleFavorite(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-yellow-500" title="收藏">
                      <Star className={`h-4 w-4 ${prompt.is_favorite ? "fill-current text-yellow-500" : ""}`} />
                    </button>
                    <button onClick={() => void handleCopy(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-foreground" title="复制">
                      <Copy className="h-4 w-4" />
                    </button>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-green-500" title="保存">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground transition-colors hover:text-foreground" title="取消">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-foreground" title="编辑">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deletePrompt(prompt.id)} className="p-1 text-muted-foreground transition-colors hover:text-destructive" title="删除">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft.content}
                      onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                      rows={7}
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={draft.category}
                        onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                        placeholder="分类"
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={draft.tags.join(", ")}
                        onChange={(event) => setDraft({ ...draft, tags: parseTags(event.target.value) })}
                        placeholder="标签，用逗号分隔"
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        value={draft.use_case || ""}
                        onChange={(event) => setDraft({ ...draft, use_case: event.target.value || null })}
                        placeholder="用途类型"
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={draft.source_framework || ""}
                        onChange={(event) => setDraft({ ...draft, source_framework: event.target.value || null })}
                        placeholder="框架"
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <select
                        value={draft.rating ?? ""}
                        onChange={(event) => setDraft({ ...draft, rating: event.target.value ? Number(event.target.value) : null })}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">未评分</option>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>{rating} 星</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={draft.user_input || ""}
                      onChange={(event) => setDraft({ ...draft, user_input: event.target.value || null })}
                      rows={3}
                      placeholder="用户原始输入"
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <p className="mb-2 line-clamp-3 text-sm text-muted-foreground text-wrap-anywhere">{prompt.content}</p>
                    {prompt.user_input && (
                      <p className="mb-2 line-clamp-2 text-xs text-muted-foreground text-wrap-anywhere">
                        原始需求：{prompt.user_input}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {prompt.category && (
                    <span className="min-w-0 max-w-full rounded-full bg-secondary px-2 py-0.5 text-wrap-anywhere">{prompt.category}</span>
                  )}
                  {prompt.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className="min-w-0 max-w-full rounded-full bg-secondary px-2 py-0.5 text-wrap-anywhere hover:bg-secondary/80"
                    >
                      {tag}
                    </button>
                  ))}
                  {prompt.source_framework && <span>框架：{prompt.source_framework}</span>}
                  {prompt.use_case && <span>用途：{prompt.use_case}</span>}
                  {prompt.rating && <span>评分：{prompt.rating}/5</span>}
                  <span>使用：{prompt.use_count}</span>
                  {prompt.source_session_title && <span>来源：{prompt.source_session_title}</span>}
                  <span className="ml-auto shrink-0">{new Date(prompt.updated_at || prompt.created_at).toLocaleDateString("zh-CN")}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
