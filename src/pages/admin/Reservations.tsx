import { useMemo, useState } from 'react';
import { BellRing, BookUp, CalendarClock, CalendarPlus, Clock, XCircle } from 'lucide-react';
import type { Book, Member, Reservation, ReservationStatus } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { closeReservation, createReservation, issueBook, notifyNextInQueue } from '@/domain/actions';
import { getInventory, getNotifiableReservations, queuePosition } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { addDays, formatDate, matches, plural } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader, StatCard, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown } from '@/components/ui/Dropdown';
import { SearchBar, Select } from '@/components/ui/Form';
import { ConfirmationDialog, Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { BookCell, MemberCell } from '@/components/shared/Entities';
import { Picker } from '@/components/shared/Picker';

type Tab = 'open' | 'closed';
const closedStatuses: ReservationStatus[] = ['fulfilled', 'cancelled', 'expired'];

export default function Reservations() {
  const { db, apply, update } = useLibrary();
  const attempt = useAttempt();
  const lookups = useLookups();
  const [tab, setTab] = useState<Tab>('open');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMember, setNewMember] = useState<Member | undefined>();
  const [newBook, setNewBook] = useState<Book | undefined>();

  const open = db.reservations.filter((r) => r.status === 'waiting' || r.status === 'ready');
  const closed = db.reservations.filter((r) => closedStatuses.includes(r.status));
  const notifiable = useMemo(() => getNotifiableReservations(db), [db]);

  const rows = useMemo(
    () =>
      (tab === 'open' ? open : closed)
        .filter((r) => matches(query, lookups.bookTitle(r.bookId), lookups.memberName(r.memberId), r.memberId, r.id))
        .filter((r) => !status || r.status === status)
        .sort((a, b) =>
          tab === 'open'
            ? lookups.bookTitle(a.bookId).localeCompare(lookups.bookTitle(b.bookId)) || a.reservedOn.localeCompare(b.reservedOn)
            : (b.closedOn ?? b.reservedOn).localeCompare(a.closedOn ?? a.reservedOn),
        ),
    // `open`/`closed` are derived from db.reservations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.reservations, tab, query, status, lookups],
  );

  const notify = (bookId: string) =>
    attempt(
      () => apply((d) => notifyNextInQueue(d, bookId)),
      (r) => `${lookups.memberName(r.reservation.memberId)} has been notified. A copy is on hold for them.`,
    );

  const fulfil = (r: Reservation) =>
    attempt(
      () => apply((d) => issueBook(d, { memberId: r.memberId, bookId: r.bookId })),
      (res) => `Issued to ${lookups.memberName(r.memberId)} (${res.loan.id}). Reservation fulfilled.`,
    );

  const close = (r: Reservation, as: 'cancelled' | 'expired') =>
    attempt(() => {
      update((d) => closeReservation(d, r.id, as));
      return true;
    }, as === 'cancelled' ? 'Reservation cancelled.' : 'Reservation marked as expired. The held copy is back on the shelf.');

  const create = () => {
    if (!newMember || !newBook) return;
    const result = attempt(
      () => apply((d) => createReservation(d, { memberId: newMember.id, bookId: newBook.id })),
      (r) =>
        r.reservation.status === 'ready'
          ? `A copy is now on hold for ${newMember.name}.`
          : `${newMember.name} added to the queue at position ${queuePosition(r.db, r.reservation)}.`,
    );
    if (result) {
      setCreateOpen(false);
      setNewMember(undefined);
      setNewBook(undefined);
    }
  };

  const availabilityCell = (r: Reservation) => {
    const book = lookups.book(r.bookId);
    if (!book) return '—';
    if (r.status === 'ready') {
      return (
        <span className="text-emerald-700">
          Held until {formatDate(addDays(r.readyOn ?? r.reservedOn, db.settings.holdDays))}
        </span>
      );
    }
    const free = getInventory(db, book).available;
    return free > 0 ? <span className="font-medium text-emerald-700">{plural(free, 'copy', 'copies')} free now</span> : <span className="text-slate-500">All copies out</span>;
  };

  const columns: Column<Reservation>[] = [
    ...(tab === 'open'
      ? [
          {
            key: 'pos',
            header: 'Queue position',
            cell: (r: Reservation) => <span className="tabular font-semibold text-slate-900">#{queuePosition(db, r)}</span>,
          },
        ]
      : []),
    { key: 'book', header: 'Book', primary: true, cell: (r) => <BookCell book={lookups.book(r.bookId)} to={`/admin/books/${r.bookId}`} /> },
    { key: 'member', header: 'Member', cell: (r) => <MemberCell member={lookups.member(r.memberId)} to={`/admin/members/${r.memberId}`} /> },
    { key: 'on', header: 'Reserved on', cell: (r) => formatDate(r.reservedOn), sortValue: (r) => r.reservedOn },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    tab === 'open'
      ? { key: 'availability', header: 'Availability', cell: availabilityCell }
      : { key: 'closed', header: 'Closed on', cell: (r) => formatDate(r.closedOn) },
    ...(tab === 'open'
      ? [
          {
            key: 'actions',
            header: 'Actions',
            actions: true,
            cell: (r: Reservation) => {
              const head = notifiable.some((n) => n.id === r.id);
              return (
                <Dropdown
                  label="Reservation actions"
                  items={[
                    ...(r.status === 'ready' ? [{ label: 'Issue to member', icon: BookUp, onSelect: () => void fulfil(r) }] : []),
                    ...(r.status === 'waiting'
                      ? [{ label: 'Notify — copy available', icon: BellRing, disabled: !head, onSelect: () => void notify(r.bookId) }]
                      : []),
                    ...(r.status === 'ready' ? [{ label: 'Mark as expired', icon: Clock, onSelect: () => void close(r, 'expired') }] : []),
                    { label: 'Cancel reservation', icon: XCircle, tone: 'danger' as const, separated: true, onSelect: () => setCancelling(r) },
                  ]}
                />
              );
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Queues for titles that are checked out, and copies on hold for pickup"
        actions={
          <Button icon={CalendarPlus} onClick={() => setCreateOpen(true)}>
            New Reservation
          </Button>
        }
      />

      {notifiable.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifiable.map((r) => (
            <div key={r.id} role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="flex items-start gap-2.5 text-sm text-brand-900">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">Book available — notify next member in queue.</span> “{lookups.bookTitle(r.bookId)}” has a free
                  copy and {lookups.memberName(r.memberId)} is first in line.
                </span>
              </p>
              <Button size="sm" onClick={() => notify(r.bookId)}>
                Notify member
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="stat-strip mb-5 grid grid-cols-2 lg:grid-cols-4">
        <StatCard label="Waiting in queue" value={String(open.filter((r) => r.status === 'waiting').length)} icon={CalendarClock} tone="amber" />
        <StatCard label="Ready for pickup" value={String(open.filter((r) => r.status === 'ready').length)} hint={`Held for ${plural(db.settings.holdDays, 'day')}`} icon={BellRing} tone="green" />
        <StatCard label="Titles with a queue" value={String(new Set(open.map((r) => r.bookId)).size)} icon={BookUp} />
        <StatCard label="Fulfilled" value={String(closed.filter((r) => r.status === 'fulfilled').length)} hint="All time" icon={BookUp} tone="slate" />
      </div>

      <Card className="overflow-hidden">
        <Tabs<Tab>
          className="px-3 pt-1"
          active={tab}
          onChange={(t) => {
            setTab(t);
            setStatus('');
          }}
          tabs={[
            { key: 'open', label: 'Active queue', count: open.length },
            { key: 'closed', label: 'History', count: closed.length },
          ]}
        />
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SearchBar value={query} onChange={setQuery} placeholder="Search by book or member…" />
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={(tab === 'open' ? (['waiting', 'ready'] as const) : closedStatuses).map((s) => ({ value: s, label: statusLabel(s) }))}
          />
        </div>
        <DataTable
          caption="Reservations"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          empty={<EmptyState icon={CalendarClock} title="No reservations here" description={tab === 'open' ? 'No one is waiting for a book right now.' : 'Closed reservations will appear here.'} />}
        />
      </Card>

      <ConfirmationDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) close(cancelling, 'cancelled');
          setCancelling(null);
        }}
        title="Cancel this reservation?"
        confirmLabel="Cancel reservation"
        message={
          <>
            {lookups.memberName(cancelling?.memberId)} will lose their place in the queue for{' '}
            <span className="font-medium text-slate-900">{lookups.bookTitle(cancelling?.bookId)}</span>.
          </>
        }
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New reservation"
        description="Place a member in the queue for a title."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!newMember || !newBook}>
              Reserve
            </Button>
          </>
        }
      >
        <div className="min-h-[18rem] space-y-4">
          <Picker<Member>
            label="Member"
            placeholder="Search by member ID, name or email"
            items={db.members}
            selected={newMember}
            onSelect={setNewMember}
            itemKey={(m) => m.id}
            filter={(m, q) => matches(q, m.id, m.name, m.email)}
            renderItem={(m) => <MemberCell member={m} />}
            renderSelected={(m) => <MemberCell member={m} />}
          />
          <Picker<Book>
            label="Book"
            placeholder="Search by ISBN, title or author"
            items={db.books.filter((b) => b.status === 'active')}
            selected={newBook}
            onSelect={setNewBook}
            itemKey={(b) => b.id}
            filter={(b, q) => matches(q, b.title, b.author, b.isbn)}
            renderItem={(b) => (
              <span className="flex items-center justify-between gap-3">
                <BookCell book={b} />
                <StatusBadge status={getInventory(db, b).state} />
              </span>
            )}
            renderSelected={(b) => <BookCell book={b} />}
          />
        </div>
      </Modal>
    </>
  );
}
