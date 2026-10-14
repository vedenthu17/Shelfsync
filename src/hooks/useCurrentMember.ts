import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLibrary } from '@/context/LibraryContext';
import { daysRemaining, getMemberSummary, isActive } from '@/domain/selectors';

/** Everything the signed-in member's pages need about their own account. */
export function useCurrentMember() {
  const { user } = useAuth();
  const { db } = useLibrary();
  const memberId = user?.memberId ?? '';

  return useMemo(() => {
    const member = db.members.find((m) => m.id === memberId);
    const summary = getMemberSummary(db, memberId);
    const loans = db.loans.filter((l) => l.memberId === memberId);
    const reservations = db.reservations
      .filter((r) => r.memberId === memberId)
      .sort((a, b) => b.reservedOn.localeCompare(a.reservedOn));
    return {
      member,
      memberId,
      summary,
      activeLoans: [...summary.activeLoans].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      history: loans.filter((l) => !isActive(l)),
      dueSoon: summary.activeLoans.filter((l) => daysRemaining(l) >= 0 && daysRemaining(l) <= 3),
      reservations,
      openReservations: reservations.filter((r) => r.status === 'waiting' || r.status === 'ready'),
      fines: db.fines.filter((f) => f.memberId === memberId),
      payments: db.payments.filter((p) => p.memberId === memberId),
      notifications: db.notifications.filter((n) => n.recipient === memberId),
    };
  }, [db, memberId]);
}
