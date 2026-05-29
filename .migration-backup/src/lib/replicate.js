/**
 * Helper único pra criar predições no Replicate (com webhook + retry).
 * Usado tanto pelo /api/generate quanto pelo encadeamento no webhook.
 */
/**
 * Descobre a URL pública do app a partir da requisição (automático no Replit/VPS).
 * Localhost não serve pro webhook (o Replicate é externo) → cai pro WEBHOOK_URL do env
 * (que no dev local é o ngrok).
 */
export function baseUrlFromRequest(req) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!host || host.includes("localhost") || host.startsWith("127.")) {
    return process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || (host ? `${proto}://${host}` : "");
  }
  return `${proto}://${host}`;
}

export async function createPrediction({ slug, input, keys = {}, webhookUrl }) {
  const token = keys.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;
  const base = webhookUrl || process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL;
  if (!token) throw new Error("REPLICATE_API_TOKEN não configurado");

  const body = JSON.stringify({
    input,
    webhook: `${base}/api/webhook/replicate`,
    webhook_events_filter: ["completed"],
  });
  const endpoint = `https://api.replicate.com/v1/models/${slug}/predictions`;

  let res;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });
      break;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!res) throw lastErr || new Error("fetch failed");
  if (!res.ok) {
    throw new Error(`Replicate request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Slugs fixos dos modelos de fala (não trocáveis pelo usuário).
export const TALKING_MODELS = {
  klingScene: "kwaivgi/kling-v3-video", // passo 1: gera a cena com movimento
  lipsync: "sync/lipsync-2-pro", // passo 2: lip-sync studio (mais natural, nuance facial)
};

// Modelo de imagem (composição avatar + produto).
export const IMAGE_MODEL = "google/nano-banana-pro";

/**
 * Roda uma predição de forma SÍNCRONA (Prefer: wait) — bom pra geração de imagem,
 * que é rápida e dispensa webhook. Retorna o objeto da predição (com .output).
 */
export async function runPredictionSync({ slug, input, keys = {} }) {
  const token = keys.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN não configurado");

  const endpoint = `https://api.replicate.com/v1/models/${slug}/predictions`;
  let res;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Prefer: "wait",
        },
        body: JSON.stringify({ input }),
      });
      break;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!res) throw lastErr || new Error("fetch failed");
  if (!res.ok) {
    throw new Error(`Replicate request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
