import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore, type DataBackup, type MaterialType, type Prompt } from "../stores/appStore";
import { Check, Copy, Download, Edit2, PackagePlus, Pin, Search, Star, Tag, Trash2, Upload, X } from "lucide-react";

const ALL = "全部";

const MATERIAL_TYPES: Array<{ id: MaterialType | "all"; label: string }> = [
  { id: "all", label: "全部素材" },
  { id: "brief", label: "用户需求" },
  { id: "prompt", label: "完整提示词" },
  { id: "response", label: "AI 回复" },
  { id: "example", label: "成功案例" },
  { id: "anti_example", label: "失败案例" },
];

const STARTER_EXAMPLES: Array<Pick<Prompt, "title" | "content" | "material_type" | "category" | "tags" | "user_input" | "use_case" | "source_framework" | "rating">> = [
  {
    title: "公众号营销文案 brief",
    content: "请为一款 AI 提示词桌面工具写一篇公众号营销文案，目标用户是独立开发者和运营同学，突出本地数据、框架匹配和可复用素材库。",
    material_type: "brief",
    category: "写作",
    tags: ["写作", "营销", "公众号"],
    user_input: "写一篇公众号营销文案",
    use_case: "运营文案",
    source_framework: "CO-STAR",
    rating: 4,
  },
  {
    title: "代码重构提示词",
    content: "你是一名资深前端工程师。请审查以下 React + TypeScript 代码，优先指出会导致状态错乱、类型不安全和用户体验退化的问题，并给出小范围修改方案。",
    material_type: "prompt",
    category: "代码",
    tags: ["代码", "React", "审查"],
    user_input: "帮我审查并优化这段前端代码",
    use_case: "代码审查",
    source_framework: "RODES",
    rating: 5,
  },
  {
    title: "API 文档生成示例",
    content: "根据接口路径、请求参数、响应示例和错误码生成 API 文档。输出包含用途、鉴权、参数表、响应字段、错误处理和调用示例。",
    material_type: "example",
    category: "API 文档",
    tags: ["API", "文档", "开发"],
    user_input: "帮我生成接口文档",
    use_case: "API 文档",
    source_framework: "OASIS",
    rating: 5,
  },
  {
    title: "数据库设计需求",
    content: "设计一个提示词素材库的 SQLite 表结构，需要支持 prompt、brief、response、example、anti_example 类型、标签、收藏、评分、来源会话和导入冲突处理。",
    material_type: "brief",
    category: "数据库设计",
    tags: ["数据库", "SQLite", "表结构"],
    user_input: "帮我设计数据库表结构",
    use_case: "数据库设计",
    source_framework: "RODES",
    rating: 5,
  },
  {
    title: "产品需求案例",
    content: "为桌面 AI 提示词工具撰写 PRD：描述目标用户、核心流程、信息架构、设置页、安全边界、导入导出、素材复用和验收标准。",
    material_type: "example",
    category: "产品需求",
    tags: ["产品", "PRD", "桌面工具"],
    user_input: "写一个产品需求文档",
    use_case: "产品需求",
    source_framework: "BROKE",
    rating: 4,
  },
  {
    title: "运营转化文案提示词",
    content: "请基于目标用户、痛点、利益点和行动按钮，生成 3 个版本的运营转化文案：理性版、情绪版、短句版，并说明各自适用场景。",
    material_type: "prompt",
    category: "运营文案",
    tags: ["运营", "转化", "文案"],
    user_input: "给活动页写转化文案",
    use_case: "运营文案",
    source_framework: "CO-STAR",
    rating: 4,
  },
  {
    title: "会议纪要总结素材",
    content: "把会议记录整理成：结论、待办、负责人、截止时间、风险、需要二次确认的问题。只保留可执行信息。",
    material_type: "prompt",
    category: "总结",
    tags: ["总结", "会议纪要", "行动项"],
    user_input: "总结这段会议记录",
    use_case: "总结",
    source_framework: "APE",
    rating: 4,
  },
  {
    title: "翻译改写提示词",
    content: "请将文本翻译为自然中文，保留技术名词，不逐字硬译。输出包括译文、关键术语表和可能存在歧义的原句。",
    material_type: "prompt",
    category: "翻译",
    tags: ["翻译", "改写", "术语"],
    user_input: "翻译并润色这段英文",
    use_case: "翻译",
    source_framework: "ERA",
    rating: 4,
  },
  {
    title: "研究分析案例",
    content: "分析一个业务问题时，先界定问题、列出假设、识别关键指标、给出证据需求、比较方案，最后输出建议和不确定性。",
    material_type: "example",
    category: "研究分析",
    tags: ["研究", "分析", "决策"],
    user_input: "分析业务问题并给出决策建议",
    use_case: "研究分析",
    source_framework: "CARE",
    rating: 5,
  },
  {
    title: "计划制定提示词",
    content: "请把目标拆成里程碑、任务、依赖、风险和检查点。输出 30/60/90 天计划，并标注每个阶段的验收标准。",
    material_type: "prompt",
    category: "计划制定",
    tags: ["计划", "项目", "执行"],
    user_input: "帮我制定项目计划",
    use_case: "计划制定",
    source_framework: "RISE",
    rating: 4,
  },
];

type PromptDraft = Pick<
  Prompt,
  "title" | "content" | "material_type" | "category" | "tags" | "source_framework" | "user_input" | "use_case" | "rating"
>;

function getMaterialLabel(type: string | null | undefined): string {
  return MATERIAL_TYPES.find((item) => item.id === type)?.label || "完整提示词";
}

function getDraft(prompt: Prompt): PromptDraft {
  return {
    title: prompt.title,
    content: prompt.content,
    material_type: prompt.material_type || "prompt",
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

function makeStarterPrompt(example: typeof STARTER_EXAMPLES[number]): Prompt {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...example,
    is_favorite: false,
    is_pinned: false,
    source_session_id: null,
    source_session_title: "Starter examples",
    use_count: 0,
    created_at: now,
    updated_at: now,
  };
}

function isImportBackup(value: unknown): value is DataBackup {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DataBackup>;
  return Array.isArray(data.conversations)
    && Array.isArray(data.prompts)
    && Array.isArray(data.custom_frameworks)
    && typeof data.settings === "object";
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
    exportData,
    importData,
  } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType | "all">("all");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          getMaterialLabel(prompt.material_type),
          ...prompt.tags,
        ].join(" ").toLowerCase();
        const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
        const matchesMaterial = selectedMaterialType === "all" || prompt.material_type === selectedMaterialType;
        const matchesCategory = !selectedCategory || prompt.category === selectedCategory;
        const matchesTag = !selectedTag || prompt.tags.includes(selectedTag);
        const matchesFavorite = !showFavoritesOnly || prompt.is_favorite;
        return matchesSearch && matchesMaterial && matchesCategory && matchesTag && matchesFavorite;
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      });
  }, [prompts, searchQuery, selectedCategory, selectedMaterialType, selectedTag, showFavoritesOnly]);

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
      title: draft.title.trim() || "未命名素材",
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

  const importStarterExamples = async () => {
    for (const example of STARTER_EXAMPLES) {
      await savePrompt(makeStarterPrompt(example));
    }
    setImportMessage(`已导入 ${STARTER_EXAMPLES.length} 条 starter examples`);
  };

  const handleExportJson = async () => {
    const backup = await exportData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `promptcraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!isImportBackup(parsed)) {
        throw new Error("JSON 结构不符合 PromptCraft 备份格式");
      }
      const result = await importData(parsed, "merge");
      await loadPrompts();
      setImportMessage(`已合并导入：${result.prompts} 条素材、${result.conversations} 个会话、${result.custom_frameworks} 个框架`);
    } catch (error) {
      console.error("Failed to import backup:", error);
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-border p-4">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-wrap-anywhere">素材库</h1>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              onClick={importStarterExamples}
              className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80"
            >
              <PackagePlus className="h-4 w-4" />
              Starter examples
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80"
            >
              <Upload className="h-4 w-4" />
              导入 JSON
            </button>
            <button
              onClick={() => void handleExportJson()}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              导出 JSON
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportJson} />
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索标题、内容、分类、标签、框架或原始需求"
            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mb-3 flex min-w-0 flex-wrap gap-2">
          {MATERIAL_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedMaterialType(type.id)}
              className={`min-w-0 max-w-full rounded-full px-3 py-1 text-sm transition-colors text-wrap-anywhere ${
                selectedMaterialType === type.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {type.label}
            </button>
          ))}
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
              showFavoritesOnly ? "bg-yellow-500 text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
        {importMessage && <p className="mt-3 text-xs text-muted-foreground text-wrap-anywhere">{importMessage}</p>}
      </div>

      <div className="min-w-0 flex-1 space-y-3 overflow-y-auto p-4">
        {filteredPrompts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Tag className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-wrap-anywhere">还没有匹配的素材</p>
            <p className="text-sm text-wrap-anywhere">从聊天结果保存素材，或导入 starter examples 后再筛选和复用。</p>
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
                        <button onClick={() => void saveEdit(prompt)} className="p-1 text-muted-foreground transition-colors hover:text-green-500" title="保存">
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
                    <div className="grid gap-2 sm:grid-cols-3">
                      <select
                        value={draft.material_type}
                        onChange={(event) => setDraft({ ...draft, material_type: event.target.value as MaterialType })}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {MATERIAL_TYPES.filter((type) => type.id !== "all").map((type) => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
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
                      placeholder="用户原始需求"
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
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{getMaterialLabel(prompt.material_type)}</span>
                  {prompt.category && <span className="min-w-0 max-w-full rounded-full bg-secondary px-2 py-0.5 text-wrap-anywhere">{prompt.category}</span>}
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
