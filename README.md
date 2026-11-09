# SetLib — A Library Catalog Built on Set Theory

SetLib is a responsive library catalog that makes set theory visible in everyday searching. The catalog is the universe `B`; genres are subsets of `B`; and `V` is the subset of available books. Searches show both their books and the expression that produced them.

## Requirements

- Node.js 20.9 or later
- npm

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`. Set a private `ADMIN_PASSWORD` for your local librarian account. Keep `.env` out of source control.

3. Create the SQLite database, apply the Prisma migration, and seed the catalog:

   ```sh
   npm run db:setup
   ```

   The seed command is deterministic and resets the local catalog to exactly 25 books, 11 genres, 6 members, and 16 loans (10 active and 6 returned). Use it only when you want to restore the sample data.

4. Start the development server:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The librarian desk is at `/admin`.

The SQLite file is created under `prisma/dev.db`. For manual database commands, use `npm run db:migrate -- --name <migration-name>`, `npm run db:generate`, and `npm run db:seed`.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler |
| `npm test` | Run unit and database integration tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run db:setup` | Apply migrations and reset/seed the sample data |

Run `npx playwright install chromium` once before the browser tests if Playwright's Chromium browser is not installed.

## The set-theory model

- `B` — every book in the catalog.
- A genre such as Fiction (`F`) or Science Fiction (`S`) — a subset of `B`.
- `V` — books with no active loan.
- `Vc` — the complement of `V` in `B`, or books on loan.
- `∩` — intersection; books belonging to both sets.
- `∪` — union; books belonging to either or both sets.
- `∖` — difference; members of the first set but not the second.
- `△` — symmetric difference; members of exactly one set.
- `T("words")` — title/author text match, applied as an additional filter.

Set operation applies to the selected genre sets first. Availability then intersects that result with `V` or `Vc`. Text matching is applied last. Difference and symmetric difference require exactly two selected genres; the interface explains this rather than silently changing the operation. For three or more genres, intersection and union are folded from left to right.

### Worked examples

The seeded data gives these expected expressions and results:

| Search | Expression | Expected |
| --- | --- | --- |
| Science Fiction and available | `S ∩ V` | 9 books |
| Fiction or Science Fiction | `F ∪ S` | 25 books |
| Fiction but not Science Fiction | `F ∖ S` | 13 books |
| Exactly one of Fiction or Science Fiction | `F △ S` | 13 books |
| On loan | `Vc` | 10 books |

For two genres the panel also presents the counts of each set and their shared region. The union follows inclusion–exclusion: `|A ∪ B| = |A| + |B| - |A ∩ B|`.

## Data model and API

Prisma models books, genres, the many-to-many `BookGenre` relation, members, and loans. Loan creation and return run transactionally and synchronize `Book.available` with active loans. API request bodies are validated using Zod.

Catalog routes:

- `GET /api/books` and `GET /api/books/[id]`
- `POST /api/books`, `PATCH /api/books/[id]`, `DELETE /api/books/[id]`
- `GET /api/genres`, `POST /api/genres`, `PATCH /api/genres/[id]`, `DELETE /api/genres/[id]`
- `GET /api/loans`, `POST /api/loans`, `PATCH /api/loans/[id]/return`
- `GET /api/members`, `POST /api/members`

Book and genre catalog reads are public. Loan/member reads and all write routes require an admin session; the password is read from `ADMIN_PASSWORD`. Deleting a book with an active loan requires explicit confirmation, and the admin UI asks before doing so.

## Tests

`npm test` covers the generic set operations, all five worked set examples, query validation and expression/result consistency, Zod request validation, and loan/availability synchronization against the migrated SQLite database. `npm run test:e2e` verifies the rendered expression, set-result membership, and availability complement in the browser.

## Screenshots

_Screenshots can be added here._
