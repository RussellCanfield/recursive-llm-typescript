export type MessageRole = "system" | "user" | "assistant";

export type Message = {
  role: MessageRole;
  content: string;
};

export type LLMRequest = {
  model: string;
  messages: Message[];
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  timeoutMs?: number;
  [key: string]: unknown;
};

export type LLMResponse = {
  content: string;
};

export interface LLMClient {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

export type RLMConfig = {
  model: string;
  recursiveModel?: string;
  apiKey?: string;
  baseUrl?: string;
  maxDepth?: number;
  maxIterations?: number;
  llmOptions?: Record<string, unknown>;
  client: LLMClient;
};

export type RLMStats = {
  llmCalls: number;
  iterations: number;
  depth: number;
};

export type REPLEnvironment = {
  context: string;
  query: string;
  recursive_llm: (query: string, context: string) => Promise<string>;
  re: {
    findAll: (pattern: string, text: string, flags?: string) => string[];
    search: (pattern: string, text: string, flags?: string) => number;
    match: (pattern: string, text: string, flags?: string) => string | null;
  };
};
