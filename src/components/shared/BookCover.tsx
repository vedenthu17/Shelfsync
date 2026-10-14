import type { Book } from '@/types';
import { cn, hashString } from '@/lib/utils';

// Cloth-binding colours with gilt lettering. A book keeps the same one everywhere it appears.
const palettes = [
  { bg: '#1f4a40', fg: '#ecdcae' },
  { bg: '#6b2530', fg: '#f1dfc0' },
  { bg: '#24365a', fg: '#e6d8b0' },
  { bg: '#8f621c', fg: '#fbf0d6' },
  { bg: '#4c3358', fg: '#ead9c4' },
  { bg: '#1e5560', fg: '#e9e0c2' },
  { bg: '#3d3830', fg: '#e4d3a6' },
  { bg: '#8a4425', fg: '#f8e6cf' },
  { bg: '#55582a', fg: '#efe5bf' },
];

export function coverPalette(book: Pick<Book, 'id' | 'title'>): { bg: string; fg: string } {
  return palettes[hashString(book.id + book.title) % palettes.length]!;
}

const sizes = {
  xs: 'w-9 rounded',
  sm: 'w-14 rounded',
  md: 'w-28 rounded-md',
  lg: 'w-44 rounded-md',
  fluid: 'w-full rounded-md',
};

export function BookCover({
  book,
  size = 'md',
  className,
}: {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover'>;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const base = cn(
    'relative aspect-[2/3] shrink-0 overflow-hidden shadow-[1px_1px_0_rgb(31_28_23/0.25),2px_3px_6px_-2px_rgb(31_28_23/0.3)] ring-1 ring-black/10',
    sizes[size],
    className,
  );

  if (book.cover) {
    return (
      <div className={base}>
        <img src={book.cover} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const palette = coverPalette(book);
  const showText = size === 'md' || size === 'lg' || size === 'fluid';

  return (
    <div className={base} style={{ background: palette.bg, color: palette.fg }} aria-hidden>
      {/* Spine hinge */}
      <div className="absolute inset-y-0 left-0 w-[8%] bg-black/25" />
      <div className="absolute inset-y-0 left-[8%] w-px bg-white/15" />
      {showText ? (
        <div className={cn('absolute inset-y-0 left-[8%] right-0', size === 'lg' ? 'p-2.5' : 'p-1.5')}>
          {/* Gilt frame */}
          <div className={cn('pointer-events-none absolute border border-current opacity-40', size === 'lg' ? 'inset-2.5' : 'inset-1.5')} />
          <div className={cn('relative flex h-full flex-col', size === 'lg' ? 'px-2.5 py-3.5' : 'px-1.5 py-2')}>
            <p
              lang="en"
              className={cn(
                'line-clamp-5 hyphens-auto break-words font-serif font-semibold leading-[1.15]',
                size === 'lg' ? 'text-[17px]' : 'text-xs',
              )}
            >
              {book.title}
            </p>
            <div className="mt-2 h-px w-6 bg-current opacity-60" />
            <p
              className={cn(
                'mt-auto line-clamp-2 font-mono uppercase tracking-[0.08em] opacity-85',
                size === 'lg' ? 'text-[10px]' : 'text-[8px]',
              )}
            >
              {book.author}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-[3px] pl-[28%] pr-[18%]">
          <div className="h-[2px] bg-current opacity-80" />
          <div className="h-[2px] w-2/3 bg-current opacity-55" />
        </div>
      )}
    </div>
  );
}
