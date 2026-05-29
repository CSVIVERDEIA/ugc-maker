import crypto from "crypto";

/**
 * Cripto simétrica (AES-256-GCM) pro "vault" de chaves.
 * A chave-mestra vem de ENCRYPTION_KEY (ou, na falta, NEXTAUTH_SECRET) — é a ÚNICA
 * coisa que precisa ficar no .env. As API keys ficam criptografadas no banco.
 */
function masterKey() {
  const base =
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dev-insecure-fallback-key";
  return crypto.createHash("sha256").update(base).digest(); // 32 bytes
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + dados, em base64
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
