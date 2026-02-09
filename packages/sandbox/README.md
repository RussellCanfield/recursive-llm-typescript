# @rlm/sandbox

Sandboxed JavaScript execution for RLM.

## What it provides
- Safe code execution with output capture and truncation
- Prefers `isolated-vm` when installed
- Falls back to Node.js `vm` with restricted globals

## Usage
- Use `createExecutor()` and call `execute(code, env)`.

## Notes
- Install `isolated-vm` separately for stronger isolation.
- When `recursive_llm` is present in the environment, the executor falls back to Node's `vm` to ensure async recursion works.
- Globals created during execution (for example, `globalThis.result` for `FINAL_VAR`) are synced back to the host environment.
