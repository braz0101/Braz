import { useState, type FormEvent } from 'react'
import type { Budget, Category, Goal, Transaction, TxType } from './types'
import { useStore } from './store'
import { PALETTE, amountToInput, parseAmount, shiftDay, todayISO, uid } from './lib'
import { GOAL_ICONS, ICON_KEYS, iconFor } from './icons'
import { AmountInput, Button, ConfirmDelete, Field, IconPicker, Segmented, Sheet, Swatches, cx, useClosing, useToast } from './ui'

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Dépense' },
  { value: 'income', label: 'Revenu' },
]

/* ---------- Transaction ---------- */

export function TransactionSheet({ tx, onClose: done }: { tx: Transaction | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { categories, settings, save, remove } = useStore()
  const toast = useToast()
  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState(tx ? amountToInput(tx.amount, settings.currency) : '')
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '')
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({})

  const today = todayISO()
  const cats = categories.filter((c) => c.type === type)
  const noun = type === 'expense' ? 'la dépense' : 'le revenu'

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    const next = {
      amount: value ? undefined : 'Saisissez un montant.',
      category: cats.some((c) => c.id === categoryId) ? undefined : 'Choisissez une catégorie.',
    }
    setErrors(next)
    if (next.amount || next.category) return
    save('transactions', {
      id: tx?.id ?? uid(),
      type,
      amount: value,
      categoryId,
      note: note.trim(),
      date: date || today,
      createdAt: tx?.createdAt ?? Date.now(),
    })
    toast(tx ? 'Transaction modifiée' : type === 'expense' ? 'Dépense ajoutée' : 'Revenu ajouté')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={tx ? 'Modifier la transaction' : 'Nouvelle transaction'}
      onClose={onClose}
      footer={
        <>
          {tx && (
            <ConfirmDelete
              onConfirm={() => {
                remove('transactions', tx.id)
                toast('Transaction supprimée')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="tx-form" className="flex-1">
            {tx ? 'Enregistrer' : `Ajouter ${noun}`}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-5" noValidate>
        <Segmented
          label="Type de transaction"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(t) => {
            setType(t)
            setCategoryId('')
            setErrors({})
          }}
        />
        <AmountInput
          value={amount}
          autoFocus={!tx}
          error={errors.amount}
          onChange={(v) => {
            setAmount(v)
            if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }))
          }}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">Catégorie</legend>
          <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
            {cats.map((c) => {
              const Icon = iconFor(c.icon)
              const on = c.id === categoryId
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setCategoryId(c.id)
                    setErrors((e) => ({ ...e, category: undefined }))
                  }}
                  className={cx(
                    'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-1 py-2.5 transition active:scale-95',
                    on ? 'bg-surface' : 'border-transparent bg-surface-2',
                  )}
                  style={on ? { borderColor: c.color } : undefined}
                >
                  <Icon size={20} style={{ color: c.color }} />
                  <span className={cx('w-full truncate text-center text-xs font-medium', !on && 'text-muted')}>{c.name}</span>
                </button>
              )
            })}
          </div>
          {errors.category && <p role="alert" className="mt-1.5 text-sm text-neg">{errors.category}</p>}
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="tx-date" className="text-sm font-medium text-muted">Date</label>
            <div className="flex gap-1.5">
              {[
                { label: 'Aujourd’hui', value: today },
                { label: 'Hier', value: shiftDay(today, -1) },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDate(q.value)}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    date === q.value ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted',
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <input id="tx-date" type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>

        <Field label="Note (facultatif)">
          <input
            className="field"
            value={note}
            maxLength={80}
            placeholder={type === 'expense' ? 'Ex. Déjeuner, taxi…' : 'Ex. Salaire de novembre'}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </form>
    </Sheet>
  )
}

/* ---------- Budget ---------- */

export function BudgetSheet({ budget, onClose: done }: { budget: Budget | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { categories, budgets, settings, save, remove } = useStore()
  const toast = useToast()
  const taken = new Set(budgets.filter((b) => b.id !== budget?.id).map((b) => b.categoryId))
  const available = categories.filter((c) => c.type === 'expense' && !taken.has(c.id))
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? available[0]?.id ?? '')
  const [limit, setLimit] = useState(budget ? amountToInput(budget.limit, settings.currency) : '')
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(limit)
    if (!value) return setError('Saisissez une limite.')
    save('budgets', { id: budget?.id ?? uid(), categoryId, limit: value })
    toast(budget ? 'Budget modifié' : 'Budget créé')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={budget ? 'Modifier le budget' : 'Nouveau budget'}
      onClose={onClose}
      footer={
        <>
          {budget && (
            <ConfirmDelete
              onConfirm={() => {
                remove('budgets', budget.id)
                toast('Budget supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="budget-form" className="flex-1" disabled={!categoryId}>
            {budget ? 'Enregistrer' : 'Créer le budget'}
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          label="Limite par mois"
          value={limit}
          autoFocus={!budget}
          error={error}
          onChange={(v) => {
            setLimit(v)
            setError(undefined)
          }}
        />
        <Field label="Catégorie">
          {available.length ? (
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-[15px] text-muted">
              Toutes les catégories ont déjà un budget.
            </p>
          )}
        </Field>
      </form>
    </Sheet>
  )
}

/* ---------- Objectif d'épargne ---------- */

export function GoalSheet({ goal, onClose: done }: { goal: Goal | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { settings, save, remove } = useStore()
  const toast = useToast()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? amountToInput(goal.target, settings.currency) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [color, setColor] = useState(goal?.color ?? PALETTE[0])
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(target)
    const next = {
      name: name.trim() ? undefined : 'Donnez un nom.',
      target: value ? undefined : 'Saisissez un montant.',
    }
    setErrors(next)
    if (next.name || next.target) return
    save('goals', {
      id: goal?.id ?? uid(),
      name: name.trim(),
      target: value,
      saved: goal?.saved ?? 0,
      icon,
      color,
      deadline: deadline || undefined,
      createdAt: goal?.createdAt ?? Date.now(),
    })
    toast(goal ? 'Objectif modifié' : 'Objectif créé')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'}
      onClose={onClose}
      footer={
        <>
          {goal && (
            <ConfirmDelete
              onConfirm={() => {
                remove('goals', goal.id)
                toast('Objectif supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="goal-form" className="flex-1">
            {goal ? 'Enregistrer' : 'Créer l’objectif'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          label="Montant à atteindre"
          value={target}
          error={errors.target}
          onChange={(v) => {
            setTarget(v)
            setErrors((e) => ({ ...e, target: undefined }))
          }}
        />
        <Field label="Nom" error={errors.name}>
          <input
            className="field"
            value={name}
            maxLength={40}
            data-autofocus={goal ? undefined : true}
            placeholder="Ex. Ordinateur, voyage…"
            onChange={(e) => {
              setName(e.target.value)
              setErrors((x) => ({ ...x, name: undefined }))
            }}
          />
        </Field>
        <Field label="Échéance (facultatif)">
          <input type="date" className="field" value={deadline} min={todayISO()} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icône</p>
          <IconPicker icons={GOAL_ICONS} value={icon} color={color} onChange={setIcon} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Couleur</p>
          <Swatches colors={PALETTE} value={color} onChange={setColor} />
        </div>
      </form>
    </Sheet>
  )
}

/** Verser de l'argent sur un objectif ou en retirer. */
export function GoalMoveSheet({ goal, mode, onClose: done }: { goal: Goal; mode: 'deposit' | 'withdraw'; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { save, money } = useStore()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string>()
  const deposit = mode === 'deposit'

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!value) return setError('Saisissez un montant.')
    if (!deposit && value > goal.saved) return setError(`Vous pouvez retirer ${money(goal.saved)} au maximum.`)
    save('goals', { ...goal, saved: goal.saved + (deposit ? value : -value) })
    toast(deposit ? 'Versement enregistré' : 'Retrait enregistré')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={deposit ? `Verser · ${goal.name}` : `Retirer · ${goal.name}`}
      onClose={onClose}
      footer={
        <Button type="submit" form="move-form" className="flex-1">
          {deposit ? 'Verser' : 'Retirer'}
        </Button>
      }
    >
      <form id="move-form" onSubmit={submit} className="space-y-4" noValidate>
        <AmountInput
          value={amount}
          autoFocus
          error={error}
          onChange={(v) => {
            setAmount(v)
            setError(undefined)
          }}
        />
        <p className="text-sm text-muted">
          {deposit
            ? `Déduit du solde disponible. Reste ${money(Math.max(0, goal.target - goal.saved))} à épargner.`
            : `Revient dans le solde disponible. Épargné : ${money(goal.saved)}.`}
        </p>
      </form>
    </Sheet>
  )
}

/* ---------- Catégorie ---------- */

export function CategorySheet({ category, onClose: done }: { category: Category | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { transactions, budgets, save, remove } = useStore()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState<TxType>(category?.type ?? 'expense')
  const [icon, setIcon] = useState(category?.icon ?? 'wallet')
  const [color, setColor] = useState(category?.color ?? PALETTE[0])
  const [error, setError] = useState<string>()
  const used = category ? transactions.filter((t) => t.categoryId === category.id).length : 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Donnez un nom.')
    save('categories', { id: category?.id ?? uid(), name: name.trim(), type, icon, color })
    toast(category ? 'Catégorie modifiée' : 'Catégorie créée')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      onClose={onClose}
      footer={
        <>
          {category && used === 0 && (
            <ConfirmDelete
              onConfirm={() => {
                budgets.filter((b) => b.categoryId === category.id).forEach((b) => remove('budgets', b.id))
                remove('categories', category.id)
                toast('Catégorie supprimée')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="cat-form" className="flex-1">
            {category ? 'Enregistrer' : 'Créer la catégorie'}
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="space-y-5" noValidate>
        {!category && <Segmented label="Type de catégorie" options={TYPE_OPTIONS} value={type} onChange={setType} />}
        <Field label="Nom" error={error}>
          <input
            className="field"
            value={name}
            maxLength={24}
            data-autofocus={category ? undefined : true}
            placeholder="Ex. Abonnements"
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icône</p>
          <IconPicker icons={ICON_KEYS} value={icon} color={color} onChange={setIcon} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Couleur</p>
          <Swatches colors={PALETTE} value={color} onChange={setColor} />
        </div>
        {used > 0 && (
          <p className="text-sm text-muted">
            Utilisée par {used} transaction{used > 1 ? 's' : ''} : suppression impossible.
          </p>
        )}
      </form>
    </Sheet>
  )
}
