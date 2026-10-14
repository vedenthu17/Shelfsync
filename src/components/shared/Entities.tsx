import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, Info, MapPin, XCircle } from 'lucide-react';
import type { AppNotification, Book, BookInventory, Member, NotificationTone } from '@/types';
import { cn, hashString, initials, relativeDay } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { BookCover } from './BookCover';

const avatarTones = [
  'bg-brand-100 text-brand-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-red-100 text-red-800',
  'bg-ink-100 text-ink-800',
];

const avatarSizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };

export function MemberAvatar({
  name,
  size = 'sm',
  className,
}: {
  name: string;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium tracking-tight',
        avatarTones[hashString(name) % avatarTones.length],
        avatarSizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Compact member reference for table cells. */
export function MemberCell({ member, to }: { member?: Member; to?: string }) {
  if (!member) return <span className="text-slate-400">—</span>;
  const body = (
    <span className="flex items-center gap-2.5">
      <MemberAvatar name={member.name} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-900">{member.name}</span>
        <span className="tabular block text-xs text-slate-500">{member.id}</span>
      </span>
    </span>
  );
  return to ? (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="rounded hover:[&_span.font-medium]:text-brand-700">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Compact book reference for table cells. */
export function BookCell({ book, to, meta, compact }: { book?: Book; to?: string; meta?: string; compact?: boolean }) {
  if (!book) return <span className="text-slate-400">Removed title</span>;
  const body = (
    <span className="flex items-center gap-3">
      <BookCover book={book} size="xs" />
      <span className="min-w-0">
        <span className={cn('block truncate font-medium text-slate-900', compact ? 'max-w-[10rem]' : 'max-w-[13rem]')} title={book.title}>
          {book.title}
        </span>
        <span className={cn('block truncate text-xs text-slate-500', compact ? 'max-w-[10rem]' : 'max-w-[13rem]')}>{meta ?? book.author}</span>
      </span>
    </span>
  );
  return to ? (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="rounded hover:[&_span.font-medium]:text-brand-700">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Search-result / browse card. */
export function BookCard({ book, inventory, to }: { book: Book; inventory: BookInventory; to: string }) {
  return (
    <Link
      to={to}
      className="glass-flat group flex h-full gap-4 rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-white/80"
    >
      <BookCover book={book} size="sm" className="w-16" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="eyebrow text-brass-600">{book.category}</p>
        <h3 className="mt-1 line-clamp-2 font-serif text-base font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
          {book.title}
        </h3>
        <p className="mt-0.5 truncate text-[13px] text-slate-500">{book.author}</p>
        <p className="tabular mt-1 truncate text-xs text-slate-400">ISBN {book.isbn}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <StatusBadge status={inventory.state} />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Shelf {book.shelf}
          </span>
        </div>
      </div>
    </Link>
  );
}

const noteTones: Record<NotificationTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: 'bg-brand-50 text-brand-700' },
  success: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700' },
  warning: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-700' },
  danger: { icon: XCircle, className: 'bg-red-50 text-red-700' },
};

export function NotificationItem({
  notification,
  onOpen,
  compact,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  compact?: boolean;
}) {
  const { icon: Icon, className } = noteTones[notification.tone] ?? { icon: Bell, className: '' };
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors hover:bg-slate-50',
        compact ? 'px-4 py-3' : 'px-5 py-4',
        !notification.read && 'bg-brand-50/40',
      )}
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', className)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={cn('text-sm text-slate-900', !notification.read && 'font-semibold')}>{notification.title}</span>
          {!notification.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600">
              <span className="sr-only">Unread</span>
            </span>
          )}
        </span>
        <span className={cn('mt-0.5 block text-[13px] text-slate-600', compact && 'line-clamp-2')}>{notification.message}</span>
        <span className="mt-1 block text-xs text-slate-400">{relativeDay(notification.date)}</span>
      </span>
    </button>
  );
}
