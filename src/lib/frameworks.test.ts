import { describe, expect, it } from "vitest";
import { matchFramework, type PromptFramework } from "./frameworks";

describe("matchFramework", () => {
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

    const framework = matchFramework("帮我准备一个面试自我介绍", [customFramework]);

    expect(framework.id).toBe("custom:interview");
  });
});
