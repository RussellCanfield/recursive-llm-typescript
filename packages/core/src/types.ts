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

export type OversizeMode = "truncate_head_tail" | "error";

export type IngestionConfig = {
  maxContextChars?: number;
  oversizeMode?: OversizeMode;
};

export type IngestionMetadata = {
  originalChars: number;
  retainedChars: number;
  truncated: boolean;
  oversizeMode: OversizeMode;
};

export type PromptBuilderInput = {
  query: string;
  contextSize: number;
  depth: number;
  ingestion: IngestionMetadata;
};

export type PromptBuilder = (input: PromptBuilderInput) => Message[];

export type RLMConfig = {
  model: string;
  recursiveModel?: string;
  apiKey?: string;
  baseUrl?: string;
  maxDepth?: number;
  maxIterations?: number;
  llmOptions?: Record<string, unknown>;
  ingestion?: IngestionConfig;
  promptBuilder?: PromptBuilder;
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
