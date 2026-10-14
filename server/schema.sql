-- ShelfSync — relational schema
--
-- The tables mirror the domain model in src/types/index.ts one-to-one, so the
-- browser store (src/context/LibraryContext.tsx) can be replaced by the REST
-- API in docs/API.md without reshaping the UI.
--
-- Written in portable SQL: it runs unchanged on PostgreSQL and SQLite. Ids are
-- the human-readable codes the application generates (BK-001, M-0001,
-- TXN-0001 ...), and dates are ISO YYYY-MM-DD.
--
-- Nothing that can be derived is stored: copies available, overdue days, queue
-- position and fine status all come from the views at the end of this file, so
-- inventory can never disagree with the loan ledger.

-- ---- Access ----------------------------------------------------------------

CREATE TABLE members (
  id          VARCHAR(12)  PRIMARY KEY,                 -- M-0001
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,             -- stored lower-case
  phone       VARCHAR(24)  NOT NULL DEFAULT '',
  department  VARCHAR(80)  NOT NULL DEFAULT '',
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('Student', 'Faculty', 'Staff')),
  status      VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  joined      DATE         NOT NULL
);

-- Login accounts. A member account points at its member row; staff accounts
-- have no member row.
CREATE TABLE users (
  id             VARCHAR(12)  PRIMARY KEY,
  email          VARCHAR(160) NOT NULL UNIQUE,
  password_salt  VARCHAR(32)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,               -- salted and stretched; the password itself is never stored
  -- Set when the desk issues a temporary password; cleared when the user chooses their own.
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_updated_on  DATE,
  role           VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'member')),
  member_id      VARCHAR(12)  UNIQUE REFERENCES members (id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  title          VARCHAR(80)  NOT NULL DEFAULT '',
  created_on     DATE         NOT NULL,
  CHECK ((role = 'member' AND member_id IS NOT NULL) OR (role = 'admin' AND member_id IS NULL))
);

-- ---- Catalog ---------------------------------------------------------------

CREATE TABLE categories (
  id           VARCHAR(12)  PRIMARY KEY,                -- CAT-01
  name         VARCHAR(80)  NOT NULL UNIQUE,
  description  VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE books (
  id            VARCHAR(12)  PRIMARY KEY,               -- BK-001
  title         VARCHAR(255) NOT NULL,
  author        VARCHAR(160) NOT NULL,
  isbn          VARCHAR(20)  NOT NULL UNIQUE,
  publisher     VARCHAR(160) NOT NULL DEFAULT '',
  year          INTEGER      NOT NULL,
  -- RESTRICT: a category cannot be deleted while books still use it.
  category_id   VARCHAR(12)  NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  subject       VARCHAR(160) NOT NULL DEFAULT '',
  description   TEXT         NOT NULL DEFAULT '',
  shelf         VARCHAR(16)  NOT NULL DEFAULT '',       -- Section-Rack-Shelf, e.g. B-07-3
  total_copies  INTEGER      NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  status        VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  cover         TEXT,                                   -- uploaded cover (URL or data URL)
  added_on      DATE         NOT NULL
);

CREATE INDEX idx_books_category ON books (category_id);
CREATE INDEX idx_books_title    ON books (title);
CREATE INDEX idx_books_author   ON books (author);

-- ---- Circulation -----------------------------------------------------------

-- One row per issue. return_date IS NULL while the copy is out.
-- History is kept when a title or member is removed, so the references are
-- nulled rather than cascaded; the API refuses to delete either while a loan
-- is still open.
CREATE TABLE loans (
  id           VARCHAR(12) PRIMARY KEY,                 -- TXN-0001
  book_id      VARCHAR(12) REFERENCES books (id)   ON DELETE SET NULL,
  member_id    VARCHAR(12) REFERENCES members (id) ON DELETE SET NULL,
  issue_date   DATE        NOT NULL,
  due_date     DATE        NOT NULL,
  return_date  DATE,
  renewals     INTEGER     NOT NULL DEFAULT 0 CHECK (renewals >= 0),  -- times the due date was extended
  CHECK (due_date >= issue_date),
  CHECK (return_date IS NULL OR return_date >= issue_date)
);

CREATE INDEX idx_loans_book   ON loans (book_id);
CREATE INDEX idx_loans_member ON loans (member_id);
CREATE INDEX idx_loans_open   ON loans (due_date) WHERE return_date IS NULL;
-- A member holds at most one copy of a title at a time.
CREATE UNIQUE INDEX uq_loans_open_copy ON loans (book_id, member_id) WHERE return_date IS NULL;

CREATE TABLE reservations (
  id           VARCHAR(12) PRIMARY KEY,                 -- RSV-0001
  book_id      VARCHAR(12) REFERENCES books (id)   ON DELETE SET NULL,
  member_id    VARCHAR(12) REFERENCES members (id) ON DELETE SET NULL,
  reserved_on  DATE        NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'waiting'
               CHECK (status IN ('waiting', 'ready', 'fulfilled', 'cancelled', 'expired')),
  ready_on     DATE,                                    -- copy set aside for pickup
  closed_on    DATE
);

CREATE INDEX idx_reservations_queue  ON reservations (book_id, reserved_on, id);
CREATE INDEX idx_reservations_member ON reservations (member_id);
-- One open reservation per member per title.
CREATE UNIQUE INDEX uq_reservations_open ON reservations (book_id, member_id)
  WHERE status IN ('waiting', 'ready');

-- ---- Fines & payments ------------------------------------------------------

CREATE TABLE fines (
  id            VARCHAR(12) PRIMARY KEY,                -- FIN-0001
  loan_id       VARCHAR(12) NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  member_id     VARCHAR(12) REFERENCES members (id) ON DELETE SET NULL,
  book_id       VARCHAR(12) REFERENCES books (id)   ON DELETE SET NULL,
  reason        VARCHAR(10) NOT NULL CHECK (reason IN ('overdue', 'damage')),
  overdue_days  INTEGER     NOT NULL DEFAULT 0 CHECK (overdue_days >= 0),
  rate          INTEGER     NOT NULL DEFAULT 0 CHECK (rate >= 0),  -- daily rate when the fine was raised
  amount        INTEGER     NOT NULL CHECK (amount >= 0),          -- whole rupees
  paid          INTEGER     NOT NULL DEFAULT 0 CHECK (paid >= 0),
  created_on    DATE        NOT NULL,
  CHECK (paid <= amount)
);

CREATE INDEX idx_fines_member ON fines (member_id);
CREATE INDEX idx_fines_loan   ON fines (loan_id);

-- fines.paid is the running total of this table; POST /fines/:id/payments
-- writes both in one transaction.
CREATE TABLE payments (
  id         VARCHAR(12) PRIMARY KEY,                   -- PAY-0001
  fine_id    VARCHAR(12) NOT NULL REFERENCES fines (id) ON DELETE RESTRICT,
  member_id  VARCHAR(12) REFERENCES members (id) ON DELETE SET NULL,
  amount     INTEGER     NOT NULL CHECK (amount > 0),
  method     VARCHAR(16) NOT NULL CHECK (method IN ('Cash', 'UPI', 'Card', 'Bank Transfer')),
  reference  VARCHAR(80) NOT NULL DEFAULT '',
  date       DATE        NOT NULL
);

CREATE INDEX idx_payments_fine ON payments (fine_id);
CREATE INDEX idx_payments_date ON payments (date);

-- ---- Damage ----------------------------------------------------------------

CREATE TABLE damage_reports (
  id              VARCHAR(12) PRIMARY KEY,              -- DMG-001
  book_id         VARCHAR(12) NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  member_id       VARCHAR(12) REFERENCES members (id) ON DELETE SET NULL,
  loan_id         VARCHAR(12) REFERENCES loans (id)   ON DELETE SET NULL,
  date            DATE        NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN
                  ('Torn pages', 'Water damage', 'Cover damage', 'Missing pages', 'Writing/marking', 'Other')),
  severity        VARCHAR(10) NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  description     TEXT        NOT NULL,
  repair_cost     INTEGER     NOT NULL DEFAULT 0 CHECK (repair_cost >= 0),
  notes           TEXT        NOT NULL DEFAULT '',
  status          VARCHAR(14) NOT NULL DEFAULT 'reported'
                  CHECK (status IN ('reported', 'under_review', 'under_repair', 'resolved')),
  -- True while the copy is pulled from circulation (High / Critical damage).
  copy_withdrawn  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_damage_book ON damage_reports (book_id);

CREATE TABLE damage_images (
  report_id  VARCHAR(12) NOT NULL REFERENCES damage_reports (id) ON DELETE CASCADE,
  position   INTEGER     NOT NULL,
  url        TEXT        NOT NULL,
  PRIMARY KEY (report_id, position)
);

-- Status history shown as the repair timeline.
CREATE TABLE damage_events (
  report_id  VARCHAR(12) NOT NULL REFERENCES damage_reports (id) ON DELETE CASCADE,
  position   INTEGER     NOT NULL,
  date       DATE        NOT NULL,
  status     VARCHAR(14) NOT NULL
             CHECK (status IN ('reported', 'under_review', 'under_repair', 'resolved')),
  note       TEXT        NOT NULL DEFAULT '',
  PRIMARY KEY (report_id, position)
);

-- ---- Notifications, activity feed, settings ----------------------------------

CREATE TABLE notifications (
  id         VARCHAR(12)  PRIMARY KEY,                  -- NTF-0001
  recipient  VARCHAR(12)  NOT NULL,                     -- member id, or 'admin' for the staff inbox
  title      VARCHAR(160) NOT NULL,
  message    TEXT         NOT NULL,
  tone       VARCHAR(10)  NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'success', 'warning', 'danger')),
  date       DATE         NOT NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  link       VARCHAR(160),
  -- Set on automated reminders (e.g. 'overdue:TXN-0179:2026-09-29') so the daily job never sends one twice.
  dedupe_key VARCHAR(64)  UNIQUE
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient, is_read);

CREATE TABLE activity (
  id    VARCHAR(12) PRIMARY KEY,                        -- ACT-0001
  kind  VARCHAR(12) NOT NULL CHECK (kind IN ('issue', 'return', 'renewal', 'reservation', 'payment', 'damage')),
  text  TEXT        NOT NULL,
  date  DATE        NOT NULL
);

-- Single-row table.
CREATE TABLE settings (
  id                    INTEGER      PRIMARY KEY CHECK (id = 1),
  library_name          VARCHAR(120) NOT NULL DEFAULT 'Central Library',
  fine_rate_per_day     INTEGER      NOT NULL DEFAULT 5  CHECK (fine_rate_per_day >= 0),
  grace_days            INTEGER      NOT NULL DEFAULT 0  CHECK (grace_days >= 0),
  loan_period_days      INTEGER      NOT NULL DEFAULT 14 CHECK (loan_period_days >= 1),
  max_loans_per_member  INTEGER      NOT NULL DEFAULT 5  CHECK (max_loans_per_member >= 1),
  hold_days             INTEGER      NOT NULL DEFAULT 3  CHECK (hold_days >= 1),
  max_renewals          INTEGER      NOT NULL DEFAULT 2  CHECK (max_renewals >= 0),   -- 0 switches renewals off
  reminder_days         INTEGER      NOT NULL DEFAULT 2  CHECK (reminder_days >= 0)   -- due-date reminder lead time
);

INSERT INTO settings (id) VALUES (1);

-- ---- Derived views ---------------------------------------------------------

-- Copies per title: same arithmetic as getInventory() in src/domain/selectors.ts.
CREATE VIEW book_inventory AS
SELECT
  i.book_id,
  i.total,
  i.issued,
  i.reserved,
  i.damaged,
  CASE WHEN i.total - i.damaged - i.issued - i.reserved > 0
       THEN i.total - i.damaged - i.issued - i.reserved ELSE 0 END AS available
FROM (
  SELECT
    b.id           AS book_id,
    b.total_copies AS total,
    (SELECT COUNT(*) FROM loans l
      WHERE l.book_id = b.id AND l.return_date IS NULL) AS issued,
    (SELECT COUNT(*) FROM reservations r
      WHERE r.book_id = b.id AND r.status = 'ready') AS reserved,
    CASE WHEN (SELECT COUNT(*) FROM damage_reports d
                WHERE d.book_id = b.id AND d.copy_withdrawn AND d.status <> 'resolved') > b.total_copies
         THEN b.total_copies
         ELSE (SELECT COUNT(*) FROM damage_reports d
                WHERE d.book_id = b.id AND d.copy_withdrawn AND d.status <> 'resolved') END AS damaged
  FROM books b
) i;

-- Open reservations with their 1-based place in the queue.
CREATE VIEW reservation_queue AS
SELECT
  r.*,
  ROW_NUMBER() OVER (PARTITION BY r.book_id ORDER BY r.reserved_on, r.id) AS position
FROM reservations r
WHERE r.status IN ('waiting', 'ready');

CREATE VIEW fine_ledger AS
SELECT
  f.*,
  f.amount - f.paid AS balance,
  CASE WHEN f.paid >= f.amount THEN 'paid'
       WHEN f.paid > 0         THEN 'partial'
       ELSE 'pending' END AS status
FROM fines f;
