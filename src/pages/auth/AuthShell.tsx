import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '@/context/LibraryContext';
import { addDays, parseISO, today } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';

const points = [
  'One catalogue for every title, copy and shelf',
  'Issue, return and reserve in seconds',
  'Fines calculated automatically, payments tracked',
  'Role-based access for staff and members',
];

const stamp = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();

// Earlier loans on the slip: how many loan periods ago, with each stamp's ink and tilt.
const pastStamps: Array<{ periodsAgo: number; style: CSSProperties }> = [
  { periodsAgo: 9, style: { color: '#2f4467', opacity: 0.55, transform: 'rotate(-3deg)' } },
  { periodsAgo: 7, style: { color: '#1f1c17', opacity: 0.5, transform: 'rotate(2deg) translateX(4px)' } },
  { periodsAgo: 6, style: { color: '#2f4467', opacity: 0.7, transform: 'rotate(-1deg)' } },
  { periodsAgo: 4, style: { color: '#8c2f24', opacity: 0.6, transform: 'rotate(4deg) translateX(-3px)' } },
  { periodsAgo: 2, style: { color: '#2f4467', opacity: 0.8, transform: 'rotate(-4deg)' } },
  { periodsAgo: 1, style: { color: '#1f1c17', opacity: 0.7, transform: 'rotate(1deg) translateX(3px)' } },
];

/** The slip pasted inside a library book; the newest stamp is the due date for a loan issued today. */
function DateDueSlip() {
  const { db } = useLibrary();
  const period = db.settings.loanPeriodDays;
  const due = addDays(today(), period);
  const cell = 'flex h-9 items-center justify-center border-b border-r border-slate-800/30';

  return (
    <div className="w-[272px] -rotate-2 bg-[#f6efdc] px-4 pb-5 pt-4 text-slate-800 shadow-pop" aria-hidden>
      <p className="text-center font-mono text-[9.5px] uppercase tracking-[0.22em] text-slate-600">{db.settings.libraryName}</p>
      <p className="mt-1 text-center font-serif text-[22px] font-semibold uppercase leading-none tracking-[0.14em]">Date due</p>
      <div className="mt-3.5 grid grid-cols-2 border-l border-t border-slate-800/30 font-mono text-[12.5px] font-semibold tracking-[0.06em]">
        {pastStamps.map((s) => (
          <div key={s.periodsAgo} className={cell}>
            <span style={s.style}>{stamp(addDays(due, -s.periodsAgo * period))}</span>
          </div>
        ))}
        <div className={cell}>
          <span className="border-[1.5px] border-red-700 px-1.5 py-0.5 text-red-700" style={{ transform: 'rotate(-2deg)' }}>
            {stamp(due)}
          </span>
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cell} />
        ))}
      </div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-brass-500/40 bg-brand-950 p-10 text-white lg:flex">
        {/* Pool of light from a desk lamp */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_35%_38%,rgb(79_146_128/0.32),transparent_70%)]"
          aria-hidden
        />
        <Link to="/" className="relative self-start rounded-lg focus-visible:ring-offset-brand-950">
          <Logo inverted subtitle />
        </Link>

        <div className="relative">
          <DateDueSlip />
          <p className="mt-12 max-w-sm font-serif text-[34px] font-medium leading-[1.1] tracking-tight">
            The whole library, <span className="block italic text-brass-300">on one desk.</span>
          </p>
          <ol className="mt-7 max-w-sm">
            {points.map((p, i) => (
              <li key={p} className="flex gap-4 border-t border-white/10 py-2.5 text-sm text-brand-100">
                <span className="tabular pt-px text-xs text-brass-300">{String(i + 1).padStart(2, '0')}</span>
                {p}
              </li>
            ))}
          </ol>
        </div>

        <p className="eyebrow relative text-brand-300">Central Library · Demo environment</p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="glass mx-auto w-full max-w-[30rem] rounded-3xl p-6 sm:p-9">
          <Link to="/" className="mb-8 inline-block rounded-lg lg:hidden">
            <Logo subtitle />
          </Link>
          <p className="eyebrow flex items-center gap-2 text-brass-700">
            <span className="h-px w-6 bg-brass-500" aria-hidden />
            Reader services
          </p>
          <h1 className="mt-2 font-serif text-[34px] font-medium leading-[1.1] tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
