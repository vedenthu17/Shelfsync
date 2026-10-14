import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

// Chart colours are separate from the UI status colours on purpose: a series
// colour identifies a series, it does not signal good or bad.
export const CHART = {
  blue: '#3a6ea5',
  orange: '#d4652f',
  aqua: '#3f8f5f',
  yellow: '#d9a21b',
  red: '#c2473b',
  violet: '#6d4c8f',
  grid: '#e9e2d3',
  axis: '#6f6759',
} as const;

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const axisTick = { fontSize: 11, fill: CHART.axis, fontFamily: MONO };

type Formatter = (value: number) => string;

function ChartTooltip({
  active,
  payload,
  label,
  format = formatNumber,
}: TooltipProps<number, string> & { format?: Formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
      {label !== undefined && label !== '' && <p className="mb-1 font-medium text-slate-900">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? (p.payload as { color?: string })?.color }} />
          {p.name}
          <span className="tabular ml-auto pl-3 font-medium text-slate-900">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 260,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: Series[];
  height?: number;
}) {
  return (
    <div>
      <Legend series={series} />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 22, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cfc6b3' }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#fffdf8', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ColumnChart({
  data,
  xKey,
  yKey,
  label,
  color = CHART.blue,
  height = 240,
  format,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  height?: number;
  format?: Formatter;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: format ? 0 : -18 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          {/* Month labels sit close together under the bars, so they use the narrower text face. */}
          <XAxis dataKey={xKey} tick={{ fontSize: 10.5, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={format} />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: 'rgb(143 134 118 / 0.12)' }} />
          <Bar dataKey={yKey} name={label} fill={color} radius={[2, 2, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranked categories; long labels stay readable. */
export function RankedBarChart({
  data,
  label,
  color = CHART.blue,
  format,
}: {
  data: Array<{ name: string; value: number }>;
  label: string;
  color?: string;
  format?: Formatter;
}) {
  return (
    <div style={{ height: Math.max(160, data.length * 34 + 16) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={{ fontSize: 12, fill: '#423c33' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
          />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: 'rgb(143 134 118 / 0.12)' }} />
          <Bar
            dataKey="value"
            name={label}
            fill={color}
            radius={[0, 2, 2, 0]}
            maxBarSize={18}
            isAnimationActive={false}
            label={{ position: 'right', fontSize: 11, fill: '#423c33', fontFamily: MONO, formatter: format }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="#fffdf8"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[30px] font-medium leading-none text-slate-900">{centerValue}</span>
          <span className="eyebrow mt-1.5">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="text-slate-600">{d.name}</span>
            <span className="tabular ml-auto font-medium text-slate-900">{formatNumber(d.value)}</span>
            <span className="tabular w-11 text-right text-xs text-slate-500">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
