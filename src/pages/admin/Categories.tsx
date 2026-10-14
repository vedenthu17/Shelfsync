import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import type { Category } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { deleteCategory, saveCategory } from '@/domain/actions';
import { popularCategories } from '@/domain/analytics';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input, Textarea } from '@/components/ui/Form';
import { ConfirmationDialog, Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';

type Row = Category & { titles: number; copies: number; loans: number };

export default function Categories() {
  const { db, update } = useLibrary();
  const attempt = useAttempt();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleting, setDeleting] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    const loans = new Map(popularCategories(db).map((c) => [c.name, c.value]));
    return db.categories.map((c) => {
      const books = db.books.filter((b) => b.category === c.name);
      return {
        ...c,
        titles: books.length,
        copies: books.reduce((sum, b) => sum + b.totalCopies, 0),
        loans: loans.get(c.name) ?? 0,
      };
    });
  }, [db]);

  const openForm = (category: Category | null) => {
    setEditing(category);
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setFormOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = attempt(() => {
      update((d) => saveCategory(d, { id: editing?.id, name, description }));
      return true;
    }, editing ? 'Category updated.' : 'Category added.');
    if (ok) setFormOpen(false);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    attempt(() => {
      update((d) => deleteCategory(d, deleting.id));
      return true;
    }, `"${deleting.name}" was deleted.`);
    setDeleting(null);
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Category',
      primary: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="max-w-md truncate text-xs font-normal text-slate-500">{r.description || 'No description'}</p>
        </div>
      ),
    },
    { key: 'titles', header: 'Titles', align: 'right', cell: (r) => r.titles, sortValue: (r) => r.titles },
    { key: 'copies', header: 'Copies', align: 'right', cell: (r) => r.copies, sortValue: (r) => r.copies },
    { key: 'loans', header: 'Total loans', align: 'right', cell: (r) => r.loans, sortValue: (r) => r.loans },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (r) => (
        <Dropdown
          label={`Actions for ${r.name}`}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openForm(r) },
            { label: 'Delete', icon: Trash2, tone: 'danger', separated: true, onSelect: () => setDeleting(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise the catalogue into subject areas"
        actions={
          <Button icon={Plus} onClick={() => openForm(null)}>
            Add Category
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <DataTable
          caption="Categories"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          pageSize={12}
          onRowClick={(r) => navigate(`/search?category=${encodeURIComponent(r.name)}`)}
          empty={
            <EmptyState
              icon={Tags}
              title="No categories yet"
              description="Create a category before adding books."
              action={
                <Button icon={Plus} onClick={() => openForm(null)}>
                  Add Category
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit category' : 'Add category'}
        description={editing ? 'Renaming a category updates every book in it.' : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form">
              {editing ? 'Save changes' : 'Add category'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="space-y-4">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </form>
      </Modal>

      <ConfirmationDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this category?"
        confirmLabel="Delete category"
        message={
          deleting?.titles ? (
            <>
              <span className="font-medium text-slate-900">{deleting.name}</span> still has {deleting.titles} title(s). Move them to
              another category first — the delete will be refused otherwise.
            </>
          ) : (
            <>
              <span className="font-medium text-slate-900">{deleting?.name}</span> will be removed. This cannot be undone.
            </>
          )
        }
      />
    </>
  );
}
