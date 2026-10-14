import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('glass rounded-xl', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-3.5', className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-[17px] font-semibold leading-snug text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
  );
}

type StatTone = 'brand' | 'green' | 'amber' | 'red' | 'slate';

// The coloured mark beside the label is the only tint: the figure stays in ink.
const statTones: Record<StatTone, { mark: string; icon: string }> = {
  brand: { mark: 'bg-brand-700', icon: 'text-brand-600' },
  green: { mark: 'bg-emerald-500', icon: 'text-emerald-600' },
  amber: { mark: 'bg-amber-400', icon: 'text-amber-600' },
  red: { mark: 'bg-red-500', icon: 'text-red-600' },
  slate: { mark: 'bg-slate-400', icon: 'text-slate-500' },
};

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  to?: string;
  loading?: boolean;
}

/** A headline figure: one cell of a ledger line (wrap a row of them in `.stat-strip`). */
export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, to, loading }: StatCardProps) {
  const body = (
    <>
      <p className="eyebrow flex gap-2">
        <span className={cn('mt-[3px] h-1.5 w-1.5 shrink-0', statTones[tone].mark)} aria-hidden />
        {label}
      </p>
      {/* Pinned to the bottom edge so figures line up across a row even when a label wraps. */}
      <div className="mt-auto pt-3">
        {loading ? (
          <div className="skeleton h-8 w-20" />
        ) : (
          <p
            title={value}
            className={cn(
              'text-slate-900',
              // Long text values (a book title, a category) wrap instead of overflowing.
              value.length > 12
                ? 'line-clamp-2 font-serif text-lg font-semibold leading-snug'
                : 'font-serif text-[34px] font-medium lining-nums leading-none tracking-tight',
            )}
          >
            {value}
          </p>
        )}
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-slate-500">{hint}</p>
          <Icon className={cn('h-4 w-4 shrink-0', statTones[tone].icon)} aria-hidden />
        </div>
      </div>
    </>
  );
  const className = 'flex h-full flex-col px-4 pb-3.5 pt-4 shadow-[1px_0_0_0_var(--rule),0_1px_0_0_var(--rule)]';
  return to ? (
    <Link to={to} className={cn(className, 'transition-colors hover:bg-white/60 focus-visible:relative focus-visible:z-10 focus-visible:ring-inset focus-visible:ring-offset-0')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} action={action} className="border-b-0 pb-0" />
      <div className="flex-1 px-5 pb-5 pt-4">{children}</div>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-7">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] font-medium leading-[1.1] tracking-tight text-slate-900 sm:text-[36px]">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: ReadonlyArray<TabItem<K>>;
  active: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('hide-scroll flex gap-1 overflow-x-auto border-b border-slate-900/15', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            active === t.key
              ? 'border-brand-700 text-slate-900'
              : 'border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'tabular rounded px-1.5 py-0.5 text-[11px] leading-none',
                active === t.key ? 'bg-brand-700 text-white' : 'bg-slate-900/[0.08] text-slate-600',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Label/value pair used on detail screens. */
export function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: K; label: string }>;
  value: K;
  onChange: (value: K) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-900/10 bg-slate-900/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
