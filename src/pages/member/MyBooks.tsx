import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, History } from 'lucide-react';
import type { Loan } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { overdueDays } from '@/domain/selectors';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLookups } from '@/hooks/useLookups';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, PageHeader, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/States';
import { BookCell } from '@/components/shared/Entities';
import { LoanCard, ReservationList } from '@/components/shared/MemberCards';

type Tab = 'current' | 'history' | 'reservations';
const tabKeys: Tab[] = ['current', 'history', 'reservations'];

export default function MyBooks() {
  const { db } = useLibrary();
  const lookups = useLookups();
  const { activeLoans, history, openReservations, fines } = useCurrentMember();
  const [params, setParams] = useSearchParams();
  const tab = tabKeys.find((t) => t === params.get('tab')) ?? 'current';

  const fineFor = (loan: Loan) => fines.filter((f) => f.loanId === loan.id).reduce((sum, f) => sum + f.amount, 0);

  const historyColumns: Column<Loan>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (l) => <BookCell book={lookups.book(l.bookId)} to={`/books/${l.bookId}`} />, sortValue: (l) => lookups.bookTitle(l.bookId) },
    { key: 'issued', header: 'Issue date', cell: (l) => formatDate(l.issueDate), sortValue: (l) => l.issueDate },
    { key: 'due', header: 'Due date', cell: (l) => formatDate(l.dueDate), sortValue: (l) => l.dueDate },
    { key: 'returned', header: 'Returned', cell: (l) => formatDate(l.returnDate), sortValue: (l) => l.returnDate ?? '' },
    {
      key: 'late',
      header: 'Return status',
      cell: (l) => {
        const late = overdueDays(l, db.settings);
        return late > 0 ? <span className="text-red-700">{late} days late</span> : <span className="text-emerald-700">On time</span>;
      },
    },
    { key: 'fine', header: 'Fine', align: 'right', cell: (l) => (fineFor(l) ? formatCurrency(fineFor(l)) : <span className="text-slate-400">—</span>), sortValue: fineFor },
  ];

  return (
    <>
      <PageHeader title="My Books" description="Your loans, borrowing history and reservations" />
      <Tabs<Tab>
        className="mb-5"
        active={tab}
        onChange={(t) => setParams(t === 'current' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { key: 'current', label: 'Current Loans', count: activeLoans.length },
          { key: 'history', label: 'Borrowing History', count: history.length },
          { key: 'reservations', label: 'Reservations', count: openReservations.length },
        ]}
      />

      {tab === 'current' &&
        (activeLoans.length === 0 ? (
          <Card>
            <EmptyState
              icon={BookOpen}
              title="No books on loan"
              description="Books issued to you at the circulation desk will appear here."
              action={
                <Link to="/search" className="text-sm font-medium text-brand-700 hover:underline">
                  Discover books
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {activeLoans.map((l) => (
              <li key={l.id}>
                <LoanCard loan={l} />
              </li>
            ))}
          </ul>
        ))}

      {tab === 'history' && (
        <Card className="overflow-hidden">
          <DataTable
            caption="Borrowing history"
            rows={history}
            columns={historyColumns}
            rowKey={(l) => l.id}
            initialSort={{ key: 'issued', dir: 'desc' }}
            empty={<EmptyState icon={History} title="No borrowing history yet" description="Books you return will be listed here." />}
          />
        </Card>
      )}

      {tab === 'reservations' && <ReservationList reservations={openReservations} />}
    </>
  );
}
