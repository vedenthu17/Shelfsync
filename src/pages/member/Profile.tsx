import { useState } from 'react';
import { BookCheck, BookOpen, IndianRupee, Library, Pencil } from 'lucide-react';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Detail, PageHeader, StatCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { MemberAvatar } from '@/components/shared/Entities';
import { MemberFormModal } from '@/components/shared/MemberFormModal';
import { ChangePasswordCard } from '@/components/shared/Passwords';

export default function Profile() {
  const { member, summary } = useCurrentMember();
  const [editOpen, setEditOpen] = useState(false);

  if (!member) {
    return (
      <Card>
        <EmptyState title="Profile unavailable" description="We could not find your member record. Please contact the library desk." />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your membership details and borrowing statistics"
        actions={
          <Button icon={Pencil} onClick={() => setEditOpen(true)}>
            Edit profile
          </Button>
        }
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <MemberAvatar name={member.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-[28px] font-medium leading-tight tracking-tight text-slate-900">{member.name}</h2>
              <StatusBadge status={member.status} />
              {summary.overdueLoans.length > 0 && <StatusBadge status="overdue" />}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {member.type} · {member.department || 'No department'}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 pt-6 lg:grid-cols-3">
          <Detail label="Name">{member.name}</Detail>
          <Detail label="Member ID">
            <span className="tabular">{member.id}</span>
          </Detail>
          <Detail label="Email">
            <span className="break-all">{member.email}</span>
          </Detail>
          <Detail label="Phone">
            <span className="tabular">{member.phone || '—'}</span>
          </Detail>
          <Detail label="Membership status">{member.status === 'active' ? 'Active' : 'Suspended'}</Detail>
          <Detail label="Join date">{formatDate(member.joined)}</Detail>
        </dl>
      </Card>

      <h2 className="mb-3 mt-7 font-serif text-[17px] font-semibold leading-snug text-slate-900">Statistics</h2>
      <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
        <StatCard label="Books borrowed" value={String(summary.borrowedCount)} hint="Since joining" icon={Library} />
        <StatCard label="Books returned" value={String(summary.returnedCount)} icon={BookCheck} tone="green" />
        <StatCard label="Current loans" value={String(summary.activeLoans.length)} icon={BookOpen} to="/member/books" />
        <StatCard label="Total fines" value={formatCurrency(summary.totalFined)} hint={`${formatCurrency(summary.outstanding)} outstanding`} icon={IndianRupee} tone="amber" to="/member/fines" />
      </div>

      <h2 className="mb-3 mt-7 font-serif text-[17px] font-semibold leading-snug text-slate-900">Sign-in</h2>
      <ChangePasswordCard accountId={member.id} className="max-w-2xl" />

      <MemberFormModal open={editOpen} onClose={() => setEditOpen(false)} member={member} selfService />
    </>
  );
}
