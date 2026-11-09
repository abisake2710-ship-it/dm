import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookDetails, getRelatedBooks } from "@/lib/realtime-database";

type Props = { params: Promise<{ id: string }> };

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params;
  const book = await getBookDetails(id);
  if (!book) notFound();

  const related = await getRelatedBooks(book);
  const activeLoan = book.loans.find((loan) => loan.returnedAt === null);

  return (
    <main className="detail-shell">
      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="SetLib home">
          <span className="brand-mark" aria-hidden="true">
            S<span>∩</span>B
          </span>
          <div className="brand-info">
            <strong>SetLib</strong>
            <small>THE OPEN-STACK CATALOG</small>
          </div>
        </Link>
        <Link className="back-link" href="/">
          ← Back to catalog explorer
        </Link>
      </header>

      <article className="detail-layout">
        <div className="detail-cover-wrap">
          <div
            className="detail-cover"
            style={{ backgroundColor: book.coverColor ?? "#0f766e" }}
            aria-label={`Generated hardcover for ${book.title}`}
          >
            <span className="detail-cover-vol">
              SETLIB / VOL. {book.publicationYear ?? "—"}
            </span>
            <strong>{book.title}</strong>
            <i className="detail-cover-author">by {book.author}</i>
            <b className="detail-cover-logo" aria-hidden="true">
              S ∩ B
            </b>
          </div>
        </div>

        <div className="detail-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> CATALOG ITEM ∈ B
          </p>
          <h1>{book.title}</h1>
          <p className="detail-author">by {book.author}</p>

          <div className="detail-status-card">
            <span
              className={`detail-status-pill ${
                book.available ? "is-available" : "is-loaned"
              }`}
            >
              <i
                className={`status-dot ${book.available ? "" : "status-loaned"}`}
                aria-hidden="true"
              />
              {book.available ? "Available to Borrow" : "Currently on Loan"}
            </span>
            <span className="detail-status-text">
              {book.available
                ? "This volume is in the open stacks and ready for checkout."
                : "This volume is currently checked out by a library member."}
            </span>
          </div>

          <p className="detail-description">
            {book.description || "No official description has been recorded for this catalog title."}
          </p>

          <dl className="detail-facts">
            <div>
              <dt>Publication Year</dt>
              <dd>{book.publicationYear ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>ISBN Number</dt>
              <dd>{book.isbn ?? "Not recorded"}</dd>
            </div>
          </dl>

          <section className="detail-genres">
            <h2>Set Theory Coordinates</h2>
            <p>
              In SetLib, this book belongs to the library universe <b>B</b> and is a member of the following genre subsets:
            </p>
            <div className="book-genres">
              {book.genres.map(({ genre }) => (
                <span key={genre.id}>
                  book ∈ {genre.name}
                </span>
              ))}
              <span style={{ background: book.available ? "#ecfdf5" : "#fffbeb", color: book.available ? "#065f46" : "#92400e" }}>
                book ∈ {book.available ? "V (Available)" : "Vc (On Loan)"}
              </span>
            </div>
          </section>

          {activeLoan && (
            <section className="loan-info">
              <h2>Active Circulation Record</h2>
              <p>
                Borrowed by member <strong>{activeLoan.member?.name ?? "Unknown member"}</strong>
              </p>
              <p>
                Due back on <strong>{activeLoan.dueAt.toLocaleDateString("en-US", { dateStyle: "long" })}</strong>
              </p>
            </section>
          )}
        </div>
      </article>

      <section className="related-section">
        <div className="section-kicker">
          <span>∩</span> RELATED BY GENRE OVERLAP
        </div>
        <h2>Other titles in these sets</h2>
        {related.length ? (
          <div className="related-grid">
            {related.map((item) => (
              <Link key={item.id} href={`/books/${item.id}`} className="related-card">
                <span className="related-card-genres">
                  {item.genres.map(({ genre }) => genre.name).join(" · ")}
                </span>
                <strong>{item.title}</strong>
                <small>{item.author}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: "#64748b" }}>No related titles found in these genre subsets.</p>
        )}
      </section>

      <footer className="page-footer">
        <span>
          <strong>SETLIB</strong> · A STUDY IN LIBRARY DISCOVERY
        </span>
        <Link href="/" style={{ color: "var(--teal)", fontWeight: 600 }}>
          ← Return to full collection
        </Link>
      </footer>
    </main>
  );
}
