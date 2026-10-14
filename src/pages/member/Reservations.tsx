import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { Reservation } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { queuePosition } from '@/domain/selectors';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLookups } from '@/hooks/useLookups';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/States';
import { BookCell } from '@/components/shared/Entities';
import { ReservationList } from '@/components/shared/MemberCards';

type Tab = 'open' | 'past';

export default function MyReservations() {
  const { db } = useLibrary();
  const lookups = useLookups();
  const navigate = useNavigate();
  const { reservations, openReservations } = useCurrentMember();
  const [tab, setTab] = useState<Tab>('open');
  const past = reservations.filter((r) => !openReservations.includes(r));

  const columns: Column<Reservation>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (r) => <BookCell book={lookups.book(r.bookId)} to={`/books/${r.bookId}`} /> },
    { key: 'pos', header: 'Position', cell: (r) => (queuePosition(db, r) ? `#${queuePosition(db, r)}` : '—') },
    { key: 'on', header: 'Reserved date', cell: (r) => formatDate(r.reservedOn), sortValue: (r) => r.reservedOn },
    { key: 'closed', header: 'Closed', cell: (r) => formatDate(r.closedOn) },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="My Reservations"
        description="Your place in the queue for books that are checked out"
        actions={
          <Button icon={Search} onClick={() => navigate('/search')}>
            Find a book
          </Button>
        }
      />
      <Tabs<Tab>
        className="mb-5"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'open', label: 'Active', count: openReservations.length },
          { key: 'past', label: 'Past', count: past.length },
        ]}
      />
      {tab === 'open' ? (
        <ReservationList reservations={openReservations} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            caption="Past reservations"
            rows={past}
            columns={columns}
            rowKey={(r) => r.id}
            empty={<EmptyState title="No past reservations" description="Fulfilled, cancelled and expired reservations appear here." />}
          />
        </Card>
      )}
    </>
  );
}
