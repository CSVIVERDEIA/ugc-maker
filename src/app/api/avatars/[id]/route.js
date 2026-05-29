import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwned(id, userId) {
  const avatar = await prisma.avatar.findUnique({ where: { id } });
  if (!avatar || avatar.userId !== userId) return null;
  return avatar;
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const avatar = await getOwned(id, session.user.id);
  if (!avatar) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ avatar });
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const { name, description, settings, photos } = await req.json();
  const avatar = await prisma.avatar.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(settings !== undefined ? { settings } : {}),
      ...(photos !== undefined ? { photos: Array.isArray(photos) ? photos : [] } : {}),
    },
  });
  return NextResponse.json({ avatar });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });
  await prisma.avatar.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
