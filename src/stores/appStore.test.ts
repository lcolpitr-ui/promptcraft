import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage as sendAiMessage } from "../lib/ai";
import { FRAMEWORKS } from "../lib/frameworks";
import { useAppStore } from "./appStore";

vi.mock("../lib/ai", () => ({
  sendMessage: vi.fn(),
}));

const mockedSendMessage = vi.mocked(sendAiMessage);

describe("appStore cancellation", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedSendMessage.mockReset();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        availableFrameworks: FRAMEWORKS,
      },
      true
    );
  });

  it("does not write a cancelled AI result back to the conversation", async () => {
    let resolveAi!: (value: { content: string; request_id: string }) => void;
    mockedSendMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveAi = resolve;
      })
    );

    const pendingSend = useAppStore.getState().sendMessage("请生成提示词");

    await vi.waitFor(() => {
      expect(mockedSendMessage).toHaveBeenCalledTimes(1);
    });

    await useAppStore.getState().stopGeneration();
    resolveAi({ content: "这个结果不应该写入", request_id: "request-1" });
    await pendingSend;

    const messages = useAppStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user", content: "请生成提示词" });
    expect(useAppStore.getState().isLoading).toBe(false);
  });
});
