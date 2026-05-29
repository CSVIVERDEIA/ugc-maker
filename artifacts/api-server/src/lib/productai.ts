// @ts-nocheck
import { callLLM, currentProvider, extractJson } from "./llm";

const SYSTEM_PROMPT = `Você é um especialista em marketing que estrutura informações de produtos para campanhas de anúncios UGC.
A partir do texto livre do usuário, você organiza os dados do produto e identifica lacunas importantes que ainda faltam para criar bons anúncios.
Seja conciso e prático. Responda SEMPRE em português do Brasil.`;

function buildUserPrompt(rawText) {
  return `Texto do usuário sobre o produto:
"""
${rawText}
"""

Organize essas informações. Responda APENAS com JSON válido, sem texto antes ou depois, neste formato exato:
{
  "name": "nome curto do produto",
  "description": "descrição clara em 1-2 frases",
  "info": {
    "benefits": ["benefício 1", "benefício 2"],
    "audience": "público-alvo principal",
    "price": "preço ou faixa de preço (ou vazio se não informado)",
    "differentials": ["diferencial 1", "diferencial 2"],
    "tone": "tom de voz sugerido para os anúncios"
  },
  "questions": ["pergunta de acompanhamento pra preencher uma lacuna importante", "outra pergunta"]
}
Se alguma informação não foi dada, deixe o campo vazio e crie uma pergunta correspondente em "questions".`;
}

export async function structureProduct(rawText, keys) {
  const text = await callLLM({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(rawText),
    maxTokens: 1200,
    keys,
  });

  const json = extractJson(text);
  if (!json) {
    throw new Error("A IA não retornou um formato válido. Tente reformular a descrição.");
  }

  return {
    name: json.name || "",
    description: json.description || "",
    info: json.info || {},
    questions: Array.isArray(json.questions) ? json.questions : [],
    provider: currentProvider(keys),
  };
}
