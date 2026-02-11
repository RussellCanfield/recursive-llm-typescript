import { afterAll, describe, expect, test } from "bun:test";
import { OpenAICompatibleClient } from "../src/openaiCompatibleClient";

const originalFetch = globalThis.fetch;

describe("OpenAICompatibleClient", () => {
  test("parses content from response", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Hello" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const client = new OpenAICompatibleClient({ apiKey: "test" });
    const result = await client.complete({
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Hello");
  });

  test("passes provider params except internal fields", async () => {
    let requestBody: Record<string, unknown> | null = null;

    globalThis.fetch = (async (_input, init) => {
      if (init?.body) {
        requestBody = JSON.parse(init.body as string) as Record<string, unknown>;
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const client = new OpenAICompatibleClient({ apiKey: "test" });
    await client.complete({
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
      timeoutMs: 500,
      temperature: 0.2,
      max_completion_tokens: 123,
      reasoning: { effort: "medium" },
      extra_body: { foo: "bar" },
    });

    expect(requestBody).not.toBeNull();
    expect(requestBody?.model).toBe("test-model");
    expect(requestBody?.temperature).toBe(0.2);
    expect(requestBody?.max_completion_tokens).toBe(123);
    expect(requestBody?.reasoning).toEqual({ effort: "medium" });
    expect(requestBody?.extra_body).toEqual({ foo: "bar" });
    expect(requestBody?.timeoutMs).toBeUndefined();
  });

  test("parses text from array content response", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  { type: "text", text: "Hello" },
                  { type: "text", text: " world" },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const client = new OpenAICompatibleClient({ apiKey: "test" });
    const result = await client.complete({
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("Hello world");
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
