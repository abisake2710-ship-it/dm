import { NextResponse } from "next/server";
import { deleteGenre, updateGenre } from "@/lib/firestore";
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
    return NextResponse.json(await updateGenre(id, parsed.data));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That genre already exists." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Genre not found.") {
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
    await deleteGenre(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "Genre not found.") {
      return NextResponse.json({ error: "Genre not found." }, { status: 404 });
    }
    console.error("Could not delete genre:", error);
    return NextResponse.json({ error: "Could not delete genre." }, { status: 500 });
  }
}
