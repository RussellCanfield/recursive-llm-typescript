import { describe, expect, test } from "bun:test";
import { extractFinal, extractFinalVar, isFinal, parseResponse } from "../src/parser";

describe("parser", () => {
  test("extractFinal handles quoted values", () => {
    expect(extractFinal('FINAL("Answer")')).toBe("Answer");
    expect(extractFinal("FINAL('Answer')")).toBe("Answer");
  });

  test("extractFinalVar reads from env", () => {
    const env = { result: "value" };
    expect(extractFinalVar("FINAL_VAR(result)", env)).toBe("value");
  });

  test("isFinal detects final statements", () => {
    expect(isFinal("FINAL('x')")).toBe(true);
    expect(isFinal("FINAL_VAR(x)")).toBe(true);
  });

  test("parseResponse returns final value", () => {
    expect(parseResponse("FINAL('ok')", {})).toBe("ok");
  });
});
