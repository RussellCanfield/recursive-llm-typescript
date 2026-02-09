import { describe, expect, test } from "bun:test";
import { createExecutor } from "@rlm/sandbox";
import { MaxDepthError, MaxIterationsError, RLM, RLMError } from "../src/rlm";
import type { LLMClient, LLMRequest } from "../src/types";

const executor = createExecutor({ forceVm: true });

class MockClient implements LLMClient {
  private responses: string[];
  public calls: LLMRequest[] = [];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  async complete(request: LLMRequest) {
    this.calls.push(request);
    const content = this.responses.shift() ?? "";
    return { content };
  }
}

describe("RLM core", () => {
  test("simple complete with FINAL", async () => {
    const client = new MockClient(["FINAL(\"The answer\")"]);
    const rlm = new RLM({ client, model: "test-model" }, executor);
    const result = await rlm.acomplete("What is the answer?", "Some context");
    expect(result).toBe("The answer");
  });

  test("multi-step complete", async () => {
    const client = new MockClient(["print(context.slice(0, 5))", "FINAL(\"Done\")"]);
    const rlm = new RLM({ client, model: "test-model" }, executor);
    const result = await rlm.acomplete("Test", "Hello World");
    expect(result).toBe("Done");
  });

  test("max iterations error", async () => {
    const client = new MockClient(["print('hi')", "print('hi')", "print('hi')"]);
    const rlm = new RLM({ client, model: "test-model", maxIterations: 2 }, executor);
    await expect(rlm.acomplete("Test", "Context")).rejects.toBeInstanceOf(MaxIterationsError);
  });

  test("max depth error", async () => {
    const client = new MockClient(["FINAL(\"Answer\")"]);
    const rlm = new RLM({ client, model: "test-model", maxDepth: 1 }, executor, 1);
    await expect(rlm.acomplete("Test", "Context")).rejects.toBeInstanceOf(MaxDepthError);
  });

  test("final var extraction", async () => {
    const client = new MockClient(["globalThis.result = 'Test Answer'\nprint(globalThis.result)", "FINAL_VAR(result)"]);
    const rlm = new RLM({ client, model: "test-model" }, executor);
    const result = await rlm.acomplete("Test", "Context");
    expect(result).toBe("Test Answer");
  });

  test("stats tracking", async () => {
    const client = new MockClient(["print('x')", "print('y')", "FINAL(\"Done\")"]);
    const rlm = new RLM({ client, model: "test-model" }, executor);
    await rlm.acomplete("Test", "Context");
    expect(rlm.stats.llmCalls).toBe(3);
    expect(rlm.stats.iterations).toBe(3);
    expect(rlm.stats.depth).toBe(0);
  });

  test("model selection", async () => {
    const client = new MockClient(["FINAL(\"Answer\")"]);
    const rlm = new RLM({ client, model: "expensive", recursiveModel: "cheap" }, executor);
    await rlm.acomplete("Test", "Context");
    expect(client.calls[0]?.model).toBe("expensive");
  });

  test("complete throws with guidance", () => {
    const client = new MockClient(["FINAL(\"Answer\")"]);
    const rlm = new RLM({ client, model: "test-model" }, executor);
    expect(() => rlm.complete("Test", "Context")).toThrow(RLMError);
  });
});
