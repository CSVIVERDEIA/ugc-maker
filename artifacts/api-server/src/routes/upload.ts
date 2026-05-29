// @ts-nocheck
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../lib/auth";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

const router = Router();
router.use(requireAuth);

// POST /api/upload — file → data URI (base64)
router.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Imagem muito grande (máx. 6 MB)" });
      }
      req.log?.error({ err }, "[UPLOAD_ERROR]");
      return res.status(500).send(err.message || "Internal Error");
    }
    const file = req.file;
    if (!file) return res.status(400).send("No file provided");
    const mime = file.mimetype || "image/jpeg";
    const dataUri = `data:${mime};base64,${file.buffer.toString("base64")}`;
    res.json({ url: dataUri });
  });
});

export default router;
