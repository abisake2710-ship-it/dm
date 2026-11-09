import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const appName = "setlib-admin";
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!projectId) {
  throw new Error("Missing required Firebase project ID.");
}
if (!databaseURL) {
  throw new Error("Missing required FIREBASE_DATABASE_URL.");
}

const app =
  getApps().find((candidate) => candidate.name === appName) ??
  initializeApp({ projectId, databaseURL }, appName);

export const db = getDatabase(app);

function ensureAdminCredentials() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localCredentialsPath = join(
    process.env.APPDATA ?? homedir(),
    "gcloud",
    "application_default_credentials.json",
  );
  const hasCredentials =
    Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST) ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.GAE_ENV) ||
    (credentialsPath ? existsSync(credentialsPath) : existsSync(localCredentialsPath));

  if (!hasCredentials) {
    throw new Error(
      "Firebase Admin credentials are missing. Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS to a service account file with Realtime Database access.",
    );
  }
}

export type GenreRecord = {
  id: string;
  name: string;
  description: string | null;
};

export type BookRecord = {
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
};

export type MemberRecord = {
  id: string;
  name: string;
  email: string;
  joinedAt: Date;
};

export type LoanRecord = {
  id: string;
  bookId: string;
  memberId: string;
  loanedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
};

type FirebaseRecord = Record<string, unknown> & { id: string };
const nullableFields = ["isbn", "publicationYear", "description", "coverColor", "returnedAt"];
const dateFields = ["createdAt", "updatedAt", "joinedAt", "loanedAt", "dueAt", "returnedAt"];

function recordFromSnapshot<T extends FirebaseRecord>(
  id: string,
  value: Record<string, unknown>,
): T {
  const record: Record<string, unknown> = { ...value, id };
  for (const field of dateFields) {
    if (typeof record[field] === "string") {
      record[field] = new Date(record[field]);
    }
  }
  for (const field of nullableFields) {
    if (!(field in record)) record[field] = null;
  }
  return record as T;
}

function toDatabaseValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toDatabaseValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) =>
        item === undefined || item === null
          ? []
          : [[key, toDatabaseValue(item)]],
      ),
    );
  }
  return value;
}

async function listRecords<T extends FirebaseRecord>(path: string): Promise<T[]> {
  ensureAdminCredentials();
  const snapshot = await db.ref(path).get();
  const records = snapshot.val() as Record<string, Record<string, unknown>> | null;
  if (!records) return [];
  return Object.entries(records)
    .map(([id, value]) => recordFromSnapshot<T>(id, value))
    .sort((a, b) => {
      const aName = "name" in a ? String(a.name) : String(a.title ?? "");
      const bName = "name" in b ? String(b.name) : String(b.title ?? "");
      return aName.localeCompare(bName);
    });
}

export async function listGenres(): Promise<GenreRecord[]> {
  return listRecords<GenreRecord>("genres");
}

export async function listGenresWithCounts() {
  const [genres, books] = await Promise.all([
    listGenres(),
    listRecords<BookRecord>("books"),
  ]);
  const counts = new Map<string, number>();
  for (const book of books) {
    for (const id of book.genreIds ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return genres.map((genre) => ({
    ...genre,
    _count: { books: counts.get(genre.id) ?? 0 },
  }));
}

export async function getGenresByIds(ids: string[]): Promise<GenreRecord[]> {
  const genres = await listGenres();
  const selectedIds = new Set(ids);
  return genres.filter((genre) => selectedIds.has(genre.id));
}

export async function getBookRecords(): Promise<BookRecord[]> {
  return listRecords<BookRecord>("books");
}

export async function listBooks() {
  const [books, genres] = await Promise.all([getBookRecords(), listGenres()]);
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  return books.map((book) => ({
    ...book,
    genres: (book.genreIds ?? []).flatMap((id) => {
      const name = genreNames.get(id);
      return name ? [name] : [];
    }),
  }));
}

export async function getBookDetails(id: string) {
  ensureAdminCredentials();
  const [bookSnapshot, genres, loans] = await Promise.all([
    db.ref(`books/${id}`).get(),
    listGenres(),
    listRecords<LoanRecord>("loans"),
  ]);
  const value = bookSnapshot.val() as Record<string, unknown> | null;
  if (!value) return null;

  const book = recordFromSnapshot<BookRecord>(id, value);
  const [members] = await Promise.all([
    listRecords<MemberRecord>("members"),
  ]);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookGenres = genres
    .filter((genre) => (book.genreIds ?? []).includes(genre.id))
    .map((genre) => ({ genreId: genre.id, genre }));
  const loansWithMembers = loans
    .filter((loan) => loan.bookId === id)
    .map((loan) => ({
      ...loan,
      member: memberById.get(loan.memberId) ?? null,
    }));

  return { ...book, genres: bookGenres, loans: loansWithMembers };
}

export async function getRelatedBooks(book: BookRecord, limit = 4) {
  const books = await getBookRecords();
  const related = books
    .filter(
      (candidate) =>
        candidate.id !== book.id &&
        candidate.genreIds.some((genreId) => book.genreIds.includes(genreId)),
    )
    .slice(0, limit);
  const genres = await listGenres();
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  return related.map((item) => ({
    ...item,
    genres: item.genreIds.flatMap((id) => {
      const name = genreNames.get(id);
      return name ? [{ genre: { id, name } }] : [];
    }),
  }));
}

export function uniqueKey(type: "isbn" | "genre" | "email", value: string) {
  const encoded = Buffer.from(value.trim().toLocaleLowerCase("en-US")).toString("base64url");
  return `${type}_${encoded}`;
}

export class DuplicateValueError extends Error {}

async function reserveUnique(
  key: string,
  ownerId: string,
  message: string,
) {
  ensureAdminCredentials();
  const result = await db.ref(`uniqueKeys/${key}`).transaction((current) => {
    if (current && current.ownerId !== ownerId) return;
    return { ownerId };
  });
  if (!result.committed) throw new DuplicateValueError(message);
}

async function releaseUnique(key: string | null, ownerId: string) {
  if (!key) return;
  await db.ref(`uniqueKeys/${key}`).transaction((current) =>
    current?.ownerId === ownerId ? null : undefined,
  );
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
  const id = crypto.randomUUID();
  const genreIds = [...new Set(input.genreIds)];
  const genres = await getGenresByIds(genreIds);
  if (genres.length !== genreIds.length) {
    throw new Error("One or more selected genres do not exist.");
  }
  const now = new Date();
  const book: BookRecord = {
    id,
    title: input.title,
    author: input.author,
    isbn: input.isbn || null,
    publicationYear: input.publicationYear ?? null,
    description: input.description || null,
    coverColor: input.coverColor || null,
    available: true,
    genreIds,
    createdAt: now,
    updatedAt: now,
  };
  const isbnKey = book.isbn ? uniqueKey("isbn", book.isbn) : null;
  if (isbnKey) await reserveUnique(isbnKey, id, "That ISBN is already in the catalog.");
  try {
    await db.ref(`books/${id}`).set(toDatabaseValue(book));
  } catch (error) {
    await releaseUnique(isbnKey, id);
    throw error;
  }
  return book;
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
  ensureAdminCredentials();
  const [snapshot, genres] = await Promise.all([
    db.ref(`books/${id}`).get(),
    getGenresByIds(input.genreIds),
  ]);
  if (!snapshot.exists()) throw new Error("Book not found.");
  if (genres.length !== new Set(input.genreIds).size) {
    throw new Error("One or more selected genres do not exist.");
  }
  const old = recordFromSnapshot<BookRecord>(
    id,
    snapshot.val() as Record<string, unknown>,
  );
  const nextIsbn = input.isbn || null;
  const oldKey = old.isbn ? uniqueKey("isbn", old.isbn) : null;
  const nextKey = nextIsbn ? uniqueKey("isbn", nextIsbn) : null;
  if (nextKey && nextKey !== oldKey) {
    await reserveUnique(nextKey, id, "That ISBN is already in the catalog.");
  }
  const updated: BookRecord = {
    ...old,
    title: input.title,
    author: input.author,
    isbn: nextIsbn,
    publicationYear: input.publicationYear ?? null,
    description: input.description || null,
    coverColor: input.coverColor || null,
    genreIds: [...new Set(input.genreIds)],
    updatedAt: new Date(),
  };
  try {
    await db.ref(`books/${id}`).set(toDatabaseValue(updated));
  } catch (error) {
    if (nextKey !== oldKey) await releaseUnique(nextKey, id);
    throw error;
  }
  if (oldKey !== nextKey) await releaseUnique(oldKey, id);
  return updated;
}

export async function deleteBook(id: string, confirmActiveLoan: boolean) {
  ensureAdminCredentials();
  const bookReference = db.ref(`books/${id}`);
  const existingBook = await bookReference.get();
  if (!existingBook.exists()) throw new Error("Book not found.");
  const result = await bookReference.transaction((current) => {
    if (!current) return;
    if (!confirmActiveLoan && !current.available) return;
    return null;
  });
  if (!result.committed) {
    throw new Error("This book has an active loan. Confirm deletion with ?confirmActiveLoan=true.");
  }
  const book = existingBook.val() as Record<string, unknown>;
  const [loans] = await Promise.all([
    listRecords<LoanRecord>("loans"),
  ]);
  const updates: Record<string, null> = {};
  for (const loan of loans) {
    if (loan.bookId === id) updates[`loans/${loan.id}`] = null;
  }
  if (typeof book.isbn === "string") {
    updates[`uniqueKeys/${uniqueKey("isbn", book.isbn)}`] = null;
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
}

export async function createGenre(input: { name: string; description?: string | null }) {
  const id = crypto.randomUUID();
  const genre: GenreRecord = { id, name: input.name, description: input.description ?? null };
  const key = uniqueKey("genre", input.name);
  await reserveUnique(key, id, "That genre already exists.");
  try {
    await db.ref(`genres/${id}`).set(toDatabaseValue(genre));
  } catch (error) {
    await releaseUnique(key, id);
    throw error;
  }
  return genre;
}

export async function updateGenre(
  id: string,
  input: { name: string; description?: string | null },
) {
  ensureAdminCredentials();
  const reference = db.ref(`genres/${id}`);
  const snapshot = await reference.get();
  if (!snapshot.exists()) throw new Error("Genre not found.");
  const old = recordFromSnapshot<GenreRecord>(
    id,
    snapshot.val() as Record<string, unknown>,
  );
  const oldKey = uniqueKey("genre", old.name);
  const nextKey = uniqueKey("genre", input.name);
  if (oldKey !== nextKey) {
    await reserveUnique(nextKey, id, "That genre already exists.");
  }
  const updated = { ...old, ...input, description: input.description ?? null };
  try {
    await reference.set(toDatabaseValue(updated));
  } catch (error) {
    if (oldKey !== nextKey) await releaseUnique(nextKey, id);
    throw error;
  }
  if (oldKey !== nextKey) await releaseUnique(oldKey, id);
  return updated;
}

export async function deleteGenre(id: string) {
  ensureAdminCredentials();
  const genreSnapshot = await db.ref(`genres/${id}`).get();
  if (!genreSnapshot.exists()) throw new Error("Genre not found.");
  const genre = genreSnapshot.val() as GenreRecord;
  const books = await getBookRecords();
  const updates: Record<string, unknown> = {
    [`genres/${id}`]: null,
    [`uniqueKeys/${uniqueKey("genre", genre.name)}`]: null,
  };
  for (const book of books) {
    if (book.genreIds.includes(id)) {
      updates[`books/${book.id}/genreIds`] = book.genreIds.filter(
        (genreId) => genreId !== id,
      );
      updates[`books/${book.id}/updatedAt`] = new Date().toISOString();
    }
  }
  await db.ref().update(updates);
}

export async function listMembers(): Promise<MemberRecord[]> {
  return listRecords<MemberRecord>("members");
}

export async function createMember(input: { name: string; email: string }) {
  const id = crypto.randomUUID();
  const member: MemberRecord = { id, ...input, joinedAt: new Date() };
  const key = uniqueKey("email", input.email);
  await reserveUnique(key, id, "A member with that email already exists.");
  try {
    await db.ref(`members/${id}`).set(toDatabaseValue(member));
  } catch (error) {
    await releaseUnique(key, id);
    throw error;
  }
  return member;
}

export async function listLoans() {
  const [loans, books, members] = await Promise.all([
    listRecords<LoanRecord>("loans"),
    listRecords<BookRecord>("books"),
    listMembers(),
  ]);
  const bookById = new Map(books.map((book) => [book.id, book.title]));
  const memberById = new Map(members.map((member) => [member.id, member.name]));
  return loans
    .sort((a, b) => b.loanedAt.getTime() - a.loanedAt.getTime())
    .map((loan) => ({
      ...loan,
      book: { title: bookById.get(loan.bookId) ?? "Deleted book" },
      member: { name: memberById.get(loan.memberId) ?? "Deleted member" },
    }));
}

export async function createMemberLoan(input: {
  bookId: string;
  memberId: string;
  dueAt: Date;
}) {
  ensureAdminCredentials();
  const [bookSnapshot, memberSnapshot] = await Promise.all([
    db.ref(`books/${input.bookId}`).get(),
    db.ref(`members/${input.memberId}`).get(),
  ]);
  if (!bookSnapshot.exists()) throw new Error("Book not found.");
  if (!memberSnapshot.exists()) throw new Error("Member not found.");

  const bookReference = db.ref(`books/${input.bookId}`);
  const result = await bookReference.transaction((current) => {
    if (!current || !current.available) return;
    return { ...current, available: false, updatedAt: new Date().toISOString() };
  });
  if (!result.committed) throw new Error("This book is already on loan.");

  const id = crypto.randomUUID();
  const now = new Date();
  const loan: LoanRecord = {
    id,
    ...input,
    loanedAt: now,
    returnedAt: null,
  };
  try {
    await db.ref(`loans/${id}`).set(toDatabaseValue(loan));
  } catch (error) {
    await bookReference.update({ available: true, updatedAt: new Date().toISOString() });
    throw error;
  }
  return {
    ...loan,
    book: { ...bookSnapshot.val(), id: input.bookId },
    member: { ...memberSnapshot.val(), id: input.memberId },
  };
}

export async function returnMemberLoan(id: string) {
  ensureAdminCredentials();
  const loanReference = db.ref(`loans/${id}`);
  const returnedAt = new Date();
  const result = await loanReference.transaction((current) => {
    if (!current || current.returnedAt) return;
    return { ...current, returnedAt: returnedAt.toISOString() };
  });
  if (!result.committed) {
    const snapshot = await loanReference.get();
    if (!snapshot.exists()) throw new Error("Loan not found.");
    throw new Error("This loan has already been returned.");
  }
  const loan = result.snapshot.val() as Record<string, unknown>;
  await db.ref(`books/${loan.bookId as string}`).update({
    available: true,
    updatedAt: returnedAt.toISOString(),
  });
  return recordFromSnapshot<LoanRecord>(id, loan);
}
