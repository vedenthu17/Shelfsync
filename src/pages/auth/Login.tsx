import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FlaskConical, ShieldCheck, UserRound } from 'lucide-react';
import type { Role } from '@/types';
import { DEMO_ADMIN_EMAIL, DEMO_MEMBER_EMAIL, useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { useToast } from '@/context/ToastContext';
import { DEMO_PASSWORD } from '@/data/seed';
import { homeFor } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Form';
import { ConfirmationDialog } from '@/components/ui/Overlay';
import { AuthShell } from './AuthShell';

const demoAccounts: Array<{ role: Role; label: string; email: string; description: string; icon: typeof UserRound }> = [
  { role: 'admin', label: 'Administrator', email: DEMO_ADMIN_EMAIL, description: 'Full library operations', icon: ShieldCheck },
  { role: 'member', label: 'Library Member', email: DEMO_MEMBER_EMAIL, description: 'Browse, reserve, track loans', icon: UserRound },
];

export default function Login() {
  const { login } = useAuth();
  const { resetDemoData } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const signIn = (id: string, pass: string, demo = false) => {
    try {
      const user = login(id, pass, remember);
      const from = (location.state as { from?: string } | null)?.from ?? params.get('next');
      // Only honour a return path the signed-in role is allowed to open.
      const allowed = from && (from.startsWith(`/${user.role}`) || from.startsWith('/search') || from.startsWith('/books'));
      navigate(allowed ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(
        demo
          ? 'This sample account no longer uses the demo password. Sign in with its new password, or restore the sample data below.'
          : err instanceof Error
            ? err.message
            : 'Unable to sign in.',
      );
    }
  };

  // /login?demo=admin or ?demo=member signs straight in (optionally with &next=/path) — handy for presentations.
  const demo = params.get('demo');
  useEffect(() => {
    const account = demoAccounts.find((a) => a.role === demo);
    if (account) signIn(account.email, DEMO_PASSWORD, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    signIn(identifier, password);
  };

  return (
    <AuthShell title="Log in to ShelfSync" subtitle="Use your library account to continue.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Email or member ID"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@college.edu or M-1001"
          autoComplete="username"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full">
          Log in
        </Button>
      </form>

      <div className="mt-8 rounded-xl border border-dashed border-amber-600/50 bg-amber-50/70 p-4">
        <p className="eyebrow flex items-center gap-2 text-amber-800">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Demo mode — sign in with one click
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {demoAccounts.map((a) => (
            <button
              key={a.role}
              type="button"
              onClick={() => {
                setError('');
                signIn(a.email, DEMO_PASSWORD, true);
              }}
              className="group flex items-start gap-3 rounded-lg border border-slate-300 bg-white/80 p-3 text-left shadow-key-light transition-colors hover:border-brand-600 hover:bg-white"
            >
              <a.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className="block font-serif text-base font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{a.label}</span>
                <span className="block text-xs text-slate-500">{a.description}</span>
                <span className="tabular mt-1.5 block truncate text-[11px] text-slate-600">{a.email}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-amber-900">
          Every sample account starts with the password <code className="tabular font-semibold">{DEMO_PASSWORD}</code>.{' '}
          <button type="button" onClick={() => setResetOpen(true)} className="font-medium underline underline-offset-2 hover:no-underline">
            Restore sample data
          </button>
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to the library?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create a member account
        </Link>
      </p>

      <ConfirmationDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemoData();
          setResetOpen(false);
          setError('');
          toast.success('Sample data and demo passwords restored.');
        }}
        title="Restore the sample data?"
        confirmLabel="Restore data"
        message="Everything added or changed in this browser — books, members, loans, payments and passwords — is replaced by the original sample data."
      />
    </AuthShell>
  );
}
