import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedProduct(id, userId) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.userId !== userId) return null;
  return product;
}

// GET — um produto
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const product = await getOwnedProduct(id, session.user.id);
  if (!product) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ product });
}

// PATCH — edita um produto
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const existing = await getOwnedProduct(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const { name, description, info, photos } = await req.json();
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(info !== undefined ? { info } : {}),
      ...(photos !== undefined ? { photos: Array.isArray(photos) ? photos : [] } : {}),
    },
  });
  return NextResponse.json({ product });
}

// DELETE — remove um produto
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const existing = await getOwnedProduct(id, session.user.id);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
