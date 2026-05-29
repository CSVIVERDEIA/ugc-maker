// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { runPredictionSync, IMAGE_MODEL } from "../lib/replicate";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

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

// Transforma as escolhas guiadas (rótulos em PT do front) numa direção de cena
// rica, seguindo boas práticas de prompt para fotografia de produto.
function buildSceneDirection(scene = {}) {
  if (!scene || typeof scene !== "object") return "";
  const { shot, setting, lighting, background, mood, angle, details } = scene;
  return [
    shot && `Enquadramento: ${shot}.`,
    angle && `Ângulo da câmera: ${angle}.`,
    setting && `Ambiente/cenário: ${setting}.`,
    background && `Fundo: ${background}.`,
    lighting && `Iluminação: ${lighting}.`,
    mood && `Estilo e clima: ${mood}.`,
    details && `Detalhes adicionais: ${details}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

router.post("/", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { avatarId, productId, prompt, scene, aspectRatio } = req.body || {};

    const [avatar, product] = await Promise.all([
      avatarId ? prisma.avatar.findUnique({ where: { id: avatarId } }) : null,
      productId ? prisma.product.findUnique({ where: { id: productId } }) : null,
    ]);

    if (avatar && avatar.userId !== userId) return res.status(404).send("Not found");
    if (product && product.userId !== userId) return res.status(404).send("Not found");

    const imageInput = [
      ...(avatar?.photos || []).slice(0, 1),
      ...(product?.photos || []),
    ].filter(Boolean).slice(0, 6);

    if (imageInput.length === 0) {
      return res.status(400).json({ error: "Selecione um avatar e/ou produto com fotos" });
    }

    // direção da cena: novo formato guiado (scene) ou texto livre legado (prompt)
    const sceneObj =
      scene && typeof scene === "object"
        ? scene
        : prompt?.trim()
        ? { details: prompt.trim() }
        : {};
    const direction = buildSceneDirection(sceneObj);

    const fullPrompt = [
      avatar && product
        ? "A pessoa da primeira imagem segurando e usando naturalmente o produto das outras imagens."
        : product
        ? "Uma pessoa real usando/segurando o produto das imagens de forma natural."
        : "A pessoa da imagem em uma cena natural.",
      direction,
      "Fotografia de produto com qualidade profissional: foco nítido no produto, composição equilibrada, cores fiéis e bem balanceadas, profundidade de campo agradável, alta resolução e aparência realista e atraente. Mantenha o rosto da pessoa e o produto fiéis às imagens de referência, sem distorcer textos, logos ou formato da embalagem.",
    ]
      .filter(Boolean)
      .join(" ");

    const keys = await getUserSecrets(userId);
    const prediction = await runPredictionSync({
      slug: IMAGE_MODEL,
      keys,
      input: {
        prompt: fullPrompt,
        image_input: imageInput,
        aspect_ratio: aspectRatio || "9:16",
        safety_filter_level: "block_only_high",
      },
    });

    if (prediction.status === "failed" || prediction.error) {
      throw new Error(prediction.error || "Falha ao gerar a imagem");
    }

    const outUrl = pickOutput(prediction.output);
    if (!outUrl) throw new Error("A composição não retornou imagem");

    const image = await toDataUri(outUrl);
    const creation = await prisma.creation.create({
      data: {
        userId,
        type: "image",
        title: product?.name || avatar?.name || "Imagem",
        prompt: fullPrompt,
        url: image,
        modelId: IMAGE_MODEL,
        status: "completed",
        inputImages: imageInput,
      },
    });

    res.json({ image, id: creation.id });
  } catch (error) {
    req.log?.error({ err: error }, "[COMPOSE_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

export default router;
