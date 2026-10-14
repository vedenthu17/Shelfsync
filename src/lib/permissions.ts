import type { Role } from '@/types';

// Role-based access control. Routes are guarded by role (see RequireRole) and
// individual controls by permission (see useCan), so adding a role later is a
// one-line change here rather than a hunt through the pages.

export type Permission =
  | 'catalog:manage'
  | 'members:manage'
  | 'circulation:manage'
  | 'reservations:manage'
  | 'fines:manage'
  | 'damage:manage'
  | 'reports:view'
  | 'settings:manage'
  | 'reservations:self'
  | 'profile:self';

const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: [
    'catalog:manage',
    'members:manage',
    'circulation:manage',
    'reservations:manage',
    'fines:manage',
    'damage:manage',
    'reports:view',
    'settings:manage',
  ],
  member: ['reservations:self', 'profile:self'],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && rolePermissions[role].includes(permission);
}

export const homeFor = (role: Role): string => (role === 'admin' ? '/admin/dashboard' : '/member/dashboard');
