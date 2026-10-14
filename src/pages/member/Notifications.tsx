import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import type { AppNotification } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { markAllNotificationsRead, markNotificationRead } from '@/domain/actions';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader, Tabs } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { NotificationItem } from '@/components/shared/Entities';

type Tab = 'all' | 'unread';

export default function Notifications() {
  const { update } = useLibrary();
  const navigate = useNavigate();
  const { notifications, memberId } = useCurrentMember();
  const [tab, setTab] = useState<Tab>('all');
  const unread = notifications.filter((n) => !n.read);
  const items = tab === 'unread' ? unread : notifications;

  const open = (n: AppNotification) => {
    update((d) => markNotificationRead(d, n.id));
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts about your loans, reservations and fines. Notifications are shown in the app only."
        actions={
          <Button variant="secondary" icon={CheckCheck} disabled={unread.length === 0} onClick={() => update((d) => markAllNotificationsRead(d, memberId))}>
            Mark all as read
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <Tabs<Tab>
          className="px-3 pt-1"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unread.length },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState icon={Bell} title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="You're all caught up." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
