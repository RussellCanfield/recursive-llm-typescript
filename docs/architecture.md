# Architecture

## Packages
- core: RLM engine (prompting, parser, recursion control, stats)
- sandbox: secure JS execution environment (isolated-vm or safer alternative)
- adapters: LLM provider adapters
- integrations: LangChain/LangGraph/DeepAgents bridges

## Security
- Prefer isolated-vm for sandboxing where available (install separately for strongest isolation).
- Fall back to a restricted Node.js vm sandbox if isolated-vm is not available.
- Enforce execution timeouts and output truncation.
