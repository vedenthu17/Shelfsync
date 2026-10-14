import { useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { useToast } from '@/context/ToastContext';
import { changePassword, hasTemporaryPassword, MIN_PASSWORD_LENGTH } from '@/domain/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';

const blank = { current: '', next: '', confirm: '' };

/** Lets the signed-in user replace their own password. */
export function ChangePasswordCard({ accountId, className }: { accountId: string; className?: string }) {
  const { db, update } = useLibrary();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const temporary = hasTemporaryPassword(db, accountId);
  const set = (key: keyof typeof blank, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) return setError('The new passwords do not match.');
    try {
      update((d) => changePassword(d, accountId, form.current, form.next));
      setForm(blank);
      toast.success('Password changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The password could not be changed.');
    }
  };

  return (
    <Card className={className}>
      <CardHeader title="Password" description={`Use at least ${MIN_PASSWORD_LENGTH} characters`} />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2" noValidate>
        {temporary && (
          <p className="flex items-start gap-2.5 rounded-lg border border-amber-600/35 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-900 sm:col-span-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            You are using a temporary password from the library desk. Enter it below as your current password and choose your own.
          </p>
        )}
        <Input
          label="Current password"
          type="password"
          required
          value={form.current}
          onChange={(e) => set('current', e.target.value)}
          autoComplete="current-password"
          wrapperClassName="sm:col-span-2"
        />
        <Input label="New password" type="password" required value={form.next} onChange={(e) => set('next', e.target.value)} autoComplete="new-password" />
        <Input label="Confirm new password" type="password" required value={form.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" />
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" icon={KeyRound} disabled={!form.current || !form.next || !form.confirm}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Shows a desk-issued password once, so it can be read out or copied to the member. */
export function TemporaryPasswordModal({
  issued,
  onClose,
}: {
  issued: { name: string; memberId: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is blocked on some origins; the password is on screen to copy by hand.
    }
  };

  return (
    <Modal
      open={!!issued}
      onClose={onClose}
      title="Temporary password"
      description={issued ? `${issued.name} · ${issued.memberId}` : undefined}
      size="sm"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {issued && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 bg-white/70 px-4 py-3">
            <code className="select-all font-mono text-2xl font-semibold tracking-[0.12em] text-slate-900">{issued.password}</code>
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Give this to {issued.name.split(' ')[0]}. They sign in with member ID <span className="tabular font-medium text-slate-900">{issued.memberId}</span> or
            their email, and are asked to choose their own password.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800">It is shown only this once.</p>
        </>
      )}
    </Modal>
  );
}
