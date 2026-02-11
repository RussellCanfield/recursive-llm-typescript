import { createExecutor, SandboxExecutor } from "@rlm/sandbox";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { isFinal, parseResponse } from "./parser";
import type {
  IngestionMetadata,
  LLMClient,
  Message,
  OversizeMode,
  PromptBuilder,
  RLMConfig,
  RLMStats,
  REPLEnvironment,
} from "./types";

export class RLMError extends Error {}
export class MaxIterationsError extends RLMError {}
export class MaxDepthError extends RLMError {}
export class ContextTooLargeError extends RLMError {}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_ITERATIONS = 30;
const DEFAULT_MAX_CONTEXT_CHARS = 100_000;
const DEFAULT_OVERSIZE_MODE: OversizeMode = "truncate_head_tail";

export class RLM {
  private readonly client: LLMClient;
  private readonly model: string;
  private readonly recursiveModel: string;
  private readonly apiKey?: string;
  private readonly baseUrl?: string;
  private readonly maxDepth: number;
  private readonly maxIterations: number;
  private readonly llmOptions: Record<string, unknown>;
  private readonly maxContextChars: number;
  private readonly oversizeMode: OversizeMode;
  private readonly promptBuilder?: PromptBuilder;
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
    this.maxContextChars = config.ingestion?.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS;
    this.oversizeMode = config.ingestion?.oversizeMode ?? DEFAULT_OVERSIZE_MODE;
    this.promptBuilder = config.promptBuilder;
    this.executor = executor ?? createExecutor();
    this.currentDepth = currentDepth;
  }

  complete(query = "", context = "", overrides: Record<string, unknown> = {}): string {
    throw new RLMError(
      "RLM.complete() is not supported in JavaScript runtimes because it can deadlock. Use acomplete() instead.",
    );
  }

  async acomplete(query = "", context = "", overrides: Record<string, unknown> = {}): Promise<string> {
    if (query && !context) {
      context = query;
      query = "";
    }

    if (this.currentDepth >= this.maxDepth) {
      throw new MaxDepthError(`Max recursion depth (${this.maxDepth}) exceeded`);
    }

    const prepared = this.prepareContext(context);
    const replEnv = this.buildReplEnv(query, prepared.context);
    const messages = this.buildMessages(query, prepared.context.length, prepared.ingestion);

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

  private buildMessages(query: string, contextSize: number, ingestion: IngestionMetadata): Message[] {
    if (this.promptBuilder) {
      return this.promptBuilder({
        query,
        contextSize,
        depth: this.currentDepth,
        ingestion,
      });
    }

    const systemPrompt = buildSystemPrompt(contextSize, this.currentDepth, ingestion);
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(query) },
    ];
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

  private prepareContext(context: string): { context: string; ingestion: IngestionMetadata } {
    const originalChars = context.length;

    if (originalChars <= this.maxContextChars) {
      return {
        context,
        ingestion: {
          originalChars,
          retainedChars: originalChars,
          truncated: false,
          oversizeMode: this.oversizeMode,
        },
      };
    }

    if (this.oversizeMode === "error") {
      throw new ContextTooLargeError(
        `Context too large (${originalChars} chars); max is ${this.maxContextChars}`,
      );
    }

    const headLength = Math.floor(this.maxContextChars / 2);
    const tailLength = this.maxContextChars - headLength;
    const retained = `${context.slice(0, headLength)}${context.slice(-tailLength)}`;

    return {
      context: retained,
      ingestion: {
        originalChars,
        retainedChars: retained.length,
        truncated: true,
        oversizeMode: this.oversizeMode,
      },
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
          ingestion: {
            maxContextChars: this.maxContextChars,
            oversizeMode: this.oversizeMode,
          },
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
