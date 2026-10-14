import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Download, Minus, RotateCcw, Save, Upload } from 'lucide-react';
import type { Database, Settings as LibrarySettings } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt, useToast } from '@/context/ToastContext';
import { updateSettings } from '@/domain/actions';
import { ADMIN_ACCOUNT_ID } from '@/domain/auth';
import { createBackup, readBackup } from '@/domain/backup';
import { downloadJson } from '@/lib/export';
import { can, type Permission } from '@/lib/permissions';
import { formatCurrency, plural, today } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { ConfirmationDialog } from '@/components/ui/Overlay';
import { ChangePasswordCard } from '@/components/shared/Passwords';

const permissionRows: Array<[Permission, string]> = [
  ['catalog:manage', 'Add, edit and delete books and categories'],
  ['members:manage', 'Manage members and suspend accounts'],
  ['circulation:manage', 'Issue, renew and return books'],
  ['reservations:manage', 'Manage every reservation queue'],
  ['fines:manage', 'Record payments and configure fine rates'],
  ['damage:manage', 'Create and update damage reports'],
  ['reports:view', 'View reports and analytics'],
  ['settings:manage', 'Change system settings'],
  ['reservations:self', 'Reserve books, renew own loans, view own fines'],
  ['profile:self', 'Edit own profile and password'],
];

const phaseTwo = [
  ['Barcode scanner integration', 'Scan a book or member card instead of searching.'],
  ['RFID integration', 'Self-checkout gates and shelf audits.'],
  ['SMS & email notifications', 'Reminders are in-app only in this release.'],
  ['Digital lending (DRM)', 'E-book and audiobook loans.'],
  ['Semantic search & recommendations', 'Search is keyword-based in this release.'],
];

type NumericKey = Exclude<keyof LibrarySettings, 'libraryName'>;

export default function Settings() {
  const { db, update, resetDemoData, replaceData } = useLibrary();
  const attempt = useAttempt();
  const toast = useToast();
  const [form, setForm] = useState<LibrarySettings>(db.settings);
  const [resetOpen, setResetOpen] = useState(false);
  const [restoring, setRestoring] = useState<{ name: string; db: Database } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A reset or a restore swaps the settings out from under the form.
  useEffect(() => setForm(db.settings), [db.settings]);

  const dirty = JSON.stringify(form) !== JSON.stringify(db.settings);
  const number = (key: NumericKey, min: number) => ({
    type: 'number' as const,
    min,
    required: true,
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: Math.max(min, Math.floor(Number(e.target.value)) || 0) })),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    attempt(() => {
      update((d) => updateSettings(d, { ...form, libraryName: form.libraryName.trim() || 'Library' }));
      return true;
    }, 'Settings saved. New rules apply from now on.');
  };

  const downloadBackup = () => {
    downloadJson(`shelfsync-backup-${today()}.json`, createBackup(db));
    toast.success('Backup downloaded.');
  };

  const chooseBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setRestoring({ name: file.name, db: readBackup(await file.text()) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  const restore = () => {
    if (!restoring) return;
    replaceData(restoring.db);
    setRestoring(null);
    toast.success('Backup restored.');
  };

  return (
    <>
      <PageHeader title="Settings" description="Circulation rules, sign-in, access control and data" />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Circulation & fine rules" description="Used by the issue, renew, return and fine calculations" />
          <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
            <Input
              label="Library name"
              value={form.libraryName}
              onChange={(e) => setForm((f) => ({ ...f, libraryName: e.target.value }))}
              wrapperClassName="sm:col-span-2"
            />
            <Input label="Fine rate per overdue day (₹)" hint="Fine = overdue days × this rate" {...number('fineRatePerDay', 0)} />
            <Input label="Grace period (days)" hint="Days late before a fine starts" {...number('graceDays', 0)} />
            <Input label="Loan period (days)" hint="Sets the due date at issue and at each renewal" {...number('loanPeriodDays', 1)} />
            <Input label="Maximum loans per member" {...number('maxLoansPerMember', 1)} />
            <Input label="Renewals per loan" hint="0 switches renewals off" {...number('maxRenewals', 0)} />
            <Input label="Due-date reminder (days ahead)" hint="Members are reminded this far in advance" {...number('reminderDays', 0)} />
            <Input label="Reservation hold (days)" hint="How long a ready copy is kept aside" {...number('holdDays', 1)} />
            <div className="rounded-lg border border-slate-900/10 bg-white/50 px-4 py-3 text-sm text-slate-600 sm:col-span-2">
              With these rules, a book returned {form.graceDays + 6} days late is charged for 6 days: 6 ×{' '}
              {formatCurrency(form.fineRatePerDay)} = <span className="font-semibold text-slate-900">{formatCurrency(6 * form.fineRatePerDay)}</span>.{' '}
              {form.maxRenewals > 0
                ? `A member can keep one book for up to ${plural(form.loanPeriodDays * (form.maxRenewals + 1), 'day')} by renewing.`
                : 'Loans cannot be renewed.'}
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="secondary" onClick={() => setForm(db.settings)} disabled={!dirty}>
                Discard
              </Button>
              <Button type="submit" icon={Save} disabled={!dirty}>
                Save settings
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <ChangePasswordCard accountId={ADMIN_ACCOUNT_ID} />

          <Card className="overflow-hidden">
            <CardHeader title="Roles & permissions" description="Role-based access control enforced on routes and controls" />
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-900/10 bg-slate-900/[0.035] text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-500">
                    <th scope="col" className="px-5 py-2.5">
                      Permission
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center">
                      Admin / Librarian
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center">
                      Member
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/[0.07]">
                  {permissionRows.map(([permission, label]) => (
                    <tr key={permission}>
                      <th scope="row" className="px-5 py-2.5 text-left font-normal text-slate-700">
                        {label}
                      </th>
                      {(['admin', 'member'] as const).map((role) => (
                        <td key={role} className="px-3 py-2.5 text-center">
                          {can(role, permission) ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Allowed" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Not allowed" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Data" description="Everything is stored in this browser, so keep a backup" />
          <ul className="divide-y divide-slate-900/[0.07]">
            <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-slate-800">Back up</p>
                <p className="text-[13px] text-slate-600">Download every book, member, loan, payment and setting as one file.</p>
              </div>
              <Button variant="secondary" icon={Download} onClick={downloadBackup}>
                Download backup
              </Button>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-slate-800">Restore</p>
                <p className="text-[13px] text-slate-600">Replace the data in this browser with a backup file, for example on a new computer.</p>
              </div>
              <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
                Restore from file
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Backup file" onChange={chooseBackup} />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-slate-800">Sample data</p>
                <p className="text-[13px] text-slate-600">Go back to the original sample books, members, transactions and passwords.</p>
              </div>
              <Button variant="secondary" icon={RotateCcw} onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
            </li>
          </ul>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Coming in Phase 2" description="Planned, not part of the current release" />
          <ul className="divide-y divide-slate-900/[0.07]">
            {phaseTwo.map(([title, text]) => (
              <li key={title} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{title}</p>
                  <p className="text-[13px] text-slate-600">{text}</p>
                </div>
                <Badge>Phase 2</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmationDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemoData();
          setResetOpen(false);
          toast.success('Demo data restored.');
        }}
        title="Reset demo data?"
        confirmLabel="Reset data"
        message="All changes made in this browser — new books, members, loans, payments, reports and passwords — will be replaced by the original sample data."
      />
      <ConfirmationDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        onConfirm={restore}
        title="Restore this backup?"
        confirmLabel="Replace data"
        message={
          <>
            Everything in this browser is replaced by <span className="font-medium text-slate-900">{restoring?.name}</span> (
            {restoring ? `${plural(restoring.db.books.length, 'book')}, ${plural(restoring.db.members.length, 'member')}` : ''}). Passwords
            become the ones saved in the backup.
          </>
        }
      />
    </>
  );
}
