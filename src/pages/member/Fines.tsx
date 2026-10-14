import { CheckCircle2, IndianRupee, Receipt } from 'lucide-react';
import type { Fine, Loan, Payment } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { accruingFine, fineBalance, fineStatus, overdueDays } from '@/domain/selectors';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLookups } from '@/hooks/useLookups';
import { formatCurrency, formatDate, plural } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/States';
import { BookCell } from '@/components/shared/Entities';

type Row = { kind: 'fine'; id: string; fine: Fine; loan?: Loan } | { kind: 'accruing'; id: string; loan: Loan };

export default function MyFines() {
  const { db } = useLibrary();
  const lookups = useLookups();
  const { summary, fines, payments } = useCurrentMember();
  const rate = db.settings.fineRatePerDay;

  const rows: Row[] = [
    ...summary.overdueLoans.map((loan): Row => ({ kind: 'accruing', id: `acc-${loan.id}`, loan })),
    ...fines.map((fine): Row => ({ kind: 'fine', id: fine.id, fine, loan: db.loans.find((l) => l.id === fine.loanId) })),
  ];

  const columns: Column<Row>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (r) => <BookCell book={lookups.book(r.kind === 'fine' ? r.fine.bookId : r.loan.bookId)} /> },
    { key: 'due', header: 'Due date', cell: (r) => formatDate(r.loan?.dueDate), sortValue: (r) => r.loan?.dueDate ?? '' },
    {
      key: 'returned',
      header: 'Returned date',
      cell: (r) => (r.kind === 'accruing' ? <span className="text-slate-400">Not returned</span> : formatDate(r.loan?.returnDate)),
    },
    {
      key: 'days',
      header: 'Overdue days',
      align: 'right',
      cell: (r) => (r.kind === 'accruing' ? overdueDays(r.loan, db.settings) : r.fine.reason === 'damage' ? <span className="text-slate-400">Damage</span> : r.fine.overdueDays),
    },
    {
      key: 'fine',
      header: 'Fine',
      align: 'right',
      cell: (r) =>
        r.kind === 'accruing' ? (
          formatCurrency(accruingFine(r.loan, db.settings))
        ) : (
          <span>
            <span className="font-medium text-slate-900">{formatCurrency(r.fine.amount)}</span>
            {r.fine.paid > 0 && r.fine.paid < r.fine.amount && <span className="block text-xs text-slate-500">{formatCurrency(fineBalance(r.fine))} due</span>}
          </span>
        ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.kind === 'accruing' ? 'accruing' : fineStatus(r.fine)} /> },
  ];

  const paymentColumns: Column<Payment>[] = [
    { key: 'date', header: 'Date', primary: true, cell: (p) => formatDate(p.date), sortValue: (p) => p.date },
    { key: 'for', header: 'For', cell: (p) => lookups.bookTitle(fines.find((f) => f.id === p.fineId)?.bookId) },
    { key: 'method', header: 'Method', cell: (p) => p.method },
    { key: 'ref', header: 'Transaction ID', cell: (p) => <span className="tabular">{p.reference || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => formatCurrency(p.amount), sortValue: (p) => p.amount },
  ];

  const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageHeader title="Fines" description="What you owe, how it was calculated and what you have paid" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Outstanding balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{formatCurrency(summary.outstanding)}</p>
          {summary.outstanding > 0 ? (
            <p className="mt-2 text-sm text-slate-600">Pay at the circulation desk by cash, UPI or card. Payments appear here once recorded.</p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              You have no unpaid fines.
            </p>
          )}
          {summary.accruing > 0 && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {formatCurrency(summary.accruing)} more is building up on {plural(summary.overdueLoans.length, 'overdue book')}. Return{' '}
              {summary.overdueLoans.length === 1 ? 'it' : 'them'} to stop the fine.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-[17px] font-semibold leading-snug text-slate-900">How fines are calculated</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fine = overdue days × {formatCurrency(rate)} per day
            {db.settings.graceDays > 0 ? `, after a grace period of ${plural(db.settings.graceDays, 'day')}` : ''}. For example, a book returned
            4 days late is fined 4 × {formatCurrency(rate)} = {formatCurrency(4 * rate)}.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
            <div>
              <dt className="text-xs text-slate-500">Total fined</dt>
              <dd className="tabular text-lg font-semibold text-slate-900">{formatCurrency(summary.totalFined)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Paid</dt>
              <dd className="tabular text-lg font-semibold text-emerald-700">{formatCurrency(paidTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Outstanding</dt>
              <dd className="tabular text-lg font-semibold text-slate-900">{formatCurrency(summary.outstanding)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Fine history" />
        <DataTable
          caption="Fine history"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          pageSize={8}
          empty={<EmptyState icon={IndianRupee} title="No fines" description="Return books by their due date to keep it that way." />}
        />
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Payment history" />
        <DataTable
          caption="Payment history"
          rows={payments}
          columns={paymentColumns}
          rowKey={(p) => p.id}
          pageSize={8}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState icon={Receipt} title="No payments yet" />}
        />
      </Card>
    </>
  );
}
