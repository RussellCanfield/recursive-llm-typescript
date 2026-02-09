# Recursive LLM TypeScript

TypeScript monorepo implementation of Recursive Language Models with optional LangChain/LangGraph/DeepAgents integrations.

## Packages
- `@rlm/core`: Recursive LLM engine
- `@rlm/sandbox`: Sandboxed JavaScript execution (install `isolated-vm` for stronger isolation)
- `@rlm/adapters`: LLM provider adapters (OpenAI-compatible)
- `@rlm/integrations`: Optional LangChain/LangGraph/DeepAgents wrappers

## Quick start
- Initialize an adapter and pass it into the core RLM instance.
- Use `acomplete` for async usage or `complete` for sync (blocking) usage.

## Python library reference
- This project ports the original Python package: https://github.com/ysz/recursive-llm
- Core ideas: store context outside the prompt, use a REPL to explore, and recurse over sub-contexts to avoid context rot.
- Python features mirrored here: FINAL/FINAL_VAR parsing, max depth/iteration controls, and REPL-driven exploration.

## Development
- `bun run build`
- `bun run test`
