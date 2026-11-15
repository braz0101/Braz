import { useMemo, useState } from 'react'
import { Plus, Target } from 'lucide-react'
import type { Budget } from '../types'
import { useStore } from '../store'
import { currentMonth, daysInMonth, inMonth, spentByCategory, todayISO } from '../lib'
import { Button, Empty, IconChip, Money, MonthSwitcher, Progress, stagger } from '../ui'
import { PageHeader } from '../parts'
import { BudgetSheet } from '../forms'

export function Budgets() {
  const { transactions, budgets, categories, month, money } = useStore()
  const [form, setForm] = useState<Budget | 'new' | null>(null)

  const spent = useMemo(() => spentByCategory(inMonth(transactions, month)), [transactions, month])
  const rows = budgets
    .map((b) => ({ b, cat: categories.find((c) => c.id === b.categoryId), used: spent.get(b.categoryId) ?? 0 }))
    .filter((r) => r.cat)
    .sort((a, z) => z.used / z.b.limit - a.used / a.b.limit)

  const totalLimit = rows.reduce((s, r) => s + r.b.limit, 0)
  const totalUsed = rows.reduce((s, r) => s + r.used, 0)
  const left = totalLimit - totalUsed
  const daysLeft = month === currentMonth() ? daysInMonth(month) - Number(todayISO().slice(8)) + 1 : 0

  return (
    <>
      <PageHeader title="Budgets">
        <MonthSwitcher />
      </PageHeader>

      {rows.length === 0 ? (
        <Empty icon={Target} title="Aucun budget" text="Fixez une limite mensuelle par catégorie.">
          <Button onClick={() => setForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Créer un budget
          </Button>
        </Empty>
      ) : (
        <>
          <section className="card rise p-6">
            <p className="text-[15px] text-muted">{left >= 0 ? 'Reste à dépenser' : 'Dépassement'}</p>
            <p className={`display num mt-1 text-[clamp(1.9rem,9vw,2.5rem)] font-semibold leading-none ${left < 0 ? 'text-neg' : ''}`}>
              <Money value={Math.abs(left)} />
            </p>
            <Progress className="mt-5 h-3" ratio={totalUsed / totalLimit} color={left < 0 ? 'var(--neg)' : 'var(--primary)'} />
            <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted">
              <span className="num">{money(totalUsed)} sur {money(totalLimit)}</span>
              {daysLeft > 0 && left > 0 && <span className="num">{money(Math.floor(left / daysLeft))} par jour</span>}
            </div>
          </section>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {rows.map(({ b, cat, used }, i) => {
              const ratio = used / b.limit
              const over = used > b.limit
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setForm(b)}
                  style={stagger(i + 1)}
                  className="card rise p-5 text-left transition hover:border-primary/40 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <IconChip icon={cat!.icon} color={cat!.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{cat!.name}</p>
                      <p className={`num truncate text-sm ${over ? 'font-semibold text-neg' : 'text-muted'}`}>
                        {over ? `Dépassé de ${money(used - b.limit)}` : `Reste ${money(b.limit - used)}`}
                      </p>
                    </div>
                    <span className={`num display text-xl font-semibold ${over ? 'text-neg' : ''}`}>{Math.round(ratio * 100)} %</span>
                  </div>
                  <Progress className="mt-4" ratio={ratio} color={over ? 'var(--neg)' : cat!.color} />
                </button>
              )
            })}
          </div>

          <Button variant="soft" className="mt-5 w-full sm:w-auto" onClick={() => setForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Nouveau budget
          </Button>
        </>
      )}

      {form && <BudgetSheet budget={form === 'new' ? null : form} onClose={() => setForm(null)} />}
    </>
  )
}
