// @ts-nocheck
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

const COOKIE_NAME = "ugc_session";
const SECRET =
  process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || "dev-insecure-fallback-key";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function signSessionToken(userId) {
  return jwt.sign({ id: userId }, SECRET, { expiresIn: MAX_AGE });
}

export function setSessionCookie(res, userId) {
  const token = signSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Returns { id } from the cookie, or null. */
export function getTokenUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    return payload?.id ? { id: payload.id } : null;
  } catch {
    return null;
  }
}

/**
 * Builds the session object (mirrors the old NextAuth session shape), reading
 * fresh credits/name from the DB. Returns null when unauthenticated.
 */
export async function getServerSession(req) {
  const tok = getTokenUser(req);
  if (!tok) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: tok.id },
    select: { id: true, email: true, name: true, credits: true, image: true },
  });
  if (!dbUser) return null;
  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
      credits: dbUser.credits,
    },
  };
}

/** Express middleware: attaches req.session or returns 401. */
export async function requireAuth(req, res, next) {
  const session = await getServerSession(req);
  if (!session?.user) {
    res.status(401).send("Unauthorized");
    return;
  }
  req.session = session;
  next();
}
