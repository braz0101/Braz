// Formulaires liés à l'argent : transaction, transfert, compte, épargne, devise.
import { useMemo, useState, type FormEvent } from 'react'
import { Repeat } from 'lucide-react'
import type { Account, Currency, Goal, Transaction, Transfer, TxType } from './types'
import { useStore } from './store'
import {
  PALETTE, amountToInput, currencySymbol, currentMonth, dateLabel, inMonth, parseAmount, shiftDay, spentByCategory, todayISO, uid,
} from './lib'
import { ACCOUNT_ICONS, iconFor } from './icons'
import {
  AmountInput, Button, ConfirmDelete, Field, IconPicker, Segmented, Sheet, Swatches, Switch, cx, useClosing, useToast,
} from './ui'
import { CategoryGrid } from './forms'

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Dépense' },
  { value: 'income', label: 'Revenu' },
]

/** Compte proposé par défaut : le dernier utilisé, sinon le premier. */
function useDefaultAccount() {
  const { accounts, settings } = useStore()
  return accounts.some((a) => a.id === settings.lastAccountId) ? settings.lastAccountId! : accounts[0].id
}

/* ---------- Choix de compte ---------- */

export function AccountPicker({
  label, value, onChange, exclude, error,
}: { label: string; value: string; onChange: (id: string) => void; exclude?: string; error?: string }) {
  const { accounts, balances, money } = useStore()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-muted">{label}</legend>
      {/* Pas de débord négatif ici : il rendrait toute la feuille défilable horizontalement. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {accounts.filter((a) => a.id !== exclude).map((a) => {
          const Icon = iconFor(a.icon)
          const on = a.id === value
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(a.id)}
              className={cx(
                'flex shrink-0 items-center gap-2.5 rounded-2xl border-[1.5px] py-2 pl-3 pr-4 text-left transition active:scale-95',
                on ? 'bg-surface' : 'border-transparent bg-surface-2',
              )}
              style={on ? { borderColor: a.color } : undefined}
            >
              <Icon size={18} style={{ color: a.color }} />
              <span>
                <span className={cx('block text-sm font-semibold leading-tight', !on && 'text-muted')}>{a.name}</span>
                <span className="num block text-xs text-muted">{money(balances.get(a.id) ?? 0)}</span>
              </span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm text-neg">{error}</p>}
    </fieldset>
  )
}

function DateField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const today = todayISO()
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-muted">Date</label>
        <div className="flex gap-1.5">
          {[
            { label: 'Aujourd’hui', value: today },
            { label: 'Hier', value: shiftDay(today, -1) },
          ].map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.value)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-semibold',
                value === q.value ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
      <input id={id} type="date" className="field" value={value} max={today} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/* ---------- Transaction ---------- */

export function TransactionSheet({ tx, onClose: done }: { tx: Transaction | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { categories, transactions, budgets, accounts, settings, save, remove, updateSettings } = useStore()
  const toast = useToast()
  const defaultAccount = useDefaultAccount()
  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState(tx ? amountToInput(tx.amount, settings.currency) : '')
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '')
  const [accountId, setAccountId] = useState(tx?.accountId ?? defaultAccount)
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [repeat, setRepeat] = useState(false)
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({})

  const noun = type === 'expense' ? 'la dépense' : 'le revenu'

  // Descriptions déjà utilisées pour cette catégorie, les plus fréquentes d'abord : un appui suffit à les reprendre.
  const suggestions = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of transactions) if (t.categoryId === categoryId && t.note) count.set(t.note, (count.get(t.note) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).map(([n]) => n).filter((n) => n !== note).slice(0, 4)
  }, [transactions, categoryId, note])

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    const next = {
      amount: value ? undefined : 'Saisissez un montant.',
      category: categories.some((c) => c.id === categoryId && c.type === type) ? undefined : 'Choisissez une catégorie.',
    }
    setErrors(next)
    if (next.amount || next.category) return
    const when = date || todayISO()
    const id = tx?.id ?? uid()
    const recurringId = repeat ? uid() : tx?.recurringId
    save('transactions', {
      id, type, amount: value, categoryId, accountId, note: note.trim(), date: when,
      createdAt: tx?.createdAt ?? Date.now(),
      ...(recurringId ? { recurringId } : {}),
    })
    if (repeat && recurringId) {
      // Cette transaction compte pour son mois : la récurrence reprend le mois suivant.
      const month = when.slice(0, 7)
      save('recurring', {
        id: recurringId, type, amount: value, categoryId, accountId, note: note.trim(), day: Number(when.slice(8)), startMonth: month, lastRun: month,
      })
    }
    if (accountId !== settings.lastAccountId) updateSettings({ lastAccountId: accountId })

    // Prévient au moment où une dépense fait franchir un seuil du budget de sa catégorie.
    let message = tx ? 'Transaction modifiée' : type === 'expense' ? 'Dépense ajoutée' : 'Revenu ajouté'
    const budget = type === 'expense' && when.startsWith(currentMonth()) ? budgets.find((b) => b.categoryId === categoryId) : undefined
    if (budget) {
      const before = spentByCategory(inMonth(transactions.filter((t) => t.id !== id), currentMonth())).get(categoryId) ?? 0
      const [was, now] = [before / budget.limit, (before + value) / budget.limit]
      const name = categories.find((c) => c.id === categoryId)?.name
      if (now >= 1 && was < 1) message = `Budget ${name} dépassé`
      else if (now >= 0.85 && was < 0.85) message = `Budget ${name} : ${Math.round(now * 100)} % utilisé`
    }
    toast(message)
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

        <CategoryGrid
          type={type}
          value={categoryId}
          error={errors.category}
          onChange={(id) => {
            setCategoryId(id)
            setErrors((e) => ({ ...e, category: undefined }))
          }}
        />

        <div>
          <Field label="Description">
            <input
              className="field"
              value={note}
              maxLength={140}
              enterKeyHint="done"
              placeholder={type === 'expense' ? 'C’était pour quoi ? Ex. Déjeuner avec Awa' : 'Ex. Salaire de novembre'}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNote(s)}
                  className="max-w-full truncate rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted transition active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {accounts.length > 1 && (
          <AccountPicker label={type === 'expense' ? 'Payé avec' : 'Reçu sur'} value={accountId} onChange={setAccountId} />
        )}

        <DateField id="tx-date" value={date} onChange={setDate} />

        {!tx && <Switch label="Répéter chaque mois" checked={repeat} onChange={setRepeat} />}
        {tx?.recurringId && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Repeat size={15} className="shrink-0" /> Créée par une récurrence. La modifier ici ne change que ce mois.
          </p>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Transfert entre comptes ---------- */

export function TransferSheet({ transfer, onClose: done }: { transfer: Transfer | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { accounts, settings, save, remove } = useStore()
  const toast = useToast()
  const defaultAccount = useDefaultAccount()
  const [fromId, setFromId] = useState(transfer?.fromId ?? defaultAccount)
  const [toId, setToId] = useState(transfer?.toId ?? accounts.find((a) => a.id !== defaultAccount)?.id ?? '')
  const [amount, setAmount] = useState(transfer ? amountToInput(transfer.amount, settings.currency) : '')
  const [date, setDate] = useState(transfer?.date ?? todayISO())
  const [note, setNote] = useState(transfer?.note ?? '')
  const [errors, setErrors] = useState<{ amount?: string; to?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    const next = {
      amount: value ? undefined : 'Saisissez un montant.',
      to: toId && toId !== fromId ? undefined : 'Choisissez un autre compte.',
    }
    setErrors(next)
    if (next.amount || next.to) return
    save('transfers', {
      id: transfer?.id ?? uid(), fromId, toId, amount: value, date: date || todayISO(), note: note.trim(),
      createdAt: transfer?.createdAt ?? Date.now(),
    })
    toast(transfer ? 'Transfert modifié' : 'Transfert enregistré')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={transfer ? 'Modifier le transfert' : 'Nouveau transfert'}
      onClose={onClose}
      footer={
        <>
          {transfer && (
            <ConfirmDelete
              onConfirm={() => {
                remove('transfers', transfer.id)
                toast('Transfert supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="transfer-form" className="flex-1">
            {transfer ? 'Enregistrer' : 'Transférer'}
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          value={amount}
          autoFocus={!transfer}
          error={errors.amount}
          onChange={(v) => {
            setAmount(v)
            setErrors((x) => ({ ...x, amount: undefined }))
          }}
        />
        <AccountPicker
          label="Depuis"
          value={fromId}
          onChange={(id) => {
            setFromId(id)
            if (id === toId) setToId('')
          }}
        />
        <AccountPicker
          label="Vers"
          value={toId}
          exclude={fromId}
          error={errors.to}
          onChange={(id) => {
            setToId(id)
            setErrors((x) => ({ ...x, to: undefined }))
          }}
        />
        <DateField id="transfer-date" value={date} onChange={setDate} />
        <Field label="Description (facultatif)">
          <input className="field" value={note} maxLength={80} enterKeyHint="done" placeholder="Ex. Retrait au guichet" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </Sheet>
  )
}

/* ---------- Compte ---------- */

export function AccountSheet({ account, onClose: done }: { account: Account | null; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { accounts, transactions, transfers, moves, recurring, settings, save, remove } = useStore()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [initial, setInitial] = useState(account?.initial ? amountToInput(account.initial, settings.currency) : '')
  const [icon, setIcon] = useState(account?.icon ?? 'wallet')
  const [color, setColor] = useState(account?.color ?? PALETTE[0])
  const [error, setError] = useState<string>()

  const used =
    !!account &&
    (transactions.some((t) => t.accountId === account.id) ||
      transfers.some((t) => t.fromId === account.id || t.toId === account.id) ||
      moves.some((m) => m.accountId === account.id) ||
      recurring.some((r) => r.accountId === account.id))
  const deletable = !!account && !used && accounts.length > 1

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Donnez un nom.')
    save('accounts', { id: account?.id ?? uid(), name: name.trim(), icon, color, initial: parseAmount(initial) })
    toast(account ? 'Compte modifié' : 'Compte créé')
    onClose()
  }

  return (
    <Sheet
      closing={closing}
      title={account ? 'Modifier le compte' : 'Nouveau compte'}
      onClose={onClose}
      footer={
        <>
          {deletable && (
            <ConfirmDelete
              onConfirm={() => {
                remove('accounts', account.id)
                toast('Compte supprimé')
                onClose()
              }}
            />
          )}
          <Button type="submit" form="account-form" className="flex-1">
            {account ? 'Enregistrer' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Nom" error={error}>
          <input
            className="field"
            value={name}
            maxLength={24}
            data-autofocus={account ? undefined : true}
            placeholder="Ex. Orange Money, Wave, Épargne"
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
          />
        </Field>
        <AmountInput label="Solde de départ" value={initial} onChange={setInitial} />
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icône</p>
          <IconPicker icons={ACCOUNT_ICONS} value={icon} color={color} onChange={setIcon} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Couleur</p>
          <Swatches colors={PALETTE} value={color} onChange={setColor} />
        </div>
        {used && <p className="text-sm text-muted">Ce compte a des mouvements : il ne peut pas être supprimé.</p>}
      </form>
    </Sheet>
  )
}

/* ---------- Épargne : versement, retrait, historique ---------- */

export function GoalMoveSheet({ goal, mode, onClose: done }: { goal: Goal; mode: 'deposit' | 'withdraw'; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { accounts, balances, save, money } = useStore()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(useDefaultAccount())
  const [error, setError] = useState<string>()
  const deposit = mode === 'deposit'

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!value) return setError('Saisissez un montant.')
    if (!deposit && value > goal.saved) return setError(`Vous pouvez retirer ${money(goal.saved)} au maximum.`)
    if (deposit && value > (balances.get(accountId) ?? 0)) return setError('Ce compte n’a pas assez d’argent.')
    save('moves', { id: uid(), goalId: goal.id, accountId, amount: deposit ? value : -value, date: todayISO(), createdAt: Date.now() })
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
      <form id="move-form" onSubmit={submit} className="space-y-5" noValidate>
        <AmountInput
          value={amount}
          autoFocus
          error={error}
          onChange={(v) => {
            setAmount(v)
            setError(undefined)
          }}
        />
        {accounts.length > 1 && (
          <AccountPicker
            label={deposit ? 'Depuis' : 'Vers'}
            value={accountId}
            onChange={(id) => {
              setAccountId(id)
              setError(undefined)
            }}
          />
        )}
        <p className="text-sm text-muted">
          {deposit ? `Reste ${money(Math.max(0, goal.target - goal.saved))} à épargner.` : `Épargné : ${money(goal.saved)}.`}
        </p>
      </form>
    </Sheet>
  )
}

export function GoalHistorySheet({ goal, onClose: done }: { goal: Goal; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { moves, accounts, money } = useStore()
  const list = moves.filter((m) => m.goalId === goal.id).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  return (
    <Sheet closing={closing} title={`Historique · ${goal.name}`} onClose={onClose}>
      {list.length ? (
        <ul className="divide-y divide-line pb-2">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block font-semibold">{m.amount > 0 ? 'Versement' : 'Retrait'}</span>
                <span className="block truncate text-sm text-muted">
                  {dateLabel(m.date)}, {accounts.find((a) => a.id === m.accountId)?.name ?? 'compte supprimé'}
                </span>
              </span>
              <span className={cx('num shrink-0 font-semibold', m.amount > 0 && 'text-pos')}>{money(m.amount, true)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-8 pt-4 text-center text-[15px] text-muted">Aucun versement pour l’instant.</p>
      )}
    </Sheet>
  )
}

/* ---------- Changement de devise ---------- */

/** Parité fixe du franc CFA avec l'euro */
const XOF_PER_EUR = 655.957
const isXOF = (c: Currency) => c === 'FCFA' || c === 'XOF'

export function CurrencySheet({ to, onClose: done }: { to: Currency; onClose: () => void }) {
  const [closing, onClose] = useClosing(done)
  const { settings, changeCurrency } = useStore()
  const toast = useToast()
  const from = settings.currency
  // Le taux est exprimé dans le sens le plus lisible : « 1 € = 655,957 FCFA » plutôt que l'inverse.
  const [strong, weak] = isXOF(from) ? [to, from] : [from, to]
  const known = (isXOF(from) && to === 'EUR') || (from === 'EUR' && isXOF(to))
  const [rate, setRate] = useState(known ? String(XOF_PER_EUR).replace('.', ',') : '')
  const [error, setError] = useState<string>()

  function convert() {
    const r = Number(rate.replace(/\s/g, '').replace(',', '.'))
    if (!(r > 0)) return setError('Saisissez un taux.')
    const factor = strong === from ? r : 1 / r
    changeCurrency(to, factor).then(() => {
      toast('Montants convertis')
      onClose()
    })
  }

  return (
    <Sheet
      closing={closing}
      title={`Passer en ${currencySymbol(to)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="soft" onClick={() => changeCurrency(to).then(() => { toast('Devise modifiée'); onClose() })}>
            Symbole seul
          </Button>
          <Button className="flex-1" onClick={convert}>Convertir les montants</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label={`1 ${currencySymbol(strong)} vaut combien de ${currencySymbol(weak)} ?`} error={error}>
          <input
            className="field"
            inputMode="decimal"
            enterKeyHint="done"
            value={rate}
            placeholder="Ex. 600"
            onChange={(e) => {
              setRate(e.target.value.replace(/[^\d.,]/g, ''))
              setError(undefined)
            }}
          />
        </Field>
        <p className="text-sm text-muted">
          Convertir recalcule transactions, budgets, comptes et épargne. « Symbole seul » garde les mêmes chiffres.
        </p>
      </div>
    </Sheet>
  )
}
