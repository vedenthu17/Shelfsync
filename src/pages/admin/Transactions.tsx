import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Download, ListOrdered } from 'lucide-react';
import type { Loan } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt, useToast } from '@/context/ToastContext';
import { renewBlocker, renewLoan } from '@/domain/actions';
import { accruingFine, isActive, isOverdue, overdueDays } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { exportCsv } from '@/lib/export';
import { formatCurrency, formatDate, matches, plural } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DatePicker, SearchBar, Select } from '@/components/ui/Form';
import { EmptyState, useSimulatedLoading } from '@/components/ui/States';
import { BookCell, MemberCell } from '@/components/shared/Entities';

type LoanState = 'on_loan' | 'overdue' | 'returned';

export default function Transactions() {
  const { db, apply } = useLibrary();
  const lookups = useLookups();
  const navigate = useNavigate();
  const toast = useToast();
  const attempt = useAttempt();
  const loading = useSimulatedLoading();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const stateOf = (l: Loan): LoanState => (!isActive(l) ? 'returned' : isOverdue(l, db.settings) ? 'overdue' : 'on_loan');

  const rows = useMemo(
    () =>
      db.loans
        .filter((l) => {
          const b = lookups.book(l.bookId);
          const m = lookups.member(l.memberId);
          return matches(query, l.id, b?.title, b?.isbn, m?.name, m?.id);
        })
        .filter((l) => !status || stateOf(l) === status)
        .filter((l) => (!from || l.issueDate >= from) && (!to || l.issueDate <= to)),
    // stateOf only depends on db.settings, which is covered by db.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, lookups, query, status, from, to],
  );

  const exportRows = () => {
    exportCsv({
      title: 'Transactions',
      headers: ['Transaction', 'Book', 'ISBN', 'Member', 'Member ID', 'Issued', 'Due', 'Returned', 'Status', 'Overdue days', 'Renewals'],
      rows: rows.map((l) => [
        l.id,
        lookups.bookTitle(l.bookId),
        lookups.book(l.bookId)?.isbn ?? '',
        lookups.memberName(l.memberId),
        l.memberId,
        l.issueDate,
        l.dueDate,
        l.returnDate ?? '',
        stateOf(l),
        overdueDays(l, db.settings),
        l.renewals ?? 0,
      ]),
    });
    toast.success(`Exported ${plural(rows.length, 'transaction')} to CSV.`);
  };

  const columns: Column<Loan>[] = [
    { key: 'id', header: 'Transaction', cell: (l) => <span className="tabular font-medium text-slate-900">{l.id}</span>, sortValue: (l) => l.id },
    { key: 'book', header: 'Book', primary: true, cell: (l) => <BookCell book={lookups.book(l.bookId)} to={`/admin/books/${l.bookId}`} />, sortValue: (l) => lookups.bookTitle(l.bookId) },
    { key: 'member', header: 'Member', cell: (l) => <MemberCell member={lookups.member(l.memberId)} to={`/admin/members/${l.memberId}`} />, sortValue: (l) => lookups.memberName(l.memberId) },
    { key: 'issued', header: 'Issued', cell: (l) => formatDate(l.issueDate), sortValue: (l) => l.issueDate },
    {
      key: 'due',
      header: 'Due',
      cell: (l) => (
        <span>
          {formatDate(l.dueDate)}
          {!!l.renewals && <span className="block text-xs text-slate-500">Renewed {l.renewals}×</span>}
        </span>
      ),
      sortValue: (l) => l.dueDate,
    },
    { key: 'returned', header: 'Returned', cell: (l) => formatDate(l.returnDate), sortValue: (l) => l.returnDate ?? '' },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={stateOf(l)} />
          {stateOf(l) === 'overdue' && (
            <span className="text-xs text-red-700">
              {overdueDays(l, db.settings)}d · {formatCurrency(accruingFine(l, db.settings))}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (l) => {
        if (!isActive(l)) return null;
        const blocker = renewBlocker(db, l.id);
        return (
          <span className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={!!blocker}
              title={blocker ?? 'Extend the due date by one loan period'}
              onClick={() => attempt(() => apply((d) => renewLoan(d, l.id)), (r) => `Renewed. Now due ${formatDate(r.loan.dueDate)}.`)}
            >
              Renew
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/circulation?tab=return&loan=${l.id}`)}>
              Return
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every issue and return, newest first"
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportRows}>
              Export
            </Button>
            <Button icon={ArrowLeftRight} onClick={() => navigate('/admin/circulation')}>
              Issue / Return
            </Button>
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-900/10 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <SearchBar value={query} onChange={setQuery} placeholder="Search transaction, book, ISBN or member…" className="sm:col-span-2 lg:col-span-1" />
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'on_loan', label: 'On loan' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'returned', label: 'Returned' },
            ]}
          />
          <DatePicker aria-label="Issued from" title="Issued from" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <DatePicker aria-label="Issued to" title="Issued to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <DataTable
          caption="Transactions"
          loading={loading}
          rows={rows}
          columns={columns}
          rowKey={(l) => l.id}
          pageSize={12}
          empty={<EmptyState icon={ListOrdered} title="No transactions found" description="Adjust the search, status or date range." />}
        />
      </Card>
    </>
  );
}
