import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { reshapeScript } from "@/lib/scriptgen";
import { getUserSecrets } from "@/lib/secrets";

// POST — reescreve o roteiro pra caber no tempo alvo (default 15s)
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { script, currentSeconds, targetSeconds } = await req.json();
    if (!script?.trim()) {
      return NextResponse.json({ error: "Roteiro vazio" }, { status: 400 });
    }

    const keys = await getUserSecrets(session.user.id);
    const reshaped = await reshapeScript({
      script: script.trim(),
      currentSeconds: Number(currentSeconds) || 0,
      targetSeconds: Math.min(Number(targetSeconds) || 15, 15),
      keys,
    });

    return NextResponse.json({ script: reshaped });
  } catch (error) {
    console.error("[RESHAPE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
