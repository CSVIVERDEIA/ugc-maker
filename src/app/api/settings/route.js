import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserSecretStatus, setUserSecret, SECRET_NAMES } from "@/lib/secrets";

// GET — status mascarado das chaves (sem expor os valores)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const status = await getUserSecretStatus(session.user.id);
  return NextResponse.json({ status });
}

// POST — salva chaves enviadas { secrets: { NAME: value } }. Valor vazio remove.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { secrets } = await req.json();
  if (!secrets || typeof secrets !== "object") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  for (const name of SECRET_NAMES) {
    if (name in secrets) {
      await setUserSecret(session.user.id, name, secrets[name]);
    }
  }

  const status = await getUserSecretStatus(session.user.id);
  return NextResponse.json({ status });
}
