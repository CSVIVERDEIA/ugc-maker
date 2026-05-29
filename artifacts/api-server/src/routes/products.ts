// @ts-nocheck
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { structureProduct } from "../lib/productai";
import { getUserSecrets } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

async function getOwnedProduct(id, userId) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.userId !== userId) return null;
  return product;
}

router.get("/", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { userId: req.session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ products });
});

router.post("/", async (req, res) => {
  const { name, description, info, photos } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "O nome do produto é obrigatório" });
  }
  const product = await prisma.product.create({
    data: {
      userId: req.session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      info: info ?? undefined,
      photos: Array.isArray(photos) ? photos : [],
    },
  });
  res.json({ product });
});

// POST /api/products/onboarding — must be before /:id
router.post("/onboarding", async (req, res) => {
  try {
    const { rawText } = req.body || {};
    if (!rawText?.trim()) {
      return res.status(400).json({ error: "Escreva algo sobre o produto" });
    }
    const keys = await getUserSecrets(req.session.user.id);
    const result = await structureProduct(rawText.trim(), keys);
    res.json(result);
  } catch (error) {
    req.log?.error({ err: error }, "[PRODUCT_ONBOARDING_ERROR]");
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  const product = await getOwnedProduct(req.params.id, req.session.user.id);
  if (!product) return res.status(404).send("Not found");
  res.json({ product });
});

router.patch("/:id", async (req, res) => {
  const existing = await getOwnedProduct(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  const { name, description, info, photos } = req.body || {};
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(info !== undefined ? { info } : {}),
      ...(photos !== undefined ? { photos: Array.isArray(photos) ? photos : [] } : {}),
    },
  });
  res.json({ product });
});

router.delete("/:id", async (req, res) => {
  const existing = await getOwnedProduct(req.params.id, req.session.user.id);
  if (!existing) return res.status(404).send("Not found");
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
