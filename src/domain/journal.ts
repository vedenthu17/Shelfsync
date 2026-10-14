import type { Activity, ActivityKind, AppNotification, Database, NotificationTone } from '@/types';
import { nextId, today } from '@/lib/utils';

// The two side-records an action can leave behind: a line in the desk's
// activity feed, and a notification in somebody's inbox.

export function withActivity(db: Database, kind: ActivityKind, text: string): Database {
  const entry: Activity = { id: nextId('ACT', db.activity.map((a) => a.id)), kind, text, date: today() };
  return { ...db, activity: [entry, ...db.activity].slice(0, 80) };
}

export function withNotification(
  db: Database,
  recipient: string,
  title: string,
  message: string,
  tone: NotificationTone = 'info',
  link?: string,
  key?: string,
): Database {
  const entry: AppNotification = {
    id: nextId('NTF', db.notifications.map((n) => n.id)),
    recipient,
    title,
    message,
    tone,
    date: today(),
    read: false,
    link,
    key,
  };
  return { ...db, notifications: [entry, ...db.notifications] };
}
