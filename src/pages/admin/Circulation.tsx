import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BellRing, BookUp, CheckCircle2, Info, Undo2 } from 'lucide-react';
import type { Book, DamageSeverity, DamageType, Fine, Loan, Member, Reservation } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt, useToast } from '@/context/ToastContext';
import { issueBlocker, issueBook, notifyNextInQueue, returnBook } from '@/domain/actions';
import { getInventory, getMemberSummary, isActive, overdueDays } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { addDays, cn, formatCurrency, formatDate, matches, plural, today } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Detail, PageHeader, Tabs } from '@/components/ui/Card';
import { FileUploader } from '@/components/ui/FileUploader';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Form';
import { BookCover } from '@/components/shared/BookCover';
import { BookCell, MemberAvatar, MemberCell } from '@/components/shared/Entities';
import { PaymentModal } from '@/components/shared/PaymentModal';
import { Picker } from '@/components/shared/Picker';

type Tab = 'issue' | 'return';

const damageTypes: DamageType[] = ['Torn pages', 'Water damage', 'Cover damage', 'Missing pages', 'Writing/marking', 'Other'];
const severities: DamageSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4">
      <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="pt-0.5 font-serif text-[17px] font-semibold leading-snug text-slate-900">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Callout({ tone, icon: Icon, children }: { tone: 'red' | 'amber' | 'green' | 'blue'; icon: typeof Info; children: ReactNode }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    blue: 'border-brand-200 bg-brand-50 text-brand-800',
  };
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', tones[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ---- Issue -----------------------------------------------------------------

function IssuePanel() {
  const { db, apply } = useLibrary();
  const attempt = useAttempt();
  const [params] = useSearchParams();
  const [member, setMember] = useState<Member | undefined>(() => db.members.find((m) => m.id === params.get('member')));
  const [book, setBook] = useState<Book | undefined>(() => db.books.find((b) => b.id === params.get('book')));
  const [issued, setIssued] = useState<Loan | null>(null);
  const lookups = useLookups();

  // Always read the live records so counts refresh after an issue.
  const liveMember = member && db.members.find((m) => m.id === member.id);
  const liveBook = book && db.books.find((b) => b.id === book.id);
  const summary = liveMember ? getMemberSummary(db, liveMember.id) : null;
  const inventory = liveBook ? getInventory(db, liveBook) : null;
  const blocker = liveMember && liveBook ? issueBlocker(db, liveMember.id, liveBook.id) : null;
  const dueDate = addDays(today(), db.settings.loanPeriodDays);

  const issue = () => {
    if (!liveMember || !liveBook) return;
    const result = attempt(() => apply((d) => issueBook(d, { memberId: liveMember.id, bookId: liveBook.id })));
    if (result) {
      setIssued(result.loan);
      setBook(undefined);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="space-y-6 p-5 sm:p-6">
        {issued && (
          <Callout tone="green" icon={CheckCircle2}>
            <p className="font-medium">Book issued — {issued.id}</p>
            <p className="mt-0.5">
              “{lookups.bookTitle(issued.bookId)}” issued to {lookups.memberName(issued.memberId)}. Due on {formatDate(issued.dueDate)}.
              Inventory has been updated.
            </p>
          </Callout>
        )}

        <Picker<Member>
          label="Member"
          placeholder="Search by member ID, name or email"
          items={db.members}
          selected={liveMember}
          onSelect={(m) => {
            setMember(m);
            setIssued(null);
          }}
          itemKey={(m) => m.id}
          filter={(m, q) => matches(q, m.id, m.name, m.email)}
          renderItem={(m) => (
            <span className="flex items-center justify-between gap-3">
              <MemberCell member={m} />
              <StatusBadge status={m.status} />
            </span>
          )}
          renderSelected={(m) => (
            <div className="flex items-start gap-3">
              <MemberAvatar name={m.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/members/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {m.name}
                  </Link>
                  <StatusBadge status={m.status} />
                  {summary && summary.overdueLoans.length > 0 && <StatusBadge status="overdue" />}
                </div>
                <p className="tabular text-xs text-slate-500">
                  {m.id} · {m.type} · {m.department}
                </p>
                {summary && (
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <Detail label="Active loans">
                      {summary.activeLoans.length} of {db.settings.maxLoansPerMember}
                    </Detail>
                    <Detail label="Overdue">{summary.overdueLoans.length}</Detail>
                    <Detail label="Pending fines">{formatCurrency(summary.outstanding)}</Detail>
                  </dl>
                )}
              </div>
            </div>
          )}
        />

        <Picker<Book>
          label="Book"
          placeholder="Search by ISBN, title or author"
          items={db.books}
          selected={liveBook}
          onSelect={(b) => {
            setBook(b);
            setIssued(null);
          }}
          itemKey={(b) => b.id}
          filter={(b, q) => matches(q, b.title, b.author) || matches(q.replace(/-/g, ''), b.isbn.replace(/-/g, ''))}
          renderItem={(b) => (
            <span className="flex items-center justify-between gap-3">
              <BookCell book={b} meta={`${b.author} · ${b.isbn}`} />
              <StatusBadge status={getInventory(db, b).state} />
            </span>
          )}
          renderSelected={(b) => (
            <div className="flex items-start gap-3">
              <BookCover book={b} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/books/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {b.title}
                  </Link>
                  {inventory && <StatusBadge status={inventory.state} />}
                </div>
                <p className="text-xs text-slate-500">{b.author}</p>
                {inventory && (
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <Detail label="ISBN">
                      <span className="tabular">{b.isbn}</span>
                    </Detail>
                    <Detail label="Shelf">
                      <span className="tabular">{b.shelf}</span>
                    </Detail>
                    <Detail label="Available">
                      {inventory.available} of {inventory.total}
                    </Detail>
                  </dl>
                )}
              </div>
            </div>
          )}
        />
      </Card>

      <Card className="h-fit p-5">
        <h2 className="font-serif text-[17px] font-semibold leading-snug text-slate-900">Loan summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          {(
            [
              ['Issue date', formatDate(today())],
              ['Loan period', plural(db.settings.loanPeriodDays, 'day')],
              ['Due date', formatDate(dueDate)],
              ['Active loans after issue', summary ? `${summary.activeLoans.length + (blocker ? 0 : 1)} of ${db.settings.maxLoansPerMember}` : '—'],
              ['Fine if late', `${formatCurrency(db.settings.fineRatePerDay)} per day`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">{label}</dt>
              <dd className="tabular font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
          {liveMember && liveBook && blocker && (
            <Callout tone="red" icon={AlertTriangle}>
              {blocker}
            </Callout>
          )}
          {liveMember && !blocker && summary && summary.overdueLoans.length > 0 && (
            <Callout tone="amber" icon={AlertTriangle}>
              This member has {plural(summary.overdueLoans.length, 'overdue book')}.
            </Callout>
          )}
          <Button icon={BookUp} size="lg" className="w-full" disabled={!liveMember || !liveBook || !!blocker} onClick={issue}>
            Issue Book
          </Button>
          {(!liveMember || !liveBook) && <p className="text-center text-xs text-slate-500">Select a member and a book to continue.</p>}
        </div>
      </Card>
    </div>
  );
}

// ---- Return ----------------------------------------------------------------

interface ReturnOutcome {
  loan: Loan;
  fine: Fine | null;
  damageFine: Fine | null;
  nextReservation: Reservation | null;
}

function ReturnPanel() {
  const { db, apply } = useLibrary();
  const attempt = useAttempt();
  const toast = useToast();
  const lookups = useLookups();
  const [params] = useSearchParams();
  const [loan, setLoan] = useState<Loan | undefined>(() => db.loans.find((l) => l.id === params.get('loan') && isActive(l)));
  const [outcome, setOutcome] = useState<ReturnOutcome | null>(null);
  const [paying, setPaying] = useState<Fine | null>(null);

  const [damaged, setDamaged] = useState(false);
  const [type, setType] = useState<DamageType>('Torn pages');
  const [severity, setSeverity] = useState<DamageSeverity>('Low');
  const [description, setDescription] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [images, setImages] = useState<string[]>([]);
  const [chargeMember, setChargeMember] = useState(true);

  useEffect(() => {
    setDamaged(false);
    setType('Torn pages');
    setSeverity('Low');
    setDescription('');
    setRepairCost('0');
    setImages([]);
    setChargeMember(true);
  }, [loan?.id]);

  const activeLoans = db.loans.filter(isActive);
  const book = lookups.book(loan?.bookId);
  const member = lookups.member(loan?.memberId);
  const late = loan ? overdueDays(loan, db.settings) : 0;
  const overdueFine = late * db.settings.fineRatePerDay;
  const damageCharge = damaged && chargeMember ? Math.max(0, Number(repairCost) || 0) : 0;

  const submit = () => {
    if (!loan) return;
    if (damaged && !description.trim()) {
      toast.error('Describe the damage before returning the book.');
      return;
    }
    const result = attempt(() =>
      apply((d) =>
        returnBook(d, {
          loanId: loan.id,
          damage: damaged
            ? { type, severity, description: description.trim(), repairCost: Math.max(0, Number(repairCost) || 0), images, chargeMember }
            : undefined,
        }),
      ),
    );
    if (result) {
      setOutcome({ loan, fine: result.fine, damageFine: result.damageFine, nextReservation: result.nextReservation });
      setLoan(undefined);
    }
  };

  const notify = (bookId: string) => {
    const result = attempt(
      () => apply((d) => notifyNextInQueue(d, bookId)),
      (r) => `${lookups.memberName(r.reservation.memberId)} has been notified. A copy is on hold for them.`,
    );
    if (result) setOutcome((o) => (o ? { ...o, nextReservation: null } : o));
  };

  // A fine shown in the outcome may have been paid since; read the live record.
  const liveFine = (f: Fine | null) => (f ? db.fines.find((x) => x.id === f.id) ?? f : null);

  return (
    <div className="space-y-5">
      {outcome && (
        <Card className="space-y-3 p-5">
          <Callout tone="green" icon={CheckCircle2}>
            <p className="font-medium">Return processed — {outcome.loan.id}</p>
            <p className="mt-0.5">
              “{lookups.bookTitle(outcome.loan.bookId)}” returned by {lookups.memberName(outcome.loan.memberId)}. Inventory has been updated.
            </p>
          </Callout>
          {[liveFine(outcome.fine), liveFine(outcome.damageFine)].map(
            (f) =>
              f && (
                <Callout key={f.id} tone="amber" icon={AlertTriangle}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {f.reason === 'damage' ? 'Damage charge' : `Overdue fine (${f.overdueDays} days × ${formatCurrency(f.rate)})`}:{' '}
                      <span className="font-semibold">{formatCurrency(f.amount)}</span>
                      {f.paid >= f.amount ? ' — paid' : f.paid > 0 ? ` — ${formatCurrency(f.amount - f.paid)} remaining` : ''}
                    </span>
                    {f.paid < f.amount && (
                      <Button size="sm" variant="secondary" onClick={() => setPaying(f)}>
                        Record payment
                      </Button>
                    )}
                  </div>
                </Callout>
              ),
          )}
          {outcome.nextReservation && (
            <Callout tone="blue" icon={BellRing}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">Book available — notify next member in queue.</span>{' '}
                  {lookups.memberName(outcome.nextReservation.memberId)} is first in line.
                </span>
                <Button size="sm" onClick={() => notify(outcome.nextReservation!.bookId)}>
                  Notify member
                </Button>
              </div>
            </Callout>
          )}
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <Picker<Loan>
          label="Find the loan"
          placeholder="Search by transaction ID, member name or ID, ISBN or title"
          items={activeLoans}
          selected={loan && isActive(loan) ? loan : undefined}
          onSelect={(l) => {
            setLoan(l);
            if (l) setOutcome(null);
          }}
          itemKey={(l) => l.id}
          emptyText="No open loans match"
          filter={(l, q) => {
            const b = lookups.book(l.bookId);
            const m = lookups.member(l.memberId);
            return matches(q, l.id, b?.title, m?.name, m?.id) || matches(q.replace(/-/g, ''), b?.isbn.replace(/-/g, ''));
          }}
          renderItem={(l) => (
            <span className="flex items-center justify-between gap-3">
              <BookCell book={lookups.book(l.bookId)} meta={`${l.id} · ${lookups.memberName(l.memberId)}`} />
              <StatusBadge status={overdueDays(l, db.settings) > 0 ? 'overdue' : 'on_loan'} />
            </span>
          )}
          renderSelected={(l) => (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="tabular font-semibold text-slate-900">{l.id}</span>
              <span className="text-slate-600">
                {lookups.bookTitle(l.bookId)} · {lookups.memberName(l.memberId)}
              </span>
            </span>
          )}
        />

        {!loan && !outcome && (
          <p className="mt-4 text-sm text-slate-500">
            {plural(activeLoans.length, 'book')} currently on loan. Pick one to start the return.
          </p>
        )}

        {loan && book && member && (
          <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
            <Step n={1} title="Verify the book">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <BookCover book={book} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{book.title}</p>
                    <p className="truncate text-xs text-slate-500">{book.author}</p>
                    <p className="tabular mt-1 text-xs text-slate-500">ISBN {book.isbn}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <MemberAvatar name={member.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{member.name}</p>
                    <p className="tabular text-xs text-slate-500">
                      {member.id} · {member.type}
                    </p>
                  </div>
                </div>
              </div>
            </Step>

            <Step n={2} title="Overdue information">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail label="Issue date">{formatDate(loan.issueDate)}</Detail>
                <Detail label="Due date">{formatDate(loan.dueDate)}</Detail>
                <Detail label="Current date">{formatDate(today())}</Detail>
                <Detail label="Overdue days">
                  <span className={cn('font-semibold', late > 0 ? 'text-red-700' : 'text-emerald-700')}>{late > 0 ? late : 'On time'}</span>
                </Detail>
              </dl>
            </Step>

            <Step n={3} title="Fine">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
                {late > 0 ? (
                  <p className="text-slate-700">
                    {plural(late, 'overdue day')} × {formatCurrency(db.settings.fineRatePerDay)} per day ={' '}
                    <span className="text-base font-semibold text-slate-900">{formatCurrency(overdueFine)}</span>
                  </p>
                ) : (
                  <p className="text-slate-700">Returned within the due date — no fine.</p>
                )}
                {db.settings.graceDays > 0 && (
                  <p className="mt-1 text-xs text-slate-500">A grace period of {plural(db.settings.graceDays, 'day')} has been applied.</p>
                )}
              </div>
            </Step>

            <Step n={4} title="Condition check">
              <Checkbox
                label="The book was returned damaged"
                description="Creates a damage report linked to this member and transaction."
                checked={damaged}
                onChange={(e) => setDamaged(e.target.checked)}
              />
              {damaged && (
                <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                  <Select label="Damage type" value={type} onChange={(e) => setType(e.target.value as DamageType)} options={damageTypes} />
                  <Select
                    label="Severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as DamageSeverity)}
                    options={severities}
                    hint={severity === 'High' || severity === 'Critical' ? 'The copy will be withdrawn until repaired.' : 'The copy stays in circulation.'}
                  />
                  <Textarea
                    label="Description"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is damaged, and where?"
                    wrapperClassName="sm:col-span-2"
                  />
                  <Input label="Estimated repair cost (₹)" type="number" min={0} value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
                  <div className="flex items-end pb-2.5">
                    <Checkbox label="Charge the repair cost to the member" checked={chargeMember} onChange={(e) => setChargeMember(e.target.checked)} />
                  </div>
                  <div className="sm:col-span-2">
                    <FileUploader label="Photos" value={images} onChange={setImages} />
                  </div>
                </div>
              )}
            </Step>

            <Step n={5} title="Complete the return">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Total charges: <span className="text-base font-semibold text-slate-900">{formatCurrency(overdueFine + damageCharge)}</span>
                  <span className="block text-xs text-slate-500">
                    The copy returns to stock{damaged && (severity === 'High' || severity === 'Critical') ? ' as damaged' : ''} and the
                    reservation queue is checked.
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setLoan(undefined)}>
                    Cancel
                  </Button>
                  <Button icon={Undo2} onClick={submit}>
                    Return Book
                  </Button>
                </div>
              </div>
            </Step>
          </div>
        )}
      </Card>

      <PaymentModal fine={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

export default function Circulation() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'return' ? 'return' : 'issue';

  return (
    <>
      <PageHeader title="Circulation" description="Issue books to members and process returns" />
      <Tabs<Tab>
        className="mb-5"
        active={tab}
        onChange={(t) => setParams(t === 'issue' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { key: 'issue', label: 'Issue Book' },
          { key: 'return', label: 'Return Book' },
        ]}
      />
      {tab === 'issue' ? <IssuePanel /> : <ReturnPanel />}
    </>
  );
}
