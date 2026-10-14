import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Calculator, Download, IndianRupee, Receipt, Users, Wallet } from 'lucide-react';
import type { Fine, Loan, Payment } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useToast } from '@/context/ToastContext';
import { collectedThisMonth } from '@/domain/analytics';
import { accruingFine, fineBalance, fineStatus, isOverdue, overdueDays } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { exportCsv } from '@/lib/export';
import { formatCurrency, formatDate, matches, plural } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader, StatCard, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SearchBar, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/States';
import { BookCell, MemberCell } from '@/components/shared/Entities';
import { fineCalculation, PaymentModal } from '@/components/shared/PaymentModal';

// The table mixes fines already raised (book returned) with fines still
// building up on overdue loans, so staff see everything owed in one place.
type Row =
  | { kind: 'fine'; id: string; fine: Fine; loan?: Loan }
  | { kind: 'accruing'; id: string; loan: Loan };

type Tab = 'fines' | 'payments';

export default function Fines() {
  const { db } = useLibrary();
  const lookups = useLookups();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('fines');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('unpaid');
  const [paying, setPaying] = useState<Fine | null>(null);

  const rate = db.settings.fineRatePerDay;
  const overdueLoans = useMemo(() => db.loans.filter((l) => isOverdue(l, db.settings)), [db.loans, db.settings]);
  const outstanding = db.fines.reduce((sum, f) => sum + fineBalance(f), 0);
  const accruing = overdueLoans.reduce((sum, l) => sum + accruingFine(l, db.settings), 0);
  const unpaidCount = db.fines.filter((f) => fineBalance(f) > 0).length;

  const memberOf = (r: Row) => (r.kind === 'fine' ? r.fine.memberId : r.loan.memberId);
  const bookOf = (r: Row) => (r.kind === 'fine' ? r.fine.bookId : r.loan.bookId);
  const statusOf = (r: Row) => (r.kind === 'fine' ? fineStatus(r.fine) : 'accruing');
  const amountOf = (r: Row) => (r.kind === 'fine' ? r.fine.amount : accruingFine(r.loan, db.settings));
  const daysOf = (r: Row) => (r.kind === 'fine' ? r.fine.overdueDays : overdueDays(r.loan, db.settings));

  const rows = useMemo<Row[]>(() => {
    const loanById = new Map(db.loans.map((l) => [l.id, l]));
    const all: Row[] = [
      ...overdueLoans.map((loan): Row => ({ kind: 'accruing', id: `acc-${loan.id}`, loan })),
      ...db.fines.map((fine): Row => ({ kind: 'fine', id: fine.id, fine, loan: loanById.get(fine.loanId) })),
    ];
    return all
      .filter((r) => matches(query, lookups.memberName(memberOf(r)), memberOf(r), lookups.bookTitle(bookOf(r))))
      .filter((r) => {
        const s = statusOf(r);
        if (!status) return true;
        if (status === 'unpaid') return s !== 'paid';
        return s === status;
      });
    // The row helpers are pure functions of db.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, overdueLoans, query, status, lookups]);

  const payments = useMemo(
    () => db.payments.filter((p) => matches(query, lookups.memberName(p.memberId), p.memberId, p.id, p.reference)),
    [db.payments, query, lookups],
  );

  const exportRows = () => {
    if (tab === 'payments') {
      exportCsv({
        title: 'Payments',
        headers: ['Payment', 'Date', 'Member', 'Member ID', 'Amount', 'Method', 'Transaction ID', 'Fine'],
        rows: payments.map((p) => [p.id, p.date, lookups.memberName(p.memberId), p.memberId, p.amount, p.method, p.reference, p.fineId]),
      });
    } else {
      exportCsv({
        title: 'Fines',
        headers: ['Member', 'Member ID', 'Book', 'Due date', 'Returned', 'Overdue days', 'Fine', 'Paid', 'Balance', 'Status'],
        rows: rows.map((r) => [
          lookups.memberName(memberOf(r)),
          memberOf(r),
          lookups.bookTitle(bookOf(r)),
          r.loan?.dueDate ?? '',
          r.loan?.returnDate ?? '',
          daysOf(r),
          amountOf(r),
          r.kind === 'fine' ? r.fine.paid : 0,
          r.kind === 'fine' ? fineBalance(r.fine) : amountOf(r),
          statusLabel(statusOf(r)),
        ]),
      });
    }
    toast.success('Exported to CSV.');
  };

  const columns: Column<Row>[] = [
    { key: 'member', header: 'Member', primary: true, cell: (r) => <MemberCell member={lookups.member(memberOf(r))} to={`/admin/members/${memberOf(r)}`} />, sortValue: (r) => lookups.memberName(memberOf(r)) },
    { key: 'book', header: 'Book', cell: (r) => <BookCell book={lookups.book(bookOf(r))} to={`/admin/books/${bookOf(r)}`} compact /> },
    { key: 'due', header: 'Due date', cell: (r) => formatDate(r.loan?.dueDate), sortValue: (r) => r.loan?.dueDate ?? '' },
    {
      key: 'returned',
      header: 'Returned date',
      cell: (r) => (r.kind === 'accruing' ? <span className="text-slate-400">Not returned</span> : formatDate(r.loan?.returnDate)),
      sortValue: (r) => r.loan?.returnDate ?? '9999',
    },
    {
      key: 'days',
      header: 'Overdue days',
      align: 'right',
      cell: (r) => (r.kind === 'fine' && r.fine.reason === 'damage' ? <span className="text-slate-400">Damage</span> : daysOf(r)),
      sortValue: daysOf,
    },
    {
      key: 'fine',
      header: 'Fine',
      align: 'right',
      sortValue: amountOf,
      cell: (r) => (
        <span title={r.kind === 'fine' ? fineCalculation(r.fine) : `${daysOf(r)} days × ${formatCurrency(rate)} so far`}>
          <span className="font-medium text-slate-900">{formatCurrency(amountOf(r))}</span>
          {r.kind === 'fine' && r.fine.paid > 0 && r.fine.paid < r.fine.amount && (
            <span className="block text-xs text-slate-500">{formatCurrency(fineBalance(r.fine))} due</span>
          )}
        </span>
      ),
    },
    { key: 'status', header: 'Payment status', cell: (r) => <StatusBadge status={statusOf(r)} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (r) =>
        r.kind === 'accruing' ? (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/circulation?tab=return&loan=${r.loan.id}`)}>
            Process return
          </Button>
        ) : fineBalance(r.fine) > 0 ? (
          <Button size="sm" onClick={() => setPaying(r.fine)}>
            Record payment
          </Button>
        ) : null,
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    { key: 'id', header: 'Payment', cell: (p) => <span className="tabular font-medium text-slate-900">{p.id}</span>, sortValue: (p) => p.id },
    { key: 'member', header: 'Member', primary: true, cell: (p) => <MemberCell member={lookups.member(p.memberId)} to={`/admin/members/${p.memberId}`} /> },
    { key: 'date', header: 'Date', cell: (p) => formatDate(p.date), sortValue: (p) => p.date },
    { key: 'for', header: 'For', cell: (p) => <span className="block max-w-[14rem] truncate">{lookups.bookTitle(db.fines.find((f) => f.id === p.fineId)?.bookId)}</span> },
    { key: 'method', header: 'Method', cell: (p) => p.method, sortValue: (p) => p.method },
    { key: 'ref', header: 'Transaction ID', cell: (p) => <span className="tabular">{p.reference || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="font-medium text-slate-900">{formatCurrency(p.amount)}</span>, sortValue: (p) => p.amount },
  ];

  return (
    <>
      <PageHeader
        title="Fines & Payments"
        description="Overdue fines are calculated automatically; record payments as members settle them"
        actions={
          <Button variant="secondary" icon={Download} onClick={exportRows}>
            Export
          </Button>
        }
      />

      <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total outstanding" value={formatCurrency(outstanding)} hint={`+ ${formatCurrency(accruing)} still accruing`} icon={Wallet} tone="amber" />
        <StatCard label="Collected this month" value={formatCurrency(collectedThisMonth(db))} hint={`${formatCurrency(db.payments.reduce((s, p) => s + p.amount, 0))} all time`} icon={IndianRupee} tone="green" />
        <StatCard label="Overdue members" value={String(new Set(overdueLoans.map((l) => l.memberId)).size)} hint={plural(overdueLoans.length, 'overdue book')} icon={Users} tone="red" />
        <StatCard label="Unpaid fines" value={String(unpaidCount)} hint="Pending or partially paid" icon={AlertTriangle} tone="slate" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 glass rounded-xl px-4 py-3">
        <p className="flex items-start gap-2.5 text-sm text-slate-600">
          <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          <span>
            <span className="font-medium text-slate-900">Fine = overdue days × {formatCurrency(rate)} per day.</span>{' '}
            {db.settings.graceDays > 0 ? `The first ${plural(db.settings.graceDays, 'day')} late are not charged. ` : ''}
            Example: 6 days late = 6 × {formatCurrency(rate)} = {formatCurrency(6 * rate)}.
          </span>
        </p>
        <Link to="/admin/settings" className="text-sm font-medium text-brand-700 hover:underline">
          Change rate
        </Link>
      </div>

      <Card className="mt-5 overflow-hidden">
        <Tabs<Tab>
          className="px-3 pt-1"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'fines', label: 'Fines', count: db.fines.length + overdueLoans.length },
            { key: 'payments', label: 'Payment history', count: db.payments.length },
          ]}
        />
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SearchBar value={query} onChange={setQuery} placeholder={tab === 'fines' ? 'Search by member or book…' : 'Search by member, payment or transaction ID…'} />
          {tab === 'fines' && (
            <Select
              aria-label="Payment status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="All fines"
              options={[
                { value: 'unpaid', label: 'All unpaid' },
                { value: 'pending', label: 'Pending' },
                { value: 'partial', label: 'Partially paid' },
                { value: 'paid', label: 'Paid' },
                { value: 'accruing', label: 'Accruing (not returned)' },
              ]}
            />
          )}
        </div>
        {tab === 'fines' ? (
          <DataTable
            caption="Fines"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={IndianRupee} title="No fines match" description="Nothing is owed for this filter." />}
          />
        ) : (
          <DataTable
            caption="Payment history"
            rows={payments}
            columns={paymentColumns}
            rowKey={(p) => p.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            empty={<EmptyState icon={Receipt} title="No payments found" />}
          />
        )}
      </Card>

      <PaymentModal fine={paying} onClose={() => setPaying(null)} />
    </>
  );
}
