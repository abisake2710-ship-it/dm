import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const [{ PrismaClient }, { db, uniqueKey }] = await Promise.all([
  import("@prisma/client"),
  import("../src/lib/firestore"),
]);
const prisma = new PrismaClient();

async function main() {
  const collectionNames = ["books", "genres", "members", "loans", "uniqueKeys"];
  const snapshots = await Promise.all(
    collectionNames.map((name) => db.collection(name).limit(1).get()),
  );
  const populated = snapshots.flatMap((snapshot, index) =>
    snapshot.empty ? [] : [collectionNames[index]],
  );
  if (populated.length) {
    throw new Error(
      `Refusing to overwrite Firestore data. These collections are not empty: ${populated.join(", ")}.`,
    );
  }

  const [genres, books, members, loans] = await Promise.all([
    prisma.genre.findMany(),
    prisma.book.findMany({ include: { genres: true } }),
    prisma.member.findMany(),
    prisma.loan.findMany(),
  ]);
  if (!genres.length && !books.length && !members.length && !loans.length) {
    throw new Error("The local SQLite database is empty. Run npm run db:setup first.");
  }

  const writes: Array<{
    collection: string;
    id: string;
    data: Record<string, unknown>;
  }> = [];
  const enqueue = (collection: string, id: string, data: Record<string, unknown>) => {
    writes.push({ collection, id, data });
  };
  for (const genre of genres) {
    enqueue("genres", genre.id, {
      id: genre.id,
      name: genre.name,
      description: genre.description,
    });
    enqueue("uniqueKeys", uniqueKey("genre", genre.name), {
      ownerId: genre.id,
    });
  }
  for (const book of books) {
    enqueue("books", book.id, {
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      publicationYear: book.publicationYear,
      description: book.description,
      coverColor: book.coverColor,
      available: book.available,
      genreIds: book.genres.map(({ genreId }) => genreId),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    });
    if (book.isbn) {
      enqueue("uniqueKeys", uniqueKey("isbn", book.isbn), {
        ownerId: book.id,
      });
    }
  }
  for (const member of members) {
    enqueue("members", member.id, {
      id: member.id,
      name: member.name,
      email: member.email,
      joinedAt: member.joinedAt,
    });
    enqueue("uniqueKeys", uniqueKey("email", member.email), {
      ownerId: member.id,
    });
  }
  for (const loan of loans) {
    enqueue("loans", loan.id, {
      id: loan.id,
      bookId: loan.bookId,
      memberId: loan.memberId,
      loanedAt: loan.loanedAt,
      dueAt: loan.dueAt,
      returnedAt: loan.returnedAt,
    });
  }

  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 450)) {
      batch.create(db.collection(write.collection).doc(write.id), write.data);
    }
    await batch.commit();
  }
  console.log(
    `Migrated ${books.length} books, ${genres.length} genres, ${members.length} members, and ${loans.length} loans to Firestore.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("SQLite to Firestore migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
