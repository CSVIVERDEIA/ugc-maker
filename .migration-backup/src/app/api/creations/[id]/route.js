import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const creation = await prisma.creation.findUnique({
      where: { 
        id,
        userId: session.user.id // Security check
      }
    });

    if (!creation) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(creation);

  } catch (error) {
    console.error("[CREATION_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
