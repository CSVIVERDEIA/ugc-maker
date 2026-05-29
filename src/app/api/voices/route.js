import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listVoices } from "@/lib/tts";
import { getUserSecrets } from "@/lib/secrets";

// GET — lista as vozes disponíveis na conta ElevenLabs do usuário
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const keys = await getUserSecrets(session.user.id);
  if (!keys.ELEVENLABS_API_KEY) {
    return NextResponse.json({ configured: false, voices: [] });
  }
  const voices = await listVoices(keys.ELEVENLABS_API_KEY);
  return NextResponse.json({ configured: true, voices });
}
