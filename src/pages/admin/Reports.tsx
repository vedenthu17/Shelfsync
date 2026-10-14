import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Printer,
  RefreshCw,
  Tags,
  TrendingUp,
} from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { useToast } from '@/context/ToastContext';
import {
  buildReport,
  reportDefinitions,
  summarise,
  type ReportFilters,
  type ReportType,
} from '@/domain/reports';
import { exportCsv, exportPdf, type ExportTable } from '@/lib/export';
import { cn, daysAgo, formatCurrency, formatDate, formatNumber, today } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader, StatCard } from '@/components/ui/Card';
import { CHART, ColumnChart, RankedBarChart, TrendChart } from '@/components/ui/Charts';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DatePicker, Select } from '@/components/ui/Form';
import { EmptyState, Skeleton } from '@/components/ui/States';

type Row = { id: string; cells: Array<string | number> };

const defaultFilters = (): ReportFilters => ({ from: daysAgo(180), to: today(), category: '', memberId: '', bookId: '', status: '' });

export default function Reports() {
  const { db } = useLibrary();
  const toast = useToast();
  const [type, setType] = useState<ReportType>('transactions');
  const [draft, setDraft] = useState<ReportFilters>(defaultFilters);
  const [applied, setApplied] = useState<ReportFilters>(defaultFilters);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const definition = reportDefinitions.find((d) => d.type === type)!;
  const report = useMemo(() => buildReport(db, type, applied), [db, type, applied]);
  const summary = useMemo(() => summarise(db, applied.from, applied.to), [db, applied.from, applied.to]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  const set = (key: keyof ReportFilters, value: string) => setDraft((f) => ({ ...f, [key]: value }));

  const generate = (filters: ReportFilters = draft) => {
    if (filters.from > filters.to) {
      toast.error('The start date must be before the end date.');
      return;
    }
    setGenerating(true);
    setApplied(filters);
    window.setTimeout(() => setGenerating(false), 450);
  };

  const changeType = (next: ReportType) => {
    // Status options differ per report, so a stale status would silently empty the table.
    const filters = { ...draft, status: '' };
    setType(next);
    setDraft(filters);
    generate(filters);
  };

  const period = `${formatDate(applied.from)} – ${formatDate(applied.to)}`;
  const table: ExportTable = {
    title: definition.label,
    subtitle: `${definition.usesDates ? period : `As of ${formatDate(today())}`} · ${report.summary}`,
    headers: report.headers,
    rows: report.rows,
  };

  const toCsv = () => {
    exportCsv(table);
    toast.success('CSV downloaded.');
  };

  const toPdf = async () => {
    setExporting(true);
    try {
      await exportPdf(table);
      toast.success('PDF downloaded.');
    } catch {
      toast.error('Could not create the PDF. Try Print and choose "Save as PDF".');
    } finally {
      setExporting(false);
    }
  };

  // Printing renders every row (no pagination) first, then opens the dialog.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.removeEventListener('afterprint', done);
      window.clearTimeout(timer);
    };
  }, [printing]);

  const rows: Row[] = report.rows.map((cells, i) => ({ id: String(i), cells }));
  const columns: Column<Row>[] = report.headers.map((header, i) => ({
    key: String(i),
    header,
    primary: i === (report.headers.length > 1 && /^(Transaction|Fine|Report|Reservation|Member ID)$/.test(report.headers[0]!) ? 1 : 0),
    align: report.numeric.includes(i) ? 'right' : 'left',
    cell: (r) => {
      const value = r.cells[i]!;
      // Long titles truncate (full text on hover) so the table fits the page.
      return (
        <span className={cn('block max-w-[11rem] truncate', i === 0 && 'font-medium text-slate-900')} title={String(value)}>
          {value}
        </span>
      );
    },
    sortValue: (r) => {
      const v = r.cells[i]!;
      if (typeof v === 'number') return v;
      const money = /^₹[\d,]+$/.test(v) ? Number(v.replace(/[₹,]/g, '')) : NaN;
      return Number.isNaN(money) ? v : money;
    },
  }));

  const chart = report.chart;
  const chartEmpty = chart.kind === 'trend' ? chart.data.every((d) => !d.issued && !d.returned) : chart.data.every((d) => !d.value);

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Generate, review and export library reports"
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={toCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button variant="secondary" icon={FileText} onClick={toPdf} loading={exporting} disabled={!rows.length}>
              Export PDF
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => setPrinting(true)}>
              Print
            </Button>
          </>
        }
      />

      <div className="stat-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total transactions" value={formatNumber(summary.totalTransactions)} hint="In the period" icon={ArrowLeftRight} />
        <StatCard label="Avg. books issued / day" value={summary.averagePerDay.toFixed(1)} hint="In the period" icon={TrendingUp} tone="slate" />
        <StatCard label="Most borrowed category" value={summary.topCategory} icon={Tags} tone="slate" />
        <StatCard label="Most borrowed book" value={summary.topBook} icon={BookOpen} tone="slate" />
        <StatCard label="Total fines collected" value={formatCurrency(summary.finesCollected)} hint="In the period" icon={IndianRupee} tone="green" />
        <StatCard label="Total overdue books" value={formatNumber(summary.overdueBooks)} hint="Right now" icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <Card className="no-print h-fit p-2">
          <p className="eyebrow px-3 pb-1.5 pt-2">Report type</p>
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {reportDefinitions.map((d) => (
              <li key={d.type} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={type === d.type}
                  onClick={() => changeType(d.type)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left transition-colors',
                    type === d.type ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className="block whitespace-nowrap text-sm font-medium">{d.label}</span>
                  <span className="hidden text-xs text-slate-500 lg:block">{d.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="no-print p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <DatePicker label="From" value={draft.from} max={draft.to} disabled={!definition.usesDates} onChange={(e) => set('from', e.target.value)} />
              <DatePicker label="To" value={draft.to} min={draft.from} max={today()} disabled={!definition.usesDates} onChange={(e) => set('to', e.target.value)} />
              <Select label="Category" value={draft.category} onChange={(e) => set('category', e.target.value)} placeholder="All categories" options={db.categories.map((c) => c.name)} />
              <Select
                label="Member"
                value={draft.memberId}
                onChange={(e) => set('memberId', e.target.value)}
                placeholder="All members"
                disabled={type === 'inventory'}
                options={db.members.map((m) => ({ value: m.id, label: `${m.name} (${m.id})` }))}
              />
              <Select
                label="Book"
                value={draft.bookId}
                onChange={(e) => set('bookId', e.target.value)}
                placeholder="All books"
                options={[...db.books].sort((a, b) => a.title.localeCompare(b.title)).map((b) => ({ value: b.id, label: b.title }))}
              />
              <Select
                label="Status"
                value={draft.status}
                onChange={(e) => set('status', e.target.value)}
                placeholder="Any status"
                disabled={definition.statusOptions.length === 0}
                options={definition.statusOptions}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {!definition.usesDates
                  ? 'This report shows the current position, so the date range does not apply.'
                  : dirty
                    ? 'Filters changed — generate the report to apply them.'
                    : `Showing ${period}.`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const fresh = defaultFilters();
                    setDraft(fresh);
                    generate(fresh);
                  }}
                >
                  Reset
                </Button>
                <Button icon={RefreshCw} onClick={() => generate()} loading={generating}>
                  Generate Report
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={chart.title} description={definition.usesDates ? period : `As of ${formatDate(today())}`} className="border-b-0 pb-0" />
            <div className="px-5 pb-5 pt-4">
              {generating ? (
                <Skeleton className="h-56 w-full" />
              ) : chartEmpty ? (
                <EmptyState title="Nothing to chart" description="No records match these filters." className="py-8" />
              ) : chart.kind === 'trend' ? (
                <TrendChart
                  data={chart.data}
                  xKey="label"
                  height={220}
                  series={[
                    { key: 'issued', label: 'Issued', color: CHART.blue },
                    { key: 'returned', label: 'Returned', color: CHART.orange },
                  ]}
                />
              ) : chart.kind === 'ranked' ? (
                <RankedBarChart data={chart.data} label={chart.label} format={chart.currency ? formatCurrency : undefined} />
              ) : (
                <ColumnChart data={chart.data} xKey="name" yKey="value" label={chart.label} height={220} format={chart.currency ? formatCurrency : undefined} />
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={definition.label} description={report.summary} />
            <DataTable
              caption={definition.label}
              loading={generating}
              rows={rows}
              columns={columns}
              rowKey={(r) => r.id}
              pageSize={printing ? Math.max(rows.length, 1) : 10}
              empty={<EmptyState title="No records for these filters" description="Widen the date range or clear a filter, then generate again." />}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
