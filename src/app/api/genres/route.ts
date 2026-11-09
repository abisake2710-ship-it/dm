import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { genreSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

export async function GET() {
  const genres = await prisma.genre.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(genres);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = genreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid genre data." }, { status: 400 });
  }
  try {
    const genre = await prisma.genre.create({ data: parsed.data });
    return NextResponse.json(genre, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That genre already exists." }, { status: 409 });
    }
    console.error("Could not create genre:", error);
    return NextResponse.json({ error: "Could not create genre." }, { status: 500 });
  }
}
