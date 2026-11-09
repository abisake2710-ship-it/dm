import { NextResponse } from "next/server";
import {
  deleteBook,
  getBookDetails,
  getGenresByIds,
  getRelatedBooks,
  updateBook,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/require-admin";
import { bookSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const book = await getBookDetails(id);
  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  const related = await getRelatedBooks(book);
  return NextResponse.json({
    ...book,
    genres: book.genres.map(({ genre }) => genre.name),
    activeLoan: book.loans.find((loan) => loan.returnedAt === null) ?? null,
    related: related.map((item) => ({
      ...item,
      genres: item.genres.map(({ genre }) => genre.name),
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = bookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid book data." }, { status: 400 });
  }
  const { id } = await context.params;
  const data = parsed.data;
  try {
    const book = await updateBook(id, data);
    const genres = await getGenresByIds(book.genreIds);
    return NextResponse.json({ ...book, genres: genres.map(({ name }) => name) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("genres")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That ISBN is already in the catalog." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Book not found.") {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
    console.error("Could not update book:", error);
    return NextResponse.json({ error: "Could not update book." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const confirmed = new URL(request.url).searchParams.get("confirmActiveLoan") === "true";
  try {
    await deleteBook(id, confirmed);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("active loan")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Book not found.") {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
    console.error("Could not delete book:", error);
    return NextResponse.json({ error: "Could not delete book." }, { status: 500 });
  }
}
