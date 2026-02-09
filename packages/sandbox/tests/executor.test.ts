import { describe, expect, test } from "bun:test";
import { createExecutor, extractCode } from "../src/index";

describe("sandbox executor", () => {
  test("extracts fenced code", () => {
    const code = extractCode("```js\nconsole.log('hi')\n```");
    expect(code).toBe("console.log('hi')");
  });

  test("executes code and captures output", async () => {
    const executor = createExecutor({ forceVm: true });
    const output = await executor.execute("print('hello')", {});
    expect(output).toContain("hello");
  });

  test("truncates output", async () => {
    const executor = createExecutor({ forceVm: true, maxOutputChars: 10 });
    const output = await executor.execute("print('0123456789012345')", {});
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain("Output truncated");
  });

  test("syncs new globals for FINAL_VAR", async () => {
    const executor = createExecutor({ preferIsolatedVm: true });
    const env: Record<string, unknown> = {};
    await executor.execute("globalThis.result = 'Synced'", env);
    expect(env.result).toBe("Synced");
  });
});
