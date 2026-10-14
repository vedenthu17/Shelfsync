import type { Database, Loan } from '@/types';
import { addDays, daysBetween, formatCurrency, formatDate, parseISO } from '@/lib/utils';
import { popularBooks, popularCategories } from './analytics';
import {
  accruingFine,
  fineBalance,
  fineStatus,
  getInventory,
  isActive,
  isOverdue,
  overdueDays,
} from './selectors';

export type ReportType = 'inventory' | 'transactions' | 'members' | 'overdue' | 'fines' | 'damage' | 'reservations';

export interface ReportFilters {
  from: string;
  to: string;
  category: string;
  memberId: string;
  bookId: string;
  status: string;
}

export interface ReportDefinition {
  type: ReportType;
  label: string;
  description: string;
  /** Whether the date range narrows this report. */
  usesDates: boolean;
  statusOptions: Array<{ value: string; label: string }>;
}

export const reportDefinitions: ReportDefinition[] = [
  {
    type: 'inventory',
    label: 'Inventory Report',
    description: 'Stock position of every title',
    usesDates: false,
    statusOptions: [
      { value: 'available', label: 'Available' },
      { value: 'low_stock', label: 'Low stock' },
      { value: 'checked_out', label: 'Checked out' },
      { value: 'reserved', label: 'Reserved' },
      { value: 'damaged', label: 'Damaged' },
    ],
  },
  {
    type: 'transactions',
    label: 'Transaction Report',
    description: 'Issues and returns in the period',
    usesDates: true,
    statusOptions: [
      { value: 'On loan', label: 'On loan' },
      { value: 'Overdue', label: 'Overdue' },
      { value: 'Returned', label: 'Returned' },
    ],
  },
  {
    type: 'members',
    label: 'Member Activity Report',
    description: 'Borrowing activity per member',
    usesDates: true,
    statusOptions: [
      { value: 'active', label: 'Active' },
      { value: 'suspended', label: 'Suspended' },
    ],
  },
  { type: 'overdue', label: 'Overdue Report', description: 'Books currently past their due date', usesDates: false, statusOptions: [] },
  {
    type: 'fines',
    label: 'Fine Collection Report',
    description: 'Fines raised and what has been collected',
    usesDates: true,
    statusOptions: [
      { value: 'Pending', label: 'Pending' },
      { value: 'Partially paid', label: 'Partially paid' },
      { value: 'Paid', label: 'Paid' },
    ],
  },
  {
    type: 'damage',
    label: 'Damage Report',
    description: 'Damage records and repair costs',
    usesDates: true,
    statusOptions: [
      { value: 'Reported', label: 'Reported' },
      { value: 'Under review', label: 'Under review' },
      { value: 'Under repair', label: 'Under repair' },
      { value: 'Resolved', label: 'Resolved' },
    ],
  },
  {
    type: 'reservations',
    label: 'Reservation Report',
    description: 'Reservations placed in the period',
    usesDates: true,
    statusOptions: ['Waiting', 'Ready', 'Fulfilled', 'Cancelled', 'Expired'].map((s) => ({ value: s, label: s })),
  },
];

export type ChartSpec =
  | { kind: 'ranked'; title: string; label: string; data: Array<{ name: string; value: number }>; currency?: boolean }
  | { kind: 'column'; title: string; label: string; data: Array<{ name: string; value: number }>; currency?: boolean }
  | { kind: 'trend'; title: string; data: Array<{ label: string; issued: number; returned: number }> };

export interface ReportResult {
  headers: string[];
  /** Index of numeric columns, for right-alignment. */
  numeric: number[];
  rows: Array<Array<string | number>>;
  chart: ChartSpec;
  summary: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const inRange = (date: string | undefined, f: ReportFilters) => !!date && date >= f.from && date <= f.to;

function monthBuckets(from: string, to: string): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const start = parseISO(from);
  const end = parseISO(to);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end && out.length < 36) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function tally<T>(items: T[], keyOf: (item: T) => string, valueOf: (item: T) => number = () => 1) {
  const map = new Map<string, number>();
  for (const item of items) map.set(keyOf(item), (map.get(keyOf(item)) ?? 0) + valueOf(item));
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function buildReport(db: Database, type: ReportType, f: ReportFilters): ReportResult {
  const book = new Map(db.books.map((b) => [b.id, b]));
  const member = new Map(db.members.map((m) => [m.id, m]));
  const title = (id: string) => book.get(id)?.title ?? 'Removed title';
  const name = (id?: string) => (id ? member.get(id)?.name ?? 'Former member' : '—');
  const bookOk = (id: string) => (!f.bookId || id === f.bookId) && (!f.category || book.get(id)?.category === f.category);
  const memberOk = (id?: string) => !f.memberId || id === f.memberId;
  const loanState = (l: Loan) => (!isActive(l) ? 'Returned' : isOverdue(l, db.settings) ? 'Overdue' : 'On loan');

  switch (type) {
    case 'inventory': {
      const items = db.books
        .filter((b) => bookOk(b.id))
        .map((b) => ({ b, inv: getInventory(db, b) }))
        .filter(({ inv }) => !f.status || inv.state === f.status);
      return {
        headers: ['Title', 'Author', 'Category', 'Shelf', 'Total', 'Available', 'Issued', 'Reserved', 'Damaged', 'Availability'],
        numeric: [4, 5, 6, 7, 8],
        rows: items.map(({ b, inv }) => [b.title, b.author, b.category, b.shelf, inv.total, inv.available, inv.issued, inv.reserved, inv.damaged, cap(inv.state)]),
        chart: { kind: 'ranked', title: 'Copies by category', label: 'Copies', data: tally(items, ({ b }) => b.category, ({ inv }) => inv.total) },
        summary: `${items.length} titles · ${items.reduce((s, { inv }) => s + inv.total, 0)} copies · ${items.reduce((s, { inv }) => s + inv.available, 0)} available`,
      };
    }

    case 'transactions': {
      const loans = db.loans
        .filter((l) => inRange(l.issueDate, f) && bookOk(l.bookId) && memberOk(l.memberId))
        .filter((l) => !f.status || loanState(l) === f.status);
      const buckets = monthBuckets(f.from, f.to);
      return {
        headers: ['Transaction', 'Book', 'Member', 'Issued', 'Due', 'Returned', 'Status'],
        numeric: [],
        rows: loans.map((l) => [l.id, title(l.bookId), name(l.memberId), formatDate(l.issueDate), formatDate(l.dueDate), l.returnDate ? formatDate(l.returnDate) : '—', loanState(l)]),
        chart: {
          kind: 'trend',
          title: 'Issued vs returned by month',
          data: buckets.map(({ key, label }) => ({
            label,
            issued: loans.filter((l) => l.issueDate.startsWith(key)).length,
            returned: loans.filter((l) => l.returnDate?.startsWith(key)).length,
          })),
        },
        summary: `${loans.length} transactions · ${loans.filter((l) => !isActive(l)).length} returned · ${loans.filter(isActive).length} still out`,
      };
    }

    case 'members': {
      const items = db.members
        .filter((m) => memberOk(m.id) && (!f.status || m.status === f.status))
        .map((m) => {
          const loans = db.loans.filter((l) => l.memberId === m.id && inRange(l.issueDate, f) && bookOk(l.bookId));
          const fines = db.fines.filter((x) => x.memberId === m.id && inRange(x.createdOn, f));
          return {
            m,
            loans: loans.length,
            onLoan: loans.filter(isActive).length,
            overdue: loans.filter((l) => isOverdue(l, db.settings)).length,
            fined: fines.reduce((s, x) => s + x.amount, 0),
            outstanding: db.fines.filter((x) => x.memberId === m.id).reduce((s, x) => s + fineBalance(x), 0),
          };
        })
        .sort((a, b) => b.loans - a.loans);
      return {
        headers: ['Member ID', 'Name', 'Type', 'Status', 'Loans', 'On loan', 'Overdue', 'Fines raised', 'Outstanding'],
        numeric: [4, 5, 6, 7, 8],
        rows: items.map((i) => [i.m.id, i.m.name, i.m.type, cap(i.m.status), i.loans, i.onLoan, i.overdue, formatCurrency(i.fined), formatCurrency(i.outstanding)]),
        chart: { kind: 'ranked', title: 'Most active members', label: 'Loans', data: items.slice(0, 8).map((i) => ({ name: i.m.name, value: i.loans })) },
        summary: `${items.length} members · ${items.reduce((s, i) => s + i.loans, 0)} loans in the period`,
      };
    }

    case 'overdue': {
      const loans = db.loans
        .filter((l) => isOverdue(l, db.settings) && bookOk(l.bookId) && memberOk(l.memberId))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return {
        headers: ['Transaction', 'Book', 'Member', 'Member ID', 'Due', 'Overdue days', 'Fine so far'],
        numeric: [5, 6],
        rows: loans.map((l) => [l.id, title(l.bookId), name(l.memberId), l.memberId, formatDate(l.dueDate), overdueDays(l, db.settings), formatCurrency(accruingFine(l, db.settings))]),
        chart: {
          kind: 'ranked',
          title: 'Days overdue by loan',
          label: 'Days overdue',
          data: loans.slice(0, 8).map((l) => ({ name: title(l.bookId), value: overdueDays(l, db.settings) })),
        },
        summary: `${loans.length} overdue books · ${formatCurrency(loans.reduce((s, l) => s + accruingFine(l, db.settings), 0))} accruing`,
      };
    }

    case 'fines': {
      const fines = db.fines
        .filter((x) => inRange(x.createdOn, f) && bookOk(x.bookId) && memberOk(x.memberId))
        .filter((x) => !f.status || cap(fineStatus(x) === 'partial' ? 'partially paid' : fineStatus(x)) === f.status);
      const payments = db.payments.filter((p) => inRange(p.date, f) && memberOk(p.memberId));
      const buckets = monthBuckets(f.from, f.to);
      return {
        headers: ['Fine', 'Raised', 'Member', 'Book', 'Reason', 'Fine amount', 'Paid', 'Balance', 'Status'],
        numeric: [5, 6, 7],
        rows: fines.map((x) => [
          x.id,
          formatDate(x.createdOn),
          name(x.memberId),
          title(x.bookId),
          x.reason === 'damage' ? 'Damage' : `${x.overdueDays} days × ${formatCurrency(x.rate)}`,
          formatCurrency(x.amount),
          formatCurrency(x.paid),
          formatCurrency(fineBalance(x)),
          cap(fineStatus(x) === 'partial' ? 'partially paid' : fineStatus(x)),
        ]),
        chart: {
          kind: 'column',
          title: 'Payments collected by month',
          label: 'Collected',
          currency: true,
          data: buckets.map(({ key, label }) => ({
            name: label,
            value: payments.filter((p) => p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0),
          })),
        },
        summary: `${formatCurrency(fines.reduce((s, x) => s + x.amount, 0))} raised · ${formatCurrency(payments.reduce((s, p) => s + p.amount, 0))} collected · ${formatCurrency(fines.reduce((s, x) => s + fineBalance(x), 0))} outstanding`,
      };
    }

    case 'damage': {
      const reports = db.damage
        .filter((d) => inRange(d.date, f) && bookOk(d.bookId) && memberOk(d.memberId))
        .filter((d) => !f.status || cap(d.status) === f.status);
      return {
        headers: ['Report', 'Date', 'Book', 'Member', 'Damage type', 'Severity', 'Status', 'Repair cost'],
        numeric: [7],
        rows: reports.map((d) => [d.id, formatDate(d.date), title(d.bookId), name(d.memberId), d.type, d.severity, cap(d.status), formatCurrency(d.repairCost)]),
        chart: { kind: 'ranked', title: 'Reports by damage type', label: 'Reports', data: tally(reports, (d) => d.type) },
        summary: `${reports.length} reports · ${formatCurrency(reports.reduce((s, d) => s + d.repairCost, 0))} estimated repair cost`,
      };
    }

    case 'reservations': {
      const items = db.reservations
        .filter((r) => inRange(r.reservedOn, f) && bookOk(r.bookId) && memberOk(r.memberId))
        .filter((r) => !f.status || cap(r.status) === f.status);
      return {
        headers: ['Reservation', 'Book', 'Member', 'Reserved on', 'Status', 'Closed on'],
        numeric: [],
        rows: items.map((r) => [r.id, title(r.bookId), name(r.memberId), formatDate(r.reservedOn), cap(r.status), r.closedOn ? formatDate(r.closedOn) : '—']),
        chart: { kind: 'column', title: 'Reservations by status', label: 'Reservations', data: tally(items, (r) => cap(r.status)) },
        summary: `${items.length} reservations · ${items.filter((r) => r.status === 'waiting' || r.status === 'ready').length} still open`,
      };
    }
  }
}

export interface AnalyticsSummary {
  totalTransactions: number;
  averagePerDay: number;
  topCategory: string;
  topBook: string;
  finesCollected: number;
  overdueBooks: number;
}

/** Headline figures for the period, independent of the selected report. */
export function summarise(db: Database, from: string, to: string): AnalyticsSummary {
  const loans = db.loans.filter((l) => l.issueDate >= from && l.issueDate <= to);
  const days = Math.max(1, daysBetween(from, addDays(to, 1)));
  return {
    totalTransactions: loans.length,
    averagePerDay: loans.length / days,
    topCategory: popularCategories(db, loans)[0]?.name ?? '—',
    topBook: popularBooks(db, loans)[0]?.name ?? '—',
    finesCollected: db.payments.filter((p) => p.date >= from && p.date <= to).reduce((s, p) => s + p.amount, 0),
    overdueBooks: db.loans.filter((l) => isOverdue(l, db.settings)).length,
  };
}
