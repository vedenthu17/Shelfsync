import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Ban, BookOpen, CheckCircle2, IndianRupee, KeyRound, Pencil, UserX } from 'lucide-react';
import type { Fine, Loan, Payment, Reservation } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { renewBlocker, renewLoan, setMemberStatus } from '@/domain/actions';
import { issueTemporaryPassword } from '@/domain/auth';
import {
  accruingFine,
  daysRemaining,
  fineBalance,
  fineStatus,
  getMemberSummary,
  isActive,
  isOverdue,
  overdueDays,
  queuePosition,
} from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Detail, StatCard, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmationDialog } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { BookCell, MemberAvatar } from '@/components/shared/Entities';
import { MemberFormModal } from '@/components/shared/MemberFormModal';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { TemporaryPasswordModal } from '@/components/shared/Passwords';

type Tab = 'loans' | 'history' | 'fines' | 'payments' | 'reservations';

export default function MemberProfile() {
  const { id } = useParams();
  const { db, apply, update } = useLibrary();
  const attempt = useAttempt();
  const navigate = useNavigate();
  const lookups = useLookups();
  const [tab, setTab] = useState<Tab>('loans');
  const [editOpen, setEditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [paying, setPaying] = useState<Fine | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [issued, setIssued] = useState<{ name: string; memberId: string; password: string } | null>(null);

  const member = db.members.find((m) => m.id === id);
  if (!member) {
    return (
      <Card>
        <EmptyState
          icon={UserX}
          title="Member not found"
          description="This account may have been deleted."
          action={
            <Button variant="secondary" onClick={() => navigate('/admin/members')}>
              Back to members
            </Button>
          }
        />
      </Card>
    );
  }

  const summary = getMemberSummary(db, member.id);
  const history = db.loans.filter((l) => l.memberId === member.id && !isActive(l));
  const fines = db.fines.filter((f) => f.memberId === member.id);
  const payments = db.payments.filter((p) => p.memberId === member.id);
  const reservations = db.reservations.filter((r) => r.memberId === member.id);

  const changeStatus = (status: 'active' | 'suspended') =>
    attempt(() => {
      update((d) => setMemberStatus(d, member.id, status));
      return true;
    }, status === 'suspended' ? `${member.name} has been suspended.` : `${member.name} has been reinstated.`);

  const renew = (loan: Loan) =>
    attempt(() => apply((d) => renewLoan(d, loan.id)), (r) => `Renewed. Now due ${formatDate(r.loan.dueDate)}.`);

  const resetPassword = () => {
    const result = attempt(() => apply((d) => issueTemporaryPassword(d, member.id)));
    if (result) setIssued({ name: member.name, memberId: member.id, password: result.password });
    setResetOpen(false);
  };

  const bookCol = <T extends { bookId: string }>(): Column<T> => ({
    key: 'book',
    header: 'Book',
    primary: true,
    cell: (row) => <BookCell book={lookups.book(row.bookId)} to={`/books/${row.bookId}`} />,
  });

  const loanColumns: Column<Loan>[] = [
    bookCol<Loan>(),
    { key: 'txn', header: 'Transaction', cell: (l) => <span className="tabular">{l.id}</span> },
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
    {
      key: 'status',
      header: 'Status',
      cell: (l) =>
        isOverdue(l, db.settings) ? (
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status="overdue" />
            <span className="text-xs text-red-700">
              {overdueDays(l, db.settings)} days · {formatCurrency(accruingFine(l, db.settings))}
            </span>
          </span>
        ) : (
          <StatusBadge status={daysRemaining(l) <= 3 ? 'due_soon' : 'on_loan'} />
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (l) => {
        const blocker = renewBlocker(db, l.id);
        return (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" disabled={!!blocker} title={blocker ?? 'Extend the due date by one loan period'} onClick={() => renew(l)}>
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

  const historyColumns: Column<Loan>[] = [
    bookCol<Loan>(),
    { key: 'issued', header: 'Issued', cell: (l) => formatDate(l.issueDate), sortValue: (l) => l.issueDate },
    { key: 'due', header: 'Due', cell: (l) => formatDate(l.dueDate) },
    { key: 'returned', header: 'Returned', cell: (l) => formatDate(l.returnDate), sortValue: (l) => l.returnDate ?? '' },
    {
      key: 'late',
      header: 'Returned late',
      cell: (l) => (overdueDays(l, db.settings) > 0 ? `${overdueDays(l, db.settings)} days` : <span className="text-slate-400">On time</span>),
    },
  ];

  const fineColumns: Column<Fine>[] = [
    bookCol<Fine>(),
    { key: 'date', header: 'Raised', cell: (f) => formatDate(f.createdOn), sortValue: (f) => f.createdOn },
    { key: 'reason', header: 'Reason', cell: (f) => (f.reason === 'damage' ? 'Damage' : `${f.overdueDays} days overdue`) },
    { key: 'amount', header: 'Fine', align: 'right', cell: (f) => formatCurrency(f.amount), sortValue: (f) => f.amount },
    { key: 'balance', header: 'Balance', align: 'right', cell: (f) => formatCurrency(fineBalance(f)), sortValue: (f) => fineBalance(f) },
    { key: 'status', header: 'Status', cell: (f) => <StatusBadge status={fineStatus(f)} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (f) =>
        fineBalance(f) > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => setPaying(f)}>
            Record payment
          </Button>
        ) : null,
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    { key: 'id', header: 'Payment', primary: true, cell: (p) => <span className="tabular font-medium text-slate-900">{p.id}</span> },
    { key: 'date', header: 'Date', cell: (p) => formatDate(p.date), sortValue: (p) => p.date },
    { key: 'for', header: 'For', cell: (p) => lookups.bookTitle(db.fines.find((f) => f.id === p.fineId)?.bookId) },
    { key: 'method', header: 'Method', cell: (p) => p.method },
    { key: 'ref', header: 'Transaction ID', cell: (p) => <span className="tabular">{p.reference || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => formatCurrency(p.amount), sortValue: (p) => p.amount },
  ];

  const reservationColumns: Column<Reservation>[] = [
    bookCol<Reservation>(),
    { key: 'on', header: 'Reserved on', cell: (r) => formatDate(r.reservedOn), sortValue: (r) => r.reservedOn },
    { key: 'pos', header: 'Queue position', cell: (r) => (queuePosition(db, r) ? `#${queuePosition(db, r)}` : '—') },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <Link to="/admin/members" className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Members
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <MemberAvatar name={member.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-[28px] font-medium leading-tight tracking-tight text-slate-900">{member.name}</h1>
              <StatusBadge status={member.status} />
              {summary.overdueLoans.length > 0 && <StatusBadge status="overdue" />}
            </div>
            <p className="tabular mt-0.5 text-sm text-slate-500">
              {member.id} · {member.type}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
              <Detail label="Email">
                <span className="break-all">{member.email}</span>
              </Detail>
              <Detail label="Phone">
                <span className="tabular">{member.phone || '—'}</span>
              </Detail>
              <Detail label="Department">{member.department || '—'}</Detail>
              <Detail label="Joined">{formatDate(member.joined)}</Detail>
            </dl>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch lg:flex-row">
            <Button icon={ArrowLeftRight} onClick={() => navigate(`/admin/circulation?member=${member.id}`)} disabled={member.status === 'suspended'}>
              Issue book
            </Button>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="secondary" icon={KeyRound} onClick={() => setResetOpen(true)}>
              Reset password
            </Button>
            {member.status === 'active' ? (
              <Button variant="secondary" icon={Ban} onClick={() => setSuspendOpen(true)}>
                Suspend
              </Button>
            ) : (
              <Button variant="secondary" icon={CheckCircle2} onClick={() => changeStatus('active')}>
                Reinstate
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="stat-strip mt-5 grid grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current loans" value={String(summary.activeLoans.length)} hint={`Limit ${db.settings.maxLoansPerMember}`} icon={BookOpen} />
        <StatCard label="Overdue books" value={String(summary.overdueLoans.length)} hint={summary.accruing ? `${formatCurrency(summary.accruing)} accruing` : 'None'} icon={Ban} tone={summary.overdueLoans.length ? 'red' : 'slate'} />
        <StatCard label="Pending fines" value={formatCurrency(summary.outstanding)} hint={`${formatCurrency(summary.totalFined)} fined in total`} icon={IndianRupee} tone={summary.outstanding ? 'amber' : 'slate'} />
        <StatCard label="Books borrowed" value={String(summary.borrowedCount)} hint={`${summary.returnedCount} returned`} icon={CheckCircle2} tone="green" />
      </div>

      <Card className="mt-5 overflow-hidden">
        <Tabs<Tab>
          className="px-3 pt-1"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'loans', label: 'Current loans', count: summary.activeLoans.length },
            { key: 'history', label: 'Borrowing history', count: history.length },
            { key: 'fines', label: 'Fine history', count: fines.length },
            { key: 'payments', label: 'Payment history', count: payments.length },
            { key: 'reservations', label: 'Reservations', count: reservations.length },
          ]}
        />
        {tab === 'loans' && (
          <DataTable caption="Current loans" rows={summary.activeLoans} columns={loanColumns} rowKey={(l) => l.id} empty={<EmptyState icon={BookOpen} title="No books on loan" />} />
        )}
        {tab === 'history' && (
          <DataTable caption="Borrowing history" rows={history} columns={historyColumns} rowKey={(l) => l.id} pageSize={8} initialSort={{ key: 'returned', dir: 'desc' }} empty={<EmptyState title="No past loans" />} />
        )}
        {tab === 'fines' && (
          <DataTable caption="Fine history" rows={fines} columns={fineColumns} rowKey={(f) => f.id} pageSize={8} empty={<EmptyState icon={IndianRupee} title="No fines on record" />} />
        )}
        {tab === 'payments' && (
          <DataTable caption="Payment history" rows={payments} columns={paymentColumns} rowKey={(p) => p.id} pageSize={8} empty={<EmptyState icon={IndianRupee} title="No payments recorded" />} />
        )}
        {tab === 'reservations' && (
          <DataTable caption="Reservations" rows={reservations} columns={reservationColumns} rowKey={(r) => r.id} pageSize={8} initialSort={{ key: 'on', dir: 'desc' }} empty={<EmptyState title="No reservations" />} />
        )}
      </Card>

      <MemberFormModal open={editOpen} onClose={() => setEditOpen(false)} member={member} />
      <PaymentModal fine={paying} onClose={() => setPaying(null)} />
      <TemporaryPasswordModal issued={issued} onClose={() => setIssued(null)} />
      <ConfirmationDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetPassword}
        tone="primary"
        title="Reset this member's password?"
        confirmLabel="Issue temporary password"
        message={
          <>
            <span className="font-medium text-slate-900">{member.name}</span>'s current password stops working at once. You will be shown a
            temporary password to give them.
          </>
        }
      />
      <ConfirmationDialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => {
          changeStatus('suspended');
          setSuspendOpen(false);
        }}
        title="Suspend this member?"
        confirmLabel="Suspend member"
        message={
          <>
            <span className="font-medium text-slate-900">{member.name}</span> will not be able to borrow or reserve books until
            reinstated.
          </>
        }
      />
    </>
  );
}
