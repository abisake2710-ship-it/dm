import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { bookSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      loans: {
        where: { returnedAt: null },
        take: 1,
        include: { member: { select: { id: true, name: true } } },
      },
    },
  });
  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  const related = await prisma.book.findMany({
    where: {
      id: { not: id },
      genres: { some: { genreId: { in: book.genres.map(({ genreId }) => genreId) } } },
    },
    include: { genres: { include: { genre: true } } },
    take: 4,
    orderBy: { title: "asc" },
  });
  return NextResponse.json({
    ...book,
    genres: book.genres.map(({ genre }) => genre.name),
    activeLoan: book.loans[0] ?? null,
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
    const book = await prisma.$transaction(async (transaction) => {
      const genres = await transaction.genre.findMany({ where: { id: { in: data.genreIds } } });
      if (genres.length !== new Set(data.genreIds).size) throw new Error("One or more selected genres do not exist.");
      await transaction.bookGenre.deleteMany({ where: { bookId: id } });
      return transaction.book.update({
        where: { id },
        data: {
          title: data.title,
          author: data.author,
          isbn: data.isbn || null,
          publicationYear: data.publicationYear ?? null,
          description: data.description || null,
          coverColor: data.coverColor || null,
          genres: { create: genres.map((genre) => ({ genre: { connect: { id: genre.id } } })) },
        },
        include: { genres: { include: { genre: true } } },
      });
    });
    return NextResponse.json({ ...book, genres: book.genres.map(({ genre }) => genre.name) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("genres")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That ISBN is already in the catalog." }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
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
    await prisma.$transaction(async (transaction) => {
      const activeLoan = await transaction.loan.findFirst({ where: { bookId: id, returnedAt: null } });
      if (activeLoan && !confirmed) {
        throw new Error("This book has an active loan. Confirm deletion with ?confirmActiveLoan=true.");
      }
      await transaction.loan.deleteMany({ where: { bookId: id } });
      await transaction.book.delete({ where: { id } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("active loan")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
    console.error("Could not delete book:", error);
    return NextResponse.json({ error: "Could not delete book." }, { status: 500 });
  }
}
