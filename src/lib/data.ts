import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function shouldUseLocalDatabase() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return false;

  const configuredCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (configuredCredentials && existsSync(configuredCredentials)) return false;

  const localCredentials = join(
    process.env.APPDATA ?? homedir(),
    "gcloud",
    "application_default_credentials.json",
  );
  return !existsSync(localCredentials);
}

async function backend() {
  return shouldUseLocalDatabase()
    ? import("@/lib/local-database")
    : import("@/lib/realtime-database");
}

export async function listGenres() {
  return (await backend()).listGenres();
}

export async function listGenresWithCounts() {
  return (await backend()).listGenresWithCounts();
}

export async function getGenresByIds(ids: string[]) {
  return (await backend()).getGenresByIds(ids);
}

export async function getBookRecords() {
  return (await backend()).getBookRecords();
}

export async function listBooks() {
  return (await backend()).listBooks();
}

export async function getBookDetails(id: string) {
  return (await backend()).getBookDetails(id);
}

export async function getRelatedBooks(
  book: {
    id: string;
    title: string;
    author: string;
    isbn: string | null;
    publicationYear: number | null;
    description: string | null;
    coverColor: string | null;
    available: boolean;
    genreIds: string[];
    createdAt: Date;
    updatedAt: Date;
  },
  limit?: number,
) {
  return (await backend()).getRelatedBooks(book, limit);
}

export async function createBook(input: {
  title: string;
  author: string;
  isbn?: string | null;
  publicationYear?: number | null;
  description?: string | null;
  coverColor?: string | null;
  genreIds: string[];
}) {
  return (await backend()).createBook(input);
}

export async function updateBook(
  id: string,
  input: {
    title: string;
    author: string;
    isbn?: string | null;
    publicationYear?: number | null;
    description?: string | null;
    coverColor?: string | null;
    genreIds: string[];
  },
) {
  return (await backend()).updateBook(id, input);
}

export async function deleteBook(id: string, confirmActiveLoan: boolean) {
  return (await backend()).deleteBook(id, confirmActiveLoan);
}

export async function createGenre(input: { name: string; description?: string | null }) {
  return (await backend()).createGenre(input);
}

export async function updateGenre(
  id: string,
  input: { name: string; description?: string | null },
) {
  return (await backend()).updateGenre(id, input);
}

export async function deleteGenre(id: string) {
  return (await backend()).deleteGenre(id);
}

export async function listMembers() {
  return (await backend()).listMembers();
}

export async function createMember(input: { name: string; email: string }) {
  return (await backend()).createMember(input);
}

export async function listLoans() {
  return (await backend()).listLoans();
}

export async function createMemberLoan(input: {
  bookId: string;
  memberId: string;
  dueAt: Date;
}) {
  return (await backend()).createMemberLoan(input);
}

export async function returnMemberLoan(id: string) {
  return (await backend()).returnMemberLoan(id);
}
