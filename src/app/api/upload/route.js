import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Limite de tamanho (data URI infla ~33%; mantém payloads e linhas do banco sãos).
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

/**
 * Upload de imagem → data URI (base64).
 *
 * Por que data URI em vez do Files API do Replicate:
 * - Os arquivos do Replicate EXPIRAM em 24h e o urls.get devolve JSON, não a imagem.
 * - Data URI funciona como preview no navegador E como input de imagem pro modelo
 *   do Replicate, sem depender de armazenamento externo nem de proxy autenticado.
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return new NextResponse("No file provided", { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Imagem muito grande (máx. 6 MB)" },
        { status: 413 }
      );
    }

    const mime = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

    return NextResponse.json({ url: dataUri });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
