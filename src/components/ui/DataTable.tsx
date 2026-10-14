import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  className?: string;
  /** Rendered as the card heading on mobile instead of a label/value pair. */
  primary?: boolean;
  /** Drop this column on narrower desktops; it still shows in mobile cards. */
  wideOnly?: boolean;
  /** Rendered in the card footer on mobile (use for the actions column). */
  actions?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Accessible name for the table. */
  caption?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  pageSize = 10,
  empty,
  onRowClick,
  loading,
  initialSort,
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return rows;
    const value = column.sortValue;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Filtering can shrink the list underneath the current page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  // The actions column is pinned only while the table is wider than its panel.
  // Pinning needs a solid cell, which would show as a pale block on the glass
  // when there is nothing scrolling underneath it.
  const scroller = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const tableShown = !loading && rows.length > 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [tableShown]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  if (loading) return <TableSkeleton columns={columns.length} />;
  if (rows.length === 0) return <>{empty ?? <p className="p-8 text-center text-sm text-slate-500">No records.</p>}</>;

  const primary = columns.find((c) => c.primary);
  const actions = columns.find((c) => c.actions);
  const details = columns.filter((c) => !c.primary && !c.actions);

  return (
    <div>
      {/* Desktop / tablet */}
      <div ref={scroller} className="thin-scroll hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-slate-900/10 bg-slate-900/[0.035] text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'whitespace-nowrap px-2.5 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-500 first:pl-5 last:pr-5',
                    c.align === 'right' && 'text-right',
                    c.wideOnly && 'hidden 2xl:table-cell',
                    // Actions stay reachable when a wide table scrolls sideways.
                    c.actions && overflowing && 'sticky right-0 bg-[#f1ece1] shadow-[-1px_0_0_var(--rule)]',
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded font-medium uppercase tracking-[0.1em] hover:text-slate-800',
                        c.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : c.actions ? (
                    <span className="sr-only">{c.header}</span>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.07]">
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors hover:bg-white/55', onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'whitespace-nowrap px-2.5 py-3 align-middle text-slate-700 first:pl-5 last:pr-5',
                      c.align === 'right' && 'tabular text-right',
                      c.wideOnly && 'hidden 2xl:table-cell',
                      c.actions && 'w-px text-right',
                      c.actions && overflowing && 'sticky right-0 bg-[#fbf8f2] shadow-[-1px_0_0_var(--rule)]',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: each row becomes a card */}
      <ul className="divide-y divide-slate-900/[0.07] md:hidden">
        {visible.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('px-4 py-3.5', onRowClick && 'cursor-pointer active:bg-white/60')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm font-medium text-slate-900">
                {(primary ?? columns[0]!).cell(row)}
              </div>
              {actions && <div className="-mr-1.5 -mt-1 shrink-0">{actions.cell(row)}</div>}
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
              {details
                .filter((c) => c !== (primary ?? columns[0]))
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="eyebrow">{c.header}</dt>
                    <dd className="mt-0.5 text-sm text-slate-700">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      {sorted.length > pageSize && (
        <Pagination page={current} pageCount={pageCount} total={sorted.length} pageSize={pageSize} onChange={setPage} />
      )}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, total, pageSize, onChange }: PaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = pageWindow(page, pageCount);
  const navButton =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-900/[0.07] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 px-4 py-3"
      aria-label="Pagination"
    >
      <p className="tabular text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={navButton} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(navButton, 'tabular hidden sm:inline-flex', p === page && 'bg-brand-700 font-medium text-white hover:bg-brand-700')}
            >
              {p}
            </button>
          ),
        )}
        <span className="tabular px-2 text-sm text-slate-500 sm:hidden">
          {page} / {pageCount}
        </span>
        <button type="button" className={navButton} disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

function pageWindow(page: number, count: number): Array<number | null> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: Array<number | null> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push(null);
  for (let p = start; p <= end; p++) out.push(p);
  if (end < count - 1) out.push(null);
  out.push(count);
  return out;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="divide-y divide-slate-900/[0.07]" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: Math.min(columns, 6) }, (_, c) => (
            <div key={c} className={cn('skeleton h-4', c === 0 ? 'w-1/4' : 'flex-1', c > 2 && 'hidden md:block')} />
          ))}
        </div>
      ))}
    </div>
  );
}
