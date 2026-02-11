import type { LLMClient, LLMRequest, LLMResponse } from "@rlm/core";

export type OpenAICompatibleClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
};

export class OpenAICompatibleClient implements LLMClient {
  private apiKey?: string;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutMs = typeof request.timeoutMs === "number" ? request.timeoutMs : undefined;
    const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    const apiKey = request.apiKey ?? this.apiKey;
    const baseUrl = request.baseUrl ?? this.baseUrl;

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.defaultHeaders,
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const { model, messages, apiKey: _apiKey, baseUrl: _baseUrl, timeoutMs: _timeoutMs, ...rest } = request;

    const body = {
      model,
      messages,
      ...rest,
    } as Record<string, unknown>;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM request failed: ${response.status} ${text}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        return { content };
      }
      if (Array.isArray(content)) {
        const text = content
          .filter((part): part is { type?: string; text?: string } => typeof part === "object" && part !== null)
          .filter((part) => part.type === "text" && typeof part.text === "string")
          .map((part) => part.text as string)
          .join("");
        if (text) {
          return { content: text };
        }
      }
      throw new Error("LLM response missing content");
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
