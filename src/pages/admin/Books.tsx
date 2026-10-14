import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookCopy, Copy, Download, Eye, FileUp, History, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Availability, Book, BookInventory } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt, useToast } from '@/context/ToastContext';
import { deleteBook, importBooks, type BookInput } from '@/domain/actions';
import { getInventory, getQueue, isActive, isOverdue } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { exportCsv, parseCsv } from '@/lib/export';
import { formatDate, matches, plural } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown } from '@/components/ui/Dropdown';
import { SearchBar, Select } from '@/components/ui/Form';
import { ConfirmationDialog, Drawer, Modal } from '@/components/ui/Overlay';
import { EmptyState, useSimulatedLoading } from '@/components/ui/States';
import { BookFormModal } from '@/components/shared/BookFormModal';
import { BookCell } from '@/components/shared/Entities';

type Row = { book: Book; inventory: BookInventory };

const availabilityOptions: Availability[] = ['available', 'low_stock', 'checked_out', 'reserved', 'damaged'];
const csvHeaders = ['title', 'author', 'isbn', 'publisher', 'year', 'category', 'subject', 'shelf', 'copies', 'description'];

export default function Books() {
  const { db, apply, update } = useLibrary();
  const attempt = useAttempt();
  const toast = useToast();
  const navigate = useNavigate();
  const lookups = useLookups();
  const loading = useSimulatedLoading();
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('');
  const [category, setCategory] = useState('');
  const [publisher, setPublisher] = useState('');
  const [status, setStatus] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | undefined>();
  const [deleting, setDeleting] = useState<Book | null>(null);
  const [copiesOf, setCopiesOf] = useState<Book | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<BookInput[] | null>(null);
  const [importError, setImportError] = useState('');

  const publishers = useMemo(() => [...new Set(db.books.map((b) => b.publisher).filter(Boolean))].sort(), [db.books]);

  const rows = useMemo<Row[]>(
    () =>
      db.books
        .filter((b) => matches(query, b.title, b.author, b.isbn, b.publisher, b.category, b.subject, b.description))
        .filter((b) => !category || b.category === category)
        .filter((b) => !publisher || b.publisher === publisher)
        .filter((b) => !status || b.status === status)
        .map((book) => ({ book, inventory: getInventory(db, book) }))
        .filter((r) => !availability || r.inventory.state === availability),
    [db, query, availability, category, publisher, status],
  );

  const filtersActive = !!(query || availability || category || publisher || status);
  const clearFilters = () => {
    setQuery('');
    setAvailability('');
    setCategory('');
    setPublisher('');
    setStatus('');
  };

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    attempt(() => {
      update((d) => deleteBook(d, deleting.id));
      return true;
    }, `"${deleting.title}" was deleted.`);
    setDeleting(null);
  };

  const exportBooks = () => {
    exportCsv({
      title: 'Books catalogue',
      headers: ['Book ID', 'Title', 'Author', 'ISBN', 'Category', 'Publisher', 'Year', 'Shelf', 'Total', 'Available', 'Issued', 'Status'],
      rows: rows.map(({ book: b, inventory: i }) => [b.id, b.title, b.author, b.isbn, b.category, b.publisher, b.year, b.shelf, i.total, i.available, i.issued, statusLabel(i.state)]),
    });
    toast.success(`Exported ${plural(rows.length, 'book')} to CSV.`);
  };

  const readImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    setImportRows(null);
    const [header, ...lines] = parseCsv(await file.text());
    const cols = (header ?? []).map((h) => h.trim().toLowerCase());
    const col = (name: string) => cols.indexOf(name);
    if (col('title') === -1 || col('author') === -1 || col('isbn') === -1) {
      setImportError('The file needs at least "title", "author" and "isbn" columns. Download the template for the expected layout.');
      return;
    }
    const get = (line: string[], name: string) => (col(name) === -1 ? '' : (line[col(name)] ?? '').trim());
    setImportRows(
      lines.map((line) => ({
        title: get(line, 'title'),
        author: get(line, 'author'),
        isbn: get(line, 'isbn'),
        publisher: get(line, 'publisher'),
        year: Number(get(line, 'year')) || new Date().getFullYear(),
        // Unknown categories fall back to the first one rather than creating strays.
        category: db.categories.find((c) => c.name.toLowerCase() === get(line, 'category').toLowerCase())?.name ?? db.categories[0]?.name ?? '',
        subject: get(line, 'subject'),
        description: get(line, 'description'),
        shelf: get(line, 'shelf').toUpperCase(),
        totalCopies: Math.max(1, Math.floor(Number(get(line, 'copies'))) || 1),
        status: 'active',
      })),
    );
  };

  const runImport = () => {
    if (!importRows) return;
    const result = attempt(() => apply((d) => importBooks(d, importRows)));
    if (!result) return;
    if (result.added) toast.success(`Imported ${plural(result.added, 'book')}.`);
    if (result.skipped) toast.error(`${plural(result.skipped, 'row')} skipped (missing fields or duplicate ISBN).`);
    setImportOpen(false);
    setImportRows(null);
  };

  const downloadTemplate = () =>
    exportCsv({
      title: 'ShelfSync import template',
      headers: csvHeaders,
      rows: [['The Mythical Man-Month', 'Frederick P. Brooks', '978-0-2018-3595-3', 'Addison-Wesley', 1995, 'Computer Science', 'Software Engineering', 'A-05-3', 2, 'Essays on software project management.']],
    });

  const columns: Column<Row>[] = [
    { key: 'book', header: 'Book', primary: true, cell: (r) => <BookCell book={r.book} />, sortValue: (r) => r.book.title },
    { key: 'isbn', header: 'ISBN', cell: (r) => <span className="tabular">{r.book.isbn}</span> },
    { key: 'category', header: 'Category', cell: (r) => <span className="block max-w-[8.5rem] truncate" title={r.book.category}>{r.book.category}</span>, sortValue: (r) => r.book.category },
    { key: 'publisher', header: 'Publisher', wideOnly: true, cell: (r) => <span className="block max-w-[8rem] truncate" title={r.book.publisher}>{r.book.publisher}</span>, sortValue: (r) => r.book.publisher },
    { key: 'shelf', header: 'Shelf', cell: (r) => <span className="tabular">{r.book.shelf}</span>, sortValue: (r) => r.book.shelf },
    { key: 'total', header: 'Total', align: 'right', cell: (r) => r.inventory.total, sortValue: (r) => r.inventory.total },
    { key: 'available', header: 'Available', align: 'right', cell: (r) => r.inventory.available, sortValue: (r) => r.inventory.available },
    { key: 'issued', header: 'Issued', align: 'right', cell: (r) => r.inventory.issued, sortValue: (r) => r.inventory.issued },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge status={r.book.status === 'archived' ? 'archived' : r.inventory.state} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: ({ book }) => (
        <Dropdown
          label={`Actions for ${book.title}`}
          items={[
            { label: 'View details', icon: Eye, onSelect: () => navigate(`/admin/books/${book.id}`) },
            {
              label: 'Edit',
              icon: Pencil,
              onSelect: () => {
                setEditing(book);
                setFormOpen(true);
              },
            },
            { label: 'View copies', icon: Copy, onSelect: () => setCopiesOf(book) },
            { label: 'View history', icon: History, onSelect: () => navigate(`/admin/transactions?q=${encodeURIComponent(book.title)}`) },
            { label: 'Delete', icon: Trash2, tone: 'danger', separated: true, onSelect: () => setDeleting(book) },
          ]}
        />
      ),
    },
  ];

  // Per-copy view: the system tracks counts, so copies are listed by what they are doing.
  const copies = useMemo(() => {
    if (!copiesOf) return [];
    const book = db.books.find((b) => b.id === copiesOf.id) ?? copiesOf;
    const inv = getInventory(db, book);
    const out: Array<{ status: 'on_loan' | 'overdue' | 'ready' | 'damaged' | 'available'; detail: string }> = [];
    for (const l of db.loans.filter((x) => x.bookId === book.id && isActive(x))) {
      out.push({
        status: isOverdue(l, db.settings) ? 'overdue' : 'on_loan',
        detail: `${lookups.memberName(l.memberId)} · due ${formatDate(l.dueDate)}`,
      });
    }
    for (const r of getQueue(db, book.id).filter((x) => x.status === 'ready')) {
      out.push({ status: 'ready', detail: `On hold for ${lookups.memberName(r.memberId)}` });
    }
    for (const d of db.damage.filter((x) => x.bookId === book.id && x.copyWithdrawn && x.status !== 'resolved').slice(0, inv.damaged)) {
      out.push({ status: 'damaged', detail: `${d.type} · ${statusLabel(d.status)}` });
    }
    for (let i = 0; i < inv.available; i++) out.push({ status: 'available', detail: `On shelf ${book.shelf}` });
    return out;
  }, [copiesOf, db, lookups]);

  return (
    <>
      <PageHeader
        title="Books & Catalog"
        description="Manage your library inventory"
        actions={
          <>
            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
              Import Books
            </Button>
            <Button variant="secondary" icon={Download} onClick={exportBooks}>
              Export
            </Button>
            <Button icon={Plus} onClick={openAdd}>
              Add Book
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search title, author, ISBN, publisher, keyword…"
            className="sm:col-span-2 lg:col-span-1"
          />
          <Select aria-label="Availability" value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="All availability" options={availabilityOptions.map((a) => ({ value: a, label: statusLabel(a) }))} />
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={db.categories.map((c) => c.name)} />
          <Select aria-label="Publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="All publishers" options={publishers} />
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-500">
          <span>
            <span className="font-medium text-slate-800">{rows.length}</span> of {plural(db.books.length, 'title')}
          </span>
          {filtersActive && (
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        <div className="border-t border-slate-200">
          <DataTable
            caption="Books"
            loading={loading}
            rows={rows}
            columns={columns}
            rowKey={(r) => r.book.id}
            onRowClick={(r) => navigate(`/admin/books/${r.book.id}`)}
            empty={
              <EmptyState
                icon={BookCopy}
                title={filtersActive ? 'No books match these filters' : 'The catalogue is empty'}
                description={filtersActive ? 'Try a different search term or clear the filters.' : 'Add your first book to get started.'}
                action={
                  filtersActive ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button icon={Plus} onClick={openAdd}>
                      Add Book
                    </Button>
                  )
                }
              />
            }
          />
        </div>
      </Card>

      <BookFormModal open={formOpen} onClose={() => setFormOpen(false)} book={editing} />

      <ConfirmationDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this book?"
        confirmLabel="Delete book"
        message={
          <>
            <span className="font-medium text-slate-900">{deleting?.title}</span> will be removed from the catalogue and its open
            reservations cancelled. This cannot be undone.
          </>
        }
      />

      <Drawer
        open={!!copiesOf}
        onClose={() => setCopiesOf(null)}
        title="Copies"
        description={copiesOf ? `${copiesOf.title} · ${plural(copies.length, 'copy', 'copies')}` : undefined}
        width="max-w-md"
      >
        {copies.length === 0 ? (
          <EmptyState title="No copies recorded" description="Edit the book to set its total copies." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {copies.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">Copy {i + 1}</p>
                  <p className="truncate text-[13px] text-slate-500">{c.detail}</p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportRows(null);
          setImportError('');
        }}
        title="Import books"
        description="Add many titles at once from a CSV file."
        footer={
          <>
            <Button variant="ghost" icon={Download} className="mr-auto" onClick={downloadTemplate}>
              Download template
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runImport} disabled={!importRows?.length}>
              Import {importRows?.length ? plural(importRows.length, 'book') : ''}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Columns: <span className="tabular text-slate-800">{csvHeaders.join(', ')}</span>. Rows with a missing title, author or ISBN,
          or an ISBN already in the catalogue, are skipped.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="mt-4 block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-800"
          onChange={(e) => void readImportFile(e.target.files?.[0])}
        />
        {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
        {importRows && (
          <div className="mt-4 rounded-lg border border-slate-200">
            <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Preview — {plural(importRows.length, 'row')} found
            </p>
            <ul className="thin-scroll max-h-48 divide-y divide-slate-100 overflow-y-auto text-sm">
              {importRows.slice(0, 20).map((r, i) => (
                <li key={i} className="flex justify-between gap-3 px-3 py-2">
                  <span className="truncate text-slate-800">{r.title || <em className="text-red-600">Missing title</em>}</span>
                  <span className="shrink-0 text-slate-500">{r.author}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
