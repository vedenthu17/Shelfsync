import { cn } from '@/lib/utils';

/** Three spines on a brass shelf, the last one leaning. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const spine = inverted ? '#fffdf8' : '#173c36';
  const lean = inverted ? '#7db2a0' : '#327666';
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect x="6" y="6" width="5" height="20" fill={spine} />
      <rect x="6" y="10" width="5" height="1.5" fill="#c39a3f" />
      <rect x="12.5" y="11" width="5" height="15" fill="#c39a3f" />
      <rect x="19" y="7" width="5" height="19" fill={lean} transform="rotate(14 24 26)" />
      <rect x="3" y="26" width="26" height="2" fill={inverted ? '#c39a3f' : '#8a6626'} />
    </svg>
  );
}

export function Logo({
  inverted,
  subtitle,
  className,
}: {
  inverted?: boolean;
  subtitle?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark inverted={inverted} />
      <span className="leading-none">
        <span className={cn('block font-serif text-[21px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-brand-900')}>
          Shelf<span className={cn('font-medium italic', inverted ? 'text-brass-300' : 'text-brass-600')}>Sync</span>
        </span>
        {subtitle && (
          <span className={cn('eyebrow mt-1.5 block', inverted ? 'text-brand-300' : 'text-slate-500')}>
            Library management system
          </span>
        )}
      </span>
    </span>
  );
}
