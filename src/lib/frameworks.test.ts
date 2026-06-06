import { describe, expect, it } from "vitest";
import { FRAMEWORKS, matchFramework, matchFrameworkRecommendation, type PromptFramework } from "./frameworks";

describe("matchFramework", () => {
  it("prefers a technical framework for database schema tasks", () => {
    const result = matchFrameworkRecommendation("帮我设计数据库表结构，包含字段、索引和 API 读写约束", FRAMEWORKS);

    expect(result.framework.id).toBe("rodes");
    expect(result.confidence).not.toBe("low");
    expect(result.isFallback).toBe(false);
  });

  it("prefers a writing and marketing framework for campaign copy", () => {
    const result = matchFrameworkRecommendation("写一篇公众号营销文案，面向新用户推广产品", FRAMEWORKS);

    expect(result.framework.id).toBe("costar");
    expect(result.confidence).not.toBe("low");
    expect(result.reason).toContain("意图");
  });

  it("prefers an analysis or business framework for decision advice", () => {
    const result = matchFrameworkRecommendation("分析业务问题并给出决策建议，需要说明关键指标和方案取舍", FRAMEWORKS);

    expect(["care", "broke"]).toContain(result.framework.id);
    expect(result.confidence).not.toBe("low");
  });

  it("matches custom frameworks by name, description, and bestFor", () => {
    const customFramework: PromptFramework = {
      id: "custom:interview",
      name: "INTERVIEW",
      fullName: "Interview Answer Builder",
      description: "用于面试回答和 STAR 结构化表达",
      bestFor: ["面试", "求职"],
      keywords: ["INTERVIEW", "面试", "求职", "STAR"],
      template: "【Situation】\n___",
    };

    const framework = matchFramework("帮我准备一个面试自我介绍", [...FRAMEWORKS, customFramework]);

    expect(framework.id).toBe("custom:interview");
  });

  it("matches custom frameworks through bestFor", () => {
    const customFramework: PromptFramework = {
      id: "custom:legal-review",
      name: "LEGAL",
      fullName: "Legal Risk Review",
      description: "合同和条款风险审查",
      bestFor: ["合同审查", "法律风险"],
      keywords: ["legal", "contract"],
      template: "【风险点】\n___",
    };

    const result = matchFrameworkRecommendation("帮我做一份合同审查清单", [...FRAMEWORKS, customFramework]);

    expect(result.framework.id).toBe("custom:legal-review");
    expect(result.isFallback).toBe(false);
  });

  it("uses a marked default fallback for low-confidence input", () => {
    const result = matchFrameworkRecommendation("嗯，那个东西再看看", FRAMEWORKS);

    expect(result.framework.id).toBe("oasis");
    expect(result.confidence).toBe("low");
    expect(result.isFallback).toBe(true);
  });
});
