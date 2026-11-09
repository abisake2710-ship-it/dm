# SetLib — A Library Catalog Built on Set Theory

SetLib is a responsive library catalog that makes set theory visible in everyday searching. The catalog is the universe `B`; genres are subsets of `B`; and `V` is the subset of available books. Searches show both their books and the expression that produced them.

## Requirements

- Node.js 24.12 or later
- npm
- Google Cloud CLI for local development against a secured database

## Firebase setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`. Set a private `ADMIN_PASSWORD` and `FIREBASE_DATABASE_URL` to the URL shown in Realtime Database settings. Keep `.env` out of source control.

3. In the Firebase console, create or enable a Realtime Database and App Hosting for project `nirbhaya-9e457`, and upgrade the project to the Blaze plan. The App Hosting runtime service account needs the **Firebase Realtime Database Admin** role.

4. For local development, the app uses the seeded SQLite database when Google Cloud credentials are not configured. To exercise Realtime Database locally, sign in with Google Cloud Application Default Credentials:

   ```sh
   gcloud auth application-default login
   ```

5. To copy the existing local SQLite catalog to an empty Realtime Database, create and seed the local source database, authenticate with Google Cloud CLI as in step 4, then run the one-time migration:

   ```sh
   npm run db:setup
   npm run db:migrate:rtdb
   ```

   The migration preserves book, genre, member, loan, and availability data. It refuses to overwrite Realtime Database data at those paths.

6. Create the `admin-password` secret for App Hosting and deploy:

   ```sh
   firebase apphosting:secrets:set admin-password --force
   firebase init apphosting
   firebase deploy --only database
   firebase deploy --only apphosting:setlib
   ```

   When prompted, use project `nirbhaya-9e457`, select or create the `setlib` backend, choose a region, and select Node.js 24. Enter a strong librarian password when creating the secret. App Hosting requires the Blaze plan. Firebase CLI local-source deployment requires version 14.4.0 or later.

7. Start the app locally:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Without local Google credentials, this uses SQLite; App Hosting uses Realtime Database. The librarian desk is at `/admin`.

Realtime Database rules deny direct browser access. The server uses the Firebase Admin SDK, which authenticates using Application Default Credentials locally and the App Hosting runtime service account in production. The SQLite database is retained as a local source for the one-time Realtime Database migration.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler |
| `npm test` | Run unit tests and SQLite-backed loan integration tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run db:setup` | Create and seed the local SQLite catalog for migration |
| `npm run db:migrate:rtdb` | Copy the local SQLite catalog to Realtime Database |

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
