import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwned(id, userId) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.userId !== userId) return null;
  return campaign;
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const campaign = await getOwned(id, session.user.id);
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const { name, objective, angle, audience, cta, productId } = await req.json();
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(objective !== undefined ? { objective: objective?.trim() || null } : {}),
      ...(angle !== undefined ? { angle: angle?.trim() || null } : {}),
      ...(audience !== undefined ? { audience: audience?.trim() || null } : {}),
      ...(cta !== undefined ? { cta: cta?.trim() || null } : {}),
      ...(productId !== undefined ? { productId: productId || null } : {}),
    },
  });
  return NextResponse.json({ campaign });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
