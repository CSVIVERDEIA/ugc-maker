// @ts-nocheck
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

async function getOwned(id, userId) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.userId !== userId) return null;
  return campaign;
}

router.get("/", async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { userId: req.session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ campaigns });
});

router.post("/", async (req, res) => {
  const { name, objective, angle, audience, cta, productId } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "O nome da campanha é obrigatório" });
  }
  const campaign = await prisma.campaign.create({
    data: {
      userId: req.session.user.id,
      name: name.trim(),
      objective: objective?.trim() || null,
      angle: angle?.trim() || null,
      audience: audience?.trim() || null,
      cta: cta?.trim() || null,
      productId: productId || null,
    },
  });
  res.json({ campaign });
});

router.get("/:id", async (req, res) => {
  const campaign = await getOwned(req.params.id, req.session.user.id);
  if (!campaign) return res.status(404).send("Not found");
  res.json({ campaign });
});

router.patch("/:id", async (req, res) => {
  const existing = await getOwned(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  const { name, objective, angle, audience, cta, productId } = req.body || {};
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(objective !== undefined ? { objective: objective?.trim() || null } : {}),
      ...(angle !== undefined ? { angle: angle?.trim() || null } : {}),
      ...(audience !== undefined ? { audience: audience?.trim() || null } : {}),
      ...(cta !== undefined ? { cta: cta?.trim() || null } : {}),
      ...(productId !== undefined ? { productId: productId || null } : {}),
    },
  });
  res.json({ campaign });
});

router.delete("/:id", async (req, res) => {
  const existing = await getOwned(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
