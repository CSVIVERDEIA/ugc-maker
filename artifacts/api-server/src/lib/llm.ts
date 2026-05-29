// @ts-nocheck
/**
 * Single text-LLM layer. Primary: Claude (Anthropic). Fallback: Replicate text model.
 */

export function currentProvider(keys = {}) {
  if (keys.ANTHROPIC_API_KEY) return "claude";
  if (keys.REPLICATE_API_TOKEN) return "replicate";
  return null;
}

async function callClaude({ system, user, maxTokens, apiKey }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude falhou: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}

async function callReplicate({ system, user, maxTokens, token }) {
  const res = await fetch(
    "https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: { system_prompt: system, prompt: user, max_tokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Replicate (LLM) falhou: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.output) ? data.output.join("") : data.output || "";
}

export async function callLLM({ system, user, maxTokens = 1500, keys = {} }) {
  if (keys.ANTHROPIC_API_KEY) {
    return callClaude({ system, user, maxTokens, apiKey: keys.ANTHROPIC_API_KEY });
  }
  if (keys.REPLICATE_API_TOKEN) {
    return callReplicate({ system, user, maxTokens, token: keys.REPLICATE_API_TOKEN });
  }
  throw new Error(
    "Nenhuma IA de texto configurada. Configure ANTHROPIC_API_KEY (recomendado) ou REPLICATE_API_TOKEN em Configurações."
  );
}

export function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const o1 = cleaned.indexOf("{");
  const o2 = cleaned.lastIndexOf("}");
  if (o1 !== -1 && o2 > o1) {
    try {
      return JSON.parse(cleaned.slice(o1, o2 + 1));
    } catch {}
  }
  const a1 = cleaned.indexOf("[");
  const a2 = cleaned.lastIndexOf("]");
  if (a1 !== -1 && a2 > a1) {
    try {
      return JSON.parse(cleaned.slice(a1, a2 + 1));
    } catch {}
  }
  return null;
}
