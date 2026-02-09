# @rlm/core

Core Recursive Language Model (RLM) engine.

## What it provides
- `RLM` class with sync/async completion
- Recursion depth and iteration controls
- Prompt builder and FINAL/FINAL_VAR parsing
- Stats tracking

## Usage
- Instantiate `RLM` with an `LLMClient` from `@rlm/adapters`.
- Use `acomplete` for async execution. `complete()` is disabled to avoid deadlocks.

## Notes
- The REPL environment is provided by `@rlm/sandbox`.
