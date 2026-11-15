import { useMemo, useState } from 'react'
import { Plus, ReceiptText, Search, SearchX } from 'lucide-react'
import type { Transaction } from '../types'
import { useStore } from '../store'
import { dayLabel, inMonth, sortTx, sum } from '../lib'
import { iconFor } from '../icons'
import { Button, Empty, MonthSwitcher, Segmented, cx, stagger } from '../ui'
import { PageHeader, TxRow } from '../parts'

type Filter = 'all' | 'expense' | 'income'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Revenus' },
]

export function Transactions() {
  const { transactions, categories, month, money, setTxForm } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryId, setCategoryId] = useState('')
  const [query, setQuery] = useState('')

  const monthTx = useMemo(() => sortTx(inMonth(transactions, month)), [transactions, month])
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return monthTx.filter(
      (t) =>
        (filter === 'all' || t.type === filter) &&
        (!categoryId || t.categoryId === categoryId) &&
        (!q || t.note.toLowerCase().includes(q) || (catName.get(t.categoryId) ?? '').toLowerCase().includes(q)),
    )
  }, [monthTx, filter, categoryId, query, catName])

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map]
  }, [filtered])

  const hasFilters = filter !== 'all' || !!categoryId || !!query.trim()
  const reset = () => {
    setFilter('all')
    setCategoryId('')
    setQuery('')
  }
  // Seules les catégories réellement utilisées ce mois-ci sont proposées en filtre.
  const used = useMemo(() => new Set(monthTx.map((t) => t.categoryId)), [monthTx])
  const chips = categories.filter((c) => used.has(c.id) && (filter === 'all' || c.type === filter))
  const chip = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95'

  return (
    <>
      <PageHeader title="Transactions">
        <MonthSwitcher />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-[1fr_18rem]">
        <label className="relative block">
          <span className="sr-only">Rechercher une transaction</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field border-line! bg-surface! pl-11!"
            placeholder="Rechercher"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Segmented
          label="Filtrer par type"
          options={FILTERS}
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setCategoryId('')
          }}
        />
      </div>

      {chips.length > 1 && (
        <div
          role="group"
          aria-label="Filtrer par catégorie"
          className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {chips.map((c) => {
            const Icon = iconFor(c.icon)
            const on = categoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCategoryId(on ? '' : c.id)}
                className={cx(chip, on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted')}
              >
                <Icon size={15} style={{ color: on ? '#fff' : c.color }} />
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted">
          <span className="num">Revenus <b className="font-semibold text-pos">{money(sum(filtered, 'income'))}</b></span>
          <span className="num">Dépenses <b className="font-semibold text-ink">{money(sum(filtered, 'expense'))}</b></span>
        </p>
      )}

      {groups.length ? (
        <div className="mt-4 space-y-6">
          {groups.map(([date, items], g) => {
            const net = sum(items, 'income') - sum(items, 'expense')
            return (
              <section key={date} className="rise" style={stagger(g)}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold">{dayLabel(date)}</h2>
                  <span className="num text-sm text-muted">{money(net, true)}</span>
                </div>
                <div className="card p-1.5">
                  {items.map((t) => <TxRow key={t.id} tx={t} />)}
                </div>
              </section>
            )
          })}
        </div>
      ) : hasFilters && monthTx.length ? (
        <Empty icon={SearchX} title="Aucun résultat">
          <Button variant="soft" onClick={reset}>Effacer les filtres</Button>
        </Empty>
      ) : (
        <Empty icon={ReceiptText} title="Rien ce mois-ci">
          <Button onClick={() => setTxForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Ajouter une transaction
          </Button>
        </Empty>
      )}
    </>
  )
}
