"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Genre = { id: string; name: string; description: string | null };
type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publicationYear: number | null;
  description: string | null;
  coverColor: string | null;
  available: boolean;
  genres: string[];
};
type Member = { id: string; name: string; email: string };
type Loan = {
  id: string;
  bookId: string;
  memberId: string;
  dueAt: string;
  loanedAt: string;
  returnedAt: string | null;
  book: { title: string };
  member: { name: string };
};
type Data = { books: Book[]; genres: Genre[]; members: Member[]; loans: Loan[] };

const emptyBook = {
  title: "",
  author: "",
  isbn: "",
  publicationYear: "",
  description: "",
  coverColor: "#0f766e",
  genreIds: [] as string[],
};

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
  return data as T;
}

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Data>({ books: [], genres: [], members: [], loans: [] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [genreName, setGenreName] = useState("");
  const [loanBookId, setLoanBookId] = useState("");
  const [loanMemberId, setLoanMemberId] = useState("");
  const [loanDueAt, setLoanDueAt] = useState("");
  const [filterQuery, setFilterQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [books, genres, members, loans] = await Promise.all([
        fetch("/api/books").then((response) => responseData<Book[]>(response)),
        fetch("/api/genres").then((response) => responseData<Genre[]>(response)),
        fetch("/api/members").then((response) => responseData<Member[]>(response)),
        fetch("/api/loans").then((response) => responseData<Loan[]>(response)),
      ]);
      setData({ books, genres, members, loans });
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load librarian data.");
    }
  }, []);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((response) => responseData<{ authenticated: boolean }>(response))
      .then(async ({ authenticated: hasSession }) => {
        if (hasSession) {
          await loadData();
          setAuthenticated(true);
        }
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not verify admin session."),
      );
  }, [loadData]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await responseData(
        await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      );
      setPassword("");
      await loadData();
      setAuthenticated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    }
  }

  async function mutate(url: string, method: string, body?: unknown) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await responseData<unknown>(response);
      setMessage("Changes saved successfully.");
      await loadData();
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed.");
      return null;
    }
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      publicationYear: book.publicationYear?.toString() ?? "",
      description: book.description ?? "",
      coverColor: book.coverColor ?? "#0f766e",
      genreIds: data.genres
        .filter((genre) => book.genres.includes(genre.name))
        .map((genre) => genre.id),
    });
    window.scrollTo({ top: 380, behavior: "smooth" });
  }

  async function saveBook(event: FormEvent) {
    event.preventDefault();
    const body = {
      ...bookForm,
      isbn: bookForm.isbn || null,
      publicationYear: bookForm.publicationYear ? Number(bookForm.publicationYear) : null,
    };
    const saved = await mutate(
      editingId ? `/api/books/${editingId}` : "/api/books",
      editingId ? "PATCH" : "POST",
      body,
    );
    if (saved) {
      setBookForm(emptyBook);
      setEditingId(null);
    }
  }

  async function createLoan(event: FormEvent) {
    event.preventDefault();
    const saved = await mutate("/api/loans", "POST", {
      bookId: loanBookId,
      memberId: loanMemberId,
      dueAt: new Date(`${loanDueAt}T23:59:59`).toISOString(),
    });
    if (saved) {
      setLoanBookId("");
      setLoanMemberId("");
      setLoanDueAt("");
    }
  }

  const filteredBooks = data.books.filter(
    (b) =>
      b.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(filterQuery.toLowerCase()) ||
      b.genres.some((g) => g.toLowerCase().includes(filterQuery.toLowerCase())),
  );

  if (!authenticated) {
    return (
      <main className="admin-login">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            S<span>∩</span>B
          </span>
          <div className="brand-info">
            <strong>SetLib</strong>
            <small>LIBRARIAN DESK</small>
          </div>
        </Link>

        <form className="admin-login-card" onSubmit={signIn}>
          <p className="eyebrow">
            <span className="eyebrow-line" /> LIBRARIAN AUTHENTICATION
          </p>
          <h1>
            Welcome back,<br />
            <em>librarian.</em>
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>
            Sign in to manage catalog titles, configure genre sets, and record circulation loans.
          </p>

          <label htmlFor="admin-password">Librarian password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter password..."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="form-error" role="alert">
              ⚠️ {error}
            </p>
          )}

          <button className="primary-button" style={{ marginTop: 8 }}>
            Enter librarian desk <span aria-hidden="true">→</span>
          </button>
          <Link className="back-link" href="/" style={{ marginTop: 12 }}>
            ← Return to public catalog
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="site-header">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            S<span>∩</span>B
          </span>
          <div className="brand-info">
            <strong>SetLib</strong>
            <small>LIBRARIAN DESK</small>
          </div>
        </Link>
        <div className="admin-header-actions">
          <Link href="/" className="secondary-button" style={{ height: 38 }}>
            View catalog ↗
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/session", { method: "DELETE" });
              setAuthenticated(false);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-heading">
        <p className="eyebrow">
          <span className="eyebrow-line" /> CATALOG & CIRCULATION MANAGEMENT
        </p>
        <h1>
          The librarian <em>desk.</em>
        </h1>
        <p>
          Oversee catalog items, maintain taxonomy subsets, and synchronize the lending ledger.
        </p>
      </div>

      {message && (
        <p className="form-success" role="status">
          ✓ {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          ⚠️ {error}
        </p>
      )}

      {/* Admin Quick Metric Cards */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <span>Universe Size (B)</span>
          <strong>{data.books.length}</strong>
          <small style={{ color: "#64748b", fontSize: 12 }}>Total cataloged titles</small>
        </div>
        <div className="admin-stat-card">
          <span>Genre Subsets</span>
          <strong>{data.genres.length}</strong>
          <small style={{ color: "#64748b", fontSize: 12 }}>Active classifications</small>
        </div>
        <div className="admin-stat-card">
          <span>Active Loans (Vc)</span>
          <strong>{data.loans.filter((loan) => !loan.returnedAt).length}</strong>
          <small style={{ color: "#64748b", fontSize: 12 }}>Books currently off shelf</small>
        </div>
      </div>

      {/* Panel 1: Collection Management */}
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">
              <span>01</span> COLLECTION
            </span>
            <h2>{editingId ? "Edit book details" : "Add a new title"}</h2>
          </div>
          {editingId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingId(null);
                setBookForm(emptyBook);
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form className="admin-form" onSubmit={saveBook}>
          <label>
            Title
            <input
              required
              placeholder="e.g. Dune"
              value={bookForm.title}
              onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
            />
          </label>
          <label>
            Author
            <input
              required
              placeholder="e.g. Frank Herbert"
              value={bookForm.author}
              onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })}
            />
          </label>
          <label>
            ISBN
            <input
              placeholder="e.g. 978-0-441-17271-9"
              value={bookForm.isbn}
              onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })}
            />
          </label>
          <label>
            Publication year
            <input
              type="number"
              min="1000"
              max="2100"
              placeholder="e.g. 1965"
              value={bookForm.publicationYear}
              onChange={(event) =>
                setBookForm({ ...bookForm, publicationYear: event.target.value })
              }
            />
          </label>
          <label>
            Hardcover color
            <input
              type="color"
              value={bookForm.coverColor}
              onChange={(event) => setBookForm({ ...bookForm, coverColor: event.target.value })}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Cover Preview</span>
            <div
              style={{
                height: 44,
                backgroundColor: bookForm.coverColor,
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                fontFamily: "var(--font-serif)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {bookForm.title || "Book Title"}
            </div>
          </div>

          <label className="admin-wide">
            Description / Synopsis
            <textarea
              rows={3}
              placeholder="A brief summary of the book..."
              value={bookForm.description}
              onChange={(event) => setBookForm({ ...bookForm, description: event.target.value })}
            />
          </label>

          <fieldset className="admin-wide">
            <legend style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Genre membership (Select all that apply)
            </legend>
            <div className="admin-genre-select">
              {data.genres.map((genre) => (
                <label key={genre.id}>
                  <input
                    type="checkbox"
                    checked={bookForm.genreIds.includes(genre.id)}
                    onChange={(event) =>
                      setBookForm({
                        ...bookForm,
                        genreIds: event.target.checked
                          ? [...bookForm.genreIds, genre.id]
                          : bookForm.genreIds.filter((id) => id !== genre.id),
                      })
                    }
                  />
                  <span>{genre.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="admin-wide admin-form-actions">
            <button className="primary-button">
              {editingId ? "Save book changes" : "Add book to catalog"}
            </button>
            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setBookForm(emptyBook);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: 24, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontFamily: "var(--font-serif)" }}>
            Titles in Universe B ({data.books.length})
          </h3>
          <input
            type="search"
            placeholder="Filter books table..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 220 }}
          />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Genres</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((book) => (
                <tr key={book.id}>
                  <td>
                    <strong>{book.title}</strong>
                    {book.publicationYear && (
                      <span style={{ color: "#64748b", marginLeft: 6, fontSize: 11 }}>
                        ({book.publicationYear})
                      </span>
                    )}
                  </td>
                  <td>{book.author}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {book.genres.map((g) => (
                        <span
                          key={g}
                          style={{
                            padding: "2px 6px",
                            background: "#f1f5f9",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: book.available ? "#ecfdf5" : "#fffbeb",
                        color: book.available ? "#065f46" : "#92400e",
                      }}
                    >
                      {book.available ? "● Available" : "● On loan"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => startEdit(book)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-action danger-action"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete “${book.title}”?${
                              book.available
                                ? ""
                                : " This book has an active loan and its loan history will be deleted."
                            }`,
                          )
                        )
                          return;
                        const activeLoan = !book.available;
                        const confirmed = await mutate(
                          `/api/books/${book.id}${activeLoan ? "?confirmActiveLoan=true" : ""}`,
                          "DELETE",
                        );
                        if (confirmed !== null) setMessage("Book deleted from universe.");
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panel 2: Taxonomy Sets */}
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">
              <span>02</span> TAXONOMY
            </span>
            <h2>Genre subsets</h2>
          </div>
        </div>

        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await mutate("/api/genres", "POST", { name: genreName });
            if (saved) setGenreName("");
          }}
        >
          <label className="sr-only" htmlFor="new-genre">
            New genre name
          </label>
          <input
            id="new-genre"
            placeholder="Add new genre name..."
            value={genreName}
            onChange={(event) => setGenreName(event.target.value)}
            required
          />
          <button className="primary-button">Add genre set</button>
        </form>

        <div className="genre-admin-list">
          {data.genres.map((genre) => (
            <div key={genre.id} className="genre-admin-item">
              <span>
                <strong>{genre.name}</strong>
              </span>
              <div>
                <button
                  type="button"
                  className="table-action"
                  onClick={async () => {
                    const name = window.prompt("Edit genre name", genre.name);
                    if (name?.trim())
                      await mutate(`/api/genres/${genre.id}`, "PATCH", {
                        name: name.trim(),
                        description: genre.description,
                      });
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="table-action danger-action"
                  onClick={async () => {
                    if (window.confirm(`Delete ${genre.name}?`))
                      await mutate(`/api/genres/${genre.id}`, "DELETE");
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Panel 3: Circulation Management */}
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">
              <span>03</span> CIRCULATION
            </span>
            <h2>Loans & returns ledger</h2>
          </div>
        </div>

        <form className="admin-form loan-form" onSubmit={createLoan}>
          <label>
            Available book (V)
            <select
              required
              value={loanBookId}
              onChange={(event) => setLoanBookId(event.target.value)}
            >
              <option value="">Choose an available book…</option>
              {data.books
                .filter((book) => book.available)
                .map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} ({book.author})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Library member
            <select
              required
              value={loanMemberId}
              onChange={(event) => setLoanMemberId(event.target.value)}
            >
              <option value="">Choose a member…</option>
              {data.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Due return date
            <input
              type="date"
              required
              value={loanDueAt}
              onChange={(event) => setLoanDueAt(event.target.value)}
            />
          </label>
          <div className="admin-wide">
            <button className="primary-button">Create loan record</button>
          </div>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Member</th>
                <th>Loaned Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.loans.map((loan) => (
                <tr key={loan.id}>
                  <td>
                    <strong>{loan.book.title}</strong>
                  </td>
                  <td>{loan.member.name}</td>
                  <td>{new Date(loan.loanedAt).toLocaleDateString()}</td>
                  <td>{new Date(loan.dueAt).toLocaleDateString()}</td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: loan.returnedAt ? "#f1f5f9" : "#fffbeb",
                        color: loan.returnedAt ? "#64748b" : "#92400e",
                      }}
                    >
                      {loan.returnedAt ? "✓ Returned" : "● Active"}
                    </span>
                  </td>
                  <td>
                    {!loan.returnedAt && (
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => mutate(`/api/loans/${loan.id}/return`, "PATCH")}
                      >
                        Record return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="page-footer">
        <span>
          <strong>SETLIB</strong> · LIBRARIAN DESK
        </span>
        <span>Availability is synchronized with the circulation ledger.</span>
      </footer>
    </main>
  );
}
