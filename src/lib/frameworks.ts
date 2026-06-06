// 专业提示词框架定义
export interface PromptFramework {
  id: string;
  name: string;
  fullName: string;
  description: string;
  bestFor: string[];
  keywords: string[];
  template: string;
}

export interface FrameworkMatchResult {
  framework: PromptFramework;
  confidence: "high" | "medium" | "low";
  score: number;
  isFallback: boolean;
  reason: string;
}

export interface PromptHistorySignal {
  title?: string;
  content?: string;
  tags?: string[];
  category?: string;
  source_framework?: string | null;
  framework_id?: string | null;
  user_input?: string | null;
  use_case?: string | null;
  output_type?: string | null;
  is_favorite?: boolean;
  favorite?: boolean;
  rating?: number | null;
  use_count?: number;
  usage_count?: number;
}

type IntentRule = {
  label: string;
  terms: string[];
  preferredFrameworks: string[];
};

const INTENT_RULES: IntentRule[] = [
  {
    label: "技术/API/代码",
    terms: ["技术", "代码", "编程", "开发", "数据库", "表结构", "SQL", "API", "接口", "架构", "debug", "bug", "test", "code", "database", "schema", "backend", "frontend"],
    preferredFrameworks: ["rodes"],
  },
  {
    label: "写作/营销",
    terms: ["写", "文案", "文章", "公众号", "营销", "推广", "品牌", "广告", "小红书", "社媒", "copywriting", "marketing", "blog", "post", "content"],
    preferredFrameworks: ["costar"],
  },
  {
    label: "分析/业务决策",
    terms: ["分析", "业务", "问题", "决策", "建议", "诊断", "策略", "指标", "KPI", "增长", "analysis", "business", "decision", "strategy", "recommendation"],
    preferredFrameworks: ["care", "broke"],
  },
  {
    label: "计划/项目",
    terms: ["计划", "规划", "项目", "路线图", "排期", "执行", "目标", "里程碑", "plan", "project", "roadmap", "schedule"],
    preferredFrameworks: ["broke", "rise"],
  },
  {
    label: "设计/创意",
    terms: ["设计", "创意", "头脑风暴", "方案", "原型", "体验", "视觉", "design", "creative", "brainstorm", "prototype", "ux", "ui"],
    preferredFrameworks: ["crispe"],
  },
  {
    label: "翻译/总结",
    terms: ["翻译", "总结", "摘要", "提炼", "改写", "解释", "translate", "summary", "summarize", "rewrite", "explain"],
    preferredFrameworks: ["ape", "era"],
  },
];

const FALLBACK_FRAMEWORK_ID = "oasis";
const MEDIUM_CONFIDENCE_SCORE = 4;
const HIGH_CONFIDENCE_SCORE = 8;

export const FRAMEWORKS: PromptFramework[] = [
  {
    id: "oasis",
    name: "OASIS",
    fullName: "Outcome-Audience-Sources-Instructions-Stop Rules",
    description: "基于 OpenAI 官方提示词指南的 PromptCraft 专属框架，强调结果优先、证据边界、输出契约和停止规则",
    bestFor: ["OpenAI", "官方指南", "复杂任务", "智能体", "长上下文", "高质量提示词", "产品助手"],
    keywords: ["openai", "gpt", "官方", "指南", "提示词优化", "提示词工程", "智能体", "agent", "复杂任务", "长上下文", "检索", "引用", "验证", "停止规则"],
    template: `【Outcome - 目标结果】
说明最终要交付什么，而不是规定每一步怎么做。明确“好结果”的判断标准。
___

【Audience - 受众与协作风格】
说明面向谁、语气如何、需要多主动、何时追问、何时合理假设。
___

【Sources - 上下文与证据边界】
列出可用资料、必须引用或验证的事实、不能凭空编造的内容，以及缺少证据时的处理方式。
___

【Instructions - 关键约束与输出契约】
说明必要约束、输出字段、长度、格式、保留内容、工具使用或验证要求。
___

【Stop Rules - 停止与追问规则】
说明什么时候可以直接回答、什么时候继续检索/验证、什么时候只问最小必要问题。
___`
  },
  {
    id: "costar",
    name: "CO-STAR",
    fullName: "Context-Objective-Style-Tone-Audience-Response",
    description: "最全面的通用框架，适合写作、营销、内容创作",
    bestFor: ["写作", "文案", "营销", "内容创作", "文章", "邮件", "社交媒体"],
    keywords: ["写", "文案", "文章", "邮件", "营销", "推广", "内容", "博客", "公众号", "社交媒体", "推文"],
    template: `【Context - 背景上下文】
___

【Objective - 任务目标】
___

【Style - 写作风格】
___

【Tone - 语气基调】
___

【Audience - 目标受众】
___

【Response - 输出格式】
___`
  },
  {
    id: "crispe",
    name: "CRISPE",
    fullName: "Capacity-Role-Insight-Statement-Personality-Experiment",
    description: "强调角色扮演和创意发散，适合创意任务",
    bestFor: ["创意", "角色扮演", "故事", "设计", "头脑风暴", "创意写作"],
    keywords: ["创意", "故事", "小说", "角色", "设计", "头脑风暴", "想法", "灵感", "创作"],
    template: `【Capacity & Role - 角色定义】
你是一位 ___，拥有 ___ 的专业能力。

【Insight - 背景洞察】
___

【Statement - 任务陈述】
___

【Personality - 风格个性】
___

【Experiment - 多方案发散】
请提供 3 种不同方向的方案：
方案一：___
方案二：___
方案三：___`
  },
  {
    id: "broke",
    name: "BROKE",
    fullName: "Background-Role-Objective-Key Results-Evolve",
    description: "注重目标和结果量化，适合项目管理和业务场景",
    bestFor: ["项目", "业务", "管理", "规划", "策略", "KPI", "目标"],
    keywords: ["项目", "业务", "管理", "规划", "策略", "目标", "KPI", "指标", "优化", "提升"],
    template: `【Background - 项目背景】
___

【Role - 角色定位】
___

【Objective - 核心目标】
___

【Key Results - 关键成果指标】
1. ___
2. ___
3. ___

【Evolve - 迭代优化】
请根据以下反馈进行优化：___`
  },
  {
    id: "rodes",
    name: "RODES",
    fullName: "Role-Objective-Details-Examples-Sense Check",
    description: "强调细节和示例，适合技术开发和精确任务",
    bestFor: ["代码", "开发", "技术", "编程", "API", "数据库", "架构"],
    keywords: ["代码", "开发", "编程", "函数", "API", "接口", "数据库", "架构", "技术", "bug", "调试", "测试"],
    template: `【Role - 技术角色】
你是一位 ___ 工程师，精通 ___。

【Objective - 技术目标】
___

【Details - 技术细节】
- 技术栈：___
- 输入：___
- 输出：___
- 约束：___

【Examples - 代码示例】
输入示例：
\`\`\`
___
\`\`\`

输出示例：
\`\`\`
___
\`\`\`

【Sense Check - 验证清单】
- [ ] 代码可运行
- [ ] 边界情况处理
- [ ] 错误处理完善`
  },
  {
    id: "ape",
    name: "APE",
    fullName: "Action-Purpose-Expectation",
    description: "简洁高效，适合简单直接的任务",
    bestFor: ["简单任务", "快速回答", "翻译", "总结", "解释"],
    keywords: ["翻译", "总结", "解释", "是什么", "怎么", "为什么", "简单", "快速"],
    template: `【Action - 执行动作】
___

【Purpose - 目的说明】
___

【Expectation - 期望结果】
___`
  },
  {
    id: "care",
    name: "CARE",
    fullName: "Context-Action-Result-Example",
    description: "注重上下文和结果，适合问题解决和分析",
    bestFor: ["分析", "问题", "解决", "诊断", "排查", "优化"],
    keywords: ["分析", "问题", "解决", "诊断", "排查", "优化", "改进", "修复", "错误"],
    template: `【Context - 问题背景】
___

【Action - 分析行动】
___

【Result - 期望结果】
___

【Example - 参考案例】
___`
  },
  {
    id: "rise",
    name: "RISE",
    fullName: "Role-Instructions-Steps-End Goal",
    description: "强调步骤化执行，适合教程和流程类任务",
    bestFor: ["教程", "流程", "步骤", "指南", "培训", "SOP"],
    keywords: ["教程", "流程", "步骤", "指南", "培训", "怎么操作", "如何", "方法", "SOP"],
    template: `【Role - 引导角色】
你是一位 ___ 导师。

【Instructions - 总体说明】
___

【Steps - 详细步骤】
第一步：___
第二步：___
第三步：___
...

【End Goal - 最终目标】
___`
  },
  {
    id: "era",
    name: "ERA",
    fullName: "Expectation-Role-Action",
    description: "最精简的框架，适合明确的单一任务",
    bestFor: ["单一任务", "明确指令", "格式转换", "数据处理"],
    keywords: ["转换", "格式", "提取", "生成", "计算", "排序", "筛选"],
    template: `【Expectation - 期望输出】
___

【Role - 执行角色】
___

【Action - 具体动作】
___`
  }
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeFrameworkId(id: string): string {
  return id.startsWith("custom:") ? id : id.toLowerCase();
}

function getFieldMatches(input: string, values: string[], weight: number, label: string) {
  let score = 0;
  const matches: string[] = [];

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const normalized = normalizeText(value);
      if (!normalized) return;

      if (input.includes(normalized)) {
        score += weight;
        matches.push(value);
        return;
      }

      const cjkTokens = (normalized.match(/[\u4e00-\u9fff]{2,}/g) || [])
        .flatMap((text) => Array.from({ length: Math.max(0, text.length - 1) }, (_, index) => text.slice(index, index + 2)));
      const words = [
        ...normalized.split(/[\s,，。;；:：/|()（）\-_]+/),
        ...cjkTokens,
      ].filter((word) => word.length >= 2);
      const hitCount = words.filter((word) => input.includes(word)).length;
      if (hitCount > 0) {
        score += Math.min(weight - 1, hitCount);
        matches.push(`${label}:${value}`);
      }
    });

  return { score, matches };
}

function scoreIntent(input: string, framework: PromptFramework) {
  let score = 0;
  const matches: string[] = [];
  const frameworkId = normalizeFrameworkId(framework.id);

  for (const rule of INTENT_RULES) {
    const hitTerms = rule.terms.filter((term) => input.includes(normalizeText(term)));
    if (hitTerms.length === 0) continue;

    const isPreferred = rule.preferredFrameworks.includes(frameworkId);
    const frameworkText = normalizeText([
      framework.name,
      framework.fullName,
      framework.description,
      ...framework.bestFor,
      ...framework.keywords,
      framework.template,
    ].join(" "));
    const isSemanticallyRelated = hitTerms.some((term) => frameworkText.includes(normalizeText(term)));

    if (isPreferred) {
      score += 5 + Math.min(hitTerms.length, 3);
      matches.push(rule.label);
    } else if (isSemanticallyRelated) {
      score += 2;
      matches.push(rule.label);
    }
  }

  return { score, matches };
}

function getHistoryFrameworkKey(prompt: PromptHistorySignal): string | null {
  return prompt.framework_id || prompt.source_framework || null;
}

function matchesHistoryFramework(prompt: PromptHistorySignal, framework: PromptFramework): boolean {
  const key = getHistoryFrameworkKey(prompt);
  if (!key) return false;
  const normalizedKey = normalizeText(key.replace(/^custom:/, ""));
  return [
    framework.id,
    framework.id.replace(/^custom:/, ""),
    framework.name,
    framework.fullName,
  ].some((value) => normalizeText(value) === normalizedKey);
}

function getHistoryRelevance(input: string, prompt: PromptHistorySignal): { score: number; matches: string[] } {
  const values = [
    prompt.title || "",
    prompt.content || "",
    prompt.category || "",
    prompt.user_input || "",
    prompt.use_case || "",
    prompt.output_type || "",
    ...(prompt.tags || []),
  ];
  const fieldMatch = getFieldMatches(input, values, 4, "历史");
  return {
    score: fieldMatch.score,
    matches: fieldMatch.matches,
  };
}

function scoreHistory(input: string, framework: PromptFramework, prompts: PromptHistorySignal[]) {
  let score = 0;
  const matches: string[] = [];

  for (const prompt of prompts) {
    if (!matchesHistoryFramework(prompt, framework)) continue;
    const relevance = getHistoryRelevance(input, prompt);
    if (relevance.score <= 0) continue;

    const usageCount = prompt.usage_count ?? prompt.use_count ?? 0;
    const rating = prompt.rating ?? 0;
    const isFavorite = prompt.favorite ?? prompt.is_favorite ?? false;
    const historyScore = Math.min(relevance.score, 6)
      + Math.min(usageCount, 10) * 0.35
      + (isFavorite ? 2.5 : 0)
      + (rating ? Math.max(0, rating - 3) * 1.25 : 0);

    score += historyScore;
    matches.push(`历史提示词：${prompt.title || framework.name}`);
  }

  return { score, matches };
}

function confidenceFromScore(score: number): FrameworkMatchResult["confidence"] {
  if (score >= HIGH_CONFIDENCE_SCORE) return "high";
  if (score >= MEDIUM_CONFIDENCE_SCORE) return "medium";
  return "low";
}

function getFallbackFramework(frameworks: PromptFramework[]): PromptFramework {
  return frameworks.find((fw) => fw.id === FALLBACK_FRAMEWORK_ID)
    || frameworks.find((fw) => fw.id === "costar")
    || frameworks[0];
}

export function matchFrameworkRecommendation(
  userInput: string,
  frameworks: PromptFramework[] = FRAMEWORKS,
  historyPrompts: PromptHistorySignal[] = []
): FrameworkMatchResult {
  const usableFrameworks = frameworks.length > 0 ? frameworks : FRAMEWORKS;
  const input = normalizeText(userInput);
  const fallback = getFallbackFramework(usableFrameworks);

  if (!input) {
    return {
      framework: fallback,
      confidence: "low",
      score: 0,
      isFallback: true,
      reason: "输入信息不足，使用默认框架",
    };
  }

  const ranked = usableFrameworks.map((framework) => {
    const nameMatch = getFieldMatches(input, [framework.name, framework.fullName], 4, "名称");
    const descriptionMatch = getFieldMatches(input, [framework.description], 2, "描述");
    const bestForMatch = getFieldMatches(input, framework.bestFor, 4, "适用场景");
    const keywordMatch = getFieldMatches(input, framework.keywords, 2, "关键词");
    const templateMatch = getFieldMatches(input, [framework.template], 1, "模板");
    const intentMatch = scoreIntent(input, framework);
    const historyMatch = scoreHistory(input, framework, historyPrompts);
    const score = nameMatch.score
      + descriptionMatch.score
      + bestForMatch.score
      + keywordMatch.score
      + templateMatch.score
      + intentMatch.score
      + historyMatch.score;
    const reasons = [
      ...intentMatch.matches.map((match) => `意图：${match}`),
      ...historyMatch.matches.slice(0, 2),
      ...bestForMatch.matches.slice(0, 2).map((match) => `适用：${match}`),
      ...keywordMatch.matches.slice(0, 2).map((match) => `关键词：${match}`),
      ...nameMatch.matches.slice(0, 1).map((match) => `名称：${match}`),
      ...descriptionMatch.matches.slice(0, 1).map(() => "描述匹配"),
    ];

    return { framework, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const confidence = confidenceFromScore(best.score);

  if (!best || confidence === "low") {
    return {
      framework: fallback,
      confidence: "low",
      score: best?.score ?? 0,
      isFallback: true,
      reason: best?.score ? `置信度较低，默认使用 ${fallback.name}` : "没有明显匹配，使用默认框架",
    };
  }

  return {
    framework: best.framework,
    confidence,
    score: best.score,
    isFallback: false,
    reason: best.reasons.length > 0 ? best.reasons.slice(0, 3).join("；") : "综合字段匹配",
  };
}

// 智能匹配最佳框架
export function matchFramework(
  userInput: string,
  frameworks: PromptFramework[] = FRAMEWORKS
): PromptFramework {
  return matchFrameworkRecommendation(userInput, frameworks).framework;
}

// 获取所有框架列表（用于展示）
export function getAllFrameworks(): Array<{id: string; name: string; description: string; bestFor: string[]}> {
  return FRAMEWORKS.map(fw => ({
    id: fw.id,
    name: fw.name,
    description: fw.description,
    bestFor: fw.bestFor
  }));
}
