import type { Account, Database } from '@/types';
import { randomString, sha256 } from '@/lib/hash';
import { today } from '@/lib/utils';
import { withNotification } from './journal';

// Sign-in rules. Passwords are kept only as a salted, stretched hash.
//
// This runs in the browser, so it decides who the app lets in but protects
// nothing from someone who can open the browser's storage. On a real
// deployment the same checks belong to the server (see docs/API.md).

export const ADMIN_ACCOUNT_ID = 'admin';
export const MIN_PASSWORD_LENGTH = 8;

const ROUNDS = 400;

export function hashPassword(password: string, salt: string): string {
  let digest = sha256(`${salt}:${password}`);
  for (let i = 1; i < ROUNDS; i++) digest = sha256(`${digest}:${salt}:${password}`);
  return digest;
}

export function makeAccount(id: string, password: string, options: { salt?: string; temporary?: boolean } = {}): Account {
  const salt = options.salt ?? randomString(16, 'abcdefghijklmnopqrstuvwxyz0123456789');
  return { id, salt, hash: hashPassword(password, salt), temporary: options.temporary || undefined, updatedOn: today() };
}

export function verifyPassword(db: Database, id: string, password: string): boolean {
  const account = db.accounts.find((a) => a.id === id);
  return !!account && hashPassword(password, account.salt) === account.hash;
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (/^\s|\s$/.test(password)) throw new Error('A password cannot start or end with a space.');
}

/** Create or replace the credentials for one user. */
export function setPassword(db: Database, id: string, password: string, temporary = false): Database {
  validatePassword(password);
  const account = makeAccount(id, password, { temporary });
  return { ...db, accounts: [...db.accounts.filter((a) => a.id !== id), account] };
}

export function changePassword(db: Database, id: string, current: string, next: string): Database {
  if (!verifyPassword(db, id, current)) throw new Error('Your current password is not right.');
  if (next === current) throw new Error('Choose a password different from your current one.');
  const updated = setPassword(db, id, next);
  return id === ADMIN_ACCOUNT_ID
    ? updated
    : withNotification(updated, id, 'Password changed', 'Your password was changed. If this was not you, contact the library desk.', 'info', '/member/profile');
}

/** Easy to read aloud across a desk: no 0/O, 1/l/I. */
export function generateTemporaryPassword(): string {
  const chars = randomString(8, 'abcdefghjkmnpqrstuvwxyz23456789');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** The desk resets a member's password; the member is asked to choose their own after signing in. */
export function issueTemporaryPassword(db: Database, memberId: string): { db: Database; password: string } {
  if (!db.members.some((m) => m.id === memberId)) throw new Error('Member not found.');
  const password = generateTemporaryPassword();
  const next = withNotification(
    setPassword(db, memberId, password, true),
    memberId,
    'Temporary password issued',
    'The library desk reset your password. Choose a new one from your profile.',
    'warning',
    '/member/profile',
  );
  return { db: next, password };
}

const digits = (s: string) => s.replace(/\D/g, '');

export interface IdentityResetInput {
  memberId: string;
  email: string;
  phone: string;
  password: string;
}

/**
 * Self-service reset. With no mail server to send a link through, the member
 * proves who they are with three things on their library record.
 */
export function resetPasswordWithIdentity(db: Database, input: IdentityResetInput): Database {
  const mismatch = new Error('Those details do not match our records. Check them, or ask the library desk to reset your password.');
  const member = db.members.find((m) => m.id.toLowerCase() === input.memberId.trim().toLowerCase());
  if (!member) throw mismatch;
  if (member.email.toLowerCase() !== input.email.trim().toLowerCase()) throw mismatch;
  // Compare the last ten digits so "+91 90000 10101" and "9000010101" both match.
  const onRecord = digits(member.phone).slice(-10);
  if (onRecord.length < 6 || digits(input.phone).slice(-10) !== onRecord) throw mismatch;

  return withNotification(
    setPassword(db, member.id, input.password),
    member.id,
    'Password reset',
    'Your password was reset from the sign-in page. If this was not you, contact the library desk.',
    'warning',
    '/member/profile',
  );
}

export const hasTemporaryPassword = (db: Database, id: string): boolean => !!db.accounts.find((a) => a.id === id)?.temporary;
