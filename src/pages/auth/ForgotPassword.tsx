import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { MIN_PASSWORD_LENGTH, resetPasswordWithIdentity } from '@/domain/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { AuthShell } from './AuthShell';

const blank = { memberId: '', email: '', phone: '', password: '', confirm: '' };

// There is no mail server to send a reset link through, so a member proves who
// they are with three things on their library record and sets a new password
// on the spot. Anyone who cannot is sent to the desk, where a librarian can
// issue a temporary password.
export default function ForgotPassword() {
  const { update } = useLibrary();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (key: keyof typeof blank, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.memberId.trim() || !form.email.trim() || !form.phone.trim()) return setError('Fill in your member ID, email and phone number.');
    if (form.password !== form.confirm) return setError('The new passwords do not match.');
    try {
      update((d) => resetPasswordWithIdentity(d, form));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The password could not be reset.');
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Confirm the details on your library record, then choose a new password.">
      {done ? (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/80 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-3 font-serif text-[17px] font-semibold leading-snug text-slate-900">Password updated</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">You can now log in with your new password.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-key hover:bg-brand-800"
          >
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Member ID" required value={form.memberId} onChange={(e) => set('memberId', e.target.value)} placeholder="M-1001" autoFocus />
            <Input label="Phone on record" type="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
          </div>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          <div className="grid gap-4 border-t border-slate-900/10 pt-4 sm:grid-cols-2">
            <Input
              label="New password"
              type="password"
              required
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
            <Input label="Confirm new password" type="password" required value={form.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full">
            Reset password
          </Button>
          <p className="text-xs leading-relaxed text-slate-600">
            Don't have these details to hand? Ask at the library desk — a librarian can issue a temporary password.
          </p>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to login
      </Link>
    </AuthShell>
  );
}
