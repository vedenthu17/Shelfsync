import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, RefreshCw } from 'lucide-react';
import type { Loan, Reservation } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { closeReservation, renewBlocker, renewLoan } from '@/domain/actions';
import { accruingFine, daysRemaining, estimatedAvailability, overdueDays, queuePosition } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { addDays, cn, daysBetween, formatCurrency, formatDate, plural } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { BookCover } from './BookCover';

/** A member's open loan: dates, time left, any fine building up, and a way to renew it. */
export function LoanCard({ loan }: { loan: Loan }) {
  const { db, apply } = useLibrary();
  const attempt = useAttempt();
  const lookups = useLookups();
  const book = lookups.book(loan.bookId);
  const late = overdueDays(loan, db.settings);
  const left = daysRemaining(loan);
  const total = Math.max(1, daysBetween(loan.issueDate, loan.dueDate));
  const elapsed = Math.min(100, Math.max(4, ((total - left) / total) * 100));
  const state = late > 0 ? 'overdue' : left <= 3 ? 'due_soon' : 'on_loan';
  const renewals = loan.renewals ?? 0;
  const limit = db.settings.maxRenewals;
  const blocker = renewBlocker(db, loan.id);

  const renew = () => attempt(() => apply((d) => renewLoan(d, loan.id)), (r) => `Renewed. Now due ${formatDate(r.loan.dueDate)}.`);

  return (
    <article className="glass-flat flex h-full gap-4 rounded-xl p-4">
      {book && (
        <Link to={`/books/${book.id}`} className="shrink-0 rounded-md">
          <BookCover book={book} size="sm" className="w-16" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-slate-900">
              {book ? <Link to={`/books/${book.id}`} className="hover:text-brand-700">{book.title}</Link> : 'Removed title'}
            </h3>
            <p className="truncate text-[13px] text-slate-500">{book?.author}</p>
          </div>
          <StatusBadge status={state} />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 text-[13px]">
          <div>
            <dt className="eyebrow">Issued</dt>
            <dd className="text-slate-700">{formatDate(loan.issueDate)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Due</dt>
            <dd className={cn('font-medium', late > 0 ? 'text-red-700' : 'text-slate-900')}>{formatDate(loan.dueDate)}</dd>
          </div>
        </dl>

        <div className="mt-3">
          <div
            className={cn('h-1.5 overflow-hidden rounded-sm', late > 0 ? 'bg-red-100' : left <= 3 ? 'bg-amber-100' : 'bg-brand-100')}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(elapsed)}
            aria-label="Loan period used"
          >
            <div
              className={cn('h-full', late > 0 ? 'bg-red-500' : left <= 3 ? 'bg-amber-500' : 'bg-brand-500')}
              style={{ width: `${elapsed}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-600">
            {late > 0 ? (
              <>
                <span className="font-medium text-red-700">{plural(late, 'day')} overdue</span> · fine so far{' '}
                <span className="font-medium text-slate-900">{formatCurrency(accruingFine(loan, db.settings))}</span>
              </>
            ) : left === 0 ? (
              <span className="font-medium text-amber-700">Due today</span>
            ) : (
              <>{plural(left, 'day')} remaining</>
            )}
          </p>
        </div>

        {limit > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-900/10 pt-3">
            {/* When the loan cannot be renewed, say why rather than just greying the button. */}
            <p className="min-w-0 text-xs text-slate-600">{blocker ?? (renewals > 0 ? `Renewed ${renewals} of ${limit}` : `${plural(limit, 'renewal')} allowed`)}</p>
            <Button size="sm" variant="secondary" icon={RefreshCw} disabled={!!blocker} onClick={renew}>
              Renew
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

/** A member's open reservation with queue position and a cancel action. */
export function ReservationCard({ reservation }: { reservation: Reservation }) {
  const { db, update } = useLibrary();
  const attempt = useAttempt();
  const lookups = useLookups();
  const [confirming, setConfirming] = useState(false);
  const book = lookups.book(reservation.bookId);
  const position = queuePosition(db, reservation);
  const open = reservation.status === 'waiting' || reservation.status === 'ready';
  const estimate = reservation.status === 'waiting' && position ? estimatedAvailability(db, reservation.bookId, position) : null;

  const cancel = () => {
    attempt(() => {
      update((d) => closeReservation(d, reservation.id, 'cancelled'));
      return true;
    }, 'Reservation cancelled.');
    setConfirming(false);
  };

  return (
    <article className="glass-flat flex h-full gap-4 rounded-xl p-4">
      {book && (
        <Link to={`/books/${book.id}`} className="shrink-0 rounded-md">
          <BookCover book={book} size="sm" className="w-16" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-slate-900">
              {book ? <Link to={`/books/${book.id}`} className="hover:text-brand-700">{book.title}</Link> : 'Removed title'}
            </h3>
            <p className="truncate text-[13px] text-slate-500">{book?.author}</p>
          </div>
          <StatusBadge status={reservation.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 text-[13px]">
          <div>
            <dt className="eyebrow">Queue position</dt>
            <dd className="tabular font-medium text-slate-900">{position ? `#${position}` : '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">Reserved</dt>
            <dd className="text-slate-700">{formatDate(reservation.reservedOn)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-600">
          {reservation.status === 'ready' ? (
            <span className="font-medium text-emerald-700">
              Collect by {formatDate(addDays(reservation.readyOn ?? reservation.reservedOn, db.settings.holdDays))} at the circulation desk
            </span>
          ) : reservation.status === 'waiting' ? (
            estimate ? `Estimated availability ${formatDate(estimate)}` : 'We will notify you when a copy is free'
          ) : (
            `Closed ${formatDate(reservation.closedOn)}`
          )}
        </p>
        {open && (
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setConfirming(true)}>
            Cancel reservation
          </Button>
        )}
      </div>
      <ConfirmationDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={cancel}
        title="Cancel this reservation?"
        confirmLabel="Cancel reservation"
        message={
          <>
            You will lose your place in the queue for <span className="font-medium text-slate-900">{book?.title}</span>.
          </>
        }
      />
    </article>
  );
}

export function ReservationList({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={BookMarked}
        title="No reservations"
        description="When a book you want is checked out, join its queue from the book page."
        action={
          <Link to="/search" className="text-sm font-medium text-brand-700 hover:underline">
            Discover books
          </Link>
        }
      />
    );
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {reservations.map((r) => (
        <li key={r.id}>
          <ReservationCard reservation={r} />
        </li>
      ))}
    </ul>
  );
}
