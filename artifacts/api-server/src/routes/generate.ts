// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { createPrediction, TALKING_MODELS, baseUrlFromRequest } from "../lib/replicate";
import { synthesizeSpeech } from "../lib/tts";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

const VIDEO_MODELS = {
  "seedance-2": {
    slug: "bytedance/seedance-2.0-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.duration ? { duration: Number(settings.duration) } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
  "kling-v3": {
    slug: "kwaivgi/kling-v3-video",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { start_image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.duration ? { duration: Number(settings.duration) } : {}),
    }),
  },
  "veo-3-1-fast": {
    slug: "google/veo-3.1-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
  "wan-2-2": {
    slug: "wan-video/wan-2.2-i2v-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
};

router.post("/", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      pipeline = "video",
      modelId,
      prompt,
      settings = {},
      images = [],
      voiceId,
      voiceSettings,
      audio: providedAudio,
      audioDuration,
      motionPrompt,
    } = req.body || {};

    const keys = await getUserSecrets(userId);
    const webhookUrl = baseUrlFromRequest(req);

    const baseData = {
      userId,
      type: "video",
      title: (prompt || "Untitled").substring(0, 50) + "...",
      prompt,
      pipeline,
      aspectRatio: settings.aspect_ratio,
      resolution: settings.resolution,
      duration: settings.duration ? Number(settings.duration) : undefined,
      inputImages: images,
    };

    let prediction;
    let extraData = {};

    if (pipeline === "talking-b") {
      if (!images?.[0]) {
        return res.status(400).json({ error: "Selecione um avatar com foto" });
      }
      if (!prompt?.trim()) {
        return res.status(400).json({ error: "Escreva o roteiro (o que o avatar fala)" });
      }
      const audio =
        providedAudio ||
        (await synthesizeSpeech({
          text: prompt,
          voiceId,
          settings: voiceSettings,
          apiKey: keys.ELEVENLABS_API_KEY,
        }));
      const naturalBase =
        "Vídeo realista e natural de uma pessoa real gravando um depoimento casual de celular (UGC). " +
        "Movimentos humanos sutis e espontâneos: pequenas inclinações de cabeça, piscadas, microexpressões faciais, respiração natural, " +
        "gestos leves e fluidos das mãos enquanto fala olhando para a câmera. Iluminação natural, aparência autêntica, nada robótico ou rígido.";
      const motion = motionPrompt?.trim()
        ? `${motionPrompt.trim()}. ${naturalBase}`
        : naturalBase;
      const ad = Number(audioDuration) || 0;
      const klingDuration = ad > 10 ? 15 : ad > 5 ? 10 : 5;
      prediction = await createPrediction({
        slug: TALKING_MODELS.klingScene,
        keys,
        webhookUrl,
        input: {
          prompt: motion,
          start_image: images[0],
          duration: klingDuration,
          ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
        },
      });
      extraData = { modelId: "kling-v3+lipsync", stage: "scene", audio };
    } else {
      const model = VIDEO_MODELS[modelId];
      if (!model) return res.status(400).send("Invalid model selected");
      prediction = await createPrediction({
        slug: model.slug,
        keys,
        webhookUrl,
        input: model.buildInput({ prompt, images, settings }),
      });
      extraData = { modelId };
    }

    const creation = await prisma.creation.create({
      data: { ...baseData, ...extraData, requestId: prediction.id, status: "processing" },
    });

    res.json({ success: true, creationId: creation.id });
  } catch (error) {
    req.log?.error({ err: error }, "[GENERATE_ERROR]");
    res.status(500).json({ error: error.message || "Internal Error" });
  }
});

export default router;
