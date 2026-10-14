import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertOctagon, Eye, ImageOff, PackageX, Plus, Wrench } from 'lucide-react';
import type { Book, DamageReport, DamageSeverity, DamageStatus, DamageType, Member } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { addDamageReport, updateDamageStatus } from '@/domain/actions';
import { useLookups } from '@/hooks/useLookups';
import { formatCurrency, formatDate, matches, today } from '@/lib/utils';
import { StatusBadge, statusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Detail, PageHeader, StatCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FileUploader } from '@/components/ui/FileUploader';
import { DatePicker, Input, SearchBar, Select, Textarea } from '@/components/ui/Form';
import { Drawer, Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { DamageSteps, DamageTimeline } from '@/components/shared/DamageTimeline';
import { BookCell, MemberCell } from '@/components/shared/Entities';
import { Picker } from '@/components/shared/Picker';

const damageTypes: DamageType[] = ['Torn pages', 'Water damage', 'Cover damage', 'Missing pages', 'Writing/marking', 'Other'];
const severities: DamageSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
const statuses: DamageStatus[] = ['reported', 'under_review', 'under_repair', 'resolved'];

function ReportForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, apply } = useLibrary();
  const attempt = useAttempt();
  const [book, setBook] = useState<Book | undefined>();
  const [member, setMember] = useState<Member | undefined>();
  const [loanId, setLoanId] = useState('');
  const [date, setDate] = useState(today());
  const [type, setType] = useState<DamageType>('Torn pages');
  const [severity, setSeverity] = useState<DamageSeverity>('Medium');
  const [description, setDescription] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [images, setImages] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setBook(undefined);
    setMember(undefined);
    setLoanId('');
    setDate(today());
    setType('Torn pages');
    setSeverity('Medium');
    setDescription('');
    setRepairCost('0');
    setImages([]);
    setNotes('');
  }, [open]);

  // Transactions that could be responsible: this book, and this member if chosen.
  const loans = book ? db.loans.filter((l) => l.bookId === book.id && (!member || l.memberId === member.id)).slice(0, 15) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!book) return;
    const result = attempt(
      () =>
        apply((d) =>
          addDamageReport(d, {
            bookId: book.id,
            memberId: member?.id,
            loanId: loanId || undefined,
            date,
            type,
            severity,
            description: description.trim(),
            repairCost: Math.max(0, Number(repairCost) || 0),
            images,
            notes: notes.trim(),
          }),
        ),
      (r) => `Damage report ${r.report.id} created.`,
    );
    if (result) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New damage report"
      description="Document damage found on a book."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="damage-form" disabled={!book}>
            Create report
          </Button>
        </>
      }
    >
      <form id="damage-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Picker<Book>
            label="Book"
            placeholder="Search by title, author or ISBN"
            items={db.books}
            selected={book}
            onSelect={(b) => {
              setBook(b);
              setLoanId('');
            }}
            itemKey={(b) => b.id}
            filter={(b, q) => matches(q, b.title, b.author, b.isbn)}
            renderItem={(b) => <BookCell book={b} meta={`${b.author} · ${b.isbn}`} />}
            renderSelected={(b) => <BookCell book={b} meta={`ISBN ${b.isbn}`} />}
          />
        </div>
        <div className="sm:col-span-2">
          <Picker<Member>
            label="Member (optional)"
            placeholder="Who had the book? Leave empty if found on the shelf"
            items={db.members}
            selected={member}
            onSelect={(m) => {
              setMember(m);
              setLoanId('');
            }}
            itemKey={(m) => m.id}
            filter={(m, q) => matches(q, m.id, m.name, m.email)}
            renderItem={(m) => <MemberCell member={m} />}
            renderSelected={(m) => <MemberCell member={m} />}
          />
        </div>
        <Select
          label="Transaction"
          value={loanId}
          onChange={(e) => {
            setLoanId(e.target.value);
            const loan = db.loans.find((l) => l.id === e.target.value);
            if (loan && !member) setMember(db.members.find((m) => m.id === loan.memberId));
          }}
          placeholder={book ? 'Not linked to a transaction' : 'Select a book first'}
          disabled={!book}
          options={loans.map((l) => ({ value: l.id, label: `${l.id} · issued ${formatDate(l.issueDate)}` }))}
        />
        <DatePicker label="Date" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <Select label="Damage type" value={type} onChange={(e) => setType(e.target.value as DamageType)} options={damageTypes} />
        <Select
          label="Severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as DamageSeverity)}
          options={severities}
          hint={severity === 'High' || severity === 'Critical' ? 'The copy will be withdrawn until resolved.' : 'The copy stays in circulation.'}
        />
        <Textarea label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} wrapperClassName="sm:col-span-2" />
        <Input label="Estimated repair cost (₹)" type="number" min={0} value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
        <Input label="Maintenance notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Send to bindery" />
        <div className="sm:col-span-2">
          <FileUploader label="Images" value={images} onChange={setImages} />
        </div>
      </form>
    </Modal>
  );
}

function ReportDrawer({ report, onClose }: { report: DamageReport | undefined; onClose: () => void }) {
  const { db, update } = useLibrary();
  const attempt = useAttempt();
  const lookups = useLookups();
  const [status, setStatus] = useState<DamageStatus>('reported');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('0');

  useEffect(() => {
    if (!report) return;
    setStatus(report.status);
    setNote('');
    setCost(String(report.repairCost));
  }, [report?.id, report?.status, report?.repairCost]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!report) return null;

  const book = lookups.book(report.bookId);
  const others = db.damage.filter((d) => d.bookId === report.bookId);
  const changed = status !== report.status || note.trim() !== '' || Number(cost) !== report.repairCost;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const ok = attempt(() => {
      update((d) => updateDamageStatus(d, report.id, { status, note, repairCost: Math.max(0, Number(cost) || 0) }));
      return true;
    }, status === 'resolved' && report.copyWithdrawn ? 'Report resolved. The copy is back in circulation.' : 'Damage report updated.');
    if (ok) setNote('');
  };

  return (
    <Drawer open onClose={onClose} title={`Damage report ${report.id}`} description={book?.title}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.severity} />
          <StatusBadge status={report.status} />
          {report.copyWithdrawn && report.status !== 'resolved' && <span className="text-xs text-red-700">Copy withdrawn from circulation</span>}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <BookCell book={book} to={`/admin/books/${report.bookId}`} meta={book ? `ISBN ${book.isbn}` : undefined} />
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Member">{report.memberId ? lookups.memberName(report.memberId) : 'Found during inspection'}</Detail>
          <Detail label="Transaction">
            <span className="tabular">{report.loanId ?? '—'}</span>
          </Detail>
          <Detail label="Date reported">{formatDate(report.date)}</Detail>
          <Detail label="Damage type">{report.type}</Detail>
          <Detail label="Repair cost">{formatCurrency(report.repairCost)}</Detail>
          <Detail label="Maintenance notes">{report.notes || '—'}</Detail>
          <Detail label="Description" className="col-span-2">
            {report.description}
          </Detail>
        </dl>

        <section>
          <h3 className="eyebrow">Images</h3>
          {report.images.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
              <ImageOff className="h-4 w-4" aria-hidden />
              No photos attached to this report.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {report.images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                  <img src={src} alt={`Damage photo ${i + 1}`} className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="eyebrow mb-3">Maintenance timeline</h3>
          <DamageSteps report={report} />
        </section>

        <form onSubmit={save} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="font-serif text-[17px] font-semibold leading-snug text-slate-900">Update maintenance status</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as DamageStatus)} options={statuses.map((s) => ({ value: s, label: statusLabel(s) }))} />
            <Input label="Repair cost (₹)" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed?" />
          <Button type="submit" disabled={!changed}>
            Save update
          </Button>
        </form>

        {others.length > 1 && (
          <section>
            <h3 className="eyebrow mb-3">Damage history for this book</h3>
            <DamageTimeline reports={others} memberName={lookups.memberName} />
          </section>
        )}
      </div>
    </Drawer>
  );
}

export default function Damage() {
  const { db } = useLibrary();
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const selectedId = params.get('report');
  const selected = db.damage.find((d) => d.id === selectedId);
  const select = (id: string | null) => setParams(id ? { report: id } : {}, { replace: true });

  const rows = useMemo(
    () =>
      db.damage
        .filter((d) => matches(query, d.id, lookups.bookTitle(d.bookId), lookups.book(d.bookId)?.isbn, d.memberId && lookups.memberName(d.memberId), d.type))
        .filter((d) => !status || d.status === status)
        .filter((d) => !severity || d.severity === severity),
    [db.damage, query, status, severity, lookups],
  );

  const open = db.damage.filter((d) => d.status !== 'resolved');

  const columns: Column<DamageReport>[] = [
    { key: 'id', header: 'Report', wideOnly: true, cell: (d) => <span className="tabular font-medium text-slate-900">{d.id}</span>, sortValue: (d) => d.id },
    { key: 'book', header: 'Book', primary: true, cell: (d) => <BookCell book={lookups.book(d.bookId)} />, sortValue: (d) => lookups.bookTitle(d.bookId) },
    { key: 'member', header: 'Member', cell: (d) => (d.memberId ? <MemberCell member={lookups.member(d.memberId)} /> : <span className="text-slate-400">Inspection</span>) },
    { key: 'date', header: 'Date', cell: (d) => formatDate(d.date), sortValue: (d) => d.date },
    { key: 'type', header: 'Damage type', cell: (d) => d.type, sortValue: (d) => d.type },
    { key: 'severity', header: 'Severity', cell: (d) => <StatusBadge status={d.severity} />, sortValue: (d) => severities.indexOf(d.severity) },
    { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} />, sortValue: (d) => statuses.indexOf(d.status) },
    { key: 'cost', header: 'Repair cost', align: 'right', cell: (d) => formatCurrency(d.repairCost), sortValue: (d) => d.repairCost },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (d) => (
        <Button size="sm" variant="ghost" icon={Eye} onClick={() => select(d.id)} aria-label={`Open ${d.id}`}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Damage Reports"
        description="Document damaged books and track them through repair"
        actions={
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            New Damage Report
          </Button>
        }
      />

      <div className="stat-strip mb-5 grid grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open reports" value={String(open.length)} hint={`${db.damage.length} in total`} icon={AlertOctagon} tone="amber" />
        <StatCard label="Under repair" value={String(db.damage.filter((d) => d.status === 'under_repair').length)} icon={Wrench} tone="brand" />
        <StatCard label="Copies withdrawn" value={String(open.filter((d) => d.copyWithdrawn).length)} hint="Unavailable until resolved" icon={PackageX} tone="red" />
        <StatCard label="Repair cost" value={formatCurrency(db.damage.reduce((s, d) => s + d.repairCost, 0))} hint="Estimated, all reports" icon={Wrench} tone="slate" />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <SearchBar value={query} onChange={setQuery} placeholder="Search by book, ISBN, member or damage type…" />
          <Select aria-label="Maintenance status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={statuses.map((s) => ({ value: s, label: statusLabel(s) }))} />
          <Select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="All severities" options={severities} />
        </div>
        <DataTable
          caption="Damage reports"
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          onRowClick={(d) => select(d.id)}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState icon={AlertOctagon} title="No damage reports found" description="Reports created at the desk or during a return appear here." />}
        />
      </Card>

      <ReportForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ReportDrawer report={selected} onClose={() => select(null)} />
    </>
  );
}
