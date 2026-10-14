import type {
  Book,
  BookInventory,
  Database,
  Fine,
  Loan,
  Reservation,
  Settings,
} from '@/types';
import { addDays, daysBetween, today } from '@/lib/utils';

// Read-side business rules. Everything that can be derived (availability,
// overdue days, queue position, fine status) is computed here rather than
// stored, so the UI can never show inventory that disagrees with the ledger.

export const isActive = (loan: Loan): boolean => !loan.returnDate;

/** Chargeable overdue days as of `asOf` (or the return date if returned). */
export function overdueDays(loan: Loan, settings: Settings, asOf: string = today()): number {
  const end = loan.returnDate ?? asOf;
  return Math.max(0, daysBetween(loan.dueDate, end) - settings.graceDays);
}

export const isOverdue = (loan: Loan, settings: Settings): boolean =>
  isActive(loan) && overdueDays(loan, settings) > 0;

export const daysRemaining = (loan: Loan): number => daysBetween(today(), loan.dueDate);

/** Fine a still-open loan would attract if it were returned today. */
export const accruingFine = (loan: Loan, settings: Settings): number =>
  isActive(loan) ? overdueDays(loan, settings) * settings.fineRatePerDay : 0;

export type FineStatus = 'pending' | 'partial' | 'paid';

export const fineBalance = (fine: Fine): number => Math.max(0, fine.amount - fine.paid);

export function fineStatus(fine: Fine): FineStatus {
  if (fine.paid >= fine.amount) return 'paid';
  return fine.paid > 0 ? 'partial' : 'pending';
}

export function getInventory(db: Database, book: Book): BookInventory {
  const issued = db.loans.filter((l) => l.bookId === book.id && isActive(l)).length;
  const reserved = db.reservations.filter((r) => r.bookId === book.id && r.status === 'ready').length;
  const damaged = Math.min(
    book.totalCopies,
    db.damage.filter((d) => d.bookId === book.id && d.copyWithdrawn && d.status !== 'resolved').length,
  );
  const usable = book.totalCopies - damaged;
  const available = Math.max(0, usable - issued - reserved);

  let state: BookInventory['state'];
  if (usable <= 0) state = 'damaged';
  else if (available === 0) state = reserved > 0 && issued < usable ? 'reserved' : 'checked_out';
  else if (usable >= 3 && available / usable <= 0.34) state = 'low_stock';
  else state = 'available';

  return { total: book.totalCopies, available, issued, reserved, damaged, state };
}

/** Open queue for a book, in service order. */
export function getQueue(db: Database, bookId: string): Reservation[] {
  return db.reservations
    .filter((r) => r.bookId === bookId && (r.status === 'waiting' || r.status === 'ready'))
    .sort((a, b) => a.reservedOn.localeCompare(b.reservedOn) || a.id.localeCompare(b.id));
}

/** 1-based position in the open queue, or null once the reservation is closed. */
export function queuePosition(db: Database, reservation: Reservation): number | null {
  const idx = getQueue(db, reservation.bookId).findIndex((r) => r.id === reservation.id);
  return idx === -1 ? null : idx + 1;
}

/** Rough date a copy should free up for the person at `position` in the queue. */
export function estimatedAvailability(db: Database, bookId: string, position: number): string | null {
  const dueDates = db.loans
    .filter((l) => l.bookId === bookId && isActive(l))
    .map((l) => (l.dueDate < today() ? today() : l.dueDate))
    .sort();
  if (dueDates.length === 0) return null;
  const copies = dueDates.length;
  const idx = (position - 1) % copies;
  const rounds = Math.floor((position - 1) / copies);
  return addDays(dueDates[idx]!, rounds * db.settings.loanPeriodDays);
}

export interface MemberSummary {
  activeLoans: Loan[];
  overdueLoans: Loan[];
  outstanding: number;
  accruing: number;
  totalFined: number;
  returnedCount: number;
  borrowedCount: number;
}

export function getMemberSummary(db: Database, memberId: string): MemberSummary {
  const loans = db.loans.filter((l) => l.memberId === memberId);
  const activeLoans = loans.filter(isActive);
  const overdueLoans = activeLoans.filter((l) => isOverdue(l, db.settings));
  const fines = db.fines.filter((f) => f.memberId === memberId);
  return {
    activeLoans,
    overdueLoans,
    outstanding: fines.reduce((sum, f) => sum + fineBalance(f), 0),
    accruing: overdueLoans.reduce((sum, l) => sum + accruingFine(l, db.settings), 0),
    totalFined: fines.reduce((sum, f) => sum + f.amount, 0),
    returnedCount: loans.length - activeLoans.length,
    borrowedCount: loans.length,
  };
}

export interface LibraryTotals {
  titles: number;
  totalCopies: number;
  available: number;
  issued: number;
  reserved: number;
  damaged: number;
  members: number;
  overdue: number;
  pendingFines: number;
}

export function getTotals(db: Database): LibraryTotals {
  const totals: LibraryTotals = {
    titles: db.books.length,
    totalCopies: 0,
    available: 0,
    issued: 0,
    reserved: 0,
    damaged: 0,
    members: db.members.length,
    overdue: db.loans.filter((l) => isOverdue(l, db.settings)).length,
    pendingFines: db.fines.reduce((sum, f) => sum + fineBalance(f), 0),
  };
  for (const book of db.books) {
    const inv = getInventory(db, book);
    totals.totalCopies += inv.total;
    totals.available += inv.available;
    totals.issued += inv.issued;
    totals.reserved += inv.reserved;
    totals.damaged += inv.damaged;
  }
  return totals;
}

/** Waiting reservations at the head of their queue whose book has a free copy. */
export function getNotifiableReservations(db: Database): Reservation[] {
  const seen = new Set<string>();
  const out: Reservation[] = [];
  for (const r of db.reservations) {
    if (r.status !== 'waiting' || seen.has(r.bookId)) continue;
    seen.add(r.bookId);
    const book = db.books.find((b) => b.id === r.bookId);
    if (!book || getInventory(db, book).available === 0) continue;
    const head = getQueue(db, r.bookId).find((q) => q.status === 'waiting');
    if (head) out.push(head);
  }
  return out;
}
