import { afterAll, describe, expect, test } from "bun:test";
import { OpenAICompatibleClient } from "../src/openaiCompatibleClient";

const originalFetch = globalThis.fetch;

describe("OpenAICompatibleClient", () => {
  test("parses content from response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Hello" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    const client = new OpenAICompatibleClient({ apiKey: "test" });
    const result = await client.complete({
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Hello");
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
