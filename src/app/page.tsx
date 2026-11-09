import { CatalogExplorer } from "@/components/catalog-explorer";
import { CatalogBook } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadCatalog() {
  try {
    const [records, genreRecords] = await Promise.all([
      prisma.book.findMany({
        include: { genres: { include: { genre: true } } },
        orderBy: { title: "asc" },
      }),
      prisma.genre.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    ]);
    return {
      books: records.map((book): CatalogBook => ({
        id: book.id,
        title: book.title,
        author: book.author,
        publicationYear: book.publicationYear,
        description: book.description,
        coverColor: book.coverColor,
        available: book.available,
        genres: book.genres.map(({ genre }) => genre.name),
      })),
      genres: genreRecords.map(({ name }) => name),
    };
  } catch (error) {
    console.error("Could not load catalog:", error);
    return null;
  }
}

export default async function HomePage() {
  const catalog = await loadCatalog();
  if (!catalog) {
    return (
      <main className="setup-error">
        <p className="eyebrow">SETLIB · LOCAL CATALOG</p>
        <h1>Your library is almost ready.</h1>
        <p>Set up the local database and seed the catalog, then refresh this page.</p>
        <pre>Copy .env.example to .env, then run npm run db:setup</pre>
        <p className="setup-hint">Database errors are logged in the development server for troubleshooting.</p>
      </main>
    );
  }
  return <CatalogExplorer books={catalog.books} genres={catalog.genres} />;
}
