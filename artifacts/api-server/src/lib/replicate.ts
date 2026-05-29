// @ts-nocheck
/**
 * Helper for creating Replicate predictions (with webhook + retry).
 */

/**
 * Resolves the app's public URL from the Express request, for the Replicate webhook.
 * Localhost can't receive webhooks → falls back to WEBHOOK_URL / REPLIT_DEV_DOMAIN.
 */
export function baseUrlFromRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "";
  if (!host || host.includes("localhost") || host.startsWith("127.")) {
    if (process.env.WEBHOOK_URL) return process.env.WEBHOOK_URL;
    if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    return host ? `${proto}://${host}` : "";
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

export const TALKING_MODELS = {
  klingScene: "kwaivgi/kling-v3-video",
  lipsync: "sync/lipsync-2-pro",
};

export const IMAGE_MODEL = "google/nano-banana-pro";

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
