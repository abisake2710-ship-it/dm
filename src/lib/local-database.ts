import { prisma } from "@/lib/prisma";

export class DuplicateValueError extends Error {}

type BookInput = {
  title: string;
  author: string;
  isbn?: string | null;
  publicationYear?: number | null;
  description?: string | null;
  coverColor?: string | null;
  genreIds: string[];
};

function bookRecord<T extends {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publicationYear: number | null;
  description: string | null;
  coverColor: string | null;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}>(
  book: T,
  genreIds: string[],
) {
  return { ...book, genreIds };
}

export async function listGenres() {
  return prisma.genre.findMany({ orderBy: { name: "asc" } });
}

export async function listGenresWithCounts() {
  return prisma.genre.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getGenresByIds(ids: string[]) {
  return prisma.genre.findMany({ where: { id: { in: [...new Set(ids)] } } });
}

export async function getBookRecords() {
  const books = await prisma.book.findMany({
    include: { genres: true },
    orderBy: { title: "asc" },
  });
  return books.map(({ genres, ...book }) =>
    bookRecord(book, genres.map(({ genreId }) => genreId)),
  );
}

export async function listBooks() {
  const books = await prisma.book.findMany({
    include: { genres: { include: { genre: true } } },
    orderBy: { title: "asc" },
  });
  return books.map(({ genres, ...book }) => ({
    ...book,
    genres: genres.map(({ genre }) => genre.name),
  }));
}

export async function getBookDetails(id: string) {
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      loans: { include: { member: true }, orderBy: { loanedAt: "desc" } },
    },
  });
  if (!book) return null;
  return {
    ...book,
    genreIds: book.genres.map(({ genreId }) => genreId),
  };
}

export async function getRelatedBooks(
  book: { id: string; genreIds: string[] },
  limit = 4,
) {
  const books = await prisma.book.findMany({
    where: {
      id: { not: book.id },
      genres: { some: { genreId: { in: book.genreIds } } },
    },
    include: { genres: { include: { genre: true } } },
    take: limit,
    orderBy: { title: "asc" },
  });
  return books;
}

export async function createBook(input: BookInput) {
  const genreIds = [...new Set(input.genreIds)];
  const genres = await getGenresByIds(genreIds);
  if (genres.length !== genreIds.length) {
    throw new Error("One or more selected genres do not exist.");
  }
  const book = await prisma.book.create({
    data: {
      title: input.title,
      author: input.author,
      isbn: input.isbn || null,
      publicationYear: input.publicationYear ?? null,
      description: input.description || null,
      coverColor: input.coverColor || null,
      genres: {
        create: genres.map((genre) => ({
          genre: { connect: { id: genre.id } },
        })),
      },
    },
    include: { genres: true },
  });
  const { genres: bookGenres, ...record } = book;
  return bookRecord(record, bookGenres.map(({ genreId }) => genreId));
}

export async function updateBook(id: string, input: BookInput) {
  const genreIds = [...new Set(input.genreIds)];
  const [bookExists, genres] = await Promise.all([
    prisma.book.findUnique({ where: { id }, select: { id: true } }),
    getGenresByIds(genreIds),
  ]);
  if (!bookExists) throw new Error("Book not found.");
  if (genres.length !== genreIds.length) {
    throw new Error("One or more selected genres do not exist.");
  }
  const book = await prisma.book.update({
    where: { id },
    data: {
      title: input.title,
      author: input.author,
      isbn: input.isbn || null,
      publicationYear: input.publicationYear ?? null,
      description: input.description || null,
      coverColor: input.coverColor || null,
      genres: {
        deleteMany: {},
        create: genres.map((genre) => ({
          genre: { connect: { id: genre.id } },
        })),
      },
    },
  });
  return bookRecord(book, genreIds);
}

export async function deleteBook(id: string, confirmActiveLoan: boolean) {
  await prisma.$transaction(async (transaction) => {
    const book = await transaction.book.findUnique({ where: { id }, select: { id: true } });
    if (!book) throw new Error("Book not found.");
    const activeLoan = await transaction.loan.findFirst({
      where: { bookId: id, returnedAt: null },
    });
    if (activeLoan && !confirmActiveLoan) {
      throw new Error("This book has an active loan. Confirm deletion with ?confirmActiveLoan=true.");
    }
    await transaction.loan.deleteMany({ where: { bookId: id } });
    await transaction.book.delete({ where: { id } });
  });
}

export async function createGenre(input: { name: string; description?: string | null }) {
  return prisma.genre.create({ data: input });
}

export async function updateGenre(
  id: string,
  input: { name: string; description?: string | null },
) {
  const genre = await prisma.genre.findUnique({ where: { id }, select: { id: true } });
  if (!genre) throw new Error("Genre not found.");
  return prisma.genre.update({ where: { id }, data: input });
}

export async function deleteGenre(id: string) {
  await prisma.$transaction(async (transaction) => {
    const genre = await transaction.genre.findUnique({ where: { id }, select: { id: true } });
    if (!genre) throw new Error("Genre not found.");
    await transaction.bookGenre.deleteMany({ where: { genreId: id } });
    await transaction.genre.delete({ where: { id } });
  });
}

export async function listMembers() {
  return prisma.member.findMany({ orderBy: { name: "asc" } });
}

export async function createMember(input: { name: string; email: string }) {
  return prisma.member.create({ data: input });
}

export async function listLoans() {
  return prisma.loan.findMany({
    include: { book: true, member: true },
    orderBy: { loanedAt: "desc" },
  });
}

export async function createMemberLoan(input: {
  bookId: string;
  memberId: string;
  dueAt: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const book = await transaction.book.findUnique({ where: { id: input.bookId } });
    if (!book) throw new Error("Book not found.");
    if (!book.available) throw new Error("This book is already on loan.");
    const member = await transaction.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new Error("Member not found.");
    const activeLoan = await transaction.loan.findFirst({
      where: { bookId: input.bookId, returnedAt: null },
    });
    if (activeLoan) throw new Error("This book is already on loan.");

    const loan = await transaction.loan.create({
      data: input,
      include: { book: true, member: true },
    });
    await transaction.book.update({
      where: { id: input.bookId },
      data: { available: false },
    });
    return loan;
  });
}

export async function returnMemberLoan(id: string) {
  return prisma.$transaction(async (transaction) => {
    const loan = await transaction.loan.findUnique({ where: { id } });
    if (!loan) throw new Error("Loan not found.");
    if (loan.returnedAt) throw new Error("This loan has already been returned.");
    const returnedAt = new Date();
    const updated = await transaction.loan.updateMany({
      where: { id, returnedAt: null },
      data: { returnedAt },
    });
    if (updated.count !== 1) throw new Error("This loan has already been returned.");
    await transaction.book.update({
      where: { id: loan.bookId },
      data: { available: true },
    });
    return { ...loan, returnedAt };
  });
}
