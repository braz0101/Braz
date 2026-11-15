import { useState } from 'react'
import { CircleCheck, History, Pencil, PiggyBank, Plus } from 'lucide-react'
import type { Goal } from '../types'
import { useStore } from '../store'
import { dateLabel } from '../lib'
import { Button, Empty, IconChip, Money, Progress, stagger } from '../ui'
import { PageHeader } from '../parts'
import { GoalSheet } from '../forms'
import { GoalHistorySheet, GoalMoveSheet } from '../sheets'

export function Savings() {
  const { goals, moves, money } = useStore()
  const [form, setForm] = useState<Goal | 'new' | null>(null)
  const [move, setMove] = useState<{ goal: Goal; mode: 'deposit' | 'withdraw' } | null>(null)
  const [history, setHistory] = useState<Goal | null>(null)

  const sorted = [...goals].sort((a, b) => a.createdAt - b.createdAt)
  const saved = goals.reduce((s, g) => s + g.saved, 0)
  const target = goals.reduce((s, g) => s + g.target, 0)
  const icon = 'grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-90'

  return (
    <>
      <PageHeader title="Épargne" />

      {goals.length === 0 ? (
        <Empty icon={PiggyBank} title="Aucun objectif" text="Créez un objectif et suivez votre progression.">
          <Button onClick={() => setForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Créer un objectif
          </Button>
        </Empty>
      ) : (
        <>
          <section className="card rise p-6">
            <p className="text-[15px] text-muted">Total épargné</p>
            <p className="display num mt-1 text-[clamp(1.9rem,9vw,2.5rem)] font-semibold leading-none">
              <Money value={saved} />
            </p>
            <Progress className="mt-5 h-3" ratio={saved / target} color="var(--pos)" />
            <p className="num mt-3 text-sm text-muted">{Math.round((saved / target) * 100)} % de {money(target)}</p>
          </section>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sorted.map((g, i) => {
              const done = g.saved >= g.target
              const count = moves.filter((m) => m.goalId === g.id).length
              return (
                <article key={g.id} className="card rise p-5" style={stagger(i + 1)}>
                  <div className="flex items-center gap-3">
                    <IconChip icon={g.icon} color={g.color} />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{g.name}</h2>
                      <p className="truncate text-sm text-muted">
                        {done ? (
                          <span className="inline-flex items-center gap-1 font-medium text-pos">
                            <CircleCheck size={15} /> Objectif atteint
                          </span>
                        ) : g.deadline ? (
                          `Pour le ${dateLabel(g.deadline)}`
                        ) : (
                          `Reste ${money(g.target - g.saved)}`
                        )}
                      </p>
                    </div>
                    {count > 0 && (
                      <button type="button" aria-label={`Historique de ${g.name}`} onClick={() => setHistory(g)} className={icon}>
                        <History size={18} />
                      </button>
                    )}
                    <button type="button" aria-label={`Modifier l’objectif ${g.name}`} onClick={() => setForm(g)} className={`${icon} -ml-2`}>
                      <Pencil size={17} />
                    </button>
                  </div>

                  <div className="mt-5 flex items-baseline justify-between gap-3">
                    <span className="display num truncate text-2xl font-semibold"><Money value={g.saved} /></span>
                    <span className="num shrink-0 text-sm text-muted">sur {money(g.target)}</span>
                  </div>
                  <Progress className="mt-2.5" ratio={g.saved / g.target} color={g.color} />

                  <div className="mt-4 flex gap-2">
                    <Button className="h-11 flex-1" onClick={() => setMove({ goal: g, mode: 'deposit' })}>Verser</Button>
                    <Button
                      variant="soft"
                      className="h-11 flex-1"
                      disabled={g.saved <= 0}
                      onClick={() => setMove({ goal: g, mode: 'withdraw' })}
                    >
                      Retirer
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          <Button variant="soft" className="mt-5 w-full sm:w-auto" onClick={() => setForm('new')}>
            <Plus size={18} strokeWidth={2.6} /> Nouvel objectif
          </Button>
        </>
      )}

      {form && <GoalSheet goal={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {move && <GoalMoveSheet goal={move.goal} mode={move.mode} onClose={() => setMove(null)} />}
      {history && <GoalHistorySheet goal={history} onClose={() => setHistory(null)} />}
    </>
  )
}
