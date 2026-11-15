import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, PiggyBank, ShieldCheck, Wallet, X } from 'lucide-react'
import { useStore } from '../store'
import { currentMonth, daysInMonth, inMonth, sortTx, spentByCategory, sum, todayISO } from '../lib'
import { Button, Empty, IconChip, Money, MonthSwitcher, Progress, stagger, useToast } from '../ui'
import { Logo, PageHeader, SectionHead, TxRow } from '../parts'
import { Sparkline } from '../charts'

export function Home() {
  const { transactions, goals, budgets, categories, month, money, setTxForm, loadDemo, settings, updateSettings, exportBackup } = useStore()
  const toast = useToast()

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0)
  const balance = sum(transactions, 'income') - sum(transactions, 'expense') - totalSaved
  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month])
  const income = sum(monthTx, 'income')
  const expense = sum(monthTx, 'expense')
  const recent = useMemo(() => sortTx(monthTx).slice(0, 6), [monthTx])

  // Solde cumulé jour par jour sur le mois affiché
  const curve = useMemo(() => {
    const start = `${month}-01`
    let running = transactions.reduce((s, t) => (t.date < start ? s + (t.type === 'income' ? t.amount : -t.amount) : s), 0)
    const last = month === currentMonth() ? Number(todayISO().slice(8)) : daysInMonth(month)
    const byDay = new Map<number, number>()
    for (const t of monthTx) {
      const d = Number(t.date.slice(8))
      byDay.set(d, (byDay.get(d) ?? 0) + (t.type === 'income' ? t.amount : -t.amount))
    }
    const values = [running]
    for (let d = 1; d <= last; d++) values.push((running += byDay.get(d) ?? 0))
    return values
  }, [transactions, monthTx, month])

  const spent = useMemo(() => spentByCategory(monthTx), [monthTx])
  const topBudgets = budgets
    .map((b) => ({ b, cat: categories.find((c) => c.id === b.categoryId), used: spent.get(b.categoryId) ?? 0 }))
    .filter((x) => x.cat)
    .sort((a, z) => z.used / z.b.limit - a.used / a.b.limit)
    .slice(0, 3)

  // Rappel de sauvegarde : dès qu'il y a des données, tous les 30 jours, reportable d'une semaine.
  const [now] = useState(() => Date.now())
  const DAY = 86_400_000
  const backupAge = settings.lastBackupAt ? Math.floor((now - settings.lastBackupAt) / DAY) : null
  const remind =
    transactions.length >= 5 && now > (settings.backupSnoozeUntil ?? 0) && (backupAge === null || backupAge >= 30)

  const hour = new Date().getHours()
  const firstRun = transactions.length === 0 && goals.length === 0 && budgets.length === 0

  return (
    <>
      <PageHeader title={hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'} lead={<span className="md:hidden"><Logo /></span>}>
        <MonthSwitcher />
      </PageHeader>

      <section className="hero rise relative overflow-hidden rounded-[2rem]">
        <div className="px-6 pt-6 md:px-8 md:pt-8">
          <p className="text-[15px] font-medium text-ink/60">Solde disponible</p>
          <p className="display num mt-1 text-[clamp(2rem,10.5vw,3.75rem)] font-semibold leading-none">
            <Money value={balance} />
          </p>
          {totalSaved > 0 && (
            <a
              href="#/epargne"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/65 px-3 py-1 text-sm font-semibold text-ink/75 transition hover:bg-white"
            >
              <PiggyBank size={15} className="text-primary" />
              {money(totalSaved)} épargnés
            </a>
          )}
        </div>
        <div className="mt-4">
          <Sparkline key={month} values={curve} />
        </div>
        <dl className="grid grid-cols-2 bg-white/45 backdrop-blur-sm">
          <div className="min-w-0 px-4 py-4 min-[380px]:px-6 md:px-8">
            <dt className="flex items-center gap-1.5 text-sm text-ink/60">
              <span className="grid size-5 place-items-center rounded-full bg-pos/15 text-pos"><ArrowDownLeft size={13} strokeWidth={2.6} /></span>
              Revenus
            </dt>
            <dd className="num mt-0.5 truncate text-[clamp(0.9rem,4.5vw,1.125rem)] font-semibold"><Money value={income} /></dd>
          </div>
          <div className="min-w-0 border-l border-white/70 px-4 py-4 min-[380px]:px-6 md:px-8">
            <dt className="flex items-center gap-1.5 text-sm text-ink/60">
              <span className="grid size-5 place-items-center rounded-full bg-ember/15 text-ember"><ArrowUpRight size={13} strokeWidth={2.6} /></span>
              Dépenses
            </dt>
            <dd className="num mt-0.5 truncate text-[clamp(0.9rem,4.5vw,1.125rem)] font-semibold"><Money value={expense} /></dd>
          </div>
        </dl>
      </section>

      {remind && (
        <div className="card rise mt-4 flex items-center gap-3 py-3 pl-4 pr-2" style={stagger(1)}>
          <ShieldCheck size={22} className="hidden shrink-0 text-primary min-[380px]:block" />
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight">
            Sauvegardez vos données
            <span className="block truncate text-sm font-normal text-muted">
              {backupAge === null ? 'Aucune sauvegarde pour l’instant' : `Dernière il y a ${backupAge} jours`}
            </span>
          </p>
          <Button
            className="h-10 shrink-0 px-4"
            onClick={() => {
              exportBackup().then((ok) => ok && toast('Sauvegarde exportée'))
            }}
          >
            Exporter
          </Button>
          <button
            type="button"
            aria-label="Me le rappeler plus tard"
            onClick={() => updateSettings({ backupSnoozeUntil: Date.now() + 7 * DAY })}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {firstRun ? (
        <div className="card rise mt-6" style={stagger(2)}>
          <Empty icon={Wallet} title="Bienvenue sur BRAZ" text="Ajoutez une première transaction pour démarrer.">
            <Button onClick={() => setTxForm('new')}>Ajouter une transaction</Button>
            <Button variant="soft" onClick={() => loadDemo().then(() => toast('Exemples chargés'))}>
              Voir un exemple
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          <section className="rise lg:col-span-3" style={stagger(2)}>
            <SectionHead title="Dernières transactions" href="#/transactions" />
            <div className="card p-1.5">
              {recent.length ? (
                recent.map((t, i) => <TxRow key={t.id} tx={t} index={i} />)
              ) : (
                <p className="px-4 py-8 text-center text-[15px] text-muted">Aucune transaction ce mois-ci.</p>
              )}
            </div>
          </section>

          <div className="grid content-start gap-8 sm:max-lg:grid-cols-2 lg:col-span-2">
            <section className="rise" style={stagger(3)}>
              <SectionHead title="Budgets" href="#/budgets" linkLabel={budgets.length ? 'Tout voir' : 'Créer'} />
              <div className="card space-y-4 p-5">
                {topBudgets.length ? (
                  topBudgets.map(({ b, cat, used }) => {
                    const over = used > b.limit
                    return (
                      <div key={b.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="truncate font-semibold">{cat!.name}</span>
                          <span className={`num shrink-0 text-sm ${over ? 'font-semibold text-neg' : 'text-muted'}`}>
                            {Math.round((used / b.limit) * 100)} %
                          </span>
                        </div>
                        <Progress ratio={used / b.limit} color={over ? 'var(--neg)' : cat!.color} />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-[15px] text-muted">Aucun budget.</p>
                )}
              </div>
            </section>

            <section className="rise" style={stagger(4)}>
              <SectionHead title="Épargne" href="#/epargne" linkLabel={goals.length ? 'Tout voir' : 'Créer'} />
              <div className="card space-y-4 p-5">
                {goals.length ? (
                  goals.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center gap-3">
                      <IconChip icon={g.icon} color={g.color} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="truncate font-semibold">{g.name}</span>
                          <span className="num shrink-0 text-sm text-muted">{Math.min(100, Math.round((g.saved / g.target) * 100))} %</span>
                        </div>
                        <Progress ratio={g.saved / g.target} color={g.color} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[15px] text-muted">Aucun objectif.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
