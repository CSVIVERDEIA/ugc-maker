// @ts-nocheck
import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { createPrediction, TALKING_MODELS, baseUrlFromRequest } from "../lib/replicate";
import { getUserSecrets } from "../lib/secrets";

const router = Router();

function pickOutput(out) {
  return Array.isArray(out) ? out[out.length - 1] : out;
}

// POST /api/webhook/replicate
router.post("/replicate", async (req, res) => {
  try {
    const data = req.body || {};
    const requestId = data.id;
    req.log?.info({ requestId, status: data?.status }, "[REPLICATE_WEBHOOK_RECEIVED]");

    if (!requestId) {
      return res.status(400).json({ error: "Missing prediction id" });
    }

    const creation = await prisma.creation.findUnique({ where: { requestId } });
    if (!creation) {
      req.log?.warn({ requestId }, "[REPLICATE_WEBHOOK] creation not found");
      return res.status(404).json({ error: "Creation not found" });
    }

    if (data.status === "failed" || data.status === "canceled") {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "failed", error: data.error || `Generation ${data.status}` },
      });
      return res.json({ success: true });
    }

    if (data.status !== "succeeded") {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "processing" },
      });
      return res.json({ success: true });
    }

    const outputUrl = pickOutput(data.output);

    if (creation.pipeline === "talking-b" && creation.stage === "scene") {
      try {
        const keys = await getUserSecrets(creation.userId);
        const lip = await createPrediction({
          slug: TALKING_MODELS.lipsync,
          keys,
          webhookUrl: baseUrlFromRequest(req),
          input: {
            video: outputUrl,
            audio: creation.audio,
            temperature: 0.7,
            sync_mode: "cut_off",
          },
        });
        await prisma.creation.update({
          where: { id: creation.id },
          data: {
            requestId: lip.id,
            stage: "lipsync",
            sceneUrl: outputUrl,
            status: "processing",
          },
        });
      } catch (err) {
        req.log?.error({ err }, "[REPLICATE_WEBHOOK] failed to start lip-sync");
        await prisma.creation.update({
          where: { id: creation.id },
          data: { status: "failed", error: "Falha ao iniciar lip-sync: " + err.message },
        });
      }
      return res.json({ success: true });
    }

    await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "completed", url: outputUrl || null },
    });
    res.json({ success: true });
  } catch (error) {
    req.log?.error({ err: error }, "[REPLICATE_WEBHOOK_ERROR]");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/webhook/stripe — receives raw body (configured in app.ts)
router.post("/stripe", async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    req.log?.error({ err }, "Webhook Error");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const creditsToAdd = parseInt(session.metadata.credits);

    if (userId && creditsToAdd) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: creditsToAdd } },
        });
      } catch (error) {
        req.log?.error({ err: error }, "Error updating user credits");
        return res.status(500).send("Error updating user");
      }
    }
  }

  res.status(200).send();
});

export default router;
