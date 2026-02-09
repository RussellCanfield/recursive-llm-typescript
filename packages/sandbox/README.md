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
