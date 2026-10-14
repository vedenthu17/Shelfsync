import type { DamageReport } from '@/types';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { ShieldCheck } from 'lucide-react';

const severityDot: Record<DamageReport['severity'], string> = {
  Low: 'bg-slate-400',
  Medium: 'bg-amber-500',
  High: 'bg-red-500',
  Critical: 'bg-red-700',
};

/** Step-by-step status history of a single damage report. */
export function DamageSteps({ report }: { report: DamageReport }) {
  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-slate-200 pl-5">
      {report.timeline.map((event, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white',
              i === report.timeline.length - 1 ? 'bg-brand-600' : 'bg-slate-300',
            )}
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-900">{statusLabel(event.status)}</p>
          <p className="text-[13px] text-slate-600">{event.note}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatDate(event.date)}</p>
        </li>
      ))}
    </ol>
  );
}

/** Every damage report for one book, newest first, as a visual history. */
export function DamageTimeline({
  reports,
  memberName,
  onSelect,
}: {
  reports: DamageReport[];
  memberName: (id?: string) => string;
  onSelect?: (report: DamageReport) => void;
}) {
  if (reports.length === 0) {
    return <EmptyState icon={ShieldCheck} title="No damage on record" description="This title has a clean condition history." />;
  }
  const ordered = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ol className="relative ml-2 space-y-5 border-l border-slate-200 py-1 pl-6">
      {ordered.map((r) => (
        <li key={r.id} className="relative">
          <span className={cn('absolute -left-[30px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white', severityDot[r.severity])} aria-hidden />
          <div className="rounded-lg border border-slate-200 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{r.type}</p>
              <StatusBadge status={r.severity} />
              <StatusBadge status={r.status} />
              <span className="ml-auto text-xs text-slate-500">{formatDate(r.date)}</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{r.description}</p>
            {r.images.length > 0 && (
              <div className="mt-2 flex gap-2">
                {r.images.map((src, i) => (
                  <img key={i} src={src} alt={`Damage photo ${i + 1}`} className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{r.memberId ? `Reported against ${memberName(r.memberId)}` : 'Found during inspection'}</span>
              <span>Repair cost {formatCurrency(r.repairCost)}</span>
              {onSelect && (
                <button type="button" onClick={() => onSelect(r)} className="ml-auto font-medium text-brand-700 hover:underline">
                  Open {r.id}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
