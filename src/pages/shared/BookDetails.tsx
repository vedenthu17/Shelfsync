import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, BookX, CalendarClock, Clock, MapPin, Pencil, Trash2, Users } from 'lucide-react';
import type { Loan, Reservation } from '@/types';
import { useAuth, useCan } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { closeReservation, createReservation, deleteBook } from '@/domain/actions';
import {
  estimatedAvailability,
  getInventory,
  getQueue,
  isActive,
  isOverdue,
  queuePosition,
} from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { cn, describeShelf, formatDate, plural } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Detail, Tabs } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmationDialog, Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { BookCover } from '@/components/shared/BookCover';
import { BookFormModal } from '@/components/shared/BookFormModal';
import { DamageTimeline } from '@/components/shared/DamageTimeline';
import { MemberCell } from '@/components/shared/Entities';

type Tab = 'history' | 'queue' | 'damage';

export default function BookDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const can = useCan();
  const { db, apply, update } = useLibrary();
  const attempt = useAttempt();
  const navigate = useNavigate();
  const lookups = useLookups();
  const [tab, setTab] = useState<Tab>('history');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const book = db.books.find((b) => b.id === id);
  const isStaff = can('catalog:manage');

  if (!book || (!isStaff && book.status === 'archived')) {
    return (
      <Card>
        <EmptyState
          icon={BookX}
          title="Book not found"
          description="This title may have been removed from the catalogue."
          action={
            <Button variant="secondary" onClick={() => navigate('/search')}>
              Back to search
            </Button>
          }
        />
      </Card>
    );
  }

  const inventory = getInventory(db, book);
  const queue = getQueue(db, book.id);
  const waiting = queue.filter((r) => r.status === 'waiting').length;
  const loans = db.loans.filter((l) => l.bookId === book.id);
  const damage = db.damage.filter((d) => d.bookId === book.id);
  const shelf = describeShelf(book.shelf);
  const usable = inventory.total - inventory.damaged;

  // Member-specific state
  const memberId = user?.memberId;
  const myLoan = memberId ? loans.find((l) => l.memberId === memberId && isActive(l)) : undefined;
  const myReservation = memberId ? queue.find((r) => r.memberId === memberId) : undefined;
  const myPosition = myReservation ? queuePosition(db, myReservation) : null;
  const nextEstimate = estimatedAvailability(db, book.id, myPosition ?? queue.length + 1);

  const reserve = () => {
    if (!memberId) return;
    attempt(
      () => apply((d) => createReservation(d, { memberId, bookId: book.id })),
      (r) =>
        r.reservation.status === 'ready'
          ? 'A copy is being held for you. Collect it from the circulation desk.'
          : `You have joined the queue at position ${queuePosition(r.db, r.reservation)}.`,
    );
  };

  const cancelReservation = () => {
    if (!myReservation) return;
    attempt(() => {
      update((d) => closeReservation(d, myReservation.id, 'cancelled'));
      return true;
    }, 'Reservation cancelled.');
  };

  const remove = () => {
    const ok = attempt(() => {
      update((d) => deleteBook(d, book.id));
      return true;
    }, `"${book.title}" was deleted.`);
    setDeleteOpen(false);
    if (ok) navigate('/admin/books');
  };

  const loanColumns: Column<Loan>[] = [
    { key: 'id', header: 'Transaction', primary: true, cell: (l) => <span className="tabular font-medium text-slate-900">{l.id}</span> },
    { key: 'member', header: 'Member', cell: (l) => <MemberCell member={lookups.member(l.memberId)} to={`/admin/members/${l.memberId}`} /> },
    { key: 'issued', header: 'Issued', cell: (l) => formatDate(l.issueDate), sortValue: (l) => l.issueDate },
    { key: 'due', header: 'Due', cell: (l) => formatDate(l.dueDate), sortValue: (l) => l.dueDate },
    { key: 'returned', header: 'Returned', cell: (l) => formatDate(l.returnDate) },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => <StatusBadge status={!isActive(l) ? 'returned' : isOverdue(l, db.settings) ? 'overdue' : 'on_loan'} />,
    },
  ];

  const queueColumns: Column<Reservation>[] = [
    { key: 'pos', header: 'Position', cell: (r) => <span className="tabular font-semibold text-slate-900">#{queuePosition(db, r)}</span> },
    { key: 'member', header: 'Member', primary: true, cell: (r) => <MemberCell member={lookups.member(r.memberId)} to={`/admin/members/${r.memberId}`} /> },
    { key: 'on', header: 'Reserved on', cell: (r) => formatDate(r.reservedOn) },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <BookCover book={book} size="lg" className="mx-auto sm:mx-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-700">{book.category}</span>
                {book.status === 'archived' && <StatusBadge status="archived" />}
              </div>
              <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{book.title}</h1>
              <p className="mt-1 text-base text-slate-600">{book.author}</p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{book.description || 'No description available.'}</p>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
                <Detail label="ISBN">
                  <span className="tabular">{book.isbn}</span>
                </Detail>
                <Detail label="Publisher">{book.publisher || '—'}</Detail>
                <Detail label="Published">{book.year}</Detail>
                <Detail label="Category">{book.category}</Detail>
                <Detail label="Subject">{book.subject || '—'}</Detail>
                <Detail label="Shelf location">
                  <span className="tabular">{book.shelf || '—'}</span>
                </Detail>
              </dl>

              {isStaff && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                  <Button icon={ArrowLeftRight} onClick={() => navigate(`/admin/circulation?book=${book.id}`)} disabled={inventory.available === 0}>
                    Issue this book
                  </Button>
                  <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                  <Button variant="secondary" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[17px] font-semibold leading-snug text-slate-900">Availability</h2>
              <StatusBadge status={inventory.state} />
            </div>
            <p className="mt-3 font-serif text-xl font-medium text-slate-900">
              {inventory.available > 0 ? (
                <>
                  {inventory.available} of {inventory.total} copies available
                </>
              ) : (
                'Currently unavailable'
              )}
            </p>
            <div
              className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${inventory.available} available, ${inventory.issued} issued, ${inventory.reserved} on hold, ${inventory.damaged} damaged`}
            >
              {(
                [
                  [inventory.available, 'bg-emerald-500'],
                  [inventory.issued, 'bg-brand-500'],
                  [inventory.reserved, 'bg-amber-400'],
                  [inventory.damaged, 'bg-red-500'],
                ] as const
              ).map(([n, color], i) => n > 0 && <span key={i} className={cn('h-full', color)} style={{ flex: n }} />)}
            </div>

            {isStaff ? (
              <dl className="mt-4 grid grid-cols-5 divide-x divide-slate-200 border-y border-slate-200 text-center">
                {(
                  [
                    ['Total', inventory.total],
                    ['Available', inventory.available],
                    ['Issued', inventory.issued],
                    ['Reserved', inventory.reserved],
                    ['Damaged', inventory.damaged],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="px-0.5 py-2.5">
                    <dd className="font-serif text-xl font-medium lining-nums leading-none text-slate-900">{n}</dd>
                    <dt className="mt-1.5 font-mono text-[8.5px] font-medium uppercase leading-none tracking-[0.03em] text-slate-500">{label}</dt>
                  </div>
                ))}
              </dl>
            ) : (
              inventory.available === 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  {usable === 0 ? 'All copies are out for repair.' : 'All copies are on loan or on hold.'}
                </p>
              )
            )}

            {(inventory.available === 0 || queue.length > 0) && (
              <dl className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <Users className="h-4 w-4" aria-hidden />
                    People waiting
                  </dt>
                  <dd className="tabular font-medium text-slate-900">{waiting}</dd>
                </div>
                {myPosition && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-slate-500">
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      Your queue position
                    </dt>
                    <dd className="tabular font-medium text-slate-900">
                      #{myPosition} of {queue.length}
                    </dd>
                  </div>
                )}
                {inventory.available === 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-slate-500">
                      <Clock className="h-4 w-4" aria-hidden />
                      Estimated availability
                    </dt>
                    <dd className="font-medium text-slate-900">{nextEstimate ? formatDate(nextEstimate) : 'After repair'}</dd>
                  </div>
                )}
              </dl>
            )}

            <div className="mt-5 space-y-2">
              {can('reservations:self') &&
                (myLoan ? (
                  <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                    You have this book on loan. It is due on {formatDate(myLoan.dueDate)}.
                  </p>
                ) : myReservation ? (
                  <>
                    <p
                      className={cn(
                        'rounded-lg px-3 py-2.5 text-sm',
                        myReservation.status === 'ready' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900',
                      )}
                    >
                      {myReservation.status === 'ready'
                        ? 'A copy is being held for you at the circulation desk.'
                        : `You are in the reservation queue at position ${myPosition}.`}
                    </p>
                    <Button variant="secondary" className="w-full" onClick={cancelReservation}>
                      Cancel reservation
                    </Button>
                  </>
                ) : inventory.available > 0 && queue.length === 0 ? (
                  <Button className="w-full" onClick={reserve}>
                    Request for pickup
                  </Button>
                ) : (
                  <Button className="w-full" icon={CalendarClock} onClick={reserve}>
                    Join Reservation Queue
                  </Button>
                ))}
              <Button variant="secondary" icon={MapPin} className="w-full" onClick={() => setShelfOpen(true)}>
                View shelf location
              </Button>
            </div>
            {can('reservations:self') && !myLoan && !myReservation && inventory.available > 0 && queue.length === 0 && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                A copy is held at the desk for {plural(db.settings.holdDays, 'day')}. Bring your member ID to borrow it.
              </p>
            )}
          </Card>
        </div>
      </div>

      {isStaff && (
        <Card className="mt-5 overflow-hidden">
          <Tabs<Tab>
            className="px-3 pt-1"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'history', label: 'Transaction history', count: loans.length },
              { key: 'queue', label: 'Reservation queue', count: queue.length },
              { key: 'damage', label: 'Damage history', count: damage.length },
            ]}
          />
          {tab === 'history' && (
            <DataTable
              caption="Transaction history"
              rows={loans}
              columns={loanColumns}
              rowKey={(l) => l.id}
              pageSize={8}
              initialSort={{ key: 'issued', dir: 'desc' }}
              empty={<EmptyState title="No transactions yet" description="This title has not been issued." />}
            />
          )}
          {tab === 'queue' && (
            <DataTable
              caption="Reservation queue"
              rows={queue}
              columns={queueColumns}
              rowKey={(r) => r.id}
              empty={
                <EmptyState
                  icon={CalendarClock}
                  title="No one is waiting"
                  description="Reservations for this title will appear here in queue order."
                  action={
                    <Link to="/admin/reservations" className="text-sm font-medium text-brand-700 hover:underline">
                      Open reservations
                    </Link>
                  }
                />
              }
            />
          )}
          {tab === 'damage' && (
            <div className="p-5">
              <DamageTimeline reports={damage} memberName={lookups.memberName} onSelect={(r) => navigate(`/admin/damage?report=${r.id}`)} />
            </div>
          )}
        </Card>
      )}

      <Modal open={shelfOpen} onClose={() => setShelfOpen(false)} title="Shelf location" description={book.title} size="sm">
        <div className="grid grid-cols-3 gap-3 text-center">
          {(
            [
              ['Section', shelf.section],
              ['Rack', shelf.rack],
              ['Shelf', shelf.level],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 py-4">
              <p className="tabular text-2xl font-semibold text-brand-800">{value}</p>
              <p className="eyebrow mt-1.5">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Go to <span className="font-medium text-slate-900">Section {shelf.section}</span> ({book.category}), find rack{' '}
          <span className="font-medium text-slate-900">{shelf.rack}</span> and look on shelf{' '}
          <span className="font-medium text-slate-900">{shelf.level}</span> from the top. Shelf code:{' '}
          <span className="tabular font-medium text-slate-900">{book.shelf}</span>.
        </p>
      </Modal>

      {isStaff && (
        <>
          <BookFormModal open={editOpen} onClose={() => setEditOpen(false)} book={book} />
          <ConfirmationDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={remove}
            title="Delete this book?"
            confirmLabel="Delete book"
            message={
              <>
                <span className="font-medium text-slate-900">{book.title}</span> and its {plural(book.totalCopies, 'copy', 'copies')} will be
                removed from the catalogue. Open reservations are cancelled. This cannot be undone.
              </>
            }
          />
        </>
      )}
    </>
  );
}
