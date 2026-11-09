import { CatalogExplorer } from "@/components/catalog-explorer";
import { CatalogBook } from "@/lib/catalog";
import { listBooks, listGenres } from "@/lib/data";

export const dynamic = "force-dynamic";

async function loadCatalog() {
  try {
    const [records, genreRecords] = await Promise.all([listBooks(), listGenres()]);
    return {
      books: records.map((book): CatalogBook => ({
        id: book.id,
        title: book.title,
        author: book.author,
        publicationYear: book.publicationYear,
        description: book.description,
        coverColor: book.coverColor,
        available: book.available,
        genres: book.genres,
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
        <p>Configure Firebase Realtime Database and server credentials, then refresh this page.</p>
        <pre>See the Firebase setup steps in README.md.</pre>
        <p className="setup-hint">Check FIREBASE_DATABASE_URL and run gcloud auth application-default login for local access. Errors are logged in the development server.</p>
      </main>
    );
  }
  return <CatalogExplorer books={catalog.books} genres={catalog.genres} />;
}
