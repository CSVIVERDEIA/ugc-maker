// @ts-nocheck
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

async function getOwned(id, userId) {
  const avatar = await prisma.avatar.findUnique({ where: { id } });
  if (!avatar || avatar.userId !== userId) return null;
  return avatar;
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
