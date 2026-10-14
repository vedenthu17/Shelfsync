import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, SearchX, SlidersHorizontal } from 'lucide-react';
import type { Availability, Book, BookInventory } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { getInventory } from '@/domain/selectors';
import { cn, matches, plural } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input, SearchBar, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/States';
import { BookCard, BookCell } from '@/components/shared/Entities';

const availabilityOptions: Availability[] = ['available', 'low_stock', 'checked_out', 'reserved', 'damaged'];

const emptyFilters = { title: '', author: '', isbn: '', publisher: '', keyword: '', category: '', availability: '' };
type Filters = typeof emptyFilters;

type Row = { book: Book; inventory: BookInventory };

export default function SearchPage() {
  const { user } = useAuth();
  const { db } = useLibrary();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, category: params.get('category') ?? '' });
  const [showFilters, setShowFilters] = useState(!!params.get('category'));
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('relevance');

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);
    else next.delete('q');
    setParams(next, { replace: true });
  };
  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const results = useMemo<Row[]>(() => {
    const rows = db.books
      // Archived titles are staff-only.
      .filter((b) => user?.role === 'admin' || b.status === 'active')
      .filter((b) => matches(query, b.title, b.author, b.isbn, b.publisher, b.category, b.subject, b.description))
      .filter((b) => matches(filters.title, b.title))
      .filter((b) => matches(filters.author, b.author))
      .filter((b) => matches(filters.isbn.replace(/-/g, ''), b.isbn.replace(/-/g, '')))
      .filter((b) => matches(filters.publisher, b.publisher))
      .filter((b) => matches(filters.keyword, b.subject, b.description, b.title))
      .filter((b) => !filters.category || b.category === filters.category)
      .map((book) => ({ book, inventory: getInventory(db, book) }))
      .filter((r) => !filters.availability || r.inventory.state === filters.availability);

    if (sort === 'title') rows.sort((a, b) => a.book.title.localeCompare(b.book.title));
    if (sort === 'author') rows.sort((a, b) => a.book.author.localeCompare(b.book.author));
    if (sort === 'newest') rows.sort((a, b) => b.book.addedOn.localeCompare(a.book.addedOn));
    if (sort === 'available') rows.sort((a, b) => b.inventory.available - a.inventory.available);
    return rows;
  }, [db, user?.role, query, filters, sort]);

  const columns: Column<Row>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (r) => <BookCell book={r.book} />, sortValue: (r) => r.book.title },
    { key: 'category', header: 'Category', cell: (r) => r.book.category, sortValue: (r) => r.book.category },
    { key: 'isbn', header: 'ISBN', cell: (r) => <span className="tabular">{r.book.isbn}</span> },
    { key: 'shelf', header: 'Shelf', cell: (r) => <span className="tabular">{r.book.shelf}</span>, sortValue: (r) => r.book.shelf },
    {
      key: 'copies',
      header: 'Copies',
      cell: (r) => (
        <span className="tabular">
          {r.inventory.available} of {r.inventory.total}
        </span>
      ),
      sortValue: (r) => r.inventory.available,
    },
    { key: 'availability', header: 'Availability', cell: (r) => <StatusBadge status={r.inventory.state} /> },
  ];

  const openBook = (r: Row) => `/books/${r.book.id}`;

  return (
    <>
      <PageHeader title="Search & Discovery" description="Find books across the whole catalogue and check live availability." />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchBar
            value={query}
            onChange={setQuery}
            size="lg"
            autoFocus
            placeholder="Search by title, author, ISBN, publisher or keyword..."
            className="flex-1"
          />
          <Button
            variant="secondary"
            icon={SlidersHorizontal}
            className="h-14 px-5"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((s) => !s)}
          >
            Advanced filters
            {activeFilters > 0 && (
              <span className="tabular rounded-full bg-brand-700 px-1.5 py-0.5 text-[11px] leading-none text-white">{activeFilters}</span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Title" value={filters.title} onChange={(e) => setFilter('title', e.target.value)} />
              <Input label="Author" value={filters.author} onChange={(e) => setFilter('author', e.target.value)} />
              <Input label="ISBN" value={filters.isbn} onChange={(e) => setFilter('isbn', e.target.value)} />
              <Input label="Publisher" value={filters.publisher} onChange={(e) => setFilter('publisher', e.target.value)} />
              <Input label="Keyword" value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} hint="Matches subject and description" />
              <Select
                label="Category"
                value={filters.category}
                onChange={(e) => setFilter('category', e.target.value)}
                placeholder="All categories"
                options={db.categories.map((c) => c.name)}
              />
              <Select
                label="Availability"
                value={filters.availability}
                onChange={(e) => setFilter('availability', e.target.value)}
                placeholder="Any availability"
                options={availabilityOptions.map((a) => ({ value: a, label: statusLabel(a) }))}
              />
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => setFilters(emptyFilters)} disabled={activeFilters === 0}>
                  Clear filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600" aria-live="polite">
          <span className="font-semibold text-slate-900">{plural(results.length, 'book')}</span>
          {query && (
            <>
              {' '}
              matching “{query}”
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Sort results"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9"
            options={[
              { value: 'relevance', label: 'Sort: Catalogue order' },
              { value: 'title', label: 'Sort: Title A–Z' },
              { value: 'author', label: 'Sort: Author A–Z' },
              { value: 'newest', label: 'Sort: Recently added' },
              { value: 'available', label: 'Sort: Most copies available' },
            ]}
          />
          <div className="hidden rounded-lg border border-slate-200 bg-white p-0.5 sm:flex" role="group" aria-label="Result layout">
            {(
              [
                ['grid', LayoutGrid, 'Card view'],
                ['list', List, 'Table view'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn('rounded-md p-1.5', view === key ? 'bg-brand-700 text-white' : 'text-slate-500 hover:text-slate-800')}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No books match your search"
            description="Check the spelling, try a broader term, or clear the filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(emptyFilters);
                  setParams({}, { replace: true });
                }}
              >
                Reset search
              </Button>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((r) => (
            <li key={r.book.id}>
              <BookCard book={r.book} inventory={r.inventory} to={openBook(r)} />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            caption="Search results"
            rows={results}
            columns={columns}
            rowKey={(r) => r.book.id}
            pageSize={12}
            onRowClick={(r) => navigate(openBook(r))}
          />
        </Card>
      )}
    </>
  );
}
