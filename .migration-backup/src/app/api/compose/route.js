import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPredictionSync, IMAGE_MODEL } from "@/lib/replicate";
import { getUserSecrets } from "@/lib/secrets";

function pickOutput(out) {
  return Array.isArray(out) ? out[0] : out;
}

// Baixa a imagem do Replicate (URL temporária) e converte em data URI permanente.
async function toDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao baixar a imagem gerada");
  const mime = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Compõe uma imagem (avatar + produto) com o Nano Banana.
 * Junta a foto do avatar + fotos do produto como referências e devolve uma
 * imagem do avatar usando/segurando o produto — base pra animar em vídeo.
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { avatarId, productId, prompt, aspectRatio } = await req.json();

    const [avatar, product] = await Promise.all([
      avatarId ? prisma.avatar.findUnique({ where: { id: avatarId } }) : null,
      productId ? prisma.product.findUnique({ where: { id: productId } }) : null,
    ]);

    // valida posse
    if (avatar && avatar.userId !== session.user.id) return new NextResponse("Not found", { status: 404 });
    if (product && product.userId !== session.user.id) return new NextResponse("Not found", { status: 404 });

    const imageInput = [
      ...(avatar?.photos || []).slice(0, 1),
      ...(product?.photos || []),
    ].filter(Boolean).slice(0, 6);

    if (imageInput.length === 0) {
      return NextResponse.json(
        { error: "Selecione um avatar e/ou produto com fotos" },
        { status: 400 }
      );
    }

    // Prompt padrão de UGC, mais a direção opcional do usuário.
    const scene = prompt?.trim();
    const fullPrompt = [
      avatar && product
        ? "A pessoa da primeira imagem segurando e usando naturalmente o produto das outras imagens."
        : product
        ? "Uma pessoa real usando/segurando o produto das imagens de forma natural."
        : "A pessoa da imagem em uma cena natural.",
      "Foto realista estilo UGC (user-generated content), boa iluminação, ambiente autêntico, mantenha o rosto e o produto fiéis às referências.",
      scene ? `Cena: ${scene}` : "",
    ].filter(Boolean).join(" ");

    const keys = await getUserSecrets(session.user.id);
    const prediction = await runPredictionSync({
      slug: IMAGE_MODEL,
      keys,
      input: {
        prompt: fullPrompt,
        image_input: imageInput,
        aspect_ratio: aspectRatio || "9:16",
        safety_filter_level: "block_only_high",
      },
    });

    if (prediction.status === "failed" || prediction.error) {
      throw new Error(prediction.error || "Falha ao gerar a imagem");
    }

    const outUrl = pickOutput(prediction.output);
    if (!outUrl) throw new Error("A composição não retornou imagem");

    // converte pra data URI permanente (a URL do Replicate expira) e salva como Criação
    const image = await toDataUri(outUrl);
    const creation = await prisma.creation.create({
      data: {
        userId: session.user.id,
        type: "image",
        title: product?.name || avatar?.name || "Imagem",
        prompt: scene || fullPrompt,
        url: image,
        modelId: IMAGE_MODEL,
        status: "completed",
        inputImages: imageInput,
      },
    });

    return NextResponse.json({ image, id: creation.id });
  } catch (error) {
    console.error("[COMPOSE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
