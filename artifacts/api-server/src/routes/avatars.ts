// @ts-nocheck
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { runPredictionSync, IMAGE_MODEL } from "../lib/replicate";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

async function getOwned(id, userId) {
  const avatar = await prisma.avatar.findUnique({ where: { id } });
  if (!avatar || avatar.userId !== userId) return null;
  return avatar;
}

function pickOutput(out) {
  return Array.isArray(out) ? out[0] : out;
}

async function toDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao baixar a imagem gerada");
  const mime = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Valores permitidos por característica — devem espelhar as opções do criador guiado
// no front. Garante que nenhum texto livre chegue ao gerador de prompt.
const ALLOWED_ATTRS = {
  gender: ["Mulher", "Homem", "Andrógino"],
  age: ["18-25", "26-35", "36-45", "46-60", "60+"],
  ethnicity: ["Caucasiana", "Negra", "Parda / Latina", "Asiática", "Indígena", "Árabe"],
  skin: ["Clara", "Média", "Morena", "Escura"],
  hairColor: ["Preto", "Castanho", "Loiro", "Ruivo", "Grisalho", "Colorido"],
  hairStyle: ["Curto", "Médio", "Longo", "Cacheado", "Liso", "Preso / coque", "Careca"],
  facialHair: ["Sem barba", "Barba por fazer", "Barba cheia", "Cavanhaque", "Bigode"],
  body: ["Magro", "Atlético", "Mediano", "Curvilíneo", "Plus size"],
  style: ["Casual", "Fitness", "Executivo", "Streetwear", "Elegante", "Beleza / skincare"],
  expression: ["Sorridente e simpático", "Sério e confiante", "Energético", "Calmo", "Sofisticado"],
  setting: ["Estúdio neutro", "Em casa", "Rua urbana", "Academia", "Café", "Escritório", "Natureza"],
};
const ALLOWED_ASPECT = ["3:4", "1:1", "9:16"];

// Valores conhecidos passam direto; valores personalizados (texto livre) são
// aceitos depois de limpos e limitados em tamanho, pra suportar a opção "Personalizado".
function sanitizeCustom(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>{}]/g, "")
    .trim()
    .slice(0, 80);
}

function sanitizeAttributes(raw = {}) {
  const clean = {};
  for (const key of Object.keys(ALLOWED_ATTRS)) {
    const value = raw[key];
    if (value == null || value === "") continue;
    const allowed = ALLOWED_ATTRS[key];
    if (allowed.includes(value)) {
      clean[key] = value;
    } else {
      const custom = sanitizeCustom(value);
      if (custom) clean[key] = custom;
    }
  }
  return clean;
}

// Monta o prompt do retrato a partir das escolhas guiadas (rótulos em PT vindos do front).
function buildPortraitPrompt(attrs = {}) {
  const a = attrs;
  const traits = [
    a.gender,
    a.age && `idade aparente ${a.age}`,
    a.ethnicity,
    a.skin && `pele ${a.skin}`,
    a.hairColor && `cabelo ${a.hairColor}`,
    a.hairStyle,
    a.body && `corpo ${a.body}`,
    a.facialHair && a.facialHair !== "Sem barba" ? a.facialHair : null,
    a.style && `estilo ${a.style}`,
    a.expression,
  ].filter(Boolean);

  const scene = a.setting ? `Cenário de fundo: ${a.setting}.` : "";

  return [
    "Retrato fotográfico realista de uma pessoa para usar como avatar/ator de vídeos UGC (user-generated content).",
    traits.length ? `Características: ${traits.join(", ")}.` : "",
    scene,
    "Foto vertical, rosto bem visível e nítido, olhando para a câmera, iluminação natural e suave, aparência autêntica e amigável, alta qualidade, fotorrealista.",
  ]
    .filter(Boolean)
    .join(" ");
}

router.get("/", async (req, res) => {
  const avatars = await prisma.avatar.findMany({
    where: { userId: req.session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ avatars });
});

router.post("/", async (req, res) => {
  const { name, description, settings, photos } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "O nome do avatar é obrigatório" });
  }
  const avatar = await prisma.avatar.create({
    data: {
      userId: req.session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      settings: settings ?? undefined,
      photos: Array.isArray(photos) ? photos : [],
    },
  });
  res.json({ avatar });
});

// POST /api/avatars/generate-portrait — gera um retrato (text-to-image) a partir
// das escolhas guiadas. Não cria o avatar, só devolve a imagem pro front decidir.
router.post("/generate-portrait", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { attributes, aspectRatio } = req.body || {};

    let attrs;
    try {
      attrs = sanitizeAttributes(attributes || {});
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const aspect = ALLOWED_ASPECT.includes(aspectRatio) ? aspectRatio : "3:4";

    const prompt = buildPortraitPrompt(attrs);
    const keys = await getUserSecrets(userId);

    const prediction = await runPredictionSync({
      slug: IMAGE_MODEL,
      keys,
      input: {
        prompt,
        aspect_ratio: aspect,
        safety_filter_level: "block_only_high",
      },
    });

    if (prediction.status === "failed" || prediction.error) {
      throw new Error(prediction.error || "Falha ao gerar o retrato");
    }

    const outUrl = pickOutput(prediction.output);
    if (!outUrl) throw new Error("A geração não retornou imagem");

    const image = await toDataUri(outUrl);

    await prisma.creation.create({
      data: {
        userId,
        type: "image",
        title: "Retrato de avatar",
        prompt,
        url: image,
        modelId: IMAGE_MODEL,
        status: "completed",
        inputImages: [],
      },
    });

    res.json({ image });
  } catch (error) {
    req.log?.error({ err: error }, "[AVATAR_PORTRAIT_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  const avatar = await getOwned(req.params.id, req.session.user.id);
  if (!avatar) return res.status(404).send("Not found");
  res.json({ avatar });
});

router.patch("/:id", async (req, res) => {
  const existing = await getOwned(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  const { name, description, settings, photos } = req.body || {};
  const avatar = await prisma.avatar.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(settings !== undefined ? { settings } : {}),
      ...(photos !== undefined ? { photos: Array.isArray(photos) ? photos : [] } : {}),
    },
  });
  res.json({ avatar });
});

router.delete("/:id", async (req, res) => {
  const existing = await getOwned(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  await prisma.avatar.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
