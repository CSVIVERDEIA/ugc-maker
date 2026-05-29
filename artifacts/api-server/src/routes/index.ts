import { Router } from "express";
import health from "./health";
import auth from "./auth";
import avatars from "./avatars";
import campaigns from "./campaigns";
import products from "./products";
import creations from "./creations";
import settings from "./settings";
import scripts from "./scripts";
import tts, { voicesRouter } from "./tts";
import upload from "./upload";
import file from "./file";
import compose from "./compose";
import generate from "./generate";
import checkout from "./checkout";
import webhooks from "./webhooks";

const router: Router = Router();

router.use("/healthz", health);
router.use("/auth", auth);
router.use("/avatars", avatars);
router.use("/campaigns", campaigns);
router.use("/products", products);
router.use("/creations", creations);
router.use("/settings", settings);
router.use("/scripts", scripts);
router.use("/tts", tts);
router.use("/voices", voicesRouter);
router.use("/upload", upload);
router.use("/file", file);
router.use("/compose", compose);
router.use("/generate", generate);
router.use("/checkout", checkout);
router.use("/webhook", webhooks);

export default router;
