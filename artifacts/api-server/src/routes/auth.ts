// @ts-nocheck
import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import {
  getServerSession,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/auth";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "A senha precisa ter ao menos 6 caracteres" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(409).json({ error: "Esse email já está cadastrado" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: name?.trim() || normalizedEmail.split("@")[0],
      },
    });

    res.json({ success: true });
  } catch (error) {
    req.log?.error({ err: error }, "[REGISTER_ERROR]");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/auth/login — replaces NextAuth credentials signIn
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }
    setSessionCookie(res, user.id);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    req.log?.error({ err: error }, "[LOGIN_ERROR]");
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/auth/session — mirrors next-auth session endpoint
router.get("/session", async (req, res) => {
  const session = await getServerSession(req);
  res.json(session || {});
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

export default router;
