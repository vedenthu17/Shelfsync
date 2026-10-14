import type {
  Activity,
  AppNotification,
  Book,
  Category,
  DamageReport,
  DamageSeverity,
  DamageStatus,
  DamageType,
  Database,
  Fine,
  Loan,
  Member,
  MemberType,
  Payment,
  PaymentMethod,
  Reservation,
  ReservationStatus,
  Settings,
} from '@/types';
import { ADMIN_ACCOUNT_ID, makeAccount } from '@/domain/auth';
import { addDays, daysAgo, today } from '@/lib/utils';

// Demo data. All members are fictional. Dates are generated relative to today
// so the demo always opens with a believable mix of due-soon and overdue loans.

const settings: Settings = {
  libraryName: 'Central Library',
  fineRatePerDay: 5,
  graceDays: 0,
  loanPeriodDays: 14,
  maxLoansPerMember: 5,
  holdDays: 3,
  maxRenewals: 2,
  reminderDays: 2,
};

/** Every sample account, staff and member alike, starts with this password. */
export const DEMO_PASSWORD = 'library123';

const categories: Category[] = [
  ['Computer Science', 'Programming, algorithms, systems and software engineering.'],
  ['Mathematics', 'Calculus, algebra, discrete mathematics and statistics.'],
  ['Physics', 'Classical and modern physics, popular science.'],
  ['Electronics', 'Circuits, digital design, signals and systems.'],
  ['Mechanical Engineering', 'Mechanics, thermodynamics and design.'],
  ['Literature', 'Fiction, classics and Indian writing in English.'],
  ['History', 'World and Indian history.'],
  ['Economics & Management', 'Economics, behavioural science and management.'],
].map(([name, description], i) => ({ id: `CAT-${String(i + 1).padStart(2, '0')}`, name: name!, description: description! }));

type BookRow = [title: string, author: string, publisher: string, year: number, category: string, subject: string, shelf: string, copies: number, description: string];

const bookRows: BookRow[] = [
  ['Introduction to Algorithms', 'Thomas H. Cormen', 'MIT Press', 2009, 'Computer Science', 'Algorithms', 'A-01-2', 6, 'A comprehensive reference on algorithm design and analysis, covering sorting, graph algorithms, dynamic programming and more.'],
  ['Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Computer Science', 'Software Engineering', 'A-01-4', 4, 'A handbook of agile software craftsmanship with practical guidance on writing readable, maintainable code.'],
  ['Design Patterns', 'Erich Gamma', 'Addison-Wesley', 1994, 'Computer Science', 'Software Engineering', 'A-02-1', 3, 'The classic catalogue of reusable object-oriented design solutions.'],
  ['Operating System Concepts', 'Abraham Silberschatz', 'Wiley', 2018, 'Computer Science', 'Operating Systems', 'A-02-3', 5, 'Processes, memory management, storage and protection, explained with modern operating system examples.'],
  ['Computer Networking: A Top-Down Approach', 'James F. Kurose', 'Pearson', 2021, 'Computer Science', 'Networks', 'A-03-1', 4, 'Networking taught from the application layer down to the physical layer.'],
  ['Database System Concepts', 'Abraham Silberschatz', 'McGraw-Hill', 2019, 'Computer Science', 'Databases', 'A-03-2', 5, 'Relational design, SQL, transactions, storage and query processing.'],
  ['Artificial Intelligence: A Modern Approach', 'Stuart Russell', 'Pearson', 2020, 'Computer Science', 'Artificial Intelligence', 'A-04-1', 2, 'The standard university text on intelligent agents, search, reasoning and learning.'],
  ['The Pragmatic Programmer', 'Andrew Hunt', 'Addison-Wesley', 2019, 'Computer Science', 'Software Engineering', 'A-04-2', 3, 'Practical advice on the craft of software development, from career habits to architecture.'],
  ['Software Engineering', 'Ian Sommerville', 'Pearson', 2015, 'Computer Science', 'Software Engineering', 'A-04-4', 4, 'Requirements, design, testing, evolution and project management for software systems.'],
  ['Compilers: Principles, Techniques, and Tools', 'Alfred V. Aho', 'Pearson', 2006, 'Computer Science', 'Compilers', 'A-05-1', 2, 'Lexical analysis, parsing, code generation and optimisation — the "Dragon Book".'],
  ['Calculus: Early Transcendentals', 'James Stewart', 'Cengage', 2015, 'Mathematics', 'Calculus', 'B-01-1', 6, 'Single and multivariable calculus with worked examples and applications.'],
  ['Introduction to Linear Algebra', 'Gilbert Strang', 'Wellesley-Cambridge Press', 2016, 'Mathematics', 'Linear Algebra', 'B-01-3', 1, 'Vectors, matrices, eigenvalues and their applications, taught with geometric intuition.'],
  ['Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'McGraw-Hill', 2018, 'Mathematics', 'Discrete Mathematics', 'B-02-2', 5, 'Logic, sets, combinatorics, graphs and number theory for computing students.'],
  ['Probability and Statistics for Engineers', 'Ronald E. Walpole', 'Pearson', 2016, 'Mathematics', 'Statistics', 'B-02-4', 3, 'Probability models, inference and regression with engineering examples.'],
  ['Concepts of Physics', 'H. C. Verma', 'Bharati Bhawan', 2017, 'Physics', 'General Physics', 'C-01-1', 6, 'A problem-driven introduction to mechanics, waves, optics and electromagnetism.'],
  ['University Physics', 'Hugh D. Young', 'Pearson', 2019, 'Physics', 'General Physics', 'C-01-3', 4, 'Calculus-based physics covering mechanics through modern physics.'],
  ['A Brief History of Time', 'Stephen Hawking', 'Bantam', 1988, 'Physics', 'Cosmology', 'C-02-2', 3, 'A popular account of cosmology, black holes and the nature of time.'],
  ['Microelectronic Circuits', 'Adel S. Sedra', 'Oxford University Press', 2014, 'Electronics', 'Analog Circuits', 'D-01-1', 4, 'Device physics, amplifiers and analog and digital integrated circuits.'],
  ['Digital Design', 'M. Morris Mano', 'Pearson', 2017, 'Electronics', 'Digital Logic', 'D-01-3', 3, 'Boolean algebra, combinational and sequential logic, and HDL-based design.'],
  ['Signals and Systems', 'Alan V. Oppenheim', 'Pearson', 1996, 'Electronics', 'Signal Processing', 'D-02-1', 2, 'Continuous and discrete-time signals, Fourier, Laplace and z-transforms.'],
  ['Engineering Mechanics: Statics', 'J. L. Meriam', 'Wiley', 2014, 'Mechanical Engineering', 'Mechanics', 'E-01-2', 3, 'Force systems, equilibrium, structures and friction.'],
  ['Thermodynamics: An Engineering Approach', 'Yunus A. Çengel', 'McGraw-Hill', 2018, 'Mechanical Engineering', 'Thermodynamics', 'E-01-4', 4, 'Energy, entropy and power cycles with real-world engineering examples.'],
  ['Pride and Prejudice', 'Jane Austen', 'Penguin Classics', 2002, 'Literature', 'Classic Fiction', 'F-01-1', 3, 'A novel of manners following Elizabeth Bennet and Mr Darcy.'],
  ['To Kill a Mockingbird', 'Harper Lee', 'HarperCollins', 2006, 'Literature', 'Classic Fiction', 'F-01-2', 3, 'A story of justice and conscience in the American South, seen through a child\'s eyes.'],
  ['Malgudi Days', 'R. K. Narayan', 'Indian Thought Publications', 1996, 'Literature', 'Short Stories', 'F-02-1', 2, 'Short stories set in the fictional South Indian town of Malgudi.'],
  ['The God of Small Things', 'Arundhati Roy', 'Penguin', 2002, 'Literature', 'Contemporary Fiction', 'F-02-3', 1, 'A family saga set in Kerala, told across two timelines.'],
  ['Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'Harper', 2014, 'History', 'World History', 'G-01-1', 4, 'A sweeping account of how Homo sapiens came to shape the planet.'],
  ['The Discovery of India', 'Jawaharlal Nehru', 'Penguin', 2004, 'History', 'Indian History', 'G-01-3', 2, 'A reflective history of India\'s culture, philosophy and past.'],
  ['Principles of Economics', 'N. Gregory Mankiw', 'Cengage', 2020, 'Economics & Management', 'Economics', 'H-01-1', 4, 'An accessible introduction to micro and macroeconomics.'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Farrar, Straus and Giroux', 2011, 'Economics & Management', 'Behavioural Science', 'H-01-3', 3, 'How two systems of thought shape judgement and decision-making.'],
  ['The Lean Startup', 'Eric Ries', 'Crown Business', 2011, 'Economics & Management', 'Entrepreneurship', 'H-02-1', 2, 'A method for building products through validated learning and rapid iteration.'],
  ['Essentials of Management', 'Harold Koontz', 'McGraw-Hill', 2012, 'Economics & Management', 'Management', 'H-02-2', 3, 'Planning, organising, staffing, leading and controlling — a managerial perspective.'],
];

const bookId = (n: number) => `BK-${String(n).padStart(3, '0')}`;
const memberId = (n: number) => `M-${1000 + n}`;

const books: Book[] = bookRows.map(([title, author, publisher, year, category, subject, shelf, copies, description], i) => ({
  id: bookId(i + 1),
  title,
  author,
  // Placeholder ISBNs for the demo catalogue.
  isbn: `978-0-${String(1000 + i * 37).slice(0, 4)}-${String(4021 + i * 113).padStart(4, '0')}-${(i * 7) % 10}`,
  publisher,
  year,
  category,
  subject,
  description,
  shelf,
  totalCopies: copies,
  status: i === 31 ? 'archived' : 'active',
  addedOn: daysAgo(i < 4 ? 3 + i * 4 : 60 + i * 21),
}));

type MemberRow = [name: string, department: string, type: MemberType, joinedDaysAgo: number];

const memberRows: MemberRow[] = [
  ['Aarav Mehta', 'Computer Engineering', 'Student', 410],
  ['Diya Kapoor', 'Information Technology', 'Student', 388],
  ['Kabir Nair', 'Computer Engineering', 'Student', 365],
  ['Ananya Iyer', 'Mathematics', 'Student', 340],
  ['Rohan Deshmukh', 'Electronics Engineering', 'Student', 322],
  ['Ishita Banerjee', 'Information Technology', 'Student', 301],
  ['Vivaan Reddy', 'Mechanical Engineering', 'Student', 276],
  ['Meera Pillai', 'Computer Engineering', 'Student', 240],
  ['Arjun Chauhan', 'Electronics Engineering', 'Student', 212],
  ['Sana Qureshi', 'Physics', 'Student', 190],
  ['Dev Malhotra', 'Electronics Engineering', 'Student', 171],
  ['Tara Fernandes', 'Humanities', 'Student', 150],
  ['Nikhil Joshi', 'Mathematics', 'Faculty', 720],
  ['Kavya Menon', 'Computer Engineering', 'Faculty', 655],
  ['Rehan Siddiqui', 'Mechanical Engineering', 'Student', 128],
  ['Pooja Kulkarni', 'Administration', 'Staff', 96],
];

const members: Member[] = memberRows.map(([name, department, type, joined], i) => ({
  id: memberId(i + 1),
  name,
  email: i === 0 ? 'member@shelfsync.demo' : `${name.toLowerCase().replace(/\s+/g, '.')}@college.demo`,
  phone: `+91 90000 ${String(10101 + i * 1373).slice(0, 5)}`,
  department,
  type,
  status: i === 14 ? 'suspended' : 'active',
  joined: daysAgo(joined),
}));

// Small deterministic PRNG so the generated history is identical on every load.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLedger(): { loans: Loan[]; fines: Fine[]; payments: Payment[] } {
  const rand = mulberry32(20261003);
  const pick = (n: number) => Math.floor(rand() * n);
  const methods: PaymentMethod[] = ['Cash', 'UPI', 'UPI', 'Card', 'Bank Transfer'];
  // Weighted so some categories are clearly more popular than others.
  const popular = [1, 1, 1, 2, 2, 4, 4, 6, 6, 7, 9, 9, 11, 11, 13, 15, 15, 17, 27, 27, 30, 5, 8, 23];

  const history: Array<{ book: number; member: number; issued: number; kept: number }> = [];
  for (let i = 0; i < 150; i++) {
    const issued = 21 + pick(160);
    const late = rand() < 0.2;
    const kept = late ? 15 + pick(9) : 3 + pick(12);
    const book = rand() < 0.6 ? popular[pick(popular.length)]! : 1 + pick(31);
    history.push({ book, member: 1 + pick(16), issued, kept: Math.min(kept, issued - 1) });
  }
  // Recent returns so the last-7-days chart has something to show.
  for (let i = 0; i < 22; i++) {
    const kept = 4 + pick(10);
    const issued = kept + pick(7);
    history.push({ book: popular[pick(popular.length)]!, member: 2 + pick(15), issued, kept });
  }
  // The demo member's own history, including one unpaid and one part-paid fine.
  history.push(
    { book: 6, member: 1, issued: 150, kept: 12 },
    { book: 2, member: 1, issued: 120, kept: 17 },
    { book: 13, member: 1, issued: 95, kept: 9 },
    { book: 17, member: 1, issued: 70, kept: 20 },
    { book: 4, member: 1, issued: 48, kept: 18 },
    { book: 30, member: 1, issued: 30, kept: 10 },
  );
  history.sort((a, b) => b.issued - a.issued);

  // Open loans: [book, member, issued N days ago].
  const open: Array<[number, number, number]> = [
    [1, 1, 19], [9, 1, 12], [27, 1, 4],
    [7, 2, 20], [7, 3, 8], [12, 4, 10], [20, 5, 6], [2, 6, 23], [4, 7, 3], [6, 8, 16],
    [11, 9, 1], [15, 10, 7], [18, 11, 30], [23, 12, 13], [29, 2, 5], [13, 13, 9],
    [10, 3, 18], [30, 14, 2], [5, 6, 11], [31, 8, 14],
  ];

  const loans: Loan[] = [];
  const fines: Fine[] = [];
  const payments: Payment[] = [];
  let n = 0;
  const txn = () => `TXN-${String(++n).padStart(4, '0')}`;

  for (const h of history) {
    const issueDate = daysAgo(h.issued);
    const loan: Loan = {
      id: txn(),
      bookId: bookId(h.book),
      memberId: memberId(h.member),
      issueDate,
      dueDate: addDays(issueDate, settings.loanPeriodDays),
      returnDate: addDays(issueDate, h.kept),
    };
    loans.push(loan);

    const late = h.kept - settings.loanPeriodDays;
    if (late <= 0) continue;
    const amount = late * settings.fineRatePerDay;
    const returnedAgo = h.issued - h.kept;
    // Older fines are mostly settled; recent ones are still open.
    const roll = rand();
    let paid = amount;
    if (h.member === 1) paid = h.issued === 48 ? 10 : h.issued === 70 ? 0 : amount;
    else if (returnedAgo < 30) paid = roll < 0.45 ? 0 : roll < 0.65 ? Math.round(amount / 10) * 5 : amount;
    else if (roll < 0.12) paid = 0;
    else if (roll < 0.2) paid = Math.round(amount / 10) * 5;

    const fine: Fine = {
      id: `FIN-${String(fines.length + 1).padStart(4, '0')}`,
      loanId: loan.id,
      memberId: loan.memberId,
      bookId: loan.bookId,
      reason: 'overdue',
      overdueDays: late,
      rate: settings.fineRatePerDay,
      amount,
      paid,
      createdOn: loan.returnDate!,
    };
    fines.push(fine);
    if (paid > 0) {
      const method = methods[pick(methods.length)]!;
      const paidAgo = Math.max(0, returnedAgo - pick(6));
      payments.push({
        id: `PAY-${String(payments.length + 1).padStart(4, '0')}`,
        fineId: fine.id,
        memberId: fine.memberId,
        amount: paid,
        method,
        reference: method === 'Cash' ? `RCPT-${4100 + payments.length}` : `${method.slice(0, 3).toUpperCase()}${700000 + pick(299999)}`,
        date: daysAgo(paidAgo),
      });
    }
  }

  for (const [book, member, issued] of open) {
    const issueDate = daysAgo(issued);
    loans.push({
      id: txn(),
      bookId: bookId(book),
      memberId: memberId(member),
      issueDate,
      dueDate: addDays(issueDate, settings.loanPeriodDays),
    });
  }

  return { loans: loans.reverse(), fines: fines.reverse(), payments: payments.reverse() };
}

type ReservationRow = [book: number, member: number, reservedAgo: number, status: ReservationStatus, extraAgo?: number];

const reservationRows: ReservationRow[] = [
  [7, 10, 9, 'waiting'],
  [7, 1, 6, 'waiting'],
  [7, 12, 2, 'waiting'],
  [12, 5, 4, 'waiting'],
  [20, 11, 7, 'ready', 1],
  [3, 1, 1, 'ready', 1],
  [1, 4, 40, 'fulfilled', 33],
  [17, 7, 52, 'fulfilled', 47],
  [27, 13, 28, 'fulfilled', 22],
  [2, 9, 35, 'cancelled', 31],
  [16, 15, 61, 'cancelled', 58],
  [22, 6, 24, 'expired', 17],
];

const reservations: Reservation[] = reservationRows.map(([book, member, reservedAgo, status, extraAgo], i) => ({
  id: `RSV-${String(i + 1).padStart(4, '0')}`,
  bookId: bookId(book),
  memberId: memberId(member),
  reservedOn: daysAgo(reservedAgo),
  status,
  readyOn: status === 'ready' ? daysAgo(extraAgo ?? 0) : undefined,
  closedOn: status !== 'ready' && extraAgo !== undefined ? daysAgo(extraAgo) : undefined,
}));

type DamageRow = [book: number, member: number | null, ago: number, type: DamageType, severity: DamageSeverity, status: DamageStatus, cost: number, description: string, notes: string];

const damageRows: DamageRow[] = [
  [26, 7, 12, 'Water damage', 'Critical', 'under_repair', 450, 'Pages 40–180 are warped and stuck together after liquid exposure. Only copy in the collection.', 'Sent to the bindery for drying and rebinding.'],
  [1, 9, 40, 'Torn pages', 'Medium', 'resolved', 120, 'Three pages torn near the spine in chapter 15.', 'Pages repaired with archival tape.'],
  [15, 10, 25, 'Cover damage', 'Low', 'resolved', 80, 'Front cover corner bent and laminate peeling.', 'Cover re-laminated in house.'],
  [4, 3, 9, 'Writing/marking', 'Low', 'reported', 0, 'Pencil annotations throughout chapters 3 and 4.', ''],
  [11, 12, 6, 'Missing pages', 'High', 'under_review', 300, 'Pages 211–226 (exercise set 4.3) are missing.', 'Checking whether replacement pages can be sourced.'],
  [23, null, 3, 'Cover damage', 'Medium', 'reported', 150, 'Spine cracked; found during shelf inspection.', ''],
  [18, 5, 60, 'Water damage', 'High', 'resolved', 380, 'Lower third of the book stained and rippled.', 'Dried, pressed and returned to circulation.'],
  [1, 2, 100, 'Writing/marking', 'Low', 'resolved', 0, 'Highlighter marks in chapters 22–24.', 'Noted; no repair needed.'],
  [29, 14, 15, 'Torn pages', 'High', 'under_repair', 200, 'Index section torn out and loosely reinserted.', 'Rebinding in progress.'],
];

const statusFlow: DamageStatus[] = ['reported', 'under_review', 'under_repair', 'resolved'];
const flowNotes: Record<DamageStatus, string> = {
  reported: 'Damage reported at the circulation desk.',
  under_review: 'Librarian assessing the extent of damage.',
  under_repair: 'Copy sent for repair.',
  resolved: 'Repair complete. Copy back in circulation.',
};

function buildDamage(loans: Loan[]): DamageReport[] {
  return damageRows.map(([book, member, ago, type, severity, status, cost, description, notes], i) => {
    const steps = statusFlow.slice(0, statusFlow.indexOf(status) + 1);
    const withdrawn = (severity === 'High' || severity === 'Critical') && status !== 'resolved';
    const loan = member
      ? loans.find((l) => l.bookId === bookId(book) && l.memberId === memberId(member) && l.returnDate)
      : undefined;
    return {
      id: `DMG-${String(i + 1).padStart(3, '0')}`,
      bookId: bookId(book),
      memberId: member ? memberId(member) : undefined,
      loanId: loan?.id,
      date: daysAgo(ago),
      type,
      severity,
      description,
      repairCost: cost,
      images: [],
      notes,
      status,
      copyWithdrawn: withdrawn,
      timeline: steps.map((s, idx) => ({
        date: daysAgo(Math.max(0, ago - Math.round((idx * ago) / Math.max(steps.length, 2)))),
        status: s,
        note: flowNotes[s],
      })),
    };
  });
}

const notifications: AppNotification[] = (
  [
    ['M-1001', 'Your reserved book is now available', '"Design Patterns" is being held for you at the circulation desk.', 'success', 1, '/member/reservations'],
    ['M-1001', 'You have an outstanding fine', 'Unpaid fines are pending on your account. Please settle them at the desk.', 'warning', 3, '/member/fines'],
    ['M-1001', 'Book return processed successfully', '"Thinking, Fast and Slow" was returned on time. Thank you!', 'success', 20, '/member/books'],
    ['admin', 'Overdue loans need attention', '6 loans are past their due date.', 'warning', 0, '/admin/fines'],
    ['admin', 'New damage report', 'Cover damage reported on "Pride and Prejudice".', 'danger', 3, '/admin/damage'],
    ['admin', 'Reservation ready for pickup', '"Signals and Systems" is on hold for Dev Malhotra.', 'info', 1, '/admin/reservations'],
  ] as const
).map(([recipient, title, message, tone, ago, link], i) => ({
  id: `NTF-${String(i + 1).padStart(4, '0')}`,
  recipient,
  title,
  message,
  tone,
  date: daysAgo(ago),
  read: ago > 2,
  link,
}));

function buildActivity(db: Pick<Database, 'loans' | 'payments' | 'damage' | 'reservations'>): Activity[] {
  const title = (id: string) => books.find((b) => b.id === id)?.title ?? 'a book';
  const name = (id?: string) => members.find((m) => m.id === id)?.name ?? 'A member';
  const items: Array<Omit<Activity, 'id'>> = [];
  const recent = daysAgo(10);

  for (const l of db.loans) {
    if (l.issueDate >= recent) items.push({ kind: 'issue', date: l.issueDate, text: `"${title(l.bookId)}" issued to ${name(l.memberId)}` });
    if (l.returnDate && l.returnDate >= recent) items.push({ kind: 'return', date: l.returnDate, text: `${name(l.memberId)} returned "${title(l.bookId)}"` });
  }
  for (const p of db.payments) {
    if (p.date >= recent) items.push({ kind: 'payment', date: p.date, text: `${name(p.memberId)} paid ₹${p.amount} (${p.method})` });
  }
  for (const d of db.damage) {
    if (d.date >= recent) items.push({ kind: 'damage', date: d.date, text: `${d.severity} damage reported on "${title(d.bookId)}"` });
  }
  for (const r of db.reservations) {
    if (r.reservedOn >= recent) items.push({ kind: 'reservation', date: r.reservedOn, text: `${name(r.memberId)} reserved "${title(r.bookId)}"` });
  }
  return items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40)
    .map((a, i) => ({ ...a, id: `ACT-${String(1000 - i).padStart(4, '0')}` }));
}

export function createSeedDatabase(): Database {
  const ledger = buildLedger();
  const damage = buildDamage(ledger.loans);
  return {
    // Fixed salts keep the seed identical from one load to the next.
    accounts: [ADMIN_ACCOUNT_ID, ...members.map((m) => m.id)].map((id) => makeAccount(id, DEMO_PASSWORD, { salt: `seed-${id}` })),
    books,
    categories,
    members,
    ...ledger,
    reservations,
    damage,
    notifications,
    activity: buildActivity({ ...ledger, damage, reservations }),
    settings,
  };
}

/** Bump when the seed's shape changes so stale browser copies are discarded. */
export const SEED_VERSION = `v2:${today().slice(0, 7)}`;
