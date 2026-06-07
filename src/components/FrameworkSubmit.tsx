import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Eye, Loader2, Plus, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendMessage } from "../lib/ai";
import { FRAMEWORKS } from "../lib/frameworks";
import { safeInvoke } from "../lib/tauri";
import { useAppStore, type CustomFramework, type Prompt } from "../stores/appStore";

function getMaterialText(prompt: Prompt): string {
  return [
    prompt.title,
    prompt.content,
    prompt.category,
    prompt.user_input || "",
    prompt.use_case || "",
    prompt.source_framework || "",
    ...prompt.tags,
  ].join(" ").toLowerCase();
}

function scoreMaterial(concept: string, prompt: Prompt): number {
  const input = concept.toLowerCase();
  const materialText = getMaterialText(prompt);
  const tokens = input
    .split(/[\s,，。；;、:：.!?？\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  let score = 0;

  for (const token of tokens) {
    if (materialText.includes(token)) score += token.length > 3 ? 2 : 1;
  }
  if (prompt.is_favorite) score += 1.5;
  if (prompt.rating) score += prompt.rating / 2;
  score += Math.min(prompt.use_count || 0, 10) * 0.15;
  if (prompt.material_type === "example") score += 0.8;
  if (prompt.material_type === "anti_example") score += 0.5;
  return score;
}

function getRelevantMaterials(concept: string, prompts: Prompt[]): Prompt[] {
  return prompts
    .map((prompt) => ({ prompt, score: scoreMaterial(concept, prompt) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.prompt);
}

function formatMaterialContext(materials: Prompt[]): string {
  if (materials.length === 0) return "";
  return materials
    .map((material, index) => {
      const content = material.content.length > 600 ? `${material.content.slice(0, 600)}...` : material.content;
      const input = material.user_input ? `\n原始需求：${material.user_input.slice(0, 300)}` : "";
      return `${index + 1}. [${material.material_type}] ${material.title}${input}\n内容：${content}`;
    })
    .join("\n\n");
}

function splitBestFor(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

export function FrameworkSubmit() {
  const { settings, customFrameworks, prompts, loadCustomFrameworks, loadPrompts } = useAppStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [expandedBuiltInFrameworkId, setExpandedBuiltInFrameworkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [concept, setConcept] = useState("");
  const [generatedFramework, setGeneratedFramework] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useMaterials, setUseMaterials] = useState(true);

  const relatedMaterials = useMemo(
    () => (useMaterials && concept.trim() ? getRelevantMaterials(concept, prompts) : []),
    [concept, prompts, useMaterials],
  );

  const reloadData = useCallback(async () => {
    try {
      await Promise.all([loadCustomFrameworks(), loadPrompts()]);
    } catch (error) {
      console.error("Failed to load framework data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [loadCustomFrameworks, loadPrompts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reloadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reloadData]);

  const handleSaveFramework = async (framework: CustomFramework) => {
    try {
      await safeInvoke("save_custom_framework", { framework });
      await loadCustomFrameworks();
    } catch (error) {
      console.error("Failed to save framework:", error);
      alert(`保存失败：${error}`);
    }
  };

  const handleDeleteFramework = async (id: string) => {
    try {
      await safeInvoke("delete_custom_framework", { id });
      await loadCustomFrameworks();
    } catch (error) {
      console.error("Failed to delete framework:", error);
    }
  };

  const handleGenerateFramework = async () => {
    if (!concept.trim() || isGenerating) return;
    setIsGenerating(true);
    setGeneratedFramework("");

    const materialContext = formatMaterialContext(relatedMaterials);
    const prompt = `请根据以下概念/需求，设计一个专业的提示词框架：

概念：${concept}

${materialContext ? `参考素材（只用于提取场景和约束，不要逐字照抄）：\n${materialContext}\n` : ""}
请按以下格式输出框架：

1. **框架名称**：用一个简短的缩写命名
2. **框架全称**：每个字母代表的含义
3. **适用场景**：这个框架最适合什么类型的任务，用逗号分隔
4. **框架模板**：详细的模板结构，每个维度都要有清晰说明和填写指引

要求：
- 框架名称要简洁易记，最好是有意义的缩写
- 每个维度要具体、可操作
- 模板结构要清晰，方便填写
- 可以参考素材中的真实用途，但不要照抄素材正文`;

    try {
      const response = await sendMessage(prompt, [], {
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        requestTimeoutSecs: settings.requestTimeoutSecs,
        enableStreaming: settings.enableStreaming,
      });

      if (!response) {
        setGeneratedFramework("生成已取消");
        return;
      }

      const responseContent = response.content;
      setGeneratedFramework(responseContent);

      const nameMatch = responseContent.match(/\*\*框架名称\*\*[：:]\s*(\S+)/);
      if (nameMatch) setName(nameMatch[1]);

      const bestForMatch = responseContent.match(/\*\*适用场景\*\*[：:]\s*([\s\S]+?)(?=\n\*\*|\n\d|$)/);
      if (bestForMatch) setBestFor(bestForMatch[1].trim().replace(/\n/g, ", "));

      const descMatch = responseContent.match(/\*\*框架全称\*\*[：:]\s*([\s\S]+?)(?=\n\*\*|\n\d|$)/);
      if (descMatch) setDescription(descMatch[1].trim());

      const templateMatch = responseContent.match(/\*\*框架模板\*\*[：:]\s*([\s\S]+)/);
      if (templateMatch) setTemplate(templateMatch[1].trim());
    } catch (error) {
      setGeneratedFramework(`生成失败：${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !template) return;

    const framework: CustomFramework = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: name.toUpperCase(),
      description,
      best_for: splitBestFor(bestFor),
      template,
      created_at: new Date().toISOString(),
    };

    await handleSaveFramework(framework);
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 3000);
    setName("");
    setDescription("");
    setTemplate("");
    setBestFor("");
    setConcept("");
    setGeneratedFramework("");
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold text-wrap-anywhere">框架管理</h1>
        <p className="mt-1 text-sm text-muted-foreground text-wrap-anywhere">
          查看内置框架、让 AI 结合素材库生成新框架，或手动提交自定义框架。
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-4">
        <div>
          <button
            onClick={() => setShowExisting(!showExisting)}
            className="mb-3 flex min-w-0 items-center gap-2 text-sm font-medium text-wrap-anywhere"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="min-w-0 text-wrap-anywhere">内置框架 ({FRAMEWORKS.length})</span>
          </button>

          {showExisting && (
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              {FRAMEWORKS.map((framework) => (
                <div key={framework.id} className="min-w-0 rounded-lg border border-border p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-wrap-anywhere">{framework.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground text-wrap-anywhere">{framework.fullName}</div>
                    </div>
                    <button
                      onClick={() => setExpandedBuiltInFrameworkId(expandedBuiltInFrameworkId === framework.id ? null : framework.id)}
                      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={expandedBuiltInFrameworkId === framework.id ? "收起架构" : "查看架构"}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedBuiltInFrameworkId === framework.id ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground text-wrap-anywhere">{framework.description}</div>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                    {framework.bestFor.slice(0, 4).map((tag) => (
                      <span key={tag} className="min-w-0 max-w-full rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-wrap-anywhere">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {expandedBuiltInFrameworkId === framework.id && (
                    <div className="mt-3 min-w-0 border-t border-border pt-3">
                      <div className="mb-2 text-xs font-medium text-wrap-anywhere">框架架构</div>
                      <pre className="max-h-80 min-w-0 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-wrap-anywhere">
                        {framework.template}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : customFrameworks.length > 0 ? (
          <div>
            <h3 className="mb-3 text-sm font-medium text-wrap-anywhere">自定义框架 ({customFrameworks.length})</h3>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              {customFrameworks.map((framework) => (
                <div key={framework.id} className="group min-w-0 rounded-lg border border-border p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-wrap-anywhere">{framework.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground text-wrap-anywhere">{framework.description}</div>
                    </div>
                    <button
                      onClick={() => void handleDeleteFramework(framework.id)}
                      className="shrink-0 p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                    {framework.best_for.slice(0, 4).map((tag) => (
                      <span key={tag} className="min-w-0 max-w-full rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-wrap-anywhere">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-t border-border pt-6">
          <h2 className="mb-4 flex min-w-0 items-center gap-2 text-lg font-semibold">
            <Wand2 className="h-5 w-5 shrink-0" />
            <span className="min-w-0 text-wrap-anywhere">AI 生成框架</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">输入概念/需求</label>
              <textarea
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="例如：我需要一个专门用于面试准备的框架，帮助我组织回答..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
              />
            </div>

            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={useMaterials}
                onChange={(event) => setUseMaterials(event.target.checked)}
              />
              <span className="min-w-0 text-wrap-anywhere">
                参考素材库相关内容（当前命中 {relatedMaterials.length} 条）
              </span>
            </label>

            {relatedMaterials.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">将参考的素材</div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {relatedMaterials.map((material) => (
                    <span key={material.id} className="min-w-0 max-w-full rounded-full bg-secondary px-2 py-0.5 text-wrap-anywhere">
                      {material.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => void handleGenerateFramework()}
              disabled={!concept.trim() || isGenerating}
              className="flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Wand2 className="h-4 w-4 shrink-0" />}
              <span className="min-w-0 text-wrap-anywhere">{isGenerating ? "AI 生成中..." : "让 AI 生成框架"}</span>
            </button>

            {generatedFramework && (
              <div className="min-w-0 rounded-lg border border-border bg-muted/50 p-4">
                <h3 className="mb-2 text-sm font-medium text-wrap-anywhere">AI 生成的框架</h3>
                <div className="markdown-content prose prose-sm dark:prose-invert mb-4 max-w-none text-wrap-anywhere [&_*]:text-wrap-anywhere">
                  <ReactMarkdown>{generatedFramework}</ReactMarkdown>
                </div>
                <p className="text-xs text-muted-foreground text-wrap-anywhere">
                  框架信息会自动填入下方表单，请检查后保存。
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="mb-4 flex min-w-0 items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5 shrink-0" />
            <span className="min-w-0 text-wrap-anywhere">{generatedFramework ? "完善框架信息" : "手动提交框架"}</span>
          </h2>

          <div className="min-w-0 max-w-2xl space-y-4">
            <div>
              <label className="text-sm font-medium">框架名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：SMART、STAR、PAR"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
              />
            </div>

            <div>
              <label className="text-sm font-medium">框架描述</label>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="简述框架的用途和特点"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
              />
            </div>

            <div>
              <label className="text-sm font-medium">适用场景，用逗号分隔</label>
              <input
                type="text"
                value={bestFor}
                onChange={(event) => setBestFor(event.target.value)}
                placeholder="例如：面试, 汇报, 演讲"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
              />
            </div>

            <div>
              <label className="text-sm font-medium">框架模板 *</label>
              <textarea
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                placeholder={`【S - Specific】\n___\n\n【M - Measurable】\n___\n\n【A - Achievable】\n___`}
                rows={10}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring text-wrap-anywhere"
              />
            </div>

            <button
              onClick={() => void handleSubmit()}
              disabled={!name || !template}
              className={`flex min-w-0 max-w-full items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                submitted
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              }`}
            >
              {submitted ? <Check className="h-4 w-4 shrink-0" /> : <Save className="h-4 w-4 shrink-0" />}
              <span className="min-w-0 text-wrap-anywhere">{submitted ? "已保存" : "保存框架"}</span>
            </button>

            <p className="text-xs text-muted-foreground text-wrap-anywhere">
              保存的框架会进入聊天页选择器，并参与自动匹配。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
