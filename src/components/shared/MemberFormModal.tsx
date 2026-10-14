import { useEffect, useState, type FormEvent } from 'react';
import type { Member, MemberType } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { addMember, updateMember, type MemberInput } from '@/domain/actions';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { TemporaryPasswordModal } from './Passwords';

const blank: MemberInput = { name: '', email: '', phone: '', department: '', type: 'Student', status: 'active' };

export function MemberFormModal({
  open,
  onClose,
  member,
  /** Members editing their own profile cannot change type or status. */
  selfService,
}: {
  open: boolean;
  onClose: () => void;
  member?: Member;
  selfService?: boolean;
}) {
  const { apply, update } = useLibrary();
  const attempt = useAttempt();
  const [form, setForm] = useState<MemberInput>(blank);
  const [issued, setIssued] = useState<{ name: string; memberId: string; password: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (member) {
      const { id: _id, joined: _joined, ...rest } = member;
      setForm(rest);
    } else {
      setForm(blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  const set = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = { ...form, name: form.name.trim(), phone: form.phone.trim(), department: form.department.trim() };
    const ok = member
      ? attempt(() => {
          update((d) => updateMember(d, member.id, input));
          return true;
        }, selfService ? 'Profile updated.' : 'Member details updated.')
      : attempt(() => apply((d) => addMember(d, input)), (r) => `${r.member.name} registered as ${r.member.id}.`);
    // A member the desk registers gets a temporary password to pass on.
    if (ok && ok !== true && ok.temporaryPassword) {
      setIssued({ name: ok.member.name, memberId: ok.member.id, password: ok.temporaryPassword });
    }
    if (ok) onClose();
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={selfService ? 'Edit profile' : member ? 'Edit member' : 'Add member'}
      description={member ? member.id : 'Register a new library member.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-form">
            {member ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={form.name} onChange={(e) => set('name', e.target.value)} wrapperClassName="sm:col-span-2" />
        <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Department" value={form.department} onChange={(e) => set('department', e.target.value)} wrapperClassName={selfService ? 'sm:col-span-2' : undefined} />
        {!selfService && (
          <Select label="Member type" value={form.type} onChange={(e) => set('type', e.target.value as MemberType)} options={['Student', 'Faculty', 'Staff']} />
        )}
      </form>
    </Modal>
    <TemporaryPasswordModal issued={issued} onClose={() => setIssued(null)} />
    </>
  );
}
