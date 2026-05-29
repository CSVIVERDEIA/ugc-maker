// @ts-nocheck
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const type = req.query.type;
    const creations = await prisma.creation.findMany({
      where: {
        userId: req.session.user.id,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(creations);
  } catch (error) {
    req.log?.error({ err: error }, "[CREATIONS_GET_ERROR]");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const creation = await prisma.creation.findUnique({
      where: { id: req.params.id, userId: req.session.user.id },
    });
    if (!creation) return res.status(404).send("Not Found");
    res.json(creation);
  } catch (error) {
    req.log?.error({ err: error }, "[CREATION_GET_ERROR]");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
