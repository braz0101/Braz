import type { ReactNode } from 'react'
import { ArrowLeftRight, Repeat, Settings } from 'lucide-react'
import type { Transaction, Transfer } from './types'
import { useStore } from './store'
import { UNKNOWN_CATEGORY } from './lib'
import { IconChip, cx, stagger } from './ui'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="130" fill="var(--primary)" />
      <rect x="140" y="104" width="60" height="304" rx="30" fill="#fff" />
      <circle cx="276" cy="302" r="76" fill="none" stroke="#fff" strokeWidth="60" />
      <circle cx="276" cy="302" r="30" fill="#ffb199" />
    </svg>
  )
}

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {lead}
        <h1 className="display truncate text-[1.75rem] font-semibold leading-tight md:text-4xl">{title}</h1>
      </div>
      {!location.hash.includes('parametres') && (
        <a
          href="#/parametres"
          aria-label="Paramètres"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition active:scale-90 md:hidden"
        >
          <Settings size={19} />
        </a>
      )}
      {children && <div className="flex w-full items-center md:w-auto">{children}</div>}
    </header>
  )
}

export function SectionHead({
  title, href, linkLabel = 'Tout voir', onAction,
}: { title: string; href?: string; linkLabel?: string; onAction?: () => void }) {
  const link = 'rounded-md text-sm font-semibold text-primary hover:underline'
  return (
    <div className="mb-3 flex items-baseline justify-between px-1">
      <h2 className="display text-lg font-semibold">{title}</h2>
      {onAction ? (
        <button type="button" onClick={onAction} className={link}>{linkLabel}</button>
      ) : (
        href && <a href={href} className={link}>{linkLabel}</a>
      )}
    </div>
  )
}

const row =
  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-surface-2/60 active:scale-[0.99] active:bg-surface-2 sm:px-4'

/** Ligne de transaction. `index` déclenche l'entrée en cascade quand il est fourni. */
export function TxRow({ tx, index }: { tx: Transaction; index?: number }) {
  const { categories, accounts, setTxForm, money } = useStore()
  const cat = categories.find((c) => c.id === tx.categoryId) ?? UNKNOWN_CATEGORY
  const account = accounts.length > 1 ? accounts.find((a) => a.id === tx.accountId)?.name : undefined
  const income = tx.type === 'income'
  return (
    <button
      type="button"
      onClick={() => setTxForm(tx)}
      style={index === undefined ? undefined : stagger(index + 3)}
      className={cx(row, index !== undefined && 'rise')}
    >
      <IconChip icon={cat.icon} color={cat.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{tx.note || cat.name}</span>
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <span className="truncate">{tx.note ? cat.name : account ?? cat.name}{tx.note && account ? `, ${account}` : ''}</span>
          {tx.recurringId && <Repeat size={13} className="shrink-0" aria-label="Récurrente" />}
        </span>
      </span>
      <span className={cx('num shrink-0 font-semibold', income && 'text-pos')}>
        {money(income ? tx.amount : -tx.amount, true)}
      </span>
    </button>
  )
}

/** Ligne de transfert entre deux comptes. */
export function TransferRow({ transfer }: { transfer: Transfer }) {
  const { accounts, setTransferForm, money } = useStore()
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Compte supprimé'
  return (
    <button type="button" onClick={() => setTransferForm(transfer)} className={row}>
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
        <ArrowLeftRight size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{transfer.note || 'Transfert'}</span>
        <span className="block truncate text-sm text-muted">{name(transfer.fromId)} vers {name(transfer.toId)}</span>
      </span>
      <span className="num shrink-0 font-semibold text-muted">{money(transfer.amount)}</span>
    </button>
  )
}
