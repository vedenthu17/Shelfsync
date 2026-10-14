// Domain model. Mirrors the relational schema in server/schema.sql so the mock
// store can later be swapped for REST calls without reshaping the UI.

export type Role = 'admin' | 'member';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Set when role === 'member'. */
  memberId?: string;
  title: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export type BookStatus = 'active' | 'archived';

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  year: number;
  category: string;
  subject: string;
  description: string;
  /** Section-Rack-Shelf, e.g. "B-07-3". */
  shelf: string;
  totalCopies: number;
  status: BookStatus;
  /** Optional uploaded cover (data URL). A generated cover is used otherwise. */
  cover?: string;
  addedOn: string;
}

export type MemberStatus = 'active' | 'suspended';
export type MemberType = 'Student' | 'Faculty' | 'Staff';

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  type: MemberType;
  status: MemberStatus;
  joined: string;
}

export interface Loan {
  id: string;
  bookId: string;
  memberId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  /** How many times the due date has been extended. */
  renewals?: number;
}

export type FineReason = 'overdue' | 'damage';

export interface Fine {
  id: string;
  loanId: string;
  memberId: string;
  bookId: string;
  reason: FineReason;
  overdueDays: number;
  /** Daily rate that applied when the fine was raised. */
  rate: number;
  amount: number;
  paid: number;
  createdOn: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';

export interface Payment {
  id: string;
  fineId: string;
  memberId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  date: string;
}

export type ReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

export interface Reservation {
  id: string;
  bookId: string;
  memberId: string;
  reservedOn: string;
  status: ReservationStatus;
  /** Date the copy was set aside for pickup. */
  readyOn?: string;
  closedOn?: string;
}

export type DamageType =
  | 'Torn pages'
  | 'Water damage'
  | 'Cover damage'
  | 'Missing pages'
  | 'Writing/marking'
  | 'Other';
export type DamageSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type DamageStatus = 'reported' | 'under_review' | 'under_repair' | 'resolved';

export interface DamageEvent {
  date: string;
  status: DamageStatus;
  note: string;
}

export interface DamageReport {
  id: string;
  bookId: string;
  memberId?: string;
  loanId?: string;
  date: string;
  type: DamageType;
  severity: DamageSeverity;
  description: string;
  repairCost: number;
  images: string[];
  notes: string;
  status: DamageStatus;
  /** True while the copy is pulled from circulation. */
  copyWithdrawn: boolean;
  timeline: DamageEvent[];
}

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  /** Member id, or 'admin' for the staff inbox. */
  recipient: string;
  title: string;
  message: string;
  tone: NotificationTone;
  date: string;
  read: boolean;
  link?: string;
  /** Set on automated reminders so the same one is never sent twice. */
  key?: string;
}

export type ActivityKind = 'issue' | 'return' | 'renewal' | 'reservation' | 'payment' | 'damage';

export interface Activity {
  id: string;
  kind: ActivityKind;
  text: string;
  date: string;
}

export interface Settings {
  libraryName: string;
  fineRatePerDay: number;
  graceDays: number;
  loanPeriodDays: number;
  maxLoansPerMember: number;
  holdDays: number;
  /** Times a loan may be renewed; 0 switches renewals off. */
  maxRenewals: number;
  /** A due-date reminder is sent this many days ahead. */
  reminderDays: number;
}

/** Sign-in credentials for one user. The password itself is never stored. */
export interface Account {
  /** 'admin', or the member's id. */
  id: string;
  salt: string;
  hash: string;
  /** Issued by the library desk; the user is asked to replace it. */
  temporary?: boolean;
  updatedOn: string;
}

export interface Database {
  accounts: Account[];
  books: Book[];
  categories: Category[];
  members: Member[];
  loans: Loan[];
  fines: Fine[];
  payments: Payment[];
  reservations: Reservation[];
  damage: DamageReport[];
  notifications: AppNotification[];
  activity: Activity[];
  settings: Settings;
}

export type Availability = 'available' | 'low_stock' | 'checked_out' | 'reserved' | 'damaged';

export interface BookInventory {
  total: number;
  available: number;
  issued: number;
  reserved: number;
  damaged: number;
  state: Availability;
}
