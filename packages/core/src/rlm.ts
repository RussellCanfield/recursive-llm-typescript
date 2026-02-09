import { createExecutor, SandboxExecutor } from "@rlm/sandbox";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { isFinal, parseResponse } from "./parser";
import type { LLMClient, Message, RLMConfig, RLMStats, REPLEnvironment } from "./types";

export class RLMError extends Error {}
export class MaxIterationsError extends RLMError {}
export class MaxDepthError extends RLMError {}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_ITERATIONS = 30;

export class RLM {
  private readonly client: LLMClient;
  private readonly model: string;
  private readonly recursiveModel: string;
  private readonly apiKey?: string;
  private readonly baseUrl?: string;
  private readonly maxDepth: number;
  private readonly maxIterations: number;
  private readonly llmOptions: Record<string, unknown>;
  private readonly executor: SandboxExecutor;
  private readonly currentDepth: number;

  private llmCalls = 0;
  private iterations = 0;

  constructor(config: RLMConfig, executor?: SandboxExecutor, currentDepth = 0) {
    this.client = config.client;
    this.model = config.model;
    this.recursiveModel = config.recursiveModel ?? config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.maxDepth = config.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.llmOptions = config.llmOptions ?? {};
    this.executor = executor ?? createExecutor();
    this.currentDepth = currentDepth;
  }

  complete(query = "", context = "", overrides: Record<string, unknown> = {}): string {
    const sab = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sab);
    let result: string | null = null;
    let error: unknown;

    this.acomplete(query, context, overrides)
      .then((value) => {
        result = value;
        Atomics.store(int32, 0, 1);
        Atomics.notify(int32, 0);
      })
      .catch((err) => {
        error = err;
        Atomics.store(int32, 0, 1);
        Atomics.notify(int32, 0);
      });

    Atomics.wait(int32, 0, 0);

    if (error) {
      throw error;
    }

    return result ?? "";
  }

  async acomplete(query = "", context = "", overrides: Record<string, unknown> = {}): Promise<string> {
    if (query && !context) {
      context = query;
      query = "";
    }

    if (this.currentDepth >= this.maxDepth) {
      throw new MaxDepthError(`Max recursion depth (${this.maxDepth}) exceeded`);
    }

    const replEnv = this.buildReplEnv(query, context);
    const systemPrompt = buildSystemPrompt(context.length, this.currentDepth);
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(query) },
    ];

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      this.iterations = iteration + 1;
      const response = await this.callLlm(messages, overrides);

      if (isFinal(response)) {
        const answer = parseResponse(response, replEnv as Record<string, unknown>);
        if (answer !== null) {
          return answer;
        }
      }

      let execResult: string;
      try {
        execResult = await this.executor.execute(response, replEnv as Record<string, unknown>);
      } catch (error) {
        execResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: execResult });
    }

    throw new MaxIterationsError(`Max iterations (${this.maxIterations}) exceeded without FINAL()`);
  }

  private async callLlm(messages: Message[], overrides: Record<string, unknown>): Promise<string> {
    this.llmCalls += 1;
    const defaultModel = this.currentDepth === 0 ? this.model : this.recursiveModel;
    const request = {
      model: (overrides.model as string) ?? defaultModel,
      messages,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      ...this.llmOptions,
      ...overrides,
    } as const;

    const response = await this.client.complete(request);
    return response.content;
  }

  private buildReplEnv(query: string, context: string): REPLEnvironment {
    const re = {
      findAll: (pattern: string, text: string, flags = "g") => {
        return [...text.matchAll(new RegExp(pattern, flags))].map((match) => match[0]);
      },
      search: (pattern: string, text: string, flags = "") => {
        return text.search(new RegExp(pattern, flags));
      },
      match: (pattern: string, text: string, flags = "") => {
        const match = text.match(new RegExp(pattern, flags));
        return match ? match[0] : null;
      },
    };

    return {
      context,
      query,
      recursive_llm: this.makeRecursiveFn(),
      re,
    };
  }

  private makeRecursiveFn() {
    return async (subQuery: string, subContext: string): Promise<string> => {
      if (this.currentDepth + 1 >= this.maxDepth) {
        return `Max recursion depth (${this.maxDepth}) reached`;
      }
      const subRlm = new RLM(
        {
          client: this.client,
          model: this.recursiveModel,
          recursiveModel: this.recursiveModel,
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          maxDepth: this.maxDepth,
          maxIterations: this.maxIterations,
          llmOptions: this.llmOptions,
        },
        this.executor,
        this.currentDepth + 1,
      );

      return subRlm.acomplete(subQuery, subContext);
    };
  }

  get stats(): RLMStats {
    return {
      llmCalls: this.llmCalls,
      iterations: this.iterations,
      depth: this.currentDepth,
    };
  }
}
