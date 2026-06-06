import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { sendMessage } from "../lib/ai";
import { FRAMEWORKS } from "../lib/frameworks";
import { Plus, Save, Sparkles, Check, Wand2, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface CustomFramework {
  id: string;
  name: string;
  description: string;
  best_for: string[];
  template: string;
  created_at: string;
}

export function FrameworkSubmit() {
  const { settings } = useAppStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [customFrameworks, setCustomFrameworks] = useState<CustomFramework[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AI 生成相关
  const [concept, setConcept] = useState("");
  const [generatedFramework, setGeneratedFramework] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 从数据库加载自定义框架
  const loadCustomFrameworks = useCallback(async () => {
    try {
      const frameworks = await invoke<CustomFramework[]>("get_custom_frameworks");
      setCustomFrameworks(frameworks);
    } catch (error) {
      console.error("Failed to load custom frameworks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomFrameworks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCustomFrameworks]);

  // 保存自定义框架到数据库
  const handleSaveFramework = async (framework: CustomFramework) => {
    try {
      await invoke("save_custom_framework", { framework });
      await loadCustomFrameworks();
    } catch (error) {
      console.error("Failed to save framework:", error);
      alert("保存失败：" + error);
    }
  };

  // 删除自定义框架
  const handleDeleteFramework = async (id: string) => {
    try {
      await invoke("delete_custom_framework", { id });
      await loadCustomFrameworks();
    } catch (error) {
      console.error("Failed to delete framework:", error);
    }
  };

  // 使用 AI 生成框架
  const handleGenerateFramework = async () => {
    if (!concept.trim() || isGenerating) return;
    setIsGenerating(true);
    setGeneratedFramework("");

    const prompt = `请根据以下概念/需求，设计一个专业的提示词框架：

概念：${concept}

请按以下格式输出框架：

1. **框架名称**：用一个简短的缩写命名（如 CO-STAR、CRISPE 等）
2. **框架全称**：每个字母代表的含义
3. **适用场景**：这个框架最适合什么类型的任务（用逗号分隔）
4. **框架模板**：详细的模板结构，每个维度都要有清晰的说明和填写指引

要求：
- 框架名称要简洁易记，最好是有意义的缩写
- 每个维度要具体、可操作
- 模板结构要清晰，方便填写
- 要有创意，不要简单重复现有框架`;

    try {
      const response = await sendMessage(prompt, [], {
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model
      });

      if (!response) {
        setGeneratedFramework("生成已取消");
        return;
      }

      setGeneratedFramework(response);

      // 尝试从响应中提取框架名称
      const nameMatch = response.match(/\*\*框架名称\*\*[：:]\s*(\S+)/);
      if (nameMatch) {
        setName(nameMatch[1]);
      }

      // 提取适用场景
      const bestForMatch = response.match(/\*\*适用场景\*\*[：:]\s*([\s\S]+?)(?=\n\*\*|\n\d|$)/);
      if (bestForMatch) {
        setBestFor(bestForMatch[1].trim().replace(/\n/g, ", "));
      }

      // 提取描述
      const descMatch = response.match(/\*\*框架全称\*\*[：:]\s*([\s\S]+?)(?=\n\*\*|\n\d|$)/);
      if (descMatch) {
        setDescription(descMatch[1].trim());
      }

      // 提取模板
      const templateMatch = response.match(/\*\*框架模板\*\*[：:]\s*([\s\S]+)/);
      if (templateMatch) {
        setTemplate(templateMatch[1].trim());
      }
    } catch (error) {
      setGeneratedFramework(`生成失败：${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 提交框架
  const handleSubmit = async () => {
    if (!name || !template) return;

    const framework: CustomFramework = {
      id: name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
      name: name.toUpperCase(),
      description,
      best_for: bestFor.split(",").map((s) => s.trim()).filter(Boolean),
      template,
      created_at: new Date().toISOString(),
    };

    await handleSaveFramework(framework);

    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);

    // 清空表单
    setName("");
    setDescription("");
    setTemplate("");
    setBestFor("");
    setConcept("");
    setGeneratedFramework("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold">框架管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          查看内置框架、AI 生成新框架或手动提交
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 内置框架列表 */}
        <div>
          <button
            onClick={() => setShowExisting(!showExisting)}
            className="flex items-center gap-2 text-sm font-medium mb-3"
          >
            <Sparkles className="w-4 h-4" />
            内置框架 ({FRAMEWORKS.length})
          </button>

          {showExisting && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FRAMEWORKS.map((fw) => (
                <div key={fw.id} className="border border-border rounded-lg p-3">
                  <div className="font-medium text-sm">{fw.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{fw.description}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fw.bestFor.slice(0, 4).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-secondary rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 自定义框架列表 */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : customFrameworks.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium mb-3">自定义框架 ({customFrameworks.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customFrameworks.map((fw) => (
                <div key={fw.id} className="border border-border rounded-lg p-3 group">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{fw.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{fw.description}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteFramework(fw.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fw.best_for.slice(0, 4).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-secondary rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* AI 生成框架 */}
        <div className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AI 生成框架
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">输入概念/需求</label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="例如：我需要一个专门用于面试准备的框架，帮助我组织回答..."
                rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              onClick={handleGenerateFramework}
              disabled={!concept.trim() || isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isGenerating ? "AI 生成中..." : "让 AI 生成框架"}
            </button>

            {/* 生成结果 */}
            {generatedFramework && (
              <div className="border border-border rounded-lg p-4 bg-muted/50">
                <h3 className="text-sm font-medium mb-2">AI 生成的框架</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                  <ReactMarkdown>{generatedFramework}</ReactMarkdown>
                </div>
                <p className="text-xs text-muted-foreground">
                  框架信息已自动填充到下方表单，请检查后点击"保存框架"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 提交框架表单 */}
        <div className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {generatedFramework ? "完善框架信息" : "手动提交框架"}
          </h2>

          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="text-sm font-medium">框架名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：SMART、STAR、PAR"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium">框架描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简述框架的用途和特点"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium">适用场景（逗号分隔）</label>
              <input
                type="text"
                value={bestFor}
                onChange={(e) => setBestFor(e.target.value)}
                placeholder="例如：面试,汇报,演讲"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium">框架模板 *</label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={`【S - 具体 Specific】\n___\n\n【M - 可衡量 Measurable】\n___\n\n【A - 可实现 Achievable】\n___\n\n【R - 相关 Relevant】\n___\n\n【T - 有时限 Time-bound】\n___`}
                rows={10}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!name || !template}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                submitted
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              }`}
            >
              {submitted ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {submitted ? "已保存" : "保存框架"}
            </button>

            <p className="text-xs text-muted-foreground">
              保存的框架会存入数据库，不会丢失。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
