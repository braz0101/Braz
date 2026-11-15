import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, ReceiptText, Repeat, Search, SearchX } from 'lucide-react'
import type { Transaction, Transfer } from '../types'
import { useStore } from '../store'
import { dayLabel, inMonth, sum } from '../lib'
import { iconFor } from '../icons'
import { Button, Empty, MonthSwitcher, Segmented, cx, stagger } from '../ui'
import { PageHeader, TransferRow, TxRow } from '../parts'
import { RecurringSheet } from '../forms'

type Filter = 'all' | 'expense' | 'income'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Revenus' },
]
type Line = { kind: 'tx'; date: string; createdAt: number; tx: Transaction } | { kind: 'transfer'; date: string; createdAt: number; transfer: Transfer }
/** Au-delà, une recherche sur toute la période n'affiche que les lignes les plus récentes. */
const MAX_LINES = 300

export function Transactions() {
  const { transactions, transfers, categories, accounts, recurring, month, money, setTxForm, setTransferForm } = useStore()
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  // Une recherche porte sur toute la période ; sans recherche, on affiche le mois choisi.
  const everywhere = q.length > 0
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const scopeTx = useMemo(() => (everywhere ? transactions : inMonth(transactions, month)), [transactions, month, everywhere])
  const scopeTransfers = useMemo(
    () => (everywhere ? transfers : transfers.filter((t) => t.date.startsWith(month))),
    [transfers, month, everywhere],
  )

  const txs = useMemo(
    () =>
      scopeTx.filter(
        (t) =>
          (filter === 'all' || t.type === filter) &&
          (!categoryId || t.categoryId === categoryId) &&
          (!accountId || t.accountId === accountId) &&
          (!q || t.note.toLowerCase().includes(q) || (catName.get(t.categoryId) ?? '').toLowerCase().includes(q)),
      ),
    [scopeTx, filter, categoryId, accountId, q, catName],
  )
  // Les transferts ne sont ni des revenus ni des dépenses : visibles seulement sans filtre de type ou de catégorie.
  const moves = useMemo(
    () =>
      filter !== 'all' || categoryId
        ? []
        : scopeTransfers.filter(
            (t) =>
              (!accountId || t.fromId === accountId || t.toId === accountId) &&
              (!q || `${t.note} transfert ${accName.get(t.fromId) ?? ''} ${accName.get(t.toId) ?? ''}`.toLowerCase().includes(q)),
          ),
    [scopeTransfers, filter, categoryId, accountId, q, accName],
  )

  const lines = useMemo<Line[]>(() => {
    const all: Line[] = [
      ...txs.map((tx) => ({ kind: 'tx' as const, date: tx.date, createdAt: tx.createdAt, tx })),
      ...moves.map((transfer) => ({ kind: 'transfer' as const, date: transfer.date, createdAt: transfer.createdAt, transfer })),
    ]
    return all.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  }, [txs, moves])

  const groups = useMemo(() => {
    const map = new Map<string, Line[]>()
    for (const l of lines.slice(0, MAX_LINES)) map.set(l.date, [...(map.get(l.date) ?? []), l])
    return [...map]
  }, [lines])

  const hasFilters = filter !== 'all' || !!categoryId || !!accountId || everywhere
  const reset = () => {
    setFilter('all')
    setCategoryId('')
    setAccountId('')
    setQuery('')
  }
  // Seules les catégories réellement présentes sont proposées en filtre.
  const used = useMemo(() => new Set(scopeTx.map((t) => t.categoryId)), [scopeTx])
  const catChips = categories.filter((c) => used.has(c.id) && (filter === 'all' || c.type === filter))
  const chip = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95'
  const chipState = (on: boolean) => (on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted')
  const hasData = scopeTx.length > 0 || scopeTransfers.length > 0

  return (
    <>
      <PageHeader title="Transactions">
        <MonthSwitcher />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-[1fr_18rem]">
        <label className="relative block">
          <span className="sr-only">Rechercher dans toutes les transactions</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            enterKeyHint="search"
            className="field border-line! bg-surface! pl-11!"
            placeholder="Rechercher partout"
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

      {(accounts.length > 1 || catChips.length > 1) && (
        <div
          role="group"
          aria-label="Filtrer par compte ou par catégorie"
          className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {accounts.length > 1 &&
            accounts.map((a) => {
              const Icon = iconFor(a.icon)
              const on = accountId === a.id
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => setAccountId(on ? '' : a.id)} className={cx(chip, chipState(on))}>
                  <Icon size={15} style={{ color: on ? '#fff' : a.color }} />
                  {a.name}
                </button>
              )
            })}
          {accounts.length > 1 && catChips.length > 1 && <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />}
          {catChips.length > 1 &&
            catChips.map((c) => {
              const Icon = iconFor(c.icon)
              const on = categoryId === c.id
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => setCategoryId(on ? '' : c.id)} className={cx(chip, chipState(on))}>
                  <Icon size={15} style={{ color: on ? '#fff' : c.color }} />
                  {c.name}
                </button>
              )
            })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {recurring.length > 0 && (
          <button
            type="button"
            onClick={() => setRecurringOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary transition active:scale-95"
          >
            <Repeat size={15} /> {recurring.length} récurrente{recurring.length > 1 ? 's' : ''}
          </button>
        )}
        {accounts.length > 1 && (
          <button
            type="button"
            onClick={() => setTransferForm('new')}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary transition active:scale-95"
          >
            <ArrowLeftRight size={15} /> Transférer
          </button>
        )}
      </div>
      {recurringOpen && <RecurringSheet onClose={() => setRecurringOpen(false)} />}

      {lines.length > 0 && (
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted">
          {everywhere && <span className="font-semibold text-ink">{lines.length} résultat{lines.length > 1 ? 's' : ''}, toutes périodes</span>}
          <span className="num">Revenus <b className="font-semibold text-pos">{money(sum(txs, 'income'))}</b></span>
          <span className="num">Dépenses <b className="font-semibold text-ink">{money(sum(txs, 'expense'))}</b></span>
        </p>
      )}

      {groups.length ? (
        <div className="mt-4 space-y-6">
          {groups.map(([date, items], g) => {
            const dayTx = items.flatMap((l) => (l.kind === 'tx' ? [l.tx] : []))
            const net = sum(dayTx, 'income') - sum(dayTx, 'expense')
            return (
              <section key={date} className="rise" style={stagger(g)}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold">{dayLabel(date)}</h2>
                  {dayTx.length > 0 && <span className="num text-sm text-muted">{money(net, true)}</span>}
                </div>
                <div className="card p-1.5">
                  {items.map((l) => (l.kind === 'tx' ? <TxRow key={l.tx.id} tx={l.tx} /> : <TransferRow key={l.transfer.id} transfer={l.transfer} />))}
                </div>
              </section>
            )
          })}
          {lines.length > MAX_LINES && (
            <p className="text-center text-sm text-muted">Les {MAX_LINES} plus récentes sont affichées. Précisez la recherche pour voir les autres.</p>
          )}
        </div>
      ) : hasFilters && (hasData || everywhere) ? (
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
