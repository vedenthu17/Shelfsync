import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'violet';

const tones: Record<Tone, { badge: string; dot: string }> = {
  green: { badge: 'border-emerald-600/35 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  amber: { badge: 'border-amber-600/40 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  red: { badge: 'border-red-600/35 bg-red-50 text-red-700', dot: 'bg-red-500' },
  blue: { badge: 'border-ink-500/35 bg-ink-50 text-ink-700', dot: 'bg-ink-500' },
  slate: { badge: 'border-slate-400/50 bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  violet: { badge: 'border-violet-500/35 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
};

export interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/** Set like a rubber stamp on a date-due slip: typed capitals in a ruled box. */
export function Badge({ tone = 'slate', dot, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-1 font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.07em]',
        tones[tone].badge,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', tones[tone].dot)} aria-hidden />}
      {children}
    </span>
  );
}

// One place that decides how every status in the system looks and reads.
const statuses = {
  // Availability
  available: ['green', 'Available'],
  low_stock: ['amber', 'Low stock'],
  checked_out: ['slate', 'Checked out'],
  reserved: ['blue', 'Reserved'],
  damaged: ['red', 'Damaged'],
  // Books
  archived: ['slate', 'Archived'],
  // Members
  active: ['green', 'Active'],
  suspended: ['red', 'Suspended'],
  // Loans
  on_loan: ['blue', 'On loan'],
  due_soon: ['amber', 'Due soon'],
  overdue: ['red', 'Overdue'],
  returned: ['slate', 'Returned'],
  // Fines
  pending: ['amber', 'Pending'],
  partial: ['blue', 'Partially paid'],
  paid: ['green', 'Paid'],
  accruing: ['red', 'Accruing'],
  // Reservations
  waiting: ['amber', 'Waiting'],
  ready: ['green', 'Ready for pickup'],
  fulfilled: ['slate', 'Fulfilled'],
  cancelled: ['slate', 'Cancelled'],
  expired: ['red', 'Expired'],
  // Damage
  reported: ['amber', 'Reported'],
  under_review: ['blue', 'Under review'],
  under_repair: ['violet', 'Under repair'],
  resolved: ['green', 'Resolved'],
  Low: ['slate', 'Low'],
  Medium: ['amber', 'Medium'],
  High: ['red', 'High'],
  Critical: ['red', 'Critical'],
} as const satisfies Record<string, readonly [Tone, string]>;

export type StatusKey = keyof typeof statuses;

export const statusLabel = (status: StatusKey): string => statuses[status][1];

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const [tone, label] = statuses[status];
  return (
    <Badge tone={tone} dot className={cn(status === 'Critical' && 'font-semibold', className)}>
      {label}
    </Badge>
  );
}
