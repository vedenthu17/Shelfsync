import type {
  Book,
  Category,
  DamageReport,
  DamageSeverity,
  DamageStatus,
  DamageType,
  Database,
  Fine,
  Loan,
  Member,
  Payment,
  PaymentMethod,
  Reservation,
  Settings,
} from '@/types';
import { addDays, daysBetween, formatCurrency, formatDate, nextId, plural, today } from '@/lib/utils';
import { generateTemporaryPassword, makeAccount, validatePassword } from './auth';
import { withActivity, withNotification } from './journal';
import { fineBalance, getInventory, getQueue, isActive, overdueDays } from './selectors';

// Write-side business rules. Each function takes the current database and
// returns the next one (never mutating), throwing an Error whose message is
// safe to show to the user when a rule is violated. These map one-to-one onto
// the REST endpoints listed in docs/API.md.

const ADMIN = 'admin';

function requireBook(db: Database, id: string): Book {
  const book = db.books.find((b) => b.id === id);
  if (!book) throw new Error('Book not found.');
  return book;
}

function requireMember(db: Database, id: string): Member {
  const member = db.members.find((m) => m.id === id);
  if (!member) throw new Error('Member not found.');
  return member;
}

// ---- Circulation -----------------------------------------------------------

/** Why this member cannot be issued this book right now, or null if they can. */
export function issueBlocker(db: Database, memberId: string, bookId: string): string | null {
  const member = db.members.find((m) => m.id === memberId);
  const book = db.books.find((b) => b.id === bookId);
  if (!member || !book) return 'Select a member and a book.';
  if (member.status === 'suspended') return `${member.name}'s membership is suspended.`;
  if (book.status === 'archived') return 'This title is archived and cannot be issued.';

  const active = db.loans.filter((l) => l.memberId === memberId && isActive(l));
  if (active.some((l) => l.bookId === bookId)) return `${member.name} already has a copy of this book.`;
  if (active.length >= db.settings.maxLoansPerMember) {
    return `Loan limit reached (${db.settings.maxLoansPerMember} books per member).`;
  }

  const hasHold = db.reservations.some(
    (r) => r.bookId === bookId && r.memberId === memberId && r.status === 'ready',
  );
  if (!hasHold && getInventory(db, book).available === 0) return 'No copies are available to issue.';
  return null;
}

export function issueBook(db: Database, input: { memberId: string; bookId: string }): { db: Database; loan: Loan } {
  const blocker = issueBlocker(db, input.memberId, input.bookId);
  if (blocker) throw new Error(blocker);
  const member = requireMember(db, input.memberId);
  const book = requireBook(db, input.bookId);

  const issueDate = today();
  const loan: Loan = {
    id: nextId('TXN', db.loans.map((l) => l.id)),
    bookId: book.id,
    memberId: member.id,
    issueDate,
    dueDate: addDays(issueDate, db.settings.loanPeriodDays),
  };

  // Issuing closes the member's open reservation for this title, if any.
  const reservations = db.reservations.map((r) =>
    r.bookId === book.id && r.memberId === member.id && (r.status === 'ready' || r.status === 'waiting')
      ? { ...r, status: 'fulfilled' as const, closedOn: issueDate }
      : r,
  );

  let next: Database = { ...db, loans: [loan, ...db.loans], reservations };
  next = withActivity(next, 'issue', `"${book.title}" issued to ${member.name}`);
  next = withNotification(
    next,
    member.id,
    'Book issued',
    `"${book.title}" has been issued to you. It is due on ${formatDate(loan.dueDate)}.`,
    'info',
    '/member/books',
  );
  return { db: next, loan };
}

export interface ReturnDamageInput {
  type: DamageType;
  severity: DamageSeverity;
  description: string;
  repairCost: number;
  images: string[];
  chargeMember: boolean;
}

export interface ReturnResult {
  db: Database;
  fine: Fine | null;
  damageFine: Fine | null;
  /** Head of the waiting queue for this title, when a copy is now free for them. */
  nextReservation: Reservation | null;
}

export function returnBook(db: Database, input: { loanId: string; damage?: ReturnDamageInput }): ReturnResult {
  const loan = db.loans.find((l) => l.id === input.loanId);
  if (!loan) throw new Error('Transaction not found.');
  if (!isActive(loan)) throw new Error('This book has already been returned.');
  const book = requireBook(db, loan.bookId);
  const member = requireMember(db, loan.memberId);

  const returnDate = today();
  const returned: Loan = { ...loan, returnDate };
  let next: Database = { ...db, loans: db.loans.map((l) => (l.id === loan.id ? returned : l)) };

  let fine: Fine | null = null;
  const lateDays = overdueDays(returned, db.settings);
  if (lateDays > 0) {
    fine = {
      id: nextId('FIN', next.fines.map((f) => f.id)),
      loanId: loan.id,
      memberId: member.id,
      bookId: book.id,
      reason: 'overdue',
      overdueDays: lateDays,
      rate: db.settings.fineRatePerDay,
      amount: lateDays * db.settings.fineRatePerDay,
      paid: 0,
      createdOn: returnDate,
    };
    next = { ...next, fines: [fine, ...next.fines] };
  }

  let damageFine: Fine | null = null;
  if (input.damage) {
    const d = input.damage;
    const report = buildDamageReport(next, {
      bookId: book.id,
      memberId: member.id,
      loanId: loan.id,
      date: returnDate,
      type: d.type,
      severity: d.severity,
      description: d.description,
      repairCost: d.repairCost,
      images: d.images,
      notes: '',
    });
    next = { ...next, damage: [report, ...next.damage] };
    next = withActivity(next, 'damage', `${d.severity} damage reported on "${book.title}"`);
    if (d.chargeMember && d.repairCost > 0) {
      damageFine = {
        id: nextId('FIN', next.fines.map((f) => f.id)),
        loanId: loan.id,
        memberId: member.id,
        bookId: book.id,
        reason: 'damage',
        overdueDays: 0,
        rate: 0,
        amount: d.repairCost,
        paid: 0,
        createdOn: returnDate,
      };
      next = { ...next, fines: [damageFine, ...next.fines] };
    }
  }

  next = withActivity(next, 'return', `${member.name} returned "${book.title}"`);
  const owed = (fine?.amount ?? 0) + (damageFine?.amount ?? 0);
  next = withNotification(
    next,
    member.id,
    'Book return processed successfully',
    owed > 0
      ? `"${book.title}" was returned. A charge of ${formatCurrency(owed)} has been added to your account.`
      : `"${book.title}" was returned on time. Thank you!`,
    owed > 0 ? 'warning' : 'success',
    owed > 0 ? '/member/fines' : '/member/books',
  );

  const freeCopy = getInventory(next, book).available > 0;
  const nextReservation = freeCopy ? getQueue(next, book.id).find((r) => r.status === 'waiting') ?? null : null;
  if (nextReservation) {
    next = withNotification(
      next,
      ADMIN,
      'Book available — notify next member in queue',
      `"${book.title}" was returned and has a waiting reservation.`,
      'info',
      '/admin/reservations',
    );
  }

  return { db: next, fine, damageFine, nextReservation };
}

/** Why this loan cannot be renewed right now, or null if it can. */
export function renewBlocker(db: Database, loanId: string): string | null {
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) return 'Transaction not found.';
  if (!isActive(loan)) return 'This book has already been returned.';
  const limit = db.settings.maxRenewals;
  if (limit === 0) return 'This library does not allow renewals.';
  if (db.members.find((m) => m.id === loan.memberId)?.status === 'suspended') return 'Suspended members cannot renew loans.';
  if (overdueDays(loan, db.settings) > 0) return 'This book is overdue and must be returned.';
  if ((loan.renewals ?? 0) >= limit) return `Already renewed ${plural(limit, 'time')} — the limit for one loan.`;
  if (getQueue(db, loan.bookId).some((r) => r.status === 'waiting')) return 'Another member is waiting for this book.';
  return null;
}

/** Extend a loan by one more loan period, counted from its current due date. */
export function renewLoan(db: Database, loanId: string): { db: Database; loan: Loan } {
  const blocker = renewBlocker(db, loanId);
  if (blocker) throw new Error(blocker);
  const current = db.loans.find((l) => l.id === loanId)!;
  const book = requireBook(db, current.bookId);
  const member = requireMember(db, current.memberId);

  const loan: Loan = {
    ...current,
    dueDate: addDays(current.dueDate, db.settings.loanPeriodDays),
    renewals: (current.renewals ?? 0) + 1,
  };
  let next: Database = { ...db, loans: db.loans.map((l) => (l.id === loanId ? loan : l)) };
  next = withActivity(next, 'renewal', `${member.name} renewed "${book.title}"`);
  next = withNotification(
    next,
    member.id,
    'Loan renewed',
    `"${book.title}" is now due on ${formatDate(loan.dueDate)}.`,
    'success',
    '/member/books',
  );
  return { db: next, loan };
}

// ---- Reservations ----------------------------------------------------------

export function createReservation(
  db: Database,
  input: { memberId: string; bookId: string },
): { db: Database; reservation: Reservation } {
  const member = requireMember(db, input.memberId);
  const book = requireBook(db, input.bookId);
  if (member.status === 'suspended') throw new Error('Suspended members cannot place reservations.');
  if (book.status === 'archived') throw new Error('This title is archived.');
  if (db.reservations.some((r) => r.bookId === book.id && r.memberId === member.id && (r.status === 'waiting' || r.status === 'ready'))) {
    throw new Error('There is already an open reservation for this book.');
  }
  if (db.loans.some((l) => l.bookId === book.id && l.memberId === member.id && isActive(l))) {
    throw new Error('This member currently has this book on loan.');
  }

  // A free copy is set aside straight away (a pickup request); otherwise the
  // member joins the back of the queue.
  const copyFree = getInventory(db, book).available > 0 && getQueue(db, book.id).length === 0;
  const reservation: Reservation = {
    id: nextId('RSV', db.reservations.map((r) => r.id)),
    bookId: book.id,
    memberId: member.id,
    reservedOn: today(),
    status: copyFree ? 'ready' : 'waiting',
    readyOn: copyFree ? today() : undefined,
  };

  let next: Database = { ...db, reservations: [...db.reservations, reservation] };
  next = withActivity(
    next,
    'reservation',
    copyFree ? `${member.name} requested pickup of "${book.title}"` : `${member.name} joined the queue for "${book.title}"`,
  );
  return { db: next, reservation };
}

/** Set a free copy aside for the next waiting member and tell them. */
export function notifyNextInQueue(db: Database, bookId: string): { db: Database; reservation: Reservation } {
  const book = requireBook(db, bookId);
  const head = getQueue(db, bookId).find((r) => r.status === 'waiting');
  if (!head) throw new Error('No one is waiting for this book.');
  if (getInventory(db, book).available === 0) throw new Error('No copy is free to set aside yet.');

  const ready: Reservation = { ...head, status: 'ready', readyOn: today() };
  let next: Database = { ...db, reservations: db.reservations.map((r) => (r.id === head.id ? ready : r)) };
  next = withNotification(
    next,
    head.memberId,
    'Your reserved book is now available',
    `"${book.title}" is being held for you. Collect it by ${formatDate(addDays(today(), db.settings.holdDays))}.`,
    'success',
    '/member/reservations',
  );
  return { db: next, reservation: ready };
}

export function closeReservation(db: Database, id: string, status: 'cancelled' | 'expired'): Database {
  const reservation = db.reservations.find((r) => r.id === id);
  if (!reservation) throw new Error('Reservation not found.');
  if (reservation.status !== 'waiting' && reservation.status !== 'ready') {
    throw new Error('This reservation is already closed.');
  }
  return {
    ...db,
    reservations: db.reservations.map((r) => (r.id === id ? { ...r, status, closedOn: today() } : r)),
  };
}

// ---- Fines & payments ------------------------------------------------------

export interface PaymentInput {
  fineId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  date: string;
}

export function recordPayment(db: Database, input: PaymentInput): { db: Database; payment: Payment } {
  const fine = db.fines.find((f) => f.id === input.fineId);
  if (!fine) throw new Error('Fine not found.');
  const balance = fineBalance(fine);
  if (!(input.amount > 0)) throw new Error('Enter an amount greater than zero.');
  if (input.amount > balance) throw new Error(`Amount exceeds the balance due (${formatCurrency(balance)}).`);

  const member = requireMember(db, fine.memberId);
  const payment: Payment = {
    id: nextId('PAY', db.payments.map((p) => p.id)),
    fineId: fine.id,
    memberId: fine.memberId,
    amount: input.amount,
    method: input.method,
    reference: input.reference.trim(),
    date: input.date,
  };
  let next: Database = {
    ...db,
    payments: [payment, ...db.payments],
    fines: db.fines.map((f) => (f.id === fine.id ? { ...f, paid: f.paid + input.amount } : f)),
  };
  next = withActivity(next, 'payment', `${member.name} paid ${formatCurrency(input.amount)} (${input.method})`);
  const remaining = balance - input.amount;
  next = withNotification(
    next,
    member.id,
    'Payment received',
    remaining > 0
      ? `We received ${formatCurrency(input.amount)}. ${formatCurrency(remaining)} is still due on this fine.`
      : `We received ${formatCurrency(input.amount)}. This fine is fully paid.`,
    'success',
    '/member/fines',
  );
  return { db: next, payment };
}

// ---- Catalog ---------------------------------------------------------------

export type BookInput = Omit<Book, 'id' | 'addedOn'>;

function validateBook(db: Database, input: BookInput, ignoreId?: string): void {
  if (!input.title.trim()) throw new Error('Title is required.');
  if (!input.author.trim()) throw new Error('Author is required.');
  if (!input.isbn.trim()) throw new Error('ISBN is required.');
  if (!Number.isInteger(input.totalCopies) || input.totalCopies < 0) {
    throw new Error('Total copies must be a whole number.');
  }
  if (db.books.some((b) => b.id !== ignoreId && b.isbn.trim() === input.isbn.trim())) {
    throw new Error('Another book already uses this ISBN.');
  }
}

export function addBook(db: Database, input: BookInput): { db: Database; book: Book } {
  validateBook(db, input);
  const book: Book = { ...input, id: nextId('BK', db.books.map((b) => b.id), 3), addedOn: today() };
  return { db: { ...db, books: [book, ...db.books] }, book };
}

export function updateBook(db: Database, id: string, input: BookInput): Database {
  const current = requireBook(db, id);
  validateBook(db, input, id);
  const inv = getInventory(db, current);
  const committed = inv.issued + inv.reserved + inv.damaged;
  if (input.totalCopies < committed) {
    throw new Error(`Total copies cannot be less than ${committed} (issued, held or under repair).`);
  }
  return { ...db, books: db.books.map((b) => (b.id === id ? { ...b, ...input } : b)) };
}

export function deleteBook(db: Database, id: string): Database {
  const book = requireBook(db, id);
  if (db.loans.some((l) => l.bookId === id && isActive(l))) {
    throw new Error(`"${book.title}" has copies on loan and cannot be deleted.`);
  }
  return {
    ...db,
    books: db.books.filter((b) => b.id !== id),
    reservations: db.reservations.map((r) =>
      r.bookId === id && (r.status === 'waiting' || r.status === 'ready')
        ? { ...r, status: 'cancelled' as const, closedOn: today() }
        : r,
    ),
  };
}

export function importBooks(db: Database, rows: BookInput[]): { db: Database; added: number; skipped: number } {
  let next = db;
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      next = addBook(next, row).db;
      added++;
    } catch {
      skipped++;
    }
  }
  return { db: next, added, skipped };
}

export function saveCategory(db: Database, input: { id?: string; name: string; description: string }): Database {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required.');
  if (db.categories.some((c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A category with this name already exists.');
  }
  if (!input.id) {
    const category: Category = {
      id: nextId('CAT', db.categories.map((c) => c.id), 2),
      name,
      description: input.description.trim(),
    };
    return { ...db, categories: [...db.categories, category] };
  }
  const previous = db.categories.find((c) => c.id === input.id);
  if (!previous) throw new Error('Category not found.');
  return {
    ...db,
    categories: db.categories.map((c) =>
      c.id === input.id ? { ...c, name, description: input.description.trim() } : c,
    ),
    // Books reference categories by name, so a rename follows through.
    books: db.books.map((b) => (b.category === previous.name ? { ...b, category: name } : b)),
  };
}

export function deleteCategory(db: Database, id: string): Database {
  const category = db.categories.find((c) => c.id === id);
  if (!category) throw new Error('Category not found.');
  const inUse = db.books.filter((b) => b.category === category.name).length;
  if (inUse > 0) throw new Error(`${inUse} book(s) still use "${category.name}". Reassign them first.`);
  return { ...db, categories: db.categories.filter((c) => c.id !== id) };
}

// ---- Members ---------------------------------------------------------------

export type MemberInput = Omit<Member, 'id' | 'joined'>;

function validateMember(db: Database, input: MemberInput, ignoreId?: string): void {
  if (!input.name.trim()) throw new Error('Name is required.');
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new Error('Enter a valid email address.');
  if (db.members.some((m) => m.id !== ignoreId && m.email.toLowerCase() === input.email.trim().toLowerCase())) {
    throw new Error('A member with this email already exists.');
  }
}

/**
 * Register a member. Someone signing themselves up supplies a password; when
 * the desk registers them, a temporary one is generated and handed back so it
 * can be passed on.
 */
export function addMember(
  db: Database,
  input: MemberInput,
  password?: string,
): { db: Database; member: Member; temporaryPassword?: string } {
  validateMember(db, input);
  if (password !== undefined) validatePassword(password);
  const member: Member = {
    ...input,
    email: input.email.trim(),
    id: nextId('M', db.members.map((m) => m.id)),
    joined: today(),
  };
  const temporaryPassword = password === undefined ? generateTemporaryPassword() : undefined;
  const account = makeAccount(member.id, password ?? temporaryPassword!, { temporary: password === undefined });
  return {
    db: { ...db, members: [member, ...db.members], accounts: [...db.accounts, account] },
    member,
    temporaryPassword,
  };
}

export function updateMember(db: Database, id: string, input: MemberInput): Database {
  requireMember(db, id);
  validateMember(db, input, id);
  return { ...db, members: db.members.map((m) => (m.id === id ? { ...m, ...input, email: input.email.trim() } : m)) };
}

export function setMemberStatus(db: Database, id: string, status: Member['status']): Database {
  const member = requireMember(db, id);
  let next: Database = { ...db, members: db.members.map((m) => (m.id === id ? { ...m, status } : m)) };
  next = withNotification(
    next,
    member.id,
    status === 'suspended' ? 'Membership suspended' : 'Membership reinstated',
    status === 'suspended'
      ? 'Your borrowing privileges are on hold. Please contact the library desk.'
      : 'Your borrowing privileges have been restored.',
    status === 'suspended' ? 'danger' : 'success',
  );
  return next;
}

export function deleteMember(db: Database, id: string): Database {
  const member = requireMember(db, id);
  if (db.loans.some((l) => l.memberId === id && isActive(l))) {
    throw new Error(`${member.name} still has books on loan.`);
  }
  if (db.fines.some((f) => f.memberId === id && fineBalance(f) > 0)) {
    throw new Error(`${member.name} has unpaid fines.`);
  }
  return {
    ...db,
    members: db.members.filter((m) => m.id !== id),
    accounts: db.accounts.filter((a) => a.id !== id),
    reservations: db.reservations.map((r) =>
      r.memberId === id && (r.status === 'waiting' || r.status === 'ready')
        ? { ...r, status: 'cancelled' as const, closedOn: today() }
        : r,
    ),
  };
}

// ---- Damage ----------------------------------------------------------------

export interface DamageInput {
  bookId: string;
  memberId?: string;
  loanId?: string;
  date: string;
  type: DamageType;
  severity: DamageSeverity;
  description: string;
  repairCost: number;
  images: string[];
  notes: string;
}

function buildDamageReport(db: Database, input: DamageInput): DamageReport {
  return {
    ...input,
    id: nextId('DMG', db.damage.map((d) => d.id), 3),
    status: 'reported',
    // Badly damaged copies come off the shelf until they are repaired.
    copyWithdrawn: input.severity === 'High' || input.severity === 'Critical',
    timeline: [{ date: input.date, status: 'reported', note: 'Damage reported.' }],
  };
}

export function addDamageReport(db: Database, input: DamageInput): { db: Database; report: DamageReport } {
  const book = requireBook(db, input.bookId);
  if (!input.description.trim()) throw new Error('Describe the damage.');
  const report = buildDamageReport(db, input);
  let next: Database = { ...db, damage: [report, ...db.damage] };
  next = withActivity(next, 'damage', `${input.severity} damage reported on "${book.title}"`);
  return { db: next, report };
}

export function updateDamageStatus(
  db: Database,
  id: string,
  input: { status: DamageStatus; note: string; repairCost?: number },
): Database {
  const report = db.damage.find((d) => d.id === id);
  if (!report) throw new Error('Damage report not found.');
  return {
    ...db,
    damage: db.damage.map((d) =>
      d.id === id
        ? {
            ...d,
            status: input.status,
            repairCost: input.repairCost ?? d.repairCost,
            notes: input.note.trim() || d.notes,
            timeline: [
              ...d.timeline,
              { date: today(), status: input.status, note: input.note.trim() || 'Status updated.' },
            ],
          }
        : d,
    ),
  };
}

// ---- Notifications & settings ---------------------------------------------

export function markNotificationRead(db: Database, id: string): Database {
  return { ...db, notifications: db.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) };
}

export function markAllNotificationsRead(db: Database, recipient: string): Database {
  return {
    ...db,
    notifications: db.notifications.map((n) => (n.recipient === recipient ? { ...n, read: true } : n)),
  };
}

export function updateSettings(db: Database, settings: Settings): Database {
  if (
    settings.fineRatePerDay < 0 ||
    settings.loanPeriodDays < 1 ||
    settings.maxLoansPerMember < 1 ||
    settings.maxRenewals < 0 ||
    settings.reminderDays < 0
  ) {
    throw new Error('Settings contain invalid values.');
  }
  return { ...db, settings };
}

// ---- Automated jobs --------------------------------------------------------

/**
 * Stands in for the server's scheduled job. It releases holds nobody
 * collected, and reminds members about loans that are nearly due or overdue.
 * Each reminder carries a key, so running the sweep again sends nothing twice.
 */
export function runSystemSweep(db: Database): Database {
  const now = today();
  let changed = false;
  const reservations = db.reservations.map((r) => {
    if (r.status === 'ready' && r.readyOn && daysBetween(r.readyOn, now) > db.settings.holdDays) {
      changed = true;
      return { ...r, status: 'expired' as const, closedOn: now };
    }
    return r;
  });
  let next: Database = changed ? { ...db, reservations } : db;

  const sent = new Set(next.notifications.map((n) => n.key));
  for (const loan of next.loans) {
    if (!isActive(loan)) continue;
    const book = next.books.find((b) => b.id === loan.bookId);
    if (!book || !next.members.some((m) => m.id === loan.memberId)) continue;

    const daysLeft = daysBetween(now, loan.dueDate);
    if (overdueDays(loan, next.settings) > 0) {
      const key = `overdue:${loan.id}:${loan.dueDate}`;
      if (sent.has(key)) continue;
      next = withNotification(
        next,
        loan.memberId,
        'Overdue book',
        `"${book.title}" was due on ${formatDate(loan.dueDate)}. A fine of ${formatCurrency(next.settings.fineRatePerDay)} is added each day until it is returned.`,
        'danger',
        '/member/books',
        key,
      );
    } else if (daysLeft >= 0 && daysLeft <= next.settings.reminderDays) {
      // Keyed on the due date, so a renewed loan is reminded again when its new date comes round.
      const key = `due:${loan.id}:${loan.dueDate}`;
      if (sent.has(key)) continue;
      next = withNotification(
        next,
        loan.memberId,
        'Book due soon',
        `"${book.title}" is due ${daysLeft === 0 ? 'today' : `in ${plural(daysLeft, 'day')}`}.${next.settings.maxRenewals > 0 ? ' Return it, or renew it from My Books.' : ''}`,
        'warning',
        '/member/books',
        key,
      );
    }
  }
  return next;
}
