import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPrediction, TALKING_MODELS, baseUrlFromRequest } from "@/lib/replicate";
import { synthesizeSpeech } from "@/lib/tts";
import { getUserSecrets } from "@/lib/secrets";

/**
 * Modelos image-to-video (pipeline "video"). buildInput traduz nossos params
 * genéricos pro input exato de cada modelo. ⚠️ se um modelo recusar um campo,
 * ajuste o nome AQUI (ver aba "API" do modelo no Replicate).
 */
const VIDEO_MODELS = {
  "seedance-2": {
    slug: "bytedance/seedance-2.0-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.duration ? { duration: Number(settings.duration) } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
  "kling-v3": {
    slug: "kwaivgi/kling-v3-video",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { start_image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.duration ? { duration: Number(settings.duration) } : {}),
    }),
  },
  "veo-3-1-fast": {
    slug: "google/veo-3.1-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
  "wan-2-2": {
    slug: "wan-video/wan-2.2-i2v-fast",
    buildInput: ({ prompt, images, settings }) => ({
      prompt,
      ...(images?.[0] ? { image: images[0] } : {}),
      ...(settings.resolution ? { resolution: settings.resolution } : {}),
    }),
  },
};

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const {
      pipeline = "video",
      modelId,
      prompt,
      settings = {},
      images = [],
      voiceId,
      voiceSettings,
      audio: providedAudio, // áudio pré-gerado (data URI) vindo do preview de voz
      audioDuration, // duração da voz (s), pra casar o tamanho do vídeo
      motionPrompt, // prompt dedicado de movimento (Caminho B → Kling)
    } = await req.json();

    const keys = await getUserSecrets(session.user.id);
    const webhookUrl = baseUrlFromRequest(req); // URL pública automática

    const baseData = {
      userId: session.user.id,
      type: "video",
      title: (prompt || "Untitled").substring(0, 50) + "...",
      prompt,
      pipeline,
      aspectRatio: settings.aspect_ratio,
      resolution: settings.resolution,
      duration: settings.duration ? Number(settings.duration) : undefined,
      inputImages: images,
    };

    let prediction;
    let extraData = {};

    if (pipeline === "talking-b") {
      // ── Avatar falante: Kling gera a cena (com movimento); o lip-sync vem no webhook ──
      if (!images?.[0]) {
        return NextResponse.json({ error: "Selecione um avatar com foto" }, { status: 400 });
      }
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "Escreva o roteiro (o que o avatar fala)" }, { status: 400 });
      }
      const audio = providedAudio || (await synthesizeSpeech({ text: prompt, voiceId, settings: voiceSettings, apiKey: keys.ELEVENLABS_API_KEY }));
      // O prompt do Kling controla o MOVIMENTO da cena. Foco em naturalidade humana
      // (micro-expressões sutis, respiração, sem rigidez/robótico).
      const naturalBase =
        "Vídeo realista e natural de uma pessoa real gravando um depoimento casual de celular (UGC). " +
        "Movimentos humanos sutis e espontâneos: pequenas inclinações de cabeça, piscadas, microexpressões faciais, respiração natural, " +
        "gestos leves e fluidos das mãos enquanto fala olhando para a câmera. Iluminação natural, aparência autêntica, nada robótico ou rígido.";
      const motion = motionPrompt?.trim()
        ? `${motionPrompt.trim()}. ${naturalBase}`
        : naturalBase;
      // Casa a duração do vídeo com a da voz pra o lip-sync não repetir o vídeo.
      // Kling v3 vai até 15s. Se a voz passar de 15s, usa 15 (máx do modelo).
      const ad = Number(audioDuration) || 0;
      const klingDuration = ad > 10 ? 15 : ad > 5 ? 10 : 5;
      prediction = await createPrediction({
        slug: TALKING_MODELS.klingScene,
        keys,
        webhookUrl,
        input: {
          prompt: motion,
          start_image: images[0],
          duration: klingDuration,
          ...(settings.aspect_ratio ? { aspect_ratio: settings.aspect_ratio } : {}),
        },
      });
      // guarda o áudio pra usar no lip-sync quando a cena terminar
      extraData = { modelId: "kling-v3+lipsync", stage: "scene", audio };
    } else {
      // ── Pipeline "video": image-to-video normal ──
      const model = VIDEO_MODELS[modelId];
      if (!model) return new NextResponse("Invalid model selected", { status: 400 });
      prediction = await createPrediction({
        slug: model.slug,
        keys,
        webhookUrl,
        input: model.buildInput({ prompt, images, settings }),
      });
      extraData = { modelId };
    }

    const creation = await prisma.creation.create({
      data: { ...baseData, ...extraData, requestId: prediction.id, status: "processing" },
    });

    return NextResponse.json({ success: true, creationId: creation.id });
  } catch (error) {
    console.error("[GENERATE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
