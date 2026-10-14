import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, BookOpenText, FlaskConical, KeyRound, LogOut, Search, UserRound } from 'lucide-react';
import type { AppNotification, SessionUser } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { markAllNotificationsRead, markNotificationRead } from '@/domain/actions';
import { fineBalance, isActive } from '@/domain/selectors';
import { cn, formatCurrency } from '@/lib/utils';
import { homeFor } from '@/lib/permissions';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { MemberAvatar, NotificationItem } from '@/components/shared/Entities';
import { Logo } from './Logo';
import { activeChapter, chaptersFor, memberTabs, type Chapter } from './nav';

// The shell borrows its structure from a book rather than from an admin
// template. A bar of smoked glass floats over the page and lists the chapters;
// the open one is marked by a ribbon hanging below the bar. The chapter's
// sections run along the head of the page, and the full contents page is one
// click away.

const barButton =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-brass-300 focus-visible:ring-offset-0';

function NotificationBell({ user }: { user: SessionUser }) {
  const { db, update } = useLibrary();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = db.notifications.filter((n) => n.recipient === user.id);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (n: AppNotification) => {
    update((d) => markNotificationRead(d, n.id));
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(barButton, 'relative')}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-brand-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="glass-strong fixed inset-x-3 top-[4.5rem] z-40 animate-scale-in overflow-hidden rounded-xl text-slate-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-900/10 px-4 py-3">
            <h2 className="font-serif text-base font-semibold text-slate-900">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:underline"
                onClick={() => update((d) => markAllNotificationsRead(d, user.id))}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="thin-scroll max-h-[60vh] divide-y divide-slate-900/[0.07] overflow-y-auto sm:max-h-96">
            {items.length === 0 ? (
              <EmptyState icon={Bell} title="You're all caught up" description="New alerts will appear here." className="py-8" />
            ) : (
              items.slice(0, 8).map((n) => <NotificationItem key={n.id} notification={n} onOpen={openNotification} compact />)
            )}
          </div>
          {user.role === 'member' && (
            <Link
              to="/member/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-slate-900/10 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-white/60"
            >
              View all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** The figure printed where a contents page would give the page number. */
function useContentsFigures(user: SessionUser): Record<string, string> {
  const { db } = useLibrary();
  return useMemo((): Record<string, string> => {
    const open = (status: string) => status === 'waiting' || status === 'ready';
    if (user.role === 'member') {
      const mine = <T extends { memberId?: string }>(rows: T[]) => rows.filter((r) => r.memberId === user.memberId);
      return {
        '/search': String(db.books.filter((b) => b.status === 'active').length),
        '/member/books': String(mine(db.loans).filter(isActive).length),
        '/member/reservations': String(mine(db.reservations).filter((r) => open(r.status)).length),
        '/member/fines': formatCurrency(mine(db.fines).reduce((sum, f) => sum + fineBalance(f), 0)),
        '/member/notifications': String(db.notifications.filter((n) => n.recipient === user.id && !n.read).length),
      };
    }
    return {
      '/admin/books': String(db.books.length),
      '/admin/categories': String(db.categories.length),
      '/admin/members': String(db.members.length),
      '/admin/circulation': String(db.loans.filter(isActive).length),
      '/admin/transactions': String(db.loans.length),
      '/admin/reservations': String(db.reservations.filter((r) => open(r.status)).length),
      '/admin/fines': formatCurrency(db.fines.reduce((sum, f) => sum + fineBalance(f), 0)),
      '/admin/damage': String(db.damage.filter((d) => d.status !== 'resolved').length),
    };
  }, [db, user]);
}

/** The table of contents: every page in the book, with dotted leaders. */
function Contents({ user, chapters, open, onClose }: { user: SessionUser; chapters: Chapter[]; open: boolean; onClose: () => void }) {
  const { db } = useLibrary();
  const figures = useContentsFigures(user);
  const numbered = chapters.some((c) => c.numeral);

  const entry = (item: Chapter['items'][number]) => (
    <li key={item.to}>
      <NavLink
        to={item.to}
        onClick={onClose}
        className={({ isActive: current }) =>
          cn(
            'group flex items-baseline gap-2 rounded py-1.5 text-[15px]',
            current ? 'font-semibold text-brand-700' : 'text-slate-700 hover:text-slate-950',
          )
        }
      >
        <span>{item.label}</span>
        <span className="min-w-6 flex-1 -translate-y-1 border-b border-dotted border-slate-400 group-hover:border-slate-600" aria-hidden />
        <span className="tabular text-[13px] text-slate-500">{figures[item.to] ?? '·'}</span>
      </NavLink>
    </li>
  );

  return (
    <Modal open={open} onClose={onClose} title="Contents" description={`${db.settings.libraryName} · ShelfSync`} size="lg">
      <nav aria-label="Contents" className="pb-2">
        {numbered ? (
          <ol className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {chapters.map((c) => (
              <li key={c.label}>
                <p className="flex items-baseline gap-3 border-b border-slate-900/15 pb-1.5">
                  <span className="tabular w-6 text-xs font-medium text-brass-600">{c.numeral}</span>
                  <span className="font-serif text-lg font-semibold text-slate-900">{c.label}</span>
                </p>
                <ul className="mt-1.5 pl-9">{c.items.map(entry)}</ul>
              </li>
            ))}
          </ol>
        ) : (
          <ul>{chapters.flatMap((c) => c.items).map(entry)}</ul>
        )}
      </nav>
    </Modal>
  );
}

function TopBar({ user, chapters, current, onContents }: { user: SessionUser; chapters: Chapter[]; current: Chapter; onContents: () => void }) {
  const { logout } = useAuth();
  const { db } = useLibrary();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const unread = db.notifications.filter((n) => n.recipient === user.id && !n.read).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
    setQuery('');
  };

  return (
    <header className="no-print sticky top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3">
      <div className="glass-dark mx-auto flex h-14 max-w-[1480px] items-center gap-1 rounded-2xl pl-1.5 pr-2 text-white sm:gap-1.5 sm:pl-2 sm:pr-2.5">
        <button type="button" onClick={onContents} className={barButton} aria-label="Open contents" title="Contents">
          <BookOpenText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
        <Link to={homeFor(user.role)} className="rounded-lg px-1 focus-visible:ring-brass-300 focus-visible:ring-offset-0">
          <Logo inverted />
        </Link>

        <nav aria-label="Chapters" className={cn('ml-4 hidden min-w-0 flex-1 items-center gap-0.5', user.role === 'admin' ? 'lg:flex' : 'min-[1120px]:flex')}>
          {chapters.map((c) => {
            const active = c === current;
            return (
              <Link
                key={c.to}
                to={c.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors focus-visible:ring-brass-300 focus-visible:ring-offset-0',
                  // The open chapter is a slip of paper under the glass, with a ribbon marking the place below the bar.
                  active
                    ? "bg-canvas font-medium text-slate-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] after:absolute after:left-1/2 after:top-[calc(100%+10px)] after:h-4 after:w-3 after:-translate-x-1/2 after:bg-brass-400 after:shadow-[inset_-3px_0_0_rgb(0_0_0/0.12)] after:content-[''] after:[clip-path:polygon(0_0,100%_0,100%_100%,50%_66%,0_100%)]"
                    : 'text-brand-100 hover:bg-white/10 hover:text-white',
                )}
              >
                {c.numeral && (
                  <span className={cn('hidden font-mono text-[10px] font-medium xl:inline', active ? 'text-brass-600' : 'text-brass-300')}>
                    {c.numeral}
                  </span>
                )}
                {c.label}
                {c.to === '/member/notifications' && unread > 0 && (
                  <span className="tabular rounded bg-brass-400 px-1 py-0.5 text-[10px] font-semibold leading-none text-brand-950">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <form onSubmit={submit} role="search" className="relative hidden min-[1400px]:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the catalogue"
              aria-label="Search the catalogue"
              className="h-9 w-52 rounded-lg border border-white/15 bg-white/[0.08] pl-9 pr-3 text-sm text-white placeholder:text-brand-200 hover:border-white/30 focus:border-brass-300 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-brass-300/30 2xl:w-64"
            />
          </form>
          <Link to="/search" className={cn(barButton, 'min-[1400px]:hidden')} aria-label="Search the catalogue" title="Search the catalogue">
            <Search className="h-[18px] w-[18px]" aria-hidden />
          </Link>
          <span
            className="mx-1 hidden items-center gap-1.5 rounded border border-dashed border-brass-300/70 px-2 py-1 font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.07em] text-brass-300 sm:inline-flex"
            title="Demo mode: running on sample data stored in this browser"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            <span className="lg:hidden xl:inline">Demo mode</span>
          </span>
          <NotificationBell user={user} />
          <Dropdown
            label="Account"
            triggerClassName="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-white/10 focus-visible:ring-brass-300 focus-visible:ring-offset-0"
            trigger={
              <>
                <MemberAvatar name={user.name} className="!bg-brass-400 !text-brand-950" />
                <span className="hidden pr-1 text-left 2xl:block">
                  <span className="block text-[13px] font-medium leading-tight text-white">{user.name}</span>
                  <span className="block text-[11px] leading-tight text-brand-200">{user.title}</span>
                </span>
              </>
            }
            items={[
              {
                label: user.role === 'admin' ? 'Settings' : 'My profile',
                icon: UserRound,
                onSelect: () => navigate(user.role === 'admin' ? '/admin/settings' : '/member/profile'),
              },
              {
                label: 'Log out',
                icon: LogOut,
                separated: true,
                onSelect: () => {
                  logout();
                  navigate('/login');
                },
              },
            ]}
          />
        </div>
      </div>
    </header>
  );
}

/** Runs along the top of every page: the chapter, its sections, and the date. */
function RunningHead({ chapter }: { chapter: Chapter }) {
  const { db } = useLibrary();
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="no-print mx-auto mt-3 max-w-[1480px] px-4 sm:px-6 lg:px-8">
      <div className="flex h-11 items-stretch gap-5 border-b border-slate-900/15">
        <p className="eyebrow flex shrink-0 items-center text-brass-700">{chapter.numeral ? `Chapter ${chapter.numeral}` : 'Member desk'}</p>
        <nav aria-label="Sections" className="hide-scroll flex min-w-0 items-stretch gap-5 overflow-x-auto">
          {chapter.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: current }) =>
                cn(
                  '-mb-px inline-flex shrink-0 items-center whitespace-nowrap border-b-2 text-sm transition-colors focus-visible:ring-offset-0',
                  current ? 'border-brass-500 font-medium text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="eyebrow ml-auto hidden shrink-0 items-center text-slate-600 md:flex">
          {db.settings.libraryName} · {date}
        </p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, mustChangePassword } = useAuth();
  const location = useLocation();
  const [contentsOpen, setContentsOpen] = useState(false);

  useEffect(() => {
    setContentsOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const role = user?.role;
  const chapters = useMemo(() => (role ? chaptersFor(role) : []), [role]);
  if (!user) return null;
  const isMember = user.role === 'member';
  const current = activeChapter(chapters, location.pathname);
  const securityPath = isMember ? '/member/profile' : '/admin/settings';

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow-pop focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <TopBar user={user} chapters={chapters} current={current} onContents={() => setContentsOpen(true)} />
      <Contents user={user} chapters={chapters} open={contentsOpen} onClose={() => setContentsOpen(false)} />
      <RunningHead chapter={current} />

      <main id="main" className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8">
        {mustChangePassword && location.pathname !== securityPath && (
          <div role="status" className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-600/35 bg-amber-50/80 px-4 py-3">
            <p className="flex items-center gap-2.5 text-sm text-amber-900">
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
              You are signed in with a temporary password from the library desk.
            </p>
            <Link to={securityPath} className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:no-underline">
              Choose your own password
            </Link>
          </div>
        )}
        {/* Keyed on the path so each page settles in as it opens. */}
        <div key={location.pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>

      <footer className={cn('no-print flex items-center justify-center gap-3 px-4 pb-8 pt-2', isMember && 'pb-24 min-[1120px]:pb-8')}>
        <span className="h-px w-10 bg-slate-900/15" aria-hidden />
        <p className="eyebrow text-slate-600">{current.numeral ? `${current.numeral} · ${current.label}` : current.label}</p>
        <span className="h-px w-10 bg-slate-900/15" aria-hidden />
      </footer>

      {isMember && (
        <nav
          aria-label="Quick navigation"
          className="glass-strong no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 rounded-t-2xl pb-[env(safe-area-inset-bottom)] min-[1120px]:hidden"
        >
          {memberTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive: current }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium focus-visible:ring-inset focus-visible:ring-offset-0',
                  current ? 'text-brand-700' : 'text-slate-500',
                )
              }
            >
              <tab.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
