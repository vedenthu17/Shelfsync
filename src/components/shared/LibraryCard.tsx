import type { Member } from '@/types';
import { cn, formatDate } from '@/lib/utils';

/** The member's reader's card: what they show at the desk to borrow. */
export function LibraryCard({ member, libraryName, className }: { member: Member; libraryName: string; className?: string }) {
  const active = member.status === 'active';
  return (
    <div className={cn('relative w-full max-w-[340px] overflow-hidden rounded-xl bg-[#f6efdc] text-slate-800 shadow-pop', className)}>
      <div className="flex items-center justify-between gap-3 bg-brand-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="truncate text-white">{libraryName}</span>
        <span className="shrink-0 text-brass-300">Reader's card</span>
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <p className="pr-20 font-serif text-2xl font-semibold leading-tight">{member.name}</p>
        <p className="mt-0.5 text-[13px] text-slate-600">
          {member.type}
          {member.department && ` · ${member.department}`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800/20 pt-3">
          <div>
            <dt className="eyebrow text-slate-600">Member no.</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tracking-[0.08em]">{member.id}</dd>
          </div>
          <div>
            <dt className="eyebrow text-slate-600">Member since</dt>
            <dd className="mt-1.5 font-mono text-sm">{formatDate(member.joined)}</dd>
          </div>
        </dl>
      </div>
      {/* Stamped across the corner, the way a desk would mark a card. */}
      <span
        className={cn(
          'absolute right-3 top-12 -rotate-12 border-2 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] opacity-80',
          active ? 'border-emerald-700 text-emerald-700' : 'border-red-700 text-red-700',
        )}
      >
        {active ? 'Active' : 'Suspended'}
      </span>
    </div>
  );
}
