import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCatalogResult, CatalogBook } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { bookSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

const listQuerySchema = z.object({
  genres: z.array(z.string().trim().min(1)).max(50),
  operation: z.enum(["and", "or", "difference", "xor"]),
  availability: z.enum(["any", "available", "loaned"]),
  text: z.string().trim().max(120),
});

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const parsed = listQuerySchema.safeParse({
    genres: search.getAll("genre"),
    operation: search.get("operation") ?? "and",
    availability: search.get("availability") ?? "any",
    text: search.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid catalog query." }, { status: 400 });
  }
  const [records, genreRecords] = await Promise.all([
    prisma.book.findMany({
      include: { genres: { include: { genre: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.genre.findMany({ select: { name: true } }),
  ]);
  const books: CatalogBook[] = records.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    publicationYear: book.publicationYear,
    description: book.description,
    coverColor: book.coverColor,
    available: book.available,
    genres: book.genres.map(({ genre }) => genre.name),
  }));
  const selectedGenres = parsed.data.genres;
  const knownGenres = new Set(genreRecords.map(({ name }) => name));
  if (selectedGenres.some((genre) => !knownGenres.has(genre))) {
    return NextResponse.json({ error: "One or more selected genres do not exist." }, { status: 400 });
  }
  const result = buildCatalogResult(books, {
    genres: selectedGenres,
    operation: parsed.data.operation,
    availability: parsed.data.availability,
    text: parsed.data.text,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  const matchingIds = new Set(result.books.map((book) => book.id));
  return NextResponse.json(
    records.filter((book) => matchingIds.has(book.id)).map((book) => ({
      ...book,
      genres: book.genres.map(({ genre }) => genre.name),
    })),
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = bookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid book data." }, { status: 400 });
  }
  try {
    const data = parsed.data;
    const book = await prisma.$transaction(async (transaction) => {
      const genres = await transaction.genre.findMany({ where: { id: { in: data.genreIds } } });
      if (genres.length !== new Set(data.genreIds).size) throw new Error("One or more selected genres do not exist.");
      return transaction.book.create({
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
    return NextResponse.json(
      { ...book, genres: book.genres.map(({ genre }) => genre.name) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("genres")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That ISBN is already in the catalog." }, { status: 409 });
    }
    console.error("Could not create book:", error);
    return NextResponse.json({ error: "Could not create book." }, { status: 500 });
  }
}
