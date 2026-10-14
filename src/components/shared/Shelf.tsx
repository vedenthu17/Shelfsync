import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '@/types';
import { cn } from '@/lib/utils';
import { coverPalette } from './BookCover';

// Heights and thicknesses for the spines, so the row looks handled rather than uniform.
const shapes = [
  [214, 40],
  [238, 48],
  [196, 32],
  [226, 44],
  [182, 34],
  [244, 52],
  [208, 36],
  [230, 46],
  [220, 42],
  [236, 38],
] as const;

/** How many books one shelf holds. */
export const SHELF_CAPACITY = shapes.length;

/**
 * A shelf of real titles, each spine carrying its call-number label. With `to`
 * the spines are links and lift off the shelf under the pointer; without it the
 * shelf is decoration.
 */
export function Shelf({
  books,
  scale = 1,
  to,
  className,
}: {
  books: Book[];
  scale?: number;
  to?: (book: Book) => string;
  className?: string;
}) {
  const shown = books.slice(0, shapes.length);
  // The last book leans against its neighbour once there are enough to lean on.
  const leanIndex = shown.length >= 4 ? shown.length - 1 : -1;
  const labelled = scale >= 0.9;

  const spine = (book: Book, i: number) => {
    const [height, width] = shapes[i]!;
    const palette = coverPalette(book);
    const [section, rack] = book.shelf.split('-');
    const style: CSSProperties = {
      height: height * scale,
      width: width * scale,
      background: palette.bg,
      color: palette.fg,
      // Room for the leaning book to tip into.
      marginLeft: i === leanIndex ? 32 * scale : undefined,
    };
    const classes = cn(
      'relative flex shrink-0 flex-col items-center shadow-[inset_-3px_0_0_rgb(0_0_0/0.18),inset_2px_0_0_rgb(255_255_255/0.08)]',
      i === leanIndex && 'origin-bottom-left -rotate-[9deg]',
      to && 'transition-transform duration-200 ease-out hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:ring-offset-0',
    );
    const body = (
      <>
        <span className="mt-2.5 h-px w-[62%] bg-current opacity-70" />
        <span className="mt-[3px] h-px w-[62%] bg-current opacity-40" />
        <span
          className="mt-3 min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-serif font-semibold tracking-wide [writing-mode:vertical-rl]"
          style={{ fontSize: Math.max(10, 13 * scale) }}
        >
          {book.title}
        </span>
        {labelled ? (
          <span className="mb-3 mt-2 w-[78%] bg-[#f6efdc] py-[3px] text-center font-mono text-[7.5px] font-medium leading-[1.25] text-slate-800">
            {section}
            <br />
            {rack}
          </span>
        ) : (
          <span className="mb-2.5 mt-2 h-2 w-[70%] bg-[#f6efdc]" />
        )}
      </>
    );
    return to ? (
      <Link key={book.id} to={to(book)} title={`${book.title} — ${book.author}`} aria-label={`${book.title} by ${book.author}`} className={classes} style={style}>
        {body}
      </Link>
    ) : (
      <div key={book.id} className={classes} style={style}>
        {body}
      </div>
    );
  };

  return (
    <div className={className} aria-hidden={to ? undefined : true}>
      <div className="flex items-end gap-[3px] overflow-hidden pl-1 pt-3">{shown.map(spine)}</div>
      {/* The shelf board */}
      <div className="h-3.5 rounded-sm bg-brass-700 shadow-[inset_0_2px_0_rgb(255_255_255/0.18),0_10px_18px_-8px_rgb(31_28_23/0.55)]" />
      <div className="mx-1 h-1 rounded-b-sm bg-brass-700/40" />
    </div>
  );
}
