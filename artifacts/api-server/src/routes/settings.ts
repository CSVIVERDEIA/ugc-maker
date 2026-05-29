// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getUserSecretStatus, setUserSecret, SECRET_NAMES } from "../lib/secrets";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const status = await getUserSecretStatus(req.session.user.id);
  res.json({ status });
});

router.post("/", async (req, res) => {
  const { secrets } = req.body || {};
  if (!secrets || typeof secrets !== "object") {
    return res.status(400).json({ error: "Payload inválido" });
  }
  for (const name of SECRET_NAMES) {
    if (name in secrets) {
      await setUserSecret(req.session.user.id, name, secrets[name]);
    }
  }
  const status = await getUserSecretStatus(req.session.user.id);
  res.json({ status });
});

export default router;
