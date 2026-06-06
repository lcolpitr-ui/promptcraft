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

// 智能匹配最佳框架
export function matchFramework(userInput: string): PromptFramework {
  const input = userInput.toLowerCase();

  // 计算每个框架的匹配分数
  const scores = FRAMEWORKS.map(fw => {
    let score = 0;
    fw.keywords.forEach(keyword => {
      if (input.includes(keyword)) {
        score += 2;
      }
    });
    fw.bestFor.forEach(area => {
      if (input.includes(area)) {
        score += 1;
      }
    });
    return { framework: fw, score };
  });

  // 按分数排序
  scores.sort((a, b) => b.score - a.score);

  // 如果没有明显匹配，返回 CO-STAR 作为默认
  if (scores[0].score === 0) {
    return FRAMEWORKS.find(fw => fw.id === "costar")!;
  }

  return scores[0].framework;
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
