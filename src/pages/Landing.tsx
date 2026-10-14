import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BookCopy,
  CalendarClock,
  IndianRupee,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { DEMO_ADMIN_EMAIL, useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { DEMO_PASSWORD } from '@/data/seed';
import { getTotals } from '@/domain/selectors';
import { homeFor } from '@/lib/permissions';
import { formatNumber } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { Badge } from '@/components/ui/Badge';
import { Shelf, SHELF_CAPACITY } from '@/components/shared/Shelf';

const features = [
  { icon: BookCopy, title: 'Smart Catalog', text: 'Titles, copies, categories and shelf locations in one inventory.' },
  { icon: Search, title: 'Advanced Discovery', text: 'Search by title, author, ISBN, publisher or keyword with live availability.' },
  { icon: ArrowLeftRight, title: 'Automated Circulation', text: 'Issue, renew and return in a few clicks; due dates and stock update themselves.' },
  { icon: IndianRupee, title: 'Fine Management', text: 'Overdue fines calculated from a configurable daily rate, with payment tracking.' },
  { icon: CalendarClock, title: 'Reservations', text: 'A fair first-come queue for titles that are checked out.' },
  { icon: BarChart3, title: 'Analytics', text: 'Dashboards and exportable reports on inventory, loans and collections.' },
  { icon: AlertOctagon, title: 'Damage Documentation', text: 'Photo-backed damage records with a repair timeline per book.' },
  { icon: ShieldCheck, title: 'Secure RBAC', text: 'Separate librarian and member workspaces with role-based access.' },
];

const phaseTwo = ['Barcode & RFID scanning', 'SMS & email alerts', 'E-book lending', 'Semantic search & recommendations'];

export default function Landing() {
  const { user, login } = useAuth();
  const { db } = useLibrary();
  const navigate = useNavigate();
  const totals = useMemo(() => getTotals(db), [db]);
  const shelfBooks = useMemo(() => db.books.filter((b) => b.status === 'active').slice(0, SHELF_CAPACITY), [db.books]);

  const exploreDemo = () => {
    if (user) return navigate(homeFor(user.role));
    try {
      navigate(homeFor(login(DEMO_ADMIN_EMAIL, DEMO_PASSWORD).role));
    } catch {
      // The demo librarian's password has been changed, so sign in by hand.
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl pl-4 pr-2.5">
          <Logo />
          <Link
            to={user ? homeFor(user.role) : '/login'}
            className="inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-key hover:bg-brand-800"
          >
            {user ? 'Open dashboard' : 'Log in'}
          </Link>
        </div>
      </header>

      <main>
        <section>
          <div className="mx-auto grid max-w-6xl items-end gap-12 px-4 pb-14 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:pb-20">
            <div>
              <p className="eyebrow flex items-center gap-2 text-brass-700">
                <span className="h-px w-8 bg-brass-500" aria-hidden />
                Smart library management system
              </p>
              <h1 className="mt-5 font-serif text-[44px] font-medium leading-[1.02] tracking-tight text-slate-900 sm:text-[64px]">
                The whole library, <span className="italic text-brand-700">on one desk.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-700">
                ShelfSync keeps the catalogue, the loan ledger, the reservation queue and the fines book in one place — for the
                librarians who run the desk and the members who borrow from it.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to={user ? homeFor(user.role) : '/login'}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-700 px-6 text-[15px] font-medium text-white shadow-key hover:bg-brand-800"
                >
                  Login to ShelfSync
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={exploreDemo}
                  className="glass inline-flex h-12 items-center rounded-xl px-6 text-[15px] font-medium text-slate-800 hover:bg-white/80"
                >
                  Explore Demo
                </button>
              </div>
            </div>

            <div className="glass rounded-3xl p-5 pb-4 sm:p-6 sm:pb-5">
              {/* Two sizes rather than one that is cut off at the edge of a phone screen. */}
              <Shelf books={shelfBooks} scale={0.62} className="sm:hidden" />
              <Shelf books={shelfBooks} scale={0.9} className="hidden sm:block" />
              <p className="eyebrow mt-4 flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-slate-900">{db.settings.libraryName}</span>
                <span>{formatNumber(totals.titles)} titles</span>
                <span>{formatNumber(totals.totalCopies)} copies</span>
                <span className="text-emerald-700">{formatNumber(totals.available)} on the shelf now</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="features">
          <div className="glass grid gap-x-12 gap-y-3 rounded-3xl p-6 sm:p-9 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="eyebrow text-brass-700">Contents</p>
              <h2 id="features" className="mt-3 font-serif text-[28px] font-medium leading-tight tracking-tight text-slate-900">
                Everything the library desk needs
              </h2>
            </div>
            <ol className="grid gap-x-10 sm:grid-cols-2">
              {features.map((f, i) => (
                <li key={f.title} className="flex gap-4 border-t border-slate-900/15 py-5">
                  <span className="tabular pt-1 text-xs font-medium text-brass-700">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center justify-between gap-3 font-serif text-lg font-semibold leading-snug text-slate-900">
                      {f.title}
                      <f.icon className="h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-900/25 px-5 py-4">
            <span className="mr-2 font-serif text-base font-semibold italic text-slate-800">In the next edition</span>
            {phaseTwo.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900/15">
        <p className="eyebrow mx-auto max-w-6xl px-4 py-6 text-slate-600 sm:px-6">
          ShelfSync — Software Engineering Laboratory project · Demo runs on sample data
        </p>
      </footer>
    </div>
  );
}
