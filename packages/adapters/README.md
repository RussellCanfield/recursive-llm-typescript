# @rlm/adapters

LLM provider adapters for RLM.

## What it provides
- `OpenAICompatibleClient` for OpenAI-style chat completions

## Usage
- Instantiate the client and pass it into `RLM` from `@rlm/core`.

## Notes
- The adapter expects OpenAI-compatible `/chat/completions` endpoints.
- Internal request fields (e.g., `timeoutMs`) are filtered out before sending.
