import { describe, expect, it } from "vitest";
import { isTauriRuntime, safeInvoke } from "./tauri";

describe("safeInvoke", () => {
  it("uses browser fallback outside Tauri without throwing", async () => {
    expect(isTauriRuntime()).toBe(false);

    const settings = await safeInvoke<{ api_endpoint: string }>("get_settings");

    expect(settings.api_endpoint).toBe("https://api.deepseek.com");
  });
});
