import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — lista os avatares do usuário
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const avatars = await prisma.avatar.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ avatars });
}

// POST — cria um avatar
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { name, description, settings, photos } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "O nome do avatar é obrigatório" }, { status: 400 });
  }

  const avatar = await prisma.avatar.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      settings: settings ?? undefined,
      photos: Array.isArray(photos) ? photos : [],
    },
  });
  return NextResponse.json({ avatar });
}
