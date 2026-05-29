// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

// GET /api/file?url=... — proxy for Replicate files (adds Bearer token)
router.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== "string" || !url.startsWith("https://api.replicate.com/v1/files/")) {
    return res.status(400).send("Invalid url");
  }
  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  });
  if (!upstream.ok) return res.status(upstream.status).send("Upstream error");

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.set({
    "content-type": contentType,
    "cache-control": "private, max-age=3600",
  });
  res.send(buf);
});

export default router;
