import type { ReactNode } from 'react'
import { monthLabel, monthShort } from './lib'
import { cx, stagger } from './ui'

/** Courbe d'évolution du solde, pleine largeur. */
export function Sparkline({ values }: { values: number[] }) {
  const w = 300
  const h = 72
  const v = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  const min = Math.min(...v)
  const span = Math.max(...v) - min
  const pts = v.map((y, i) => [
    (i / (v.length - 1)) * w,
    span ? h - 8 - ((y - min) / span) * (h - 20) : h / 2,
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <div className="relative h-[72px] w-full" aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ember)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--ember)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#spark-fill)" />
        <path
          d={line}
          pathLength={1}
          className="spark-line"
          fill="none"
          stroke="var(--ember)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-2.5 -translate-x-[calc(100%+6px)] -translate-y-1/2 rounded-full bg-ember ring-4 ring-ember/25"
        style={{ left: `${(lx / w) * 100}%`, top: `${(ly / h) * 100}%` }}
      />
    </div>
  )
}

export interface MonthPoint {
  month: string
  income: number
  expense: number
}

/** Revenus et dépenses par mois ; un appui sélectionne le mois. */
export function MonthBars({
  data, selected, onSelect, describe,
}: { data: MonthPoint[]; selected: string; onSelect: (m: string) => void; describe: (p: MonthPoint) => string }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))
  const bar = (value: number, color: string, on: boolean, i: number) => (
    <div
      className={cx('bar-y w-full max-w-5 rounded-t-lg transition-[height,opacity] duration-500 ease-soft', !on && 'opacity-40')}
      style={{ height: value ? `max(3px, ${(value / max) * 100}%)` : 0, background: color, ...stagger(i) }}
    />
  )
  return (
    <div className="flex h-48 items-stretch gap-1.5 sm:gap-3">
      {data.map((d, i) => {
        const on = d.month === selected
        return (
          <button
            key={d.month}
            type="button"
            aria-pressed={on}
            aria-label={`${monthLabel(d.month)} : ${describe(d)}`}
            onClick={() => onSelect(d.month)}
            className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl"
          >
            <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-1 border-b border-line">
              {bar(d.income, '#3fbf98', on, i)}
              {bar(d.expense, 'var(--ember)', on, i)}
            </div>
            <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', on ? 'bg-ink text-white' : 'text-muted')}>
              {monthShort(d.month)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export interface Slice {
  label: string
  value: number
  color: string
}

export function Donut({ slices, children }: { slices: Slice[]; children?: ReactNode }) {
  const r = 40
  const C = 2 * Math.PI * r
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const gap = slices.length > 1 ? 2.5 : 0
  let acc = 0
  return (
    <div className="donut relative size-44 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Répartition des dépenses par catégorie">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        {slices.map((s) => {
          const len = (s.value / total) * C
          const el = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={`${Math.max(0.5, len - gap)} ${C}`}
              strokeDashoffset={-acc}
            />
          )
          acc += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
