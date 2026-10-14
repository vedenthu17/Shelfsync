import type { Database, Loan } from '@/types';
import { addDays, formatShortDate, parseISO, toISO, today } from '@/lib/utils';

export type TrendRange = '7d' | '30d' | '6m';

export interface TrendPoint {
  [key: string]: string | number;
  label: string;
  issued: number;
  returned: number;
}

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) =>
  parseISO(`${key}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

/** The last `count` calendar months as YYYY-MM keys, oldest first. */
function recentMonths(count: number): string[] {
  const now = parseISO(today());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return toISO(d).slice(0, 7);
  });
}

/** Books issued vs returned, daily for the short ranges and monthly for six months. */
export function circulationTrend(loans: Loan[], range: TrendRange): TrendPoint[] {
  if (range === '6m') {
    return recentMonths(6).map((key) => ({
      label: monthLabel(key),
      issued: loans.filter((l) => monthKey(l.issueDate) === key).length,
      returned: loans.filter((l) => l.returnDate && monthKey(l.returnDate) === key).length,
    }));
  }
  const days = range === '7d' ? 7 : 30;
  const start = addDays(today(), -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(start, i);
    return {
      label: formatShortDate(day),
      issued: loans.filter((l) => l.issueDate === day).length,
      returned: loans.filter((l) => l.returnDate === day).length,
    };
  });
}

export function monthlyFineCollection(db: Database, months = 6): Array<{ month: string; collected: number }> {
  return recentMonths(months).map((key) => ({
    month: monthLabel(key),
    collected: db.payments.filter((p) => monthKey(p.date) === key).reduce((sum, p) => sum + p.amount, 0),
  }));
}

export function collectedThisMonth(db: Database): number {
  const key = monthKey(today());
  return db.payments.filter((p) => monthKey(p.date) === key).reduce((sum, p) => sum + p.amount, 0);
}

function countBy<T>(items: T[], keyOf: (item: T) => string | undefined): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Loans per category, most borrowed first. */
export function popularCategories(db: Database, loans: Loan[] = db.loans) {
  const categoryOf = new Map(db.books.map((b) => [b.id, b.category]));
  return countBy(loans, (l) => categoryOf.get(l.bookId));
}

/** Loans per title, most borrowed first. */
export function popularBooks(db: Database, loans: Loan[] = db.loans) {
  const titleOf = new Map(db.books.map((b) => [b.id, b.title]));
  return countBy(loans, (l) => titleOf.get(l.bookId));
}

export function popularBookIds(db: Database, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const l of db.loans) counts.set(l.bookId, (counts.get(l.bookId) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
