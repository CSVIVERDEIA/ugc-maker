// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { synthesizeSpeech, listVoices } from "../lib/tts";
import { prisma } from "../lib/prisma";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

// POST /api/tts
router.post("/", async (req, res) => {
  try {
    const { text, voiceId, voiceName, settings } = req.body || {};
    if (!text?.trim()) {
      return res.status(400).json({ error: "Escreva o roteiro primeiro" });
    }
    const keys = await getUserSecrets(req.session.user.id);
    const audio = await synthesizeSpeech({
      text: text.trim(),
      voiceId,
      settings,
      apiKey: keys.ELEVENLABS_API_KEY,
    });
    const creation = await prisma.creation.create({
      data: {
        userId: req.session.user.id,
        type: "audio",
        title: voiceName || "Voz",
        prompt: text.trim(),
        url: audio,
        modelId: voiceName || voiceId || "elevenlabs",
        status: "completed",
      },
    });
    res.json({ id: creation.id, audio });
  } catch (error) {
    req.log?.error({ err: error }, "[TTS_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

export default router;

// Separate router for /api/voices
export const voicesRouter = Router();
voicesRouter.use(requireAuth);
voicesRouter.get("/", async (req, res) => {
  const keys = await getUserSecrets(req.session.user.id);
  if (!keys.ELEVENLABS_API_KEY) {
    return res.json({ configured: false, voices: [] });
  }
  const voices = await listVoices(keys.ELEVENLABS_API_KEY);
  res.json({ configured: true, voices });
});
