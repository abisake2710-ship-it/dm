import { getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type DocumentData,
  type Transaction,
} from "firebase-admin/firestore";

const appName = "setlib-admin";
const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT;

const app =
  getApps().find((candidate) => candidate.name === appName) ??
  initializeApp({ projectId }, appName);

export const db = getFirestore(app);

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

export function recordFromDocument<T>(id: string, data: DocumentData): T {
  const record = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Timestamp ? value.toDate() : value,
    ]),
  );
  return { ...record, id } as T;
}

export async function listGenres(): Promise<GenreRecord[]> {
  const snapshot = await db.collection("genres").orderBy("name").get();
  return snapshot.docs.map((document) =>
    recordFromDocument<GenreRecord>(document.id, document.data()),
  );
}

export async function listGenresWithCounts() {
  const [genres, books] = await Promise.all([
    listGenres(),
    db.collection("books").select("genreIds").get(),
  ]);
  const counts = new Map<string, number>();
  for (const book of books.docs) {
    for (const id of (book.get("genreIds") as string[] | undefined) ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return genres.map((genre) => ({
    ...genre,
    _count: { books: counts.get(genre.id) ?? 0 },
  }));
}

export async function getGenresByIds(ids: string[]): Promise<GenreRecord[]> {
  const uniqueIds = [...new Set(ids)];
  const documents = await Promise.all(
    uniqueIds.map((id) => db.collection("genres").doc(id).get()),
  );
  return documents
    .filter((document) => document.exists)
    .map((document) =>
      recordFromDocument<GenreRecord>(document.id, document.data()!),
    );
}

export async function getBookRecords(): Promise<BookRecord[]> {
  const snapshot = await db.collection("books").orderBy("title").get();
  return snapshot.docs.map((document) =>
    recordFromDocument<BookRecord>(document.id, document.data()),
  );
}

export async function listBooks() {
  const [books, genres] = await Promise.all([getBookRecords(), listGenres()]);
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  return books.map((book) => ({
    ...book,
    genres: book.genreIds.flatMap((id) => {
      const name = genreNames.get(id);
      return name ? [name] : [];
    }),
  }));
}

export async function getBookDetails(id: string) {
  const bookSnapshot = await db.collection("books").doc(id).get();
  if (!bookSnapshot.exists) return null;

  const book = recordFromDocument<BookRecord>(bookSnapshot.id, bookSnapshot.data()!);
  const [genres, loans] = await Promise.all([
    getGenresByIds(book.genreIds),
    db.collection("loans").where("bookId", "==", id).get(),
  ]);
  const loanRecords = loans.docs.map((document) =>
    recordFromDocument<LoanRecord>(document.id, document.data()),
  );
  const members = await Promise.all(
    loanRecords.map((loan) => db.collection("members").doc(loan.memberId).get()),
  );
  const memberById = new Map(
    members
      .filter((member) => member.exists)
      .map((member) => [member.id, recordFromDocument<MemberRecord>(member.id, member.data()!)]),
  );
  const loansWithMembers = loanRecords.map((loan) => ({
    ...loan,
    member: memberById.get(loan.memberId) ?? null,
  }));

  return {
    ...book,
    genres: genres.map((genre) => ({ genreId: genre.id, genre })),
    loans: loansWithMembers,
  };
}

export async function getRelatedBooks(book: BookRecord, limit = 4) {
  if (!book.genreIds.length) return [];
  const matchingBooks = await Promise.all(
    book.genreIds.map((genreId) =>
      db.collection("books").where("genreIds", "array-contains", genreId).get(),
    ),
  );
  const related = new Map<string, BookRecord>();
  for (const snapshot of matchingBooks) {
    for (const document of snapshot.docs) {
      if (document.id !== book.id) {
        related.set(
          document.id,
          recordFromDocument<BookRecord>(document.id, document.data()),
        );
      }
    }
  }
  const sorted = [...related.values()].sort((a, b) => a.title.localeCompare(b.title)).slice(0, limit);
  const genres = await listGenres();
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  return sorted.map((item) => ({
    ...item,
    genres: item.genreIds.flatMap((id) => {
      const name = genreNames.get(id);
      return name ? [{ genre: { id, name } }] : [];
    }),
  }));
}

export function uniqueKey(type: "isbn" | "genre" | "email", value: string) {
  return `${type}_${encodeURIComponent(value.trim().toLocaleLowerCase("en-US"))}`;
}

export class DuplicateValueError extends Error {}

async function reserveUnique(
  transaction: Transaction,
  key: string,
  ownerId: string,
  message: string,
) {
  const reference = db.collection("uniqueKeys").doc(key);
  const existing = await transaction.get(reference);
  if (existing.exists && existing.get("ownerId") !== ownerId) {
    throw new DuplicateValueError(message);
  }
  transaction.set(reference, { ownerId });
}

async function releaseUnique(
  transaction: Transaction,
  key: string | null,
  ownerId: string,
) {
  if (!key) return;
  const reference = db.collection("uniqueKeys").doc(key);
  const existing = await transaction.get(reference);
  if (existing.exists && existing.get("ownerId") === ownerId) {
    transaction.delete(reference);
  }
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
  const reference = db.collection("books").doc(id);
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

  await db.runTransaction(async (transaction) => {
    const genres = await Promise.all(
      genreIds.map((genreId) =>
        transaction.get(db.collection("genres").doc(genreId)),
      ),
    );
    if (genres.some((genre) => !genre.exists)) {
      throw new Error("One or more selected genres do not exist.");
    }
    if (book.isbn) {
      await reserveUnique(
        transaction,
        uniqueKey("isbn", book.isbn),
        id,
        "That ISBN is already in the catalog.",
      );
    }
    transaction.create(reference, book);
  });
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
  const reference = db.collection("books").doc(id);
  const genreIds = [...new Set(input.genreIds)];
  const genreReferences = genreIds.map((genreId) => db.collection("genres").doc(genreId));
  const nextIsbn = input.isbn || null;

  return db.runTransaction(async (transaction) => {
    const [current, ...genres] = await Promise.all([
      transaction.get(reference),
      ...genreReferences.map((genre) => transaction.get(genre)),
    ]);
    if (!current.exists) throw new Error("Book not found.");
    if (genres.some((genre) => !genre.exists)) {
      throw new Error("One or more selected genres do not exist.");
    }
    const old = recordFromDocument<BookRecord>(id, current.data()!);
    const oldIsbnKey = old.isbn ? uniqueKey("isbn", old.isbn) : null;
    const newIsbnKey = nextIsbn ? uniqueKey("isbn", nextIsbn) : null;
    const uniqueReferences = [...new Set([oldIsbnKey, newIsbnKey].filter(
      (key): key is string => key !== null,
    ))].map((key) => db.collection("uniqueKeys").doc(key));
    const uniqueDocuments = await Promise.all(
      uniqueReferences.map((uniqueReference) => transaction.get(uniqueReference)),
    );
    if (
      newIsbnKey &&
      uniqueDocuments.some(
        (uniqueDocument) =>
          uniqueDocument.id === newIsbnKey &&
          uniqueDocument.exists &&
          uniqueDocument.get("ownerId") !== id,
      )
    ) {
      throw new DuplicateValueError("That ISBN is already in the catalog.");
    }
    if (oldIsbnKey && oldIsbnKey !== newIsbnKey) {
      const oldUniqueDocument = uniqueDocuments.find((document) => document.id === oldIsbnKey);
      if (oldUniqueDocument?.get("ownerId") === id) transaction.delete(oldUniqueDocument.ref);
    }
    if (newIsbnKey) {
      transaction.set(db.collection("uniqueKeys").doc(newIsbnKey), { ownerId: id });
    }
    const updated: BookRecord = {
      ...old,
      title: input.title,
      author: input.author,
      isbn: nextIsbn,
      publicationYear: input.publicationYear ?? null,
      description: input.description || null,
      coverColor: input.coverColor || null,
      genreIds,
      updatedAt: new Date(),
    };
    transaction.set(reference, updated);
    return updated;
  });
}

export async function deleteBook(id: string, confirmActiveLoan: boolean) {
  const bookReference = db.collection("books").doc(id);
  await db.runTransaction(async (transaction) => {
    const book = await transaction.get(bookReference);
    if (!book.exists) throw new Error("Book not found.");
    const loanQuery = db.collection("loans").where("bookId", "==", id);
    const loans = await transaction.get(loanQuery);
    if (!confirmActiveLoan && loans.docs.some((loan) => loan.get("returnedAt") == null)) {
      throw new Error("This book has an active loan. Confirm deletion with ?confirmActiveLoan=true.");
    }
    if (loans.size > 497) {
      throw new Error("This book has too many loan records to delete in one transaction.");
    }
    for (const loan of loans.docs) transaction.delete(loan.ref);
    const data = book.data()!;
    if (data.isbn) {
      await releaseUnique(transaction, uniqueKey("isbn", data.isbn), id);
    }
    transaction.delete(bookReference);
  });
}

export async function createGenre(input: { name: string; description?: string | null }) {
  const id = crypto.randomUUID();
  const genre: GenreRecord = { id, name: input.name, description: input.description ?? null };
  await db.runTransaction(async (transaction) => {
    await reserveUnique(
      transaction,
      uniqueKey("genre", input.name),
      id,
      "That genre already exists.",
    );
    transaction.create(db.collection("genres").doc(id), genre);
  });
  return genre;
}

export async function updateGenre(
  id: string,
  input: { name: string; description?: string | null },
) {
  const reference = db.collection("genres").doc(id);
  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (!current.exists) throw new Error("Genre not found.");
    const old = recordFromDocument<GenreRecord>(id, current.data()!);
    const oldKey = uniqueKey("genre", old.name);
    const nextKey = uniqueKey("genre", input.name);
    const uniqueReferences = [...new Set([oldKey, nextKey])].map((key) =>
      db.collection("uniqueKeys").doc(key),
    );
    const uniqueDocuments = await Promise.all(
      uniqueReferences.map((uniqueReference) => transaction.get(uniqueReference)),
    );
    const nextUniqueDocument = uniqueDocuments.find((document) => document.id === nextKey);
    if (nextUniqueDocument?.exists && nextUniqueDocument.get("ownerId") !== id) {
      throw new DuplicateValueError("That genre already exists.");
    }
    if (oldKey !== nextKey) {
      const oldUniqueDocument = uniqueDocuments.find((document) => document.id === oldKey);
      if (oldUniqueDocument?.get("ownerId") === id) transaction.delete(oldUniqueDocument.ref);
    }
    transaction.set(db.collection("uniqueKeys").doc(nextKey), { ownerId: id });
    const updated: GenreRecord = {
      ...old,
      name: input.name,
      description: input.description ?? null,
    };
    transaction.set(reference, updated);
    return updated;
  });
}

export async function deleteGenre(id: string) {
  const genreReference = db.collection("genres").doc(id);
  await db.runTransaction(async (transaction) => {
    const genre = await transaction.get(genreReference);
    if (!genre.exists) throw new Error("Genre not found.");
    const books = await transaction.get(
      db.collection("books").where("genreIds", "array-contains", id),
    );
    if (books.size > 498) {
      throw new Error("This genre is assigned to too many books to delete in one transaction.");
    }
    const keyReference = db
      .collection("uniqueKeys")
      .doc(uniqueKey("genre", genre.get("name")));
    const uniqueKeyDocument = await transaction.get(keyReference);
    for (const book of books.docs) {
      const genreIds = (book.get("genreIds") as string[]).filter(
        (genreId) => genreId !== id,
      );
      transaction.update(book.ref, { genreIds, updatedAt: new Date() });
    }
    if (uniqueKeyDocument.exists && uniqueKeyDocument.get("ownerId") === id) {
      transaction.delete(keyReference);
    }
    transaction.delete(genreReference);
  });
}

export async function listMembers(): Promise<MemberRecord[]> {
  const snapshot = await db.collection("members").orderBy("name").get();
  return snapshot.docs.map((document) =>
    recordFromDocument<MemberRecord>(document.id, document.data()),
  );
}

export async function createMember(input: { name: string; email: string }) {
  const id = crypto.randomUUID();
  const member: MemberRecord = { id, ...input, joinedAt: new Date() };
  await db.runTransaction(async (transaction) => {
    await reserveUnique(
      transaction,
      uniqueKey("email", input.email),
      id,
      "A member with that email already exists.",
    );
    transaction.create(db.collection("members").doc(id), member);
  });
  return member;
}

export async function listLoans() {
  const [loanSnapshot, books, members] = await Promise.all([
    db.collection("loans").orderBy("loanedAt", "desc").get(),
    db.collection("books").get(),
    db.collection("members").get(),
  ]);
  const bookById = new Map(
    books.docs.map((document) => [document.id, document.get("title") as string]),
  );
  const memberById = new Map(
    members.docs.map((document) => [document.id, document.get("name") as string]),
  );
  return loanSnapshot.docs.map((document) => {
    const loan = recordFromDocument<LoanRecord>(document.id, document.data());
    return {
      ...loan,
      book: { title: bookById.get(loan.bookId) ?? "Deleted book" },
      member: { name: memberById.get(loan.memberId) ?? "Deleted member" },
    };
  });
}

export async function createMemberLoan(input: {
  bookId: string;
  memberId: string;
  dueAt: Date;
}) {
  const loanReference = db.collection("loans").doc();
  return db.runTransaction(async (transaction) => {
    const bookReference = db.collection("books").doc(input.bookId);
    const memberReference = db.collection("members").doc(input.memberId);
    const [book, member] = await Promise.all([
      transaction.get(bookReference),
      transaction.get(memberReference),
    ]);
    if (!book.exists) throw new Error("Book not found.");
    if (!member.exists) throw new Error("Member not found.");
    if (!book.get("available")) throw new Error("This book is already on loan.");

    const now = new Date();
    const loan: LoanRecord = {
      id: loanReference.id,
      ...input,
      loanedAt: now,
      returnedAt: null,
    };
    transaction.create(loanReference, loan);
    transaction.update(bookReference, { available: false, updatedAt: now });
    return {
      ...loan,
      book: { ...book.data(), id: book.id },
      member: { ...member.data(), id: member.id },
    };
  });
}

export async function returnMemberLoan(id: string) {
  const loanReference = db.collection("loans").doc(id);
  return db.runTransaction(async (transaction) => {
    const loanSnapshot = await transaction.get(loanReference);
    if (!loanSnapshot.exists) throw new Error("Loan not found.");
    const loan = recordFromDocument<LoanRecord>(loanSnapshot.id, loanSnapshot.data()!);
    if (loan.returnedAt) throw new Error("This loan has already been returned.");
    const bookReference = db.collection("books").doc(loan.bookId);
    const book = await transaction.get(bookReference);
    if (!book.exists) throw new Error("Book not found.");
    const returnedAt = new Date();
    transaction.update(loanReference, { returnedAt });
    transaction.update(bookReference, { available: true, updatedAt: returnedAt });
    return { ...loan, returnedAt };
  });
}
