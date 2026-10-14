import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  BookCheck,
  BookCopy,
  BookUp,
  CalendarClock,
  IndianRupee,
  RefreshCw,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityKind, Loan } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { circulationTrend, monthlyFineCollection, popularBookIds, popularCategories, type TrendRange } from '@/domain/analytics';
import { accruingFine, getTotals, isOverdue, overdueDays } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { cn, formatCurrency, formatDate, formatNumber, greeting, plural, relativeDay } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, ChartCard, SegmentedControl, StatCard } from '@/components/ui/Card';
import { CHART, ColumnChart, DonutChart, RankedBarChart, TrendChart } from '@/components/ui/Charts';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, LoadingState, useSimulatedLoading } from '@/components/ui/States';
import { BookCell, MemberCell } from '@/components/shared/Entities';
import { Shelf, SHELF_CAPACITY } from '@/components/shared/Shelf';

const activityStyles: Record<ActivityKind, { icon: LucideIcon; className: string }> = {
  issue: { icon: BookUp, className: 'bg-brand-50 text-brand-700' },
  return: { icon: Undo2, className: 'bg-emerald-50 text-emerald-700' },
  renewal: { icon: RefreshCw, className: 'bg-ink-50 text-ink-700' },
  reservation: { icon: CalendarClock, className: 'bg-amber-50 text-amber-700' },
  payment: { icon: IndianRupee, className: 'bg-violet-50 text-violet-700' },
  damage: { icon: AlertOctagon, className: 'bg-red-50 text-red-700' },
};

const ranges = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '6m', label: '6 months' },
] as const;

export default function AdminDashboard() {
  const { user } = useAuth();
  const { db } = useLibrary();
  const lookups = useLookups();
  const navigate = useNavigate();
  const loading = useSimulatedLoading();
  const [range, setRange] = useState<TrendRange>('30d');

  const totals = useMemo(() => getTotals(db), [db]);
  const trend = useMemo(() => circulationTrend(db.loans, range), [db.loans, range]);
  const categories = useMemo(() => popularCategories(db).slice(0, 6), [db]);
  const collection = useMemo(() => monthlyFineCollection(db), [db]);
  const shelf = useMemo(
    () => popularBookIds(db, db.books.length).map((id) => lookups.book(id)).filter((b) => !!b).slice(0, SHELF_CAPACITY),
    [db, lookups],
  );
  const overdue = useMemo(
    () => db.loans.filter((l) => isOverdue(l, db.settings)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [db.loans, db.settings],
  );

  const overdueColumns: Column<Loan>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (l) => <BookCell book={lookups.book(l.bookId)} to={`/books/${l.bookId}`} /> },
    { key: 'member', header: 'Member', cell: (l) => <MemberCell member={lookups.member(l.memberId)} to={`/admin/members/${l.memberId}`} /> },
    { key: 'due', header: 'Due date', cell: (l) => formatDate(l.dueDate), sortValue: (l) => l.dueDate },
    {
      key: 'late',
      header: 'Overdue',
      align: 'right',
      cell: (l) => <span className="font-medium text-red-700">{overdueDays(l, db.settings)} days</span>,
      sortValue: (l) => overdueDays(l, db.settings),
    },
    {
      key: 'fine',
      header: 'Fine so far',
      align: 'right',
      cell: (l) => formatCurrency(accruingFine(l, db.settings)),
      sortValue: (l) => accruingFine(l, db.settings),
    },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (l) => (
        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/circulation?tab=return&loan=${l.id}`)}>
          Return
        </Button>
      ),
    },
  ];

  return (
    <>
      <section className="glass mb-6 grid items-end gap-x-10 gap-y-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="font-serif text-[32px] font-medium leading-[1.08] tracking-tight text-slate-900 sm:text-[42px]">
            {greeting()}, <span className="italic text-brand-700">{user?.name.split(' ')[0]}.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
            {plural(totals.issued, 'book')} {totals.issued === 1 ? 'is' : 'are'} out on loan at {db.settings.libraryName}
            {totals.overdue > 0 ? (
              <>
                , <span className="font-medium text-red-700">{totals.overdue} overdue</span>
              </>
            ) : (
              ', none overdue'
            )}
            . {totals.reserved > 0 ? `${plural(totals.reserved, 'copy', 'copies')} ${totals.reserved === 1 ? 'is' : 'are'} being held for pickup.` : 'No copies are being held for pickup.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button icon={ArrowLeftRight} onClick={() => navigate('/admin/circulation')}>
              Issue / Return
            </Button>
            <Button variant="secondary" icon={BookCopy} onClick={() => navigate('/admin/books')}>
              Catalogue
            </Button>
          </div>
        </div>
        <div className="hidden md:block">
          <Shelf books={shelf} scale={0.78} to={(b) => `/books/${b.id}`} />
          <p className="eyebrow mt-3">Most borrowed titles · select a spine to open it</p>
        </div>
      </section>
      {loading ? (
        <LoadingState stats={6} blocks={4} />
      ) : (
        <div className="space-y-5">
          <div className="stat-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Books" value={formatNumber(totals.totalCopies)} hint={`${totals.titles} titles`} icon={BookCopy} to="/admin/books" />
            <StatCard label="Available" value={formatNumber(totals.available)} hint="On the shelves now" icon={BookCheck} tone="green" to="/admin/books" />
            <StatCard label="Issued" value={formatNumber(totals.issued)} hint={`${totals.reserved} more on hold`} icon={BookUp} to="/admin/transactions" />
            <StatCard label="Registered Members" value={formatNumber(totals.members)} hint="Students, faculty, staff" icon={Users} tone="slate" to="/admin/members" />
            <StatCard label="Overdue Books" value={formatNumber(totals.overdue)} hint="Past their due date" icon={AlertTriangle} tone="red" to="/admin/transactions?status=overdue" />
            <StatCard label="Pending Fines" value={formatCurrency(totals.pendingFines)} hint="Unpaid balance" icon={IndianRupee} tone="amber" to="/admin/fines" />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Books Issued vs Returned"
              description="Circulation volume over the selected period"
              action={<SegmentedControl label="Period" options={ranges} value={range} onChange={setRange} />}
            >
              <TrendChart
                data={trend}
                xKey="label"
                series={[
                  { key: 'issued', label: 'Issued', color: CHART.blue },
                  { key: 'returned', label: 'Returned', color: CHART.orange },
                ]}
              />
            </ChartCard>

            <ChartCard title="Inventory Distribution" description="Where every copy is right now">
              <DonutChart
                centerValue={formatNumber(totals.totalCopies)}
                centerLabel="copies"
                data={[
                  { name: 'Available', value: totals.available, color: CHART.aqua },
                  { name: 'Issued', value: totals.issued, color: CHART.blue },
                  { name: 'Reserved', value: totals.reserved, color: CHART.yellow },
                  { name: 'Damaged', value: totals.damaged, color: CHART.red },
                ]}
              />
            </ChartCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Popular Categories" description="Loans by category, all time">
              <RankedBarChart data={categories} label="Loans" />
            </ChartCard>

            <ChartCard title="Fine Collection" description="Payments received per month">
              <ColumnChart data={collection} xKey="month" yKey="collected" label="Collected" color={CHART.violet} format={formatCurrency} />
            </ChartCard>

            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader title="Recent Activity" description="Latest desk transactions" />
              {db.activity.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <ul className="thin-scroll max-h-[300px] divide-y divide-slate-900/[0.07] overflow-y-auto">
                  {db.activity.slice(0, 12).map((a) => {
                    const { icon: Icon, className } = activityStyles[a.kind];
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', className)}>
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] leading-snug text-slate-700">{a.text}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{relativeDay(a.date)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Overdue Books"
              description={`Fine rate ${formatCurrency(db.settings.fineRatePerDay)} per day`}
              action={
                <Link to="/admin/fines" className="text-sm font-medium text-brand-700 hover:underline">
                  Fines & payments
                </Link>
              }
            />
            <DataTable
              caption="Overdue books"
              rows={overdue}
              columns={overdueColumns}
              rowKey={(l) => l.id}
              pageSize={6}
              empty={<EmptyState icon={BookCheck} title="Nothing is overdue" description="Every book on loan is within its due date." />}
            />
          </Card>
        </div>
      )}
    </>
  );
}
