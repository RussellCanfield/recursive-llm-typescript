import { describe, expect, test } from "bun:test";
import { RLM } from "@rlm/core";
import { createDeepAgentsTool, createLangChainRunnable, createLangGraphNode } from "../src/index";

const mockClient = {
  complete: async () => ({ content: "FINAL(\"Answer\")" }),
};

describe("integrations", () => {
  test("langchain runnable invokes rlm", async () => {
    const rlm = new RLM({ client: mockClient, model: "test" });
    const runnable = createLangChainRunnable(rlm);
    const result = await runnable.invoke({ query: "Q", context: "C" });
    expect(result).toBe("Answer");
  });

  test("langgraph node returns result", async () => {
    const rlm = new RLM({ client: mockClient, model: "test" });
    const node = createLangGraphNode(rlm);
    const nextState = await node({ query: "Q", context: "C" });
    expect(nextState.result).toBe("Answer");
  });

  test("deepagents tool runs", async () => {
    const rlm = new RLM({ client: mockClient, model: "test" });
    const tool = createDeepAgentsTool(rlm);
    const result = await tool.run({ query: "Q", context: "C" });
    expect(result).toBe("Answer");
  });
});
