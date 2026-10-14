import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PickerProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  selected: T | undefined;
  onSelect: (item: T | undefined) => void;
  itemKey: (item: T) => string;
  /** Returns true when the item matches the typed query. */
  filter: (item: T, query: string) => boolean;
  renderItem: (item: T) => ReactNode;
  /** Shown in place of the search box once something is picked. */
  renderSelected: (item: T) => ReactNode;
  emptyText?: string;
}

/** Search-as-you-type selector for a member, book or transaction. */
export function Picker<T>({
  label,
  placeholder,
  items,
  selected,
  onSelect,
  itemKey,
  filter,
  renderItem,
  renderSelected,
  emptyText = 'No matches',
}: PickerProps<T>) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const results = items.filter((item) => filter(item, query)).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const choose = (item: T) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  if (selected) {
    return (
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-slate-700">{label}</p>
        <div className="relative rounded-lg border border-brand-200 bg-brand-50/40 p-3 pr-10">
          {renderSelected(selected)}
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          className="field-input pl-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="thin-scroll absolute z-20 mt-1.5 max-h-72 w-full glass-strong overflow-y-auto rounded-xl p-1.5"
        >
          {results.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-slate-500">{emptyText}</li>
          ) : (
            results.map((item, i) => (
              <li
                key={itemKey(item)}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
                className={cn('cursor-pointer rounded-lg px-2.5 py-2', i === active && 'bg-slate-100')}
              >
                {renderItem(item)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
