import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateScripts } from "@/lib/scriptgen";
import { getUserSecrets } from "@/lib/secrets";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { context, tone, count } = await req.json();

    if (!context?.trim()) {
      return NextResponse.json(
        { error: "Informe o contexto do produto ou a oferta" },
        { status: 400 }
      );
    }

    const keys = await getUserSecrets(session.user.id);
    const { scripts, provider } = await generateScripts({
      context: context.trim(),
      tone: tone?.trim() || undefined,
      count: Math.min(Math.max(Number(count) || 3, 1), 5),
      keys,
    });

    return NextResponse.json({ scripts, provider });
  } catch (error) {
    console.error("[SCRIPTS_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
