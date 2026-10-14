import {
  AlertOctagon,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookCopy,
  BookMarked,
  BookOpen,
  CalendarClock,
  IndianRupee,
  LayoutDashboard,
  ListOrdered,
  Search,
  Settings,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface NavGroup {
  /** Section heading; omitted for top-level items. */
  label?: string;
  items: NavItem[];
}

const adminNav: NavGroup[] = [
  { items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [
      { label: 'Books', to: '/admin/books', icon: BookCopy },
      { label: 'Categories', to: '/admin/categories', icon: Tags },
      { label: 'Search & Discovery', to: '/search', icon: Search },
    ],
  },
  {
    label: 'People',
    items: [{ label: 'Members', to: '/admin/members', icon: Users }],
  },
  {
    label: 'Circulation',
    items: [
      { label: 'Issue / Return', to: '/admin/circulation', icon: ArrowLeftRight },
      { label: 'Transactions', to: '/admin/transactions', icon: ListOrdered },
      { label: 'Reservations', to: '/admin/reservations', icon: CalendarClock },
    ],
  },
  {
    label: 'Finance & Care',
    items: [
      { label: 'Fines & Payments', to: '/admin/fines', icon: IndianRupee },
      { label: 'Damage Reports', to: '/admin/damage', icon: AlertOctagon },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports & Analytics', to: '/admin/reports', icon: BarChart3 },
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
];

const memberNav: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/member/dashboard', icon: LayoutDashboard },
      { label: 'Discover Books', to: '/search', icon: Search },
      { label: 'My Books', to: '/member/books', icon: BookOpen },
      { label: 'Reservations', to: '/member/reservations', icon: BookMarked },
      { label: 'Fines', to: '/member/fines', icon: IndianRupee },
      { label: 'Notifications', to: '/member/notifications', icon: Bell },
      { label: 'Profile', to: '/member/profile', icon: UserRound },
    ],
  },
];

// The app is laid out like a book: each chapter is an index tab on the edge of
// the page, and its sections run along the head of the page.

export interface Chapter {
  /** Roman numeral; staff chapters are numbered, a member's pages are not. */
  numeral?: string;
  label: string;
  /** Where the tab leads: the chapter's first section. */
  to: string;
  items: NavItem[];
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function chaptersFor(role: Role): Chapter[] {
  if (role === 'member') {
    return memberNav.flatMap((g) => g.items).map((item) => ({ label: item.label, to: item.to, items: [item] }));
  }
  return adminNav.map((g, i) => ({
    numeral: NUMERALS[i],
    label: g.label ?? 'Overview',
    to: g.items[0]!.to,
    items: g.items,
  }));
}

export function activeChapter(chapters: Chapter[], pathname: string): Chapter {
  return (
    chapters.find((c) => c.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))) ??
    // A book's own page (/books/:id) belongs with the catalogue.
    chapters.find((c) => c.items.some((item) => item.to === '/search')) ??
    chapters[0]!
  );
}

/** Bottom tab bar on phones (members only; staff use the contents page). */
export const memberTabs: NavItem[] = [
  { label: 'Home', to: '/member/dashboard', icon: LayoutDashboard },
  { label: 'Discover', to: '/search', icon: Search },
  { label: 'My Books', to: '/member/books', icon: BookOpen },
  { label: 'Fines', to: '/member/fines', icon: IndianRupee },
  { label: 'Profile', to: '/member/profile', icon: UserRound },
];
