import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookMarked, BookOpen, CalendarDays, Clock, IndianRupee, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { popularBookIds } from '@/domain/analytics';
import { daysRemaining, getInventory, overdueDays } from '@/domain/selectors';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLookups } from '@/hooks/useLookups';
import { cn, formatCurrency, formatDate, greeting, plural } from '@/lib/utils';
import { Card, CardHeader, StatCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { BookCard } from '@/components/shared/Entities';
import { LibraryCard } from '@/components/shared/LibraryCard';
import { LoanCard } from '@/components/shared/MemberCards';

export default function MemberDashboard() {
  const { user } = useAuth();
  const { db } = useLibrary();
  const lookups = useLookups();
  const { member, summary, activeLoans, dueSoon, openReservations } = useCurrentMember();

  const visible = useMemo(() => db.books.filter((b) => b.status === 'active'), [db.books]);
  const popular = useMemo(
    () => popularBookIds(db, 12).map((id) => visible.find((b) => b.id === id)).filter((b) => !!b).slice(0, 3),
    [db, visible],
  );
  const recent = useMemo(() => [...visible].sort((a, b) => b.addedOn.localeCompare(a.addedOn)).slice(0, 3), [visible]);
  const ready = openReservations.filter((r) => r.status === 'ready');

  return (
    <>
      <section className="glass mb-6 grid items-center gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="font-serif text-[32px] font-medium leading-[1.08] tracking-tight text-slate-900 sm:text-[42px]">
            {greeting()}, <span className="italic text-brand-700">{user?.name.split(' ')[0]}.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
            {summary.overdueLoans.length > 0
              ? `You have ${plural(summary.overdueLoans.length, 'overdue book')}. Please return ${summary.overdueLoans.length === 1 ? 'it' : 'them'} soon.`
              : activeLoans.length > 0
                ? `You have ${plural(activeLoans.length, 'book')} on loan.`
                : 'You have no books on loan right now.'}{' '}
            Show your reader's card at the desk to borrow.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/search"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-key hover:bg-brand-800"
            >
              <Search className="h-4 w-4" aria-hidden />
              Discover books
            </Link>
            <Link
              to="/member/books"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-4 text-sm font-medium text-slate-800 shadow-key-light hover:border-slate-400 hover:bg-white"
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              My books
            </Link>
          </div>
        </div>
        {member && <LibraryCard member={member} libraryName={db.settings.libraryName} className="lg:rotate-1" />}
      </section>

      {ready.length > 0 && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-600/30 bg-emerald-50/80 px-4 py-3">
          <p className="text-sm text-emerald-900">
            <span className="font-semibold">Ready for pickup:</span> {ready.map((r) => `“${lookups.bookTitle(r.bookId)}”`).join(', ')}{' '}
            {ready.length === 1 ? 'is' : 'are'} being held for you at the circulation desk.
          </p>
          <Link to="/member/reservations" className="text-sm font-medium text-emerald-800 hover:underline">
            View reservations
          </Link>
        </div>
      )}

      <div className="stat-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Books Currently Borrowed" value={String(activeLoans.length)} hint={`Limit ${db.settings.maxLoansPerMember}`} icon={BookOpen} to="/member/books" />
        <StatCard label="Due Soon" value={String(dueSoon.length)} hint="Within 3 days" icon={Clock} tone={dueSoon.length ? 'amber' : 'slate'} to="/member/books" />
        <StatCard label="Overdue" value={String(summary.overdueLoans.length)} hint={summary.accruing ? `${formatCurrency(summary.accruing)} accruing` : 'All on time'} icon={AlertTriangle} tone={summary.overdueLoans.length ? 'red' : 'slate'} to="/member/books" />
        <StatCard label="Pending Fine" value={formatCurrency(summary.outstanding)} hint={summary.outstanding ? 'Pay at the desk' : 'Nothing owed'} icon={IndianRupee} tone={summary.outstanding ? 'amber' : 'green'} to="/member/fines" />
        <StatCard label="Reservations" value={String(openReservations.length)} hint={ready.length ? `${ready.length} ready for pickup` : 'In queue'} icon={BookMarked} to="/member/reservations" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="loans-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="loans-heading" className="font-serif text-xl font-semibold leading-snug text-slate-900">
              My Current Loans
            </h2>
            <Link to="/member/books" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {activeLoans.length === 0 ? (
            <Card>
              <EmptyState
                icon={BookOpen}
                title="No books on loan"
                description="Find something to read in the catalogue."
                action={
                  <Link to="/search" className="text-sm font-medium text-brand-700 hover:underline">
                    Discover books
                  </Link>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {activeLoans.map((l) => (
                <li key={l.id}>
                  <LoanCard loan={l} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="h-fit">
          <CardHeader title="Upcoming due dates" />
          {activeLoans.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing due" className="py-8" />
          ) : (
            <ol className="divide-y divide-slate-100">
              {activeLoans.map((l) => {
                const left = daysRemaining(l);
                const late = overdueDays(l, db.settings);
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded border font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.08em]',
                        late > 0
                          ? 'border-red-600/35 bg-red-50 text-red-700'
                          : left <= 3
                            ? 'border-amber-600/40 bg-amber-50 text-amber-800'
                            : 'border-slate-300 bg-slate-50 text-slate-600',
                      )}
                      aria-hidden
                    >
                      <span className="font-serif text-lg font-semibold tracking-normal">{formatDate(l.dueDate).slice(0, 2)}</span>
                      {formatDate(l.dueDate).slice(3, 6)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{lookups.bookTitle(l.bookId)}</p>
                      <p className={cn('text-xs', late > 0 ? 'font-medium text-red-700' : 'text-slate-500')}>
                        {late > 0 ? `${plural(late, 'day')} overdue` : left === 0 ? 'Due today' : `Due ${formatDate(l.dueDate)} · ${plural(left, 'day')} left`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {[
        { title: 'Browse Popular Books', note: 'Most borrowed titles in the library', books: popular },
        { title: 'Recently Added', note: 'New arrivals in the catalogue', books: recent },
      ].map((section) => (
        <section key={section.title} className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold leading-snug text-slate-900">{section.title}</h2>
              <p className="text-[13px] text-slate-500">{section.note}</p>
            </div>
            <Link to="/search" className="text-sm font-medium text-brand-700 hover:underline">
              Browse all
            </Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.books.map((b) => (
              <li key={b.id}>
                <BookCard book={b} inventory={getInventory(db, b)} to={`/books/${b.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
