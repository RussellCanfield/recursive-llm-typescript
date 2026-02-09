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

export const createDeepAgentsTool = (rlm: RLM, name = "recursive_llm", description = "Recursive LLM tool") => {
  return {
    name,
    description,
    async run(input: { query?: string; context?: string }) {
      return rlm.acomplete(input.query ?? "", input.context ?? "");
    },
  };
};
