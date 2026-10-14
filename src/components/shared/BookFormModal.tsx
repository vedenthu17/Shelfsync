import { useEffect, useState, type FormEvent } from 'react';
import type { Book, BookStatus } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { addBook, updateBook, type BookInput } from '@/domain/actions';
import { getInventory } from '@/domain/selectors';
import { Button } from '@/components/ui/Button';
import { FileUploader } from '@/components/ui/FileUploader';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';

const blank = (category: string): BookInput => ({
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  year: new Date().getFullYear(),
  category,
  subject: '',
  description: '',
  shelf: '',
  totalCopies: 1,
  status: 'active',
  cover: undefined,
});

export function BookFormModal({
  open,
  onClose,
  book,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Book to edit; omit to add a new one. */
  book?: Book;
  onSaved?: (book: Book) => void;
}) {
  const { db, apply, update } = useLibrary();
  const attempt = useAttempt();
  const [form, setForm] = useState<BookInput>(() => blank(db.categories[0]?.name ?? ''));

  useEffect(() => {
    if (!open) return;
    if (book) {
      const { id: _id, addedOn: _addedOn, ...rest } = book;
      setForm(rest);
    } else {
      setForm(blank(db.categories[0]?.name ?? ''));
    }
    // Reset only when the dialog opens, not on every database change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book?.id]);

  const set = <K extends keyof BookInput>(key: K, value: BookInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const inventory = book ? getInventory(db, book) : null;
  const committed = inventory ? inventory.issued + inventory.reserved + inventory.damaged : 0;
  const availableAfter = Math.max(0, form.totalCopies - committed);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: BookInput = {
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      shelf: form.shelf.trim().toUpperCase(),
    };
    if (book) {
      const ok = attempt(() => {
        update((d) => updateBook(d, book.id, input));
        return true;
      }, 'Book details updated.');
      if (ok) {
        onSaved?.({ ...book, ...input });
        onClose();
      }
    } else {
      const result = attempt(() => apply((d) => addBook(d, input)), (r) => `"${r.book.title}" added to the catalogue.`);
      if (result) {
        onSaved?.(result.book);
        onClose();
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={book ? 'Edit book' : 'Add book'}
      description={book ? `${book.id} · ${book.title}` : 'Add a new title to the catalogue.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="book-form">
            {book ? 'Save changes' : 'Add book'}
          </Button>
        </>
      }
    >
      <form id="book-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" required value={form.title} onChange={(e) => set('title', e.target.value)} wrapperClassName="sm:col-span-2" />
        <Input label="Author" required value={form.author} onChange={(e) => set('author', e.target.value)} />
        <Input label="ISBN" required value={form.isbn} onChange={(e) => set('isbn', e.target.value)} placeholder="978-…" />
        <Input label="Publisher" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
        <Input
          label="Publication year"
          type="number"
          min={1400}
          max={new Date().getFullYear() + 1}
          value={form.year}
          onChange={(e) => set('year', Number(e.target.value))}
        />
        <Select
          label="Category"
          required
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          options={db.categories.map((c) => c.name)}
        />
        <Input label="Subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Algorithms" />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          wrapperClassName="sm:col-span-2"
        />
        <Input
          label="Shelf location"
          value={form.shelf}
          onChange={(e) => set('shelf', e.target.value)}
          placeholder="A-01-2"
          hint="Section – Rack – Shelf"
        />
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => set('status', e.target.value as BookStatus)}
          options={[
            { value: 'active', label: 'Active — can be issued' },
            { value: 'archived', label: 'Archived — hidden from members' },
          ]}
        />
        <Input
          label="Total copies"
          type="number"
          min={committed}
          required
          value={form.totalCopies}
          onChange={(e) => set('totalCopies', Math.max(0, Math.floor(Number(e.target.value))))}
        />
        <Input
          label="Available copies"
          value={availableAfter}
          readOnly
          disabled
          hint={
            committed > 0
              ? `Calculated: total minus ${committed} issued, held or under repair.`
              : 'Calculated from total copies and open loans.'
          }
        />
        <div className="sm:col-span-2">
          <FileUploader
            label="Cover image"
            multiple={false}
            value={form.cover ? [form.cover] : []}
            onChange={(images) => set('cover', images[0])}
            hint="Optional. A cover is generated when none is uploaded."
          />
        </div>
      </form>
    </Modal>
  );
}
