import { matchFrameworkRecommendation, type PromptFramework } from "./frameworks";

const BASE_SYSTEM_PROMPT = `你是 PromptCraft 的提示词工程助手。你的任务是把用户的模糊想法打磨成可直接交给大模型使用的高质量提示词。

工作规则：
1. 先判断信息是否足够；不足时最多追问 3 个关键问题。
2. 信息足够时直接生成结构化提示词。
3. 优先保留目标、角色、约束、输出格式和验收标准。
4. 不要输出冗长理论解释，不要重复用户已经明确的信息。
5. 生成结果应清晰、可执行、可复制。`;

function getTemplateFields(template: string): string[] {
  const fields = [...template.matchAll(/【([^】]+)】/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (fields.length > 0) {
    return fields;
  }

  return template
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("___"))
    .slice(0, 8);
}

function getCompactFrameworkGuide(framework: PromptFramework, selectionReason?: string): string {
  const fields = getTemplateFields(framework.template);
  const fieldList = fields.map((field) => `- ${field}`).join("\n");
  const bestFor = framework.bestFor.slice(0, 5).join("、");
  const reasonLine = selectionReason ? `框架选择说明：${selectionReason}\n` : "";

  return `当前框架：${framework.name} (${framework.fullName})
适用场景：${bestFor}
使用原因：${framework.description}
${reasonLine}生成提示词时只保留以下必要字段：
${fieldList}

如果用户缺少某个必要字段，请用“待补充”标记，或先追问。`;
}

export function getSystemPrompt(
  userInput?: string,
  explicitFramework?: PromptFramework | null,
  availableFrameworks?: PromptFramework[],
  selectionReason?: string
): string {
  const recommendation = !explicitFramework && userInput
    ? matchFrameworkRecommendation(userInput, availableFrameworks)
    : null;
  const framework = explicitFramework || recommendation?.framework || null;
  const reason = selectionReason || (recommendation && !recommendation.isFallback ? recommendation.reason : undefined);

  if (!framework) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}

${getCompactFrameworkGuide(framework, reason)}`;
}

export const SYSTEM_PROMPT = getSystemPrompt();
