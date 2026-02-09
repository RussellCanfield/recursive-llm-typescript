import vm from "node:vm";

export interface SandboxOptions {
  timeoutMs?: number;
  maxOutputChars?: number;
  memoryLimitMb?: number;
  preferIsolatedVm?: boolean;
  forceVm?: boolean;
}

export interface SandboxExecutor {
  execute(code: string, env: Record<string, unknown>): Promise<string>;
}

const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_MAX_OUTPUT_CHARS = 2000;
const DEFAULT_MEMORY_LIMIT_MB = 128;

const TRUNCATION_TEMPLATE = "\n\n[Output truncated: {{total}} chars total, showing first {{max}}]";

const normalizeNumber = (value: number | undefined, fallback: number, min: number) => {
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, normalized);
};

const truncateOutput = (output: string, maxChars: number): string => {
  if (output.length <= maxChars) {
    return output.trim();
  }
  const truncated = output.slice(0, maxChars);
  return (
    truncated +
    TRUNCATION_TEMPLATE.replace("{{total}}", output.length.toString()).replace(
      "{{max}}",
      maxChars.toString(),
    )
  ).trim();
};

const extractCode = (text: string): string => {
  const fenced = text.match(/```(?:javascript|js|ts)?\n([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return text.trim();
};

const isExpressionLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const forbiddenPrefixes = [
    "const ",
    "let ",
    "var ",
    "function ",
    "class ",
    "if ",
    "for ",
    "while ",
    "switch ",
    "return ",
    "import ",
    "export ",
    "try ",
    "catch ",
    "throw ",
  ];
  if (forbiddenPrefixes.some((prefix) => trimmed.startsWith(prefix))) return false;
  if (trimmed.includes("=")) return false;
  return true;
};

const buildSafeGlobals = (env: Record<string, unknown>, output: string[]) => {
  const print = (...args: unknown[]) => {
    output.push(args.map((arg) => String(arg)).join(" "));
  };
  const consoleApi = {
    log: print,
    info: print,
    warn: print,
    error: print,
  };

  const sandbox = env as Record<string, unknown>;
  sandbox.print = print;
  sandbox.console = consoleApi;
  sandbox.Math = Math;
  sandbox.JSON = JSON;
  sandbox.Date = Date;
  sandbox.Intl = Intl;
  sandbox.RegExp = RegExp;
  sandbox.Array = Array;
  sandbox.Object = Object;
  sandbox.String = String;
  sandbox.Number = Number;
  sandbox.Boolean = Boolean;
  sandbox.Map = Map;
  sandbox.Set = Set;

  return sandbox;
};

const tryIsolatedVmExecute = async (
  code: string,
  env: Record<string, unknown>,
  options: Required<Pick<SandboxOptions, "timeoutMs" | "maxOutputChars" | "memoryLimitMb">>,
): Promise<string | null> => {
  let isolatedVm: typeof import("isolated-vm") | null = null;
  try {
    isolatedVm = await import("isolated-vm");
  } catch {
    return null;
  }
  if (!isolatedVm) return null;

  const output: string[] = [];
  const safeGlobals = buildSafeGlobals(env, output);
  const isolate = new isolatedVm.Isolate({ memoryLimit: options.memoryLimitMb });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set("global", jail.derefInto());
  await jail.set("globalThis", jail.derefInto());

  for (const [key, value] of Object.entries(safeGlobals)) {
    if (typeof value === "function") {
      await jail.set(key, new isolatedVm.Reference(value));
      await context.eval(`globalThis[${JSON.stringify(key)}] = (...args) => ${key}.applySync(undefined, args);`);
    } else {
      await jail.set(key, value as any, { copy: true });
    }
  }

  const script = await isolate.compileScript(code);
  try {
    await script.run(context, { timeout: options.timeoutMs });
  } catch (error) {
    output.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isolate.dispose();
  }

  const outputText = output.join("\n");
  return truncateOutput(outputText || "Code executed successfully (no output)", options.maxOutputChars);
};

const executeWithNodeVm = (
  code: string,
  env: Record<string, unknown>,
  options: Required<Pick<SandboxOptions, "timeoutMs" | "maxOutputChars">>,
): string => {
  const output: string[] = [];
  const safeGlobals = buildSafeGlobals(env, output);
  safeGlobals.global = safeGlobals;
  safeGlobals.globalThis = safeGlobals;

  const context = vm.createContext(safeGlobals, {
    codeGeneration: { strings: false, wasm: false },
  });
  const script = new vm.Script(`"use strict";\n${code}`);

  try {
    script.runInContext(context, { timeout: options.timeoutMs });
    const lines = code.split("\n").filter((line) => line.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    if (isExpressionLine(lastLine)) {
      try {
        const result = vm.runInContext(lastLine, context, { timeout: options.timeoutMs });
        if (result !== undefined) {
          output.push(String(result));
        }
      } catch {
        // ignore expression evaluation errors
      }
    }
  } catch (error) {
    output.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const outputText = output.join("\n");
  return truncateOutput(outputText || "Code executed successfully (no output)", options.maxOutputChars);
};

export const createExecutor = (options: SandboxOptions = {}): SandboxExecutor => {
  const timeoutMs = normalizeNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1);
  const maxOutputChars = normalizeNumber(options.maxOutputChars, DEFAULT_MAX_OUTPUT_CHARS, 0);
  const memoryLimitMb = normalizeNumber(options.memoryLimitMb, DEFAULT_MEMORY_LIMIT_MB, 8);
  const preferIsolatedVm = options.preferIsolatedVm ?? true;
  const forceVm = options.forceVm ?? false;

  return {
    async execute(rawCode: string, env: Record<string, unknown>) {
      const code = extractCode(rawCode);
      if (!code) {
        return "No code to execute";
      }

      if (preferIsolatedVm && !forceVm) {
        const isolatedResult = await tryIsolatedVmExecute(code, env, {
          timeoutMs,
          maxOutputChars,
          memoryLimitMb,
        });
        if (isolatedResult !== null) {
          return isolatedResult;
        }
      }

      return executeWithNodeVm(code, env, { timeoutMs, maxOutputChars });
    },
  };
};

export { extractCode };
