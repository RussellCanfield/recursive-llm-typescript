import type { RLM } from "@rlm/core";

type LangChainInput = {
  query?: string;
  context?: string;
};

type LangGraphState = {
  query?: string;
  context?: string;
  result?: string;
};

export const createLangChainRunnable = (rlm: RLM) => {
  return {
    async invoke(input: LangChainInput) {
      const query = input.query ?? "";
      const context = input.context ?? "";
      return rlm.acomplete(query, context);
    },
  };
};

export const createLangGraphNode = (rlm: RLM) => {
  return async (state: LangGraphState): Promise<LangGraphState> => {
    const query = state.query ?? "";
    const context = state.context ?? "";
    const result = await rlm.acomplete(query, context);
    return { ...state, result };
  };
};

export type DeepAgentsToolInput = {
  query?: string;
  context?: string;
  contextRef?: string;
};

export type DeepAgentsToolOptions = {
  resolveContextRef?: (ref: string) => Promise<string>;
  name?: string;
  description?: string;
};

export const createDeepAgentsTool = (rlm: RLM, options: DeepAgentsToolOptions = {}) => {
  const name = options.name ?? "recursive_llm";
  const description = options.description ?? "Recursive LLM tool";

  return {
    name,
    description,
    async run(input: DeepAgentsToolInput) {
      const query = input.query ?? "";
      let context = input.context ?? "";

      if (!input.context && input.contextRef && options.resolveContextRef) {
        context = await options.resolveContextRef(input.contextRef);
      }

      return rlm.acomplete(query, context);
    },
  };
};
