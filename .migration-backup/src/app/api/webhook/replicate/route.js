import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPrediction, TALKING_MODELS, baseUrlFromRequest } from "@/lib/replicate";
import { getUserSecrets } from "@/lib/secrets";

/**
 * Webhook do Replicate (evento "completed").
 * Caminho B é multi-etapa: quando a CENA (Kling) termina, este webhook dispara
 * o lip-sync (sync/lipsync-2) com a cena + o áudio guardado, e só finaliza no
 * segundo webhook (quando o lip-sync termina).
 */
function pickOutput(out) {
  return Array.isArray(out) ? out[out.length - 1] : out;
}

export async function POST(req) {
  try {
    const data = await req.json();
    const requestId = data.id;
    console.log("[REPLICATE_WEBHOOK_RECEIVED]", requestId, data?.status);

    if (!requestId) {
      return NextResponse.json({ error: "Missing prediction id" }, { status: 400 });
    }

    const creation = await prisma.creation.findUnique({ where: { requestId } });
    if (!creation) {
      console.warn(`[REPLICATE_WEBHOOK] requestId ${requestId} não encontrado.`);
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    if (data.status === "failed" || data.status === "canceled") {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "failed", error: data.error || `Generation ${data.status}` },
      });
      return NextResponse.json({ success: true });
    }

    if (data.status !== "succeeded") {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "processing" },
      });
      return NextResponse.json({ success: true });
    }

    // ── succeeded ──
    const outputUrl = pickOutput(data.output);

    // Caminho B: a CENA terminou → dispara o lip-sync e continua processando.
    if (creation.pipeline === "talking-b" && creation.stage === "scene") {
      try {
        const keys = await getUserSecrets(creation.userId);
        const lip = await createPrediction({
          slug: TALKING_MODELS.lipsync,
          keys,
          webhookUrl: baseUrlFromRequest(req),
          input: {
            video: outputUrl,
            audio: creation.audio,
            temperature: 0.7, // mais expressivo = boca/expressão menos robótica
            // corta a sobra de vídeo em vez de repetir (vídeo já é >= áudio)
            sync_mode: "cut_off",
          },
        });
        await prisma.creation.update({
          where: { id: creation.id },
          data: {
            requestId: lip.id, // o próximo webhook chega com este id
            stage: "lipsync",
            sceneUrl: outputUrl,
            status: "processing",
          },
        });
        console.log(`[REPLICATE_WEBHOOK] cena pronta, lip-sync iniciado (${creation.id}).`);
      } catch (err) {
        console.error("[REPLICATE_WEBHOOK] falha ao iniciar lip-sync:", err);
        await prisma.creation.update({
          where: { id: creation.id },
          data: { status: "failed", error: "Falha ao iniciar lip-sync: " + err.message },
        });
      }
      return NextResponse.json({ success: true });
    }

    // Demais casos (video, talking-a, ou lip-sync do B finalizado): finaliza.
    await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "completed", url: outputUrl || null },
    });
    console.log(`[REPLICATE_WEBHOOK] creation ${creation.id} concluída.`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[REPLICATE_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
