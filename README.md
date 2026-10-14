# ShelfSync — Smart Library Management System

A library management web app with two workspaces: one for librarians (catalog,
members, issue, renew and return, reservations, fines, damage reports,
analytics) and one for members (discover books, track and renew loans, reserve,
view fines).

Built with React 18, TypeScript, Vite, Tailwind CSS, Recharts and jsPDF.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | Type-check only |

## Sign in

The login page has one-click demo accounts. Every sample account starts with
the password `library123`.

| Role | Sign in with |
|---|---|
| Administrator | `admin@shelfsync.demo` |
| Library member | `member@shelfsync.demo`, or any member's email or ID (`M-1001` … `M-1016`) |

For presentations, `/login?demo=admin` and `/login?demo=member` sign straight in.

Passwords are checked, and stored only as a salted hash:

- **Registering** on the site sets your own password (at least 8 characters).
- **A member added by a librarian** gets a temporary password, shown once to the
  librarian, and is asked to replace it after signing in.
- **Changing a password**: members under Profile, the librarian under Settings.
- **Forgotten password**: the member confirms their member ID, email and phone
  number and chooses a new one, or a librarian issues a temporary password from
  the member's page.

If a demo account's password is changed and lost, **Restore sample data** on
the login page puts everything back.

## How the data works

This release has no server. The app starts from sample data
([src/data/seed.ts](src/data/seed.ts)) and saves every change to the browser's
`localStorage`, so data is per browser and is not shared between devices.

- **Settings → Back up** downloads the whole library as one JSON file, and
  **Restore** loads such a file — the way to move the data to another computer.
- **Settings → Reset demo data** restores the sample data. It is also refreshed
  at the start of each calendar month so the sample dates stay current.

Because everything runs in the browser, the password check decides who the app
lets in but is not real security: anyone who can open the browser's developer
tools can read or change the stored data. Proper protection needs the server
described below.

The path to a real backend is laid out but not built:

- [server/schema.sql](server/schema.sql) — the relational schema (PostgreSQL or SQLite).
- [docs/API.md](docs/API.md) — the REST contract, endpoint by endpoint.

## Project layout

```
src/
  pages/        One file per screen: admin/, member/, auth/, shared/
  components/   ui/ (buttons, tables, charts, forms), shared/ (book and member widgets), layout/
  domain/       Business rules — actions.ts (writes), auth.ts (passwords), selectors.ts
                (derived values), backup.ts, reports.ts and analytics.ts
  context/      LibraryContext (data store), AuthContext (session), ToastContext
  data/seed.ts  Sample data
  lib/          Dates and formatting, hashing, permissions, CSV/PDF export
  types/        The domain model
server/schema.sql
docs/API.md
```

All business rules live in `src/domain/` as pure functions that take the
database and return the next one, which is what the API document maps its
endpoints onto.

## Library rules

Defaults, all editable under **Settings**:

| Rule | Default |
|---|---|
| Loan period | 14 days |
| Maximum loans per member | 5 |
| Renewals per loan | 2 |
| Fine per overdue day | ₹5 |
| Grace period | 0 days |
| Due-date reminder | 2 days ahead |
| Reservation hold | 3 days |

- Fine = overdue days (after the grace period) × the daily rate, raised when the book is returned.
- Copies available = total − issued − held for pickup − withdrawn for repair. It is always calculated, never stored.
- A renewal adds one loan period to the due date. It is refused if the loan is overdue, has reached the renewal limit, or another member is waiting for the title.
- Members are reminded in the app when a loan is nearly due and again when it becomes overdue.
- Reservations are served first come, first served. When a copy comes back, the librarian notifies the next member and the copy is held for them.
- Damage rated High or Critical takes the copy out of circulation until the report is resolved.

## Design

The interface is built around a library rather than a generic dashboard:
chapters and a table of contents instead of a sidebar, catalogue-card
typography, stamped status labels, and frosted-glass panels over a softly lit
backdrop. The theme lives in [tailwind.config.js](tailwind.config.js) and
[src/index.css](src/index.css).

## Not in this release

Barcode and RFID scanning, SMS and email notifications (including emailed
password-reset links), e-book lending, and semantic search are planned for
Phase 2.
