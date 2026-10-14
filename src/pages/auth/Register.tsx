import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MemberType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { MIN_PASSWORD_LENGTH } from '@/domain/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { AuthShell } from './AuthShell';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    type: 'Student' as MemberType,
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('The passwords do not match.');
    try {
      const user = register(
        {
          name: form.name.trim(),
          email: form.email,
          phone: form.phone.trim(),
          department: form.department.trim() || 'General',
          type: form.type,
          status: 'active',
        },
        form.password,
      );
      toast.success(`Welcome, ${user.name.split(' ')[0]}! Your member ID is ${user.memberId}.`);
      navigate('/member/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the account.');
    }
  };

  return (
    <AuthShell title="Create a member account" subtitle="Register to browse, reserve and track your loans.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Full name" required value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" autoFocus />
        <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            autoComplete="tel"
            hint="Used to confirm it's you if you forget your password"
          />
          <Select label="Member type" value={form.type} onChange={(e) => set('type', e.target.value as MemberType)} options={['Student', 'Faculty', 'Staff']} />
        </div>
        <Input label="Department" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Computer Engineering" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <Input label="Confirm password" type="password" required value={form.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
