import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-3 font-serif text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this information. Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-3 font-serif text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** Page-level skeleton: a row of stat tiles above content blocks. */
export function LoadingState({ stats = 4, blocks = 2 }: { stats?: number; blocks?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="p-4 shadow-[1px_0_0_0_var(--rule),0_1px_0_0_var(--rule)]">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: blocks }, (_, i) => (
          <div key={i} className="glass rounded-xl p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-52 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Stands in for the network round-trip the mock service layer doesn't have, so
 * loading states are visible in the demo. Returns true while "loading".
 */
export function useSimulatedLoading(key: unknown = null, ms = 350): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(timer);
  }, [key, ms]);
  return loading;
}
