import { prisma } from "./prisma";
import { encryptSecret, decryptSecret } from "./crypto";

// Chaves que o vault guarda. (WEBHOOK_URL saiu: é detectado automaticamente.)
export const SECRET_NAMES = [
  "REPLICATE_API_TOKEN",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
];

/**
 * Resolve as chaves do usuário: usa o que está no vault (banco) e, na falta,
 * cai pro .env (facilita a migração — depois pode remover do .env).
 * @returns {Promise<Record<string,string|null>>}
 */
export async function getUserSecrets(userId) {
  const rows = userId ? await prisma.secret.findMany({ where: { userId } }) : [];
  const out = {};
  for (const name of SECRET_NAMES) {
    const row = rows.find((r) => r.name === name);
    let val = null;
    if (row) {
      try {
        val = decryptSecret(row.value);
      } catch {
        val = null;
      }
    }
    out[name] = val || process.env[name] || null;
  }
  return out;
}

/** Salva/atualiza (ou remove, se vazio) uma chave do usuário. */
export async function setUserSecret(userId, name, value) {
  if (!SECRET_NAMES.includes(name)) throw new Error(`Chave inválida: ${name}`);
  if (!value || !String(value).trim()) {
    await prisma.secret.deleteMany({ where: { userId, name } });
    return;
  }
  const enc = encryptSecret(String(value).trim());
  await prisma.secret.upsert({
    where: { userId_name: { userId, name } },
    update: { value: enc },
    create: { userId, name, value: enc },
  });
}

/** Status mascarado pra UI: quais chaves estão configuradas (sem expor o valor). */
export async function getUserSecretStatus(userId) {
  const secrets = await getUserSecrets(userId);
  const status = {};
  for (const name of SECRET_NAMES) {
    const v = secrets[name];
    status[name] = {
      configured: !!v,
      // origem ajuda a saber se ainda vem do .env
      source: v
        ? (await prisma.secret.findUnique({ where: { userId_name: { userId, name } } }))
          ? "vault"
          : "env"
        : null,
      preview: v ? `${v.slice(0, 4)}…${v.slice(-2)}` : null,
    };
  }
  return status;
}
