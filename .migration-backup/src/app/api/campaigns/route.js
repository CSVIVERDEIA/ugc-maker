import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { name, objective, angle, audience, cta, productId } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "O nome da campanha é obrigatório" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      objective: objective?.trim() || null,
      angle: angle?.trim() || null,
      audience: audience?.trim() || null,
      cta: cta?.trim() || null,
      productId: productId || null,
    },
  });
  return NextResponse.json({ campaign });
}
