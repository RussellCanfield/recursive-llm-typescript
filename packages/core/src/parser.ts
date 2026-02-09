export const extractFinal = (response: string): string | null => {
  const patterns = [
    /FINAL\s*\(\s*"""([\s\S]*?)"""\s*\)/,
    /FINAL\s*\(\s*'''([\s\S]*?)'''\s*\)/,
    /FINAL\s*\(\s*"([\s\S]*?)"\s*\)/,
    /FINAL\s*\(\s*'([\s\S]*?)'\s*\)/,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match?.[1] !== undefined) {
      return match[1].trim();
    }
  }

  return null;
};

export const extractFinalVar = (response: string, env: Record<string, unknown>): string | null => {
  const match = response.match(/FINAL_VAR\s*\(\s*(\w+)\s*\)/);
  if (!match?.[1]) {
    return null;
  }
  const value = env[match[1]];
  if (value === undefined) {
    return null;
  }
  return String(value);
};

export const isFinal = (response: string): boolean => {
  return response.includes("FINAL(") || response.includes("FINAL_VAR(");
};

export const parseResponse = (response: string, env: Record<string, unknown>): string | null => {
  const answer = extractFinal(response);
  if (answer !== null) {
    return answer;
  }
  const finalVar = extractFinalVar(response, env);
  if (finalVar !== null) {
    return finalVar;
  }
  return null;
};
