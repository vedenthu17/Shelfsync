import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Member, Role, SessionUser } from '@/types';
import { addMember, type MemberInput } from '@/domain/actions';
import { ADMIN_ACCOUNT_ID, hasTemporaryPassword, verifyPassword } from '@/domain/auth';
import { can, type Permission } from '@/lib/permissions';
import { useLibrary } from './LibraryContext';

// Authentication without a server. Credentials are checked against the
// accounts in the library store (src/domain/auth.ts); a real deployment would
// exchange them for a JWT at POST /api/auth/login and keep the role claim from
// the token. Here the "token" is a small session record in browser storage.

const SESSION_KEY = 'shelfsync:session';
export const DEMO_ADMIN_EMAIL = 'admin@shelfsync.demo';
export const DEMO_MEMBER_EMAIL = 'member@shelfsync.demo';

interface Session {
  role: Role;
  memberId?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  /** True while the signed-in user is still on a password the desk issued. */
  mustChangePassword: boolean;
  /** Throws an Error with a user-facing message when the credentials don't match. */
  login: (identifier: string, password: string, remember?: boolean) => SessionUser;
  register: (input: MemberInput, password: string) => SessionUser;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null, remember = true): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable: the session simply lasts until the tab is closed.
  }
}

const ADMIN_USER: SessionUser = {
  id: ADMIN_ACCOUNT_ID,
  name: 'Priya Raman',
  email: DEMO_ADMIN_EMAIL,
  role: 'admin',
  title: 'Head Librarian',
};

function memberUser(member: Member): SessionUser {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: 'member',
    memberId: member.id,
    title: `${member.type} · ${member.id}`,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { db, apply } = useLibrary();
  const [session, setSession] = useState<Session | null>(readSession);

  // The member's display details come from the live record, so profile edits
  // show up everywhere immediately.
  const user = useMemo<SessionUser | null>(() => {
    if (!session) return null;
    if (session.role === 'admin') return ADMIN_USER;
    const member = db.members.find((m) => m.id === session.memberId);
    return member ? memberUser(member) : null;
  }, [session, db.members]);

  const start = useCallback((next: Session, remember = true) => {
    writeSession(next, remember);
    setSession(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mustChangePassword: !!user && hasTemporaryPassword(db, user.id),
      login: (identifier, password, remember = true) => {
        const id = identifier.trim().toLowerCase();
        if (!id || !password) throw new Error('Enter your email or member ID and password.');
        // One message for every failure, so the form does not reveal which accounts exist.
        const rejected = new Error('That email, member ID or password is not right.');
        if (id === DEMO_ADMIN_EMAIL) {
          if (!verifyPassword(db, ADMIN_ACCOUNT_ID, password)) throw rejected;
          start({ role: 'admin' }, remember);
          return ADMIN_USER;
        }
        const member = db.members.find((m) => m.email.toLowerCase() === id || m.id.toLowerCase() === id);
        if (!member || !verifyPassword(db, member.id, password)) throw rejected;
        start({ role: 'member', memberId: member.id }, remember);
        return memberUser(member);
      },
      register: (input, password) => {
        const { member } = apply((d) => addMember(d, input, password));
        start({ role: 'member', memberId: member.id });
        return memberUser(member);
      },
      logout: () => {
        writeSession(null);
        setSession(null);
      },
    }),
    [user, db, apply, start],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** UI-level permission check for the signed-in user. */
export function useCan(): (permission: Permission) => boolean {
  const { user } = useAuth();
  const role = user?.role;
  return useCallback((permission: Permission) => can(role, permission), [role]);
}
