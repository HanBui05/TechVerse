import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatCount } from '../data/dashboardI18n'
import type { Language } from '../types/preferences'

export type ChartRow = { key: string; label: string; value: number | undefined }
type Row = { key: string; label: string; value: number }

const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']

/** Rows the response actually carries; a missing field drops its row, never shows as 0. */
const present = (rows: ChartRow[]): Row[] => rows.filter((row): row is Row => typeof row.value === 'number')

/** Whole-number shares that add up to 100 (largest remainder). Callers guarantee a positive total. */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  const raw = values.map(v => (v * 100) / total)
  const out = raw.map(Math.floor)
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0, left = 100 - out.reduce((s, v) => s + v, 0); k < left; k++) out[order[k][1]] += 1
  return out
}

export function ChartCard({ title, hint, loading, className, children }: { title: string; hint?: string; loading?: boolean; className?: string; children: ReactNode }) {
  return <Card className={`gap-4 rounded-xl p-5 ${className ?? ''}`}>
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {loading ? <Skeleton data-slot="chart-skeleton" className="h-32 w-full rounded-md" /> : children}
  </Card>
}

const NoData = ({ text }: { text: string }) => <p className="text-sm text-muted-foreground">{text}</p>

/** Horizontal bars, largest first, one hue; the value sits at the end of each bar. */
export function RankedBars({ title, rows, language, noData }: { title: string; rows: ChartRow[]; language: Language; noData: string }) {
  const mobile = useIsMobile()
  // Stable sort keeps the response order for ties.
  const data = present(rows).sort((a, b) => b.value - a.value)
  if (data.every(row => row.value === 0)) return <NoData text={noData} />
  const config = { value: { label: title, color: SERIES[0] } } satisfies ChartConfig
  // Room for the widest value label after the longest bar (~7px per digit at 12px, plus the 8px offset).
  const right = Math.max(...data.map(row => formatCount(row.value, language).length)) * 7 + 16
  const label = `${title}: ${data.map(row => `${row.label} ${formatCount(row.value, language)}`).join(', ')}`
  return <figure role="img" aria-label={label} className="m-0">
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 40 + 28 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCount(v, language)} />
        <YAxis type="category" dataKey="label" width={mobile ? 112 : 148} tickLine={false} axisLine={false} interval={0} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value, _name, item) =>
          <span className="flex w-full justify-between gap-3"><span className="text-muted-foreground">{(item.payload as Row).label}</span><span className="font-medium text-foreground tabular-nums">{formatCount(Number(value), language)}</span></span>} />} />
        {/* minPointSize: a zero bar still gets its value label (Recharts skips labels of empty bars). */}
        <Bar dataKey="value" fill="var(--color-value)" radius={4} barSize={18} minPointSize={1} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: unknown) => formatCount(Number(v), language)} />
        </Bar>
      </BarChart>
    </ChartContainer>
  </figure>
}

/** One whole split into ≤ 3 parts: a segmented bar with a legend that carries the numbers. */
export function SplitBar({ title, rows, language, noData }: { title: string; rows: ChartRow[]; language: Language; noData: string }) {
  const parts = present(rows)
  const total = parts.reduce((sum, row) => sum + row.value, 0)
  if (total === 0) return <div className="flex flex-col gap-2"><span className="text-xs font-medium text-foreground">{title}</span><NoData text={noData} /></div>
  const pct = shares(parts.map(row => row.value))
  const items = parts.map((row, i) => ({ ...row, color: SERIES[i], text: `${formatCount(row.value, language)} (${pct[i]}%)` }))
  return <div className="flex flex-col gap-2">
    <span className="text-xs font-medium text-foreground">{title}</span>
    <div role="img" aria-label={`${title}: ${items.map(item => `${item.label} ${item.text}`).join(', ')}`} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
      {items.filter(item => item.value > 0).map(item => <span key={item.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(item.value * 100) / total}%`, minWidth: 4, backgroundColor: item.color }} />)}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(item => <li key={item.key} className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-muted-foreground">{item.label}</span>
        <span className="font-medium text-foreground tabular-nums">{item.text}</span>
      </li>)}
    </ul>
  </div>
}

/** A part against its whole (e.g. last-30-day gross against all-time gross). */
export function Meter({ title, part, whole, format, language }: { title: string; part: number; whole: number; format: (n: number) => string; language: Language }) {
  const ratio = Math.min(part / whole, 1)
  const percent = ratio > 0 && ratio < 0.001
    ? `<${(0.001).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { style: 'percent', minimumFractionDigits: 1 })}`
    : ratio.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { style: 'percent', maximumFractionDigits: 1 })
  const detail = `${format(part)} / ${format(whole)} · ${percent}`
  return <div className="flex flex-col gap-2">
    <div role="img" aria-label={`${title}: ${percent} (${format(part)} / ${format(whole)})`} className="h-3 w-full overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, minWidth: ratio > 0 ? 4 : 0, backgroundColor: SERIES[0] }} />
    </div>
    <span className="text-xs font-medium text-foreground tabular-nums wrap-break-word">{detail}</span>
  </div>
}
