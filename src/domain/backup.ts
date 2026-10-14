import type { Database, Settings } from '@/types';
import { today } from '@/lib/utils';
import { ADMIN_ACCOUNT_ID } from './auth';

// Everything the library holds lives in one browser, so a backup file is the
// only way to move it to another machine or recover from cleared storage.

export interface Backup {
  app: 'shelfsync';
  format: 1;
  exportedOn: string;
  db: Database;
}

export function createBackup(db: Database): Backup {
  return { app: 'shelfsync', format: 1, exportedOn: today(), db };
}

const tables = [
  'accounts',
  'books',
  'categories',
  'members',
  'loans',
  'fines',
  'payments',
  'reservations',
  'damage',
  'notifications',
  'activity',
] as const satisfies ReadonlyArray<keyof Database>;

const settingKeys = [
  'fineRatePerDay',
  'graceDays',
  'loanPeriodDays',
  'maxLoansPerMember',
  'holdDays',
  'maxRenewals',
  'reminderDays',
] as const satisfies ReadonlyArray<keyof Settings>;

/** Parse a backup file, throwing a message fit to show the user if it is not one. */
export function readBackup(text: string): Database {
  const invalid = new Error('This file is not a ShelfSync backup.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid;
  }
  const backup = parsed as Partial<Backup> | null;
  if (!backup || backup.app !== 'shelfsync' || typeof backup.db !== 'object' || backup.db === null) throw invalid;

  const db = backup.db as Database;
  if (!tables.every((table) => Array.isArray(db[table]))) throw invalid;
  const settings = db.settings as Settings | undefined;
  if (!settings || typeof settings.libraryName !== 'string') throw invalid;
  if (!settingKeys.every((key) => Number.isFinite(settings[key]))) throw invalid;
  // Without the staff account nobody could sign in to undo the restore.
  if (!db.accounts.some((a) => a.id === ADMIN_ACCOUNT_ID)) throw new Error('This backup has no administrator account and cannot be restored.');
  return db;
}
