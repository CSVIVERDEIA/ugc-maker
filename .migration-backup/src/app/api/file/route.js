import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Proxy de imagem.
 * Os arquivos do Replicate (api.replicate.com/v1/files/...) exigem Bearer token,
 * então o <img> do navegador não consegue abri-los direto. Este endpoint busca
 * com o token e devolve os bytes pro navegador.
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  // Trava de segurança: só repassa arquivos do próprio Replicate (evita SSRF).
  if (!url || !url.startsWith("https://api.replicate.com/v1/files/")) {
    return new NextResponse("Invalid url", { status: 400 });
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Upstream error", { status: res.status });

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "content-type": contentType,
      "cache-control": "private, max-age=3600",
    },
  });
}
