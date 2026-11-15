import { useMemo } from 'react'
import { ChartNoAxesColumn, Plus } from 'lucide-react'
import { useStore } from '../store'
import {
  UNKNOWN_CATEGORY, currentMonth, daysInMonth, formatCompact, inMonth, shiftMonth, spentByCategory, sum, todayISO,
} from '../lib'
import { Button, Empty, MonthSwitcher, stagger } from '../ui'
import { PageHeader } from '../parts'
import { Donut, MonthBars, type MonthPoint, type Slice } from '../charts'

export function Stats() {
  const { transactions, categories, month, setMonth, money, setTxForm } = useStore()

  // Fenêtre de 6 mois se terminant au plus tard au mois en cours et contenant le mois affiché
  const series = useMemo<MonthPoint[]>(() => {
    const now = currentMonth()
    let end = shiftMonth(month, 2)
    if (end > now) end = now
    return Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(end, i - 5)
      const txs = inMonth(transactions, m)
      return { month: m, income: sum(txs, 'income'), expense: sum(txs, 'expense') }
    })
  }, [transactions, month])

  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month])
  const income = sum(monthTx, 'income')
  const expense = sum(monthTx, 'expense')
  const net = income - expense

  const slices = useMemo<Slice[]>(() => {
    const all = [...spentByCategory(monthTx)]
      .map(([id, value]) => {
        const cat = categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY
        return { label: cat.name, value, color: cat.color }
      })
      .sort((a, b) => b.value - a.value)
    if (all.length <= 6) return all
    const rest = all.slice(5).reduce((s, x) => s + x.value, 0)
    return [...all.slice(0, 5), { label: 'Autres', value: rest, color: '#B4B6CE' }]
  }, [monthTx, categories])

  const biggest = monthTx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0]
  const elapsed = month === currentMonth() ? Number(todayISO().slice(8)) : daysInMonth(month)

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Statistiques" />
        <Empty icon={ChartNoAxesColumn} title="Pas encore de statistiques">
          <Button onClick={() => setTxForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Ajouter une transaction
          </Button>
        </Empty>
      </>
    )
  }

  const figures = [
    { label: 'Solde du mois', value: money(net, true), tone: net < 0 ? 'text-neg' : 'text-pos' },
    { label: 'Taux d’épargne', value: income > 0 ? `${Math.round((net / income) * 100)} %` : '—', tone: '' },
    { label: 'Moyenne par jour', value: money(Math.round(expense / elapsed)), tone: '' },
    { label: 'Plus grosse dépense', value: biggest ? money(biggest.amount) : '—', tone: '' },
  ]

  return (
    <>
      <PageHeader title="Statistiques">
        <MonthSwitcher />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f, i) => (
          <div key={f.label} className="card rise min-w-0 p-4 sm:p-5" style={stagger(i)}>
            <p className="truncate text-sm text-muted">{f.label}</p>
            <p className={`display num mt-1 truncate text-[clamp(0.95rem,4.6vw,1.5rem)] font-semibold ${f.tone}`}>{f.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card rise p-5 sm:p-6" style={stagger(4)}>
          <h2 className="display mb-5 text-lg font-semibold">Revenus et dépenses</h2>
          <MonthBars
            key={series[0].month}
            data={series}
            selected={month}
            onSelect={setMonth}
            describe={(p) => `revenus ${money(p.income)}, dépenses ${money(p.expense)}`}
          />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className="size-2.5 rounded-full bg-pos" /> Revenus
              </dt>
              <dd className="num truncate font-semibold">{money(income)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className="size-2.5 rounded-full bg-ember" /> Dépenses
              </dt>
              <dd className="num truncate font-semibold">{money(expense)}</dd>
            </div>
          </dl>
        </section>

        <section className="card rise p-5 sm:p-6" style={stagger(5)}>
          <h2 className="display mb-5 text-lg font-semibold">Répartition des dépenses</h2>
          {slices.length ? (
            <div className="flex flex-col items-center gap-6 sm:max-lg:flex-row sm:max-lg:items-start">
              <Donut key={month} slices={slices}>
                <div>
                  <p className="text-xs text-muted">Total</p>
                  <p className="display num text-lg font-semibold leading-tight">{formatCompact(expense)}</p>
                </div>
              </Donut>
              <ul className="w-full min-w-0 flex-1 space-y-3">
                {slices.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5 text-[15px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="num shrink-0 text-muted">{Math.round((s.value / expense) * 100)} %</span>
                    <span className="num min-w-24 shrink-0 text-right font-semibold">{money(s.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-[15px] text-muted">Aucune dépense ce mois-ci.</p>
          )}
        </section>
      </div>
    </>
  )
}
