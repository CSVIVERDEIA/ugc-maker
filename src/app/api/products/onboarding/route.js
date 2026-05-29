import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { structureProduct } from "@/lib/productai";
import { getUserSecrets } from "@/lib/secrets";

// POST — recebe texto livre e devolve infos do produto estruturadas pela IA
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { rawText } = await req.json();
    if (!rawText?.trim()) {
      return NextResponse.json({ error: "Escreva algo sobre o produto" }, { status: 400 });
    }

    const keys = await getUserSecrets(session.user.id);
    const result = await structureProduct(rawText.trim(), keys);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PRODUCT_ONBOARDING_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
