// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { generateScripts, reshapeScript, enhanceMotionPrompt } from "../lib/scriptgen";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

// POST /api/scripts
router.post("/", async (req, res) => {
  try {
    const { context, tone, count } = req.body || {};
    if (!context?.trim()) {
      return res.status(400).json({ error: "Informe o contexto do produto ou a oferta" });
    }
    const keys = await getUserSecrets(req.session.user.id);
    const { scripts, provider } = await generateScripts({
      context: context.trim(),
      tone: tone?.trim() || undefined,
      count: Math.min(Math.max(Number(count) || 3, 1), 5),
      keys,
    });
    res.json({ scripts, provider });
  } catch (error) {
    req.log?.error({ err: error }, "[SCRIPTS_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

// POST /api/scripts/reshape
router.post("/reshape", async (req, res) => {
  try {
    const { script, currentSeconds, targetSeconds } = req.body || {};
    if (!script?.trim()) {
      return res.status(400).json({ error: "Roteiro vazio" });
    }
    const keys = await getUserSecrets(req.session.user.id);
    const reshaped = await reshapeScript({
      script: script.trim(),
      currentSeconds: Number(currentSeconds) || 0,
      targetSeconds: Math.min(Number(targetSeconds) || 15, 15),
      keys,
    });
    res.json({ script: reshaped });
  } catch (error) {
    req.log?.error({ err: error }, "[RESHAPE_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

// POST /api/scripts/enhance-motion — melhora uma descrição crua de movimento da cena
router.post("/enhance-motion", async (req, res) => {
  try {
    const { raw } = req.body || {};
    if (!raw?.trim()) {
      return res.status(400).json({ error: "Escreva uma ideia do movimento primeiro" });
    }
    const keys = await getUserSecrets(req.session.user.id);
    const motion = await enhanceMotionPrompt({ raw: raw.trim(), keys });
    if (!motion?.trim()) {
      return res.status(502).json({ error: "A IA não retornou uma versão melhorada. Tente de novo." });
    }
    res.json({ motion });
  } catch (error) {
    req.log?.error({ err: error }, "[ENHANCE_MOTION_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

export default router;
