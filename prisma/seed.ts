import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const genreDescriptions: Record<string, string> = {
  Fiction: "Narrative literature and imagined stories.",
  "Science Fiction": "Speculative stories shaped by science and technology.",
  Fantasy: "Stories featuring magic, myth, or otherworldly settings.",
  Mystery: "Stories centered on an unexplained event or investigation.",
  Horror: "Stories intended to evoke suspense, fear, or unease.",
  "Historical Fiction": "Fiction set in a recognizable historical period.",
  Romance: "Stories focused on romantic relationships.",
  Dystopian: "Stories about oppressive or deeply flawed societies.",
  Adventure: "Stories driven by discovery, danger, and action.",
  "Literary Fiction": "Character-driven fiction with an emphasis on style and theme.",
  Gothic: "Atmospheric fiction exploring mystery, dread, and the uncanny.",
};

const books = [
  { title: "Pride and Prejudice", author: "Jane Austen", year: 1813, color: "#d8a99a", genres: ["Fiction", "Romance", "Literary Fiction"] },
  { title: "Jane Eyre", author: "Charlotte Brontë", year: 1847, color: "#6d7770", genres: ["Fiction", "Romance", "Historical Fiction", "Literary Fiction"] },
  { title: "Wuthering Heights", author: "Emily Brontë", year: 1847, color: "#735654", genres: ["Fiction", "Romance", "Gothic", "Literary Fiction"] },
  { title: "Frankenstein", author: "Mary Shelley", year: 1818, color: "#526c68", genres: ["Fiction", "Science Fiction", "Horror", "Gothic"] },
  { title: "Dracula", author: "Bram Stoker", year: 1897, color: "#783b45", genres: ["Fiction", "Horror", "Gothic"] },
  { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", year: 1892, color: "#a4865b", genres: ["Fiction", "Mystery", "Adventure"] },
  { title: "The Time Machine", author: "H. G. Wells", year: 1895, color: "#496b70", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "The War of the Worlds", author: "H. G. Wells", year: 1898, color: "#735b49", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "Nineteen Eighty-Four", author: "George Orwell", year: 1949, color: "#a9473c", genres: ["Fiction", "Dystopian", "Literary Fiction"] },
  { title: "Animal Farm", author: "George Orwell", year: 1945, color: "#8c754c", genres: ["Fiction", "Dystopian", "Literary Fiction"] },
  { title: "Brave New World", author: "Aldous Huxley", year: 1932, color: "#527c78", genres: ["Fiction", "Science Fiction", "Dystopian"] },
  { title: "Fahrenheit 451", author: "Ray Bradbury", year: 1953, color: "#c75d3e", genres: ["Fiction", "Science Fiction", "Dystopian"] },
  { title: "The Hitchhiker’s Guide to the Galaxy", author: "Douglas Adams", year: 1979, color: "#4b8c76", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "Dune", author: "Frank Herbert", year: 1965, color: "#c38b4e", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "Neuromancer", author: "William Gibson", year: 1984, color: "#456574", genres: ["Fiction", "Science Fiction", "Dystopian"] },
  { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", year: 1969, color: "#75949a", genres: ["Fiction", "Science Fiction", "Literary Fiction"] },
  { title: "The Hobbit", author: "J. R. R. Tolkien", year: 1937, color: "#6f8558", genres: ["Fiction", "Fantasy", "Adventure"] },
  { title: "The Fellowship of the Ring", author: "J. R. R. Tolkien", year: 1954, color: "#63764b", genres: ["Fiction", "Fantasy", "Adventure"] },
  { title: "A Wizard of Earthsea", author: "Ursula K. Le Guin", year: 1968, color: "#527f83", genres: ["Fiction", "Fantasy", "Adventure"] },
  { title: "The Name of the Wind", author: "Patrick Rothfuss", year: 2007, color: "#a16d47", genres: ["Fiction", "Fantasy", "Adventure"] },
  { title: "The Martian", author: "Andy Weir", year: 2011, color: "#b85d45", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "Project Hail Mary", author: "Andy Weir", year: 2021, color: "#d39a61", genres: ["Fiction", "Science Fiction", "Adventure"] },
  { title: "Klara and the Sun", author: "Kazuo Ishiguro", year: 2021, color: "#d2ae76", genres: ["Fiction", "Science Fiction", "Literary Fiction"] },
  { title: "The Midnight Library", author: "Matt Haig", year: 2020, color: "#678c81", genres: ["Fiction", "Fantasy", "Literary Fiction"] },
  { title: "The Song of Achilles", author: "Madeline Miller", year: 2011, color: "#6c7881", genres: ["Fiction", "Fantasy", "Historical Fiction", "Romance"] },
];

const members = [
  { name: "Amara Chen", email: "amara.chen@example.test" },
  { name: "Noah Williams", email: "noah.williams@example.test" },
  { name: "Sofia Patel", email: "sofia.patel@example.test" },
  { name: "Elias Morgan", email: "elias.morgan@example.test" },
  { name: "Mina Okafor", email: "mina.okafor@example.test" },
  { name: "Theo Martin", email: "theo.martin@example.test" },
];

async function main() {
  await prisma.loan.deleteMany();
  await prisma.bookGenre.deleteMany();
  await prisma.book.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.member.deleteMany();

  const genreRecords = new Map<string, { id: string }>();
  for (const [name, description] of Object.entries(genreDescriptions)) {
    genreRecords.set(
      name,
      await prisma.genre.create({ data: { name, description }, select: { id: true } }),
    );
  }
  const memberRecords = [];
  for (const member of members) {
    memberRecords.push(await prisma.member.create({ data: member }));
  }

  const bookRecords = [];
  for (const [index, book] of books.entries()) {
    const record = await prisma.book.create({
      data: {
        title: book.title,
        author: book.author,
        publicationYear: book.year,
        description: `${book.title} by ${book.author}, a landmark work in ${book.genres.slice(1).join(", ")}.`,
        coverColor: book.color,
        available: index >= 10,
        genres: {
          create: book.genres.map((name) => ({ genre: { connect: { id: genreRecords.get(name)!.id } } })),
        },
      },
    });
    bookRecords.push(record);
  }

  const dueAt = (days: number) => new Date(Date.now() + days * 86_400_000);
  for (let index = 0; index < 10; index += 1) {
    await prisma.loan.create({
      data: {
        bookId: bookRecords[index].id,
        memberId: memberRecords[index % memberRecords.length].id,
        dueAt: dueAt(7 + index),
        loanedAt: dueAt(-5 - index),
      },
    });
  }
  for (let index = 10; index < 16; index += 1) {
    await prisma.loan.create({
      data: {
        bookId: bookRecords[index].id,
        memberId: memberRecords[index % memberRecords.length].id,
        dueAt: dueAt(-20 - index),
        loanedAt: dueAt(-35 - index),
        returnedAt: dueAt(-18 - index),
      },
    });
  }

  console.log(`Seeded exactly ${bookRecords.length} books, ${genreRecords.size} genres, ${memberRecords.length} members, and 16 loans.`);
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
