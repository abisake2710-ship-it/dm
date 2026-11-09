import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { genreSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = genreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid genre data." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    return NextResponse.json(await prisma.genre.update({ where: { id }, data: parsed.data }));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That genre already exists." }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Genre not found." }, { status: 404 });
    }
    console.error("Could not update genre:", error);
    return NextResponse.json({ error: "Could not update genre." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  try {
    await prisma.genre.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Genre not found." }, { status: 404 });
    }
    console.error("Could not delete genre:", error);
    return NextResponse.json({ error: "Could not delete genre." }, { status: 500 });
  }
}
