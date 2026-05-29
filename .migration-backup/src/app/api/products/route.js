import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — lista os produtos do usuário
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ products });
}

// POST — cria um produto
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { name, description, info, photos } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "O nome do produto é obrigatório" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      info: info ?? undefined,
      photos: Array.isArray(photos) ? photos : [],
    },
  });
  return NextResponse.json({ product });
}
