/**
 * Geração de roteiros UGC. Usa a camada de LLM compartilhada (Claude + fallback Replicate).
 */
import { callLLM, currentProvider, extractJson } from "./llm";

const SYSTEM_PROMPT = `Você é um copywriter especialista em anúncios UGC (user-generated content) para TikTok, Reels e Shorts.
Você escreve roteiros curtos, naturais e autênticos, em primeira pessoa, como uma pessoa real recomendando algo — nunca como propaganda corporativa.
Regras de cada roteiro:
- Gancho forte nos primeiros 3 segundos (pare o scroll).
- Fala em primeira pessoa, tom de conversa, gírias leves quando couber.
- 15 a 30 segundos de fala (aprox. 40-80 palavras).
- Termina com uma chamada pra ação natural.
Responda SEMPRE em português do Brasil.`;

function buildUserPrompt({ context, tone, count }) {
  return `Contexto do produto/oferta:
${context}

Tom desejado: ${tone}
Gere ${count} variações DISTINTAS de roteiro (ângulos diferentes: problema/solução, antes/depois, depoimento, curiosidade, etc).
Responda APENAS com JSON válido, sem texto antes ou depois, neste formato exato:
{"scripts":[{"hook":"primeira frase de gancho","script":"roteiro completo da fala"}]}`;
}

function normalize(arr) {
  return arr
    .map((s) => ({ hook: s.hook || s.gancho || "", script: s.script || s.text || s.roteiro || "" }))
    .filter((s) => s.script);
}

function parseScripts(text) {
  const json = extractJson(text);
  if (json) {
    // formato {"scripts":[...]} ou array no topo [...]
    const arr = Array.isArray(json) ? json : json.scripts || json.roteiros;
    if (Array.isArray(arr) && arr.length > 0) {
      const items = normalize(arr);
      if (items.length) return items;
    }
  }

  // Fallback resiliente: extrai pares hook/script via regex mesmo de JSON cortado/sujo.
  const items = [];
  const re = /"(?:hook|gancho)"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:script|text|roteiro)"\s*:\s*"([\s\S]*?)"\s*}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    items.push({ hook: m[1].trim(), script: m[2].trim() });
  }
  if (items.length) return items;

  // Último recurso: um roteiro só com o texto cru.
  return [{ hook: "", script: text.trim() }];
}

/**
 * Reescreve um roteiro pra caber num tempo de fala alvo (encurta proporcionalmente).
 * @param {object} opts
 * @param {string} opts.script          roteiro atual
 * @param {number} opts.currentSeconds  duração falada atual (s)
 * @param {number} [opts.targetSeconds] alvo (default 15s)
 */
export async function reshapeScript({ script, currentSeconds, targetSeconds = 15, keys }) {
  const words = script.trim().split(/\s+/).filter(Boolean).length || 1;
  const rate = currentSeconds > 0 ? words / currentSeconds : 2.5; // palavras por segundo
  const targetWords = Math.max(8, Math.floor(rate * targetSeconds * 0.85)); // 15% de margem

  const text = await callLLM({
    system:
      "Você é um copywriter de anúncios UGC. Reescreve roteiros mais curtos mantendo o gancho e a mensagem principal, em português do Brasil. Responda APENAS com o texto do roteiro — sem aspas, sem títulos, sem comentários.",
    user: `O roteiro abaixo, quando falado, dura cerca de ${Math.round(currentSeconds)} segundos. Reescreva uma versão mais curta que caiba em no máximo ${targetSeconds} segundos falados (aproximadamente ${targetWords} palavras), mantendo o gancho forte e a ideia central.\n\nRoteiro:\n${script}`,
    maxTokens: 400,
    keys,
  });

  return text
    .replace(/```/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * @param {object} opts
 * @param {string} opts.context  Descrição/infos do produto (pode vir de um Product estruturado).
 * @param {string} [opts.tone]
 * @param {number} [opts.count]
 */
export async function generateScripts({ context, tone = "autêntico e casual", count = 3, keys }) {
  const text = await callLLM({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt({ context, tone, count }),
    maxTokens: 1500,
    keys,
  });
  return { scripts: parseScripts(text), provider: currentProvider(keys) };
}
