// Shared Claude API helper for all AI features
export async function getAnthropicApiKey() {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || process.env.CLAUDE_API_KEY) {
    return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || process.env.CLAUDE_API_KEY || "";
  }

  try {
    const { storage } = await import("./storage");
    return await storage.getSetting("anthropic_api_key") || "";
  } catch {
    return "";
  }
}

export async function hasAnthropicApiKey() {
  return !!(await getAnthropicApiKey());
}

export async function callClaude(
  prompt: string,
  system = "You are an expert executive recruiting assistant for The Hiring Advisors.",
  maxTokens = 1500,
): Promise<string> {
  const key = await getAnthropicApiKey();
  if (!key) throw new Error("Anthropic API key not configured — set ANTHROPIC_API_KEY, ANTHROPIC_KEY, or CLAUDE_API_KEY in Render environment variables");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Claude API ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { content: Array<{ text: string }> };
  return data.content[0].text;
}

export function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("No valid JSON found in AI response");
  }
}
