import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { synthesizeSpeech } from "@/lib/tts";
import { prisma } from "@/lib/prisma";
import { getUserSecrets } from "@/lib/secrets";

// POST — gera a voz a partir do texto + voz + settings, SALVA como Criação (type=audio)
// e devolve o áudio (data URI) + o id pra preview/seleção.
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { text, voiceId, voiceName, settings } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Escreva o roteiro primeiro" }, { status: 400 });
    }

    const keys = await getUserSecrets(session.user.id);
    const audio = await synthesizeSpeech({ text: text.trim(), voiceId, settings, apiKey: keys.ELEVENLABS_API_KEY });

    const creation = await prisma.creation.create({
      data: {
        userId: session.user.id,
        type: "audio",
        title: voiceName || "Voz",
        prompt: text.trim(),
        url: audio,
        modelId: voiceName || voiceId || "elevenlabs",
        status: "completed",
      },
    });

    return NextResponse.json({ id: creation.id, audio });
  } catch (error) {
    console.error("[TTS_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
