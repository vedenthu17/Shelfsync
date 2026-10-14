import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CheckCircle2, Download, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import type { Member } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt, useToast } from '@/context/ToastContext';
import { deleteMember, setMemberStatus } from '@/domain/actions';
import { getMemberSummary, type MemberSummary } from '@/domain/selectors';
import { exportCsv } from '@/lib/export';
import { formatCurrency, formatDate, matches, plural } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown } from '@/components/ui/Dropdown';
import { SearchBar, Select } from '@/components/ui/Form';
import { ConfirmationDialog } from '@/components/ui/Overlay';
import { EmptyState, useSimulatedLoading } from '@/components/ui/States';
import { MemberCell } from '@/components/shared/Entities';
import { MemberFormModal } from '@/components/shared/MemberFormModal';

type Row = { member: Member; summary: MemberSummary };

export default function Members() {
  const { db, update } = useLibrary();
  const attempt = useAttempt();
  const toast = useToast();
  const navigate = useNavigate();
  const loading = useSimulatedLoading();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | undefined>();
  const [suspending, setSuspending] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      db.members
        .filter((m) => matches(query, m.id, m.name, m.email, m.phone, m.department))
        .filter((m) => !type || m.type === type)
        .map((member) => ({ member, summary: getMemberSummary(db, member.id) }))
        .filter((r) => {
          if (!status) return true;
          if (status === 'overdue') return r.summary.overdueLoans.length > 0;
          return r.member.status === status;
        }),
    [db, query, status, type],
  );

  const toggleStatus = (member: Member) => {
    const next = member.status === 'active' ? 'suspended' : 'active';
    attempt(() => {
      update((d) => setMemberStatus(d, member.id, next));
      return true;
    }, next === 'suspended' ? `${member.name} has been suspended.` : `${member.name} has been reinstated.`);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    attempt(() => {
      update((d) => deleteMember(d, deleting.id));
      return true;
    }, `${deleting.name} was removed.`);
    setDeleting(null);
  };

  const exportMembers = () => {
    exportCsv({
      title: 'Members',
      headers: ['Member ID', 'Name', 'Email', 'Phone', 'Type', 'Department', 'Status', 'Books issued', 'Overdue', 'Pending fines', 'Joined'],
      rows: rows.map(({ member: m, summary: s }) => [m.id, m.name, m.email, m.phone, m.type, m.department, m.status, s.activeLoans.length, s.overdueLoans.length, s.outstanding, m.joined]),
    });
    toast.success(`Exported ${plural(rows.length, 'member')} to CSV.`);
  };

  const columns: Column<Row>[] = [
    { key: 'member', header: 'Member', primary: true, cell: (r) => <MemberCell member={r.member} />, sortValue: (r) => r.member.name },
    {
      key: 'contact',
      header: 'Contact',
      cell: (r) => (
        <div>
          <p className="max-w-[14rem] truncate">{r.member.email}</p>
          <p className="tabular text-xs text-slate-500">{r.member.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={r.member.status} />
          {r.summary.overdueLoans.length > 0 && <StatusBadge status="overdue" />}
        </span>
      ),
      sortValue: (r) => r.member.status,
    },
    { key: 'issued', header: 'Issued', align: 'right', cell: (r) => r.summary.activeLoans.length, sortValue: (r) => r.summary.activeLoans.length },
    {
      key: 'overdue',
      header: 'Overdue',
      align: 'right',
      cell: (r) => <span className={r.summary.overdueLoans.length ? 'font-medium text-red-700' : undefined}>{r.summary.overdueLoans.length}</span>,
      sortValue: (r) => r.summary.overdueLoans.length,
    },
    {
      key: 'fines',
      header: 'Pending fines',
      align: 'right',
      cell: (r) => <span className={r.summary.outstanding ? 'font-medium text-slate-900' : 'text-slate-400'}>{formatCurrency(r.summary.outstanding)}</span>,
      sortValue: (r) => r.summary.outstanding,
    },
    { key: 'joined', header: 'Joined', cell: (r) => formatDate(r.member.joined), sortValue: (r) => r.member.joined },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: ({ member }) => (
        <Dropdown
          label={`Actions for ${member.name}`}
          items={[
            { label: 'View profile', icon: Eye, onSelect: () => navigate(`/admin/members/${member.id}`) },
            {
              label: 'Edit',
              icon: Pencil,
              onSelect: () => {
                setEditing(member);
                setFormOpen(true);
              },
            },
            member.status === 'active'
              ? { label: 'Suspend', icon: Ban, onSelect: () => setSuspending(member) }
              : { label: 'Reinstate', icon: CheckCircle2, onSelect: () => toggleStatus(member) },
            { label: 'Delete', icon: Trash2, tone: 'danger', separated: true, onSelect: () => setDeleting(member) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Members"
        description="Register members and review their borrowing standing"
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportMembers}>
              Export
            </Button>
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              Add Member
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <SearchBar value={query} onChange={setQuery} placeholder="Search by name, member ID, email or phone…" />
          <Select
            aria-label="Membership status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'overdue', label: 'Has overdue books' },
            ]}
          />
          <Select aria-label="Member type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All member types" options={['Student', 'Faculty', 'Staff']} />
        </div>
        <DataTable
          caption="Members"
          loading={loading}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.member.id}
          onRowClick={(r) => navigate(`/admin/members/${r.member.id}`)}
          empty={<EmptyState icon={Users} title="No members found" description="Try a different search or filter." />}
        />
      </Card>

      <MemberFormModal open={formOpen} onClose={() => setFormOpen(false)} member={editing} />

      <ConfirmationDialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        onConfirm={() => {
          if (suspending) toggleStatus(suspending);
          setSuspending(null);
        }}
        title="Suspend this member?"
        confirmLabel="Suspend member"
        message={
          <>
            <span className="font-medium text-slate-900">{suspending?.name}</span> will not be able to borrow or reserve books until
            reinstated. Existing loans are unaffected.
          </>
        }
      />
      <ConfirmationDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this member?"
        confirmLabel="Delete member"
        message={
          <>
            <span className="font-medium text-slate-900">{deleting?.name}</span>'s account will be removed. Members with books on loan
            or unpaid fines cannot be deleted.
          </>
        }
      />
    </>
  );
}
