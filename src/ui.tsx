import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ReactNode,
} from 'react'
import { Check, ChevronLeft, ChevronRight, Delete, X, type LucideIcon } from 'lucide-react'
import { iconFor } from './icons'
import { currentMonth, formatAmountInput, monthLabel, shiftMonth, currencySymbol } from './lib'
import { useStore } from './store'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

/** Rang d'un bloc dans l'animation d'entrée en cascade. */
export const stagger = (i: number) => ({ '--i': i }) as CSSProperties

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- Bouton ---------- */

type Variant = 'primary' | 'soft' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-[0_8px_18px_-10px_var(--primary)] hover:brightness-105',
  soft: 'bg-surface-2 text-ink hover:brightness-[0.97]',
  ghost: 'text-primary hover:bg-primary-soft',
  danger: 'bg-neg/10 text-neg hover:bg-neg/15',
}
export function Button({
  variant = 'primary', className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

/* ---------- Montant animé ---------- */

/** Affiche un montant qui défile jusqu'à sa valeur quand elle change. */
export function Money({ value, sign }: { value: number; sign?: boolean }) {
  const { money } = useStore()
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  const current = useRef(shown)
  useEffect(() => {
    const start = current.current
    if (start === value) return
    if (reducedMotion()) {
      current.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700)
      const v = p === 1 ? value : Math.round(start + (value - start) * (1 - Math.pow(1 - p, 4)))
      current.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Filet de sécurité : si les images ne sont pas servies (onglet en arrière-plan), on affiche la valeur finale.
    const settle = setTimeout(() => {
      cancelAnimationFrame(raf)
      current.current = value
      setShown(value)
    }, 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [value])
  return <>{money(shown, sign)}</>
}

/* ---------- Pastille d'icône ---------- */

export function IconChip({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  const Icon = iconFor(icon)
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 13%, white)` }}
    >
      <Icon size={size * 0.45} strokeWidth={2.1} />
    </span>
  )
}

/* ---------- Barre de progression ---------- */

export function Progress({ ratio, color, className }: { ratio: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className="bar-x h-full rounded-full transition-[width] duration-700 ease-soft"
        style={{ width: `${pct}%`, background: color ?? 'var(--primary)' }}
      />
    </div>
  )
}

/* ---------- État vide ---------- */

export function Empty({
  icon: Icon, title, text, children,
}: { icon: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center px-6 py-12 text-center">
      <span className="relative mb-5 grid size-20 place-items-center rounded-[1.75rem] bg-primary-soft text-primary">
        <Icon size={32} strokeWidth={1.7} />
        <span className="absolute -right-1 -top-1 size-4 rounded-full bg-ember ring-4 ring-bg" />
      </span>
      <h3 className="display text-xl font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-[15px] text-muted">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

/* ---------- Feuille modale ---------- */

/** Ferme une feuille après son animation de sortie. Renvoie [en cours de fermeture, fermer]. */
export function useClosing(onClose: () => void): [boolean, () => void] {
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (reducedMotion()) return onClose()
    setClosing(true)
    setTimeout(onClose, 190)
  }, [onClose])
  return [closing, close]
}

export function Sheet({
  title, onClose, children, footer, closing,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; closing?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [selfClosing, dismiss] = useClosing(onClose)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      d.showModal()
      // showModal place le focus sur le bouton de fermeture : on le ramène sur le champ principal, sinon sur la feuille.
      ;(d.querySelector<HTMLElement>('[data-autofocus]') ?? d).focus()
    }
    return () => d?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className={cx('sheet outline-none', (closing || selfClosing) && 'closing')}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        dismiss()
      }}
      onClick={(e) => e.target === ref.current && dismiss()}
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
      <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3 sm:pt-4">
        <h2 className="display text-xl font-semibold">{title}</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 active:scale-90"
        >
          <X size={20} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">{children}</div>
      {footer && (
        <footer className="flex shrink-0 gap-2 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      )}
    </dialog>
  )
}

/* ---------- Champs ---------- */

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error && <span role="alert" className="mt-1.5 block text-sm text-neg">{error}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-2xl bg-surface-2 p-1">
      {/* Pastille qui glisse sous l'option choisie */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-xl bg-surface shadow-[0_2px_8px_-2px_rgb(43_44_79/0.18)] transition-transform duration-300 ease-soft"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative h-10 min-w-0 flex-1 truncate rounded-xl px-2 text-[15px] font-semibold transition-colors',
            value === o.value ? 'text-ink' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const coarsePointer = () => matchMedia('(pointer: coarse)').matches
const amountBox = 'block w-full rounded-3xl bg-surface-2 px-5 py-4 text-center transition-shadow'

/**
 * Grand champ de montant, formaté pendant la saisie.
 * Sur écran tactile, il utilise son propre pavé numérique : le clavier du téléphone ne s'ouvre pas.
 */
export function AmountInput({
  value, onChange, autoFocus, label = 'Montant', error,
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean; label?: string; error?: string }) {
  const { settings } = useStore()
  const [touch] = useState(coarsePointer)
  const [open, setOpen] = useState(!!autoFocus)
  const box = useRef<HTMLDivElement>(null)
  const symbol = currencySymbol(settings.currency)
  const set = (raw: string) => onChange(formatAmountInput(raw, settings.currency))
  const whole = symbol === 'FCFA' || symbol === 'XOF'

  // Le pavé se referme quand on touche autre chose. On écoute le clic (et non l'appui)
  // pour que l'élément visé reçoive son clic avant que la mise en page ne bouge.
  useEffect(() => {
    if (!touch || !open) return
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    // On n'écoute que la feuille : le clic qui vient de l'ouvrir, parti d'ailleurs, ne doit pas refermer le pavé.
    const scope: Node = box.current?.closest('dialog') ?? document
    scope.addEventListener('click', away)
    return () => {
      scope.removeEventListener('click', away)
    }
  }, [touch, open])

  if (!touch) {
    return (
      <label className={cx(amountBox, 'focus-within:ring-2 focus-within:ring-primary', error && 'shake ring-2 ring-neg/60')}>
        <span className="block text-sm font-medium text-muted">{label}</span>
        <span className="mt-1 flex items-baseline justify-center gap-2">
          <input
            inputMode="decimal"
            autoComplete="off"
            data-autofocus={autoFocus || undefined}
            placeholder="0"
            value={value}
            onChange={(e) => set(e.target.value)}
            className="display num w-full min-w-0 bg-transparent text-center text-[2.6rem] font-semibold leading-tight outline-none placeholder:text-muted/40"
            style={{ maxWidth: `${Math.max(2, value.length + 1)}ch` }}
          />
          <span className="shrink-0 text-lg font-semibold text-muted">{symbol}</span>
        </span>
        {error && <span role="alert" className="mt-1 block text-sm text-neg">{error}</span>}
      </label>
    )
  }

  const key = 'display grid h-12 place-items-center rounded-2xl bg-surface-2 text-xl font-semibold transition duration-100 active:scale-95 active:bg-primary-soft'
  return (
    <div ref={box}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label} : ${value || '0'} ${symbol}`}
        aria-expanded={open}
        className={cx(amountBox, open && 'ring-2 ring-primary', error && 'shake ring-2 ring-neg/60')}
      >
        <span className="block text-sm font-medium text-muted">{label}</span>
        <span className="mt-1 flex items-baseline justify-center gap-1.5">
          <span className={cx('display num text-[2.6rem] font-semibold leading-tight', !value && 'text-muted/40')}>{value || '0'}</span>
          {open && <span className="caret" aria-hidden />}
          <span className="ml-1 text-lg font-semibold text-muted">{symbol}</span>
        </span>
        {error && <span role="alert" className="mt-1 block text-sm text-neg">{error}</span>}
      </button>
      {open && (
        <div className="mt-3 grid animate-[rise_0.25s_var(--ease-soft)] grid-cols-3 gap-2" role="group" aria-label="Pavé numérique">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', whole ? '00' : ',', '0'].map((d) => (
            <button key={d} type="button" className={key} onClick={() => set(value + d)}>{d}</button>
          ))}
          <button type="button" aria-label="Effacer" className={cx(key, 'text-muted')} onClick={() => set(value.slice(0, -1))}>
            <Delete size={22} />
          </button>
        </div>
      )}
    </div>
  )
}

/** Interrupteur accessible. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 text-left font-medium"
    >
      {label}
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-primary' : 'bg-ink/15')}>
        <span
          className={cx(
            'absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ease-soft',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

export function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Couleur" className="flex flex-wrap gap-2.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Couleur ${c}`}
          onClick={() => onChange(c)}
          className="grid size-10 place-items-center rounded-full text-white transition active:scale-90"
          style={{ background: c }}
        >
          {value === c && <Check size={18} strokeWidth={3} className="dot-pop" />}
        </button>
      ))}
    </div>
  )
}

export function IconPicker({ icons, value, color, onChange }: { icons: string[]; value: string; color: string; onChange: (i: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Icône" className="grid grid-cols-6 gap-2">
      {icons.map((key) => {
        const Icon = iconFor(key)
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={key}
            onClick={() => onChange(key)}
            className={cx('grid aspect-square place-items-center rounded-2xl transition active:scale-90', !on && 'bg-surface-2 text-muted')}
            style={on ? { color: '#fff', background: color } : undefined}
          >
            <Icon size={20} />
          </button>
        )
      })}
    </div>
  )
}

/** Suppression en deux temps : le premier appui arme, le second confirme. */
export function ConfirmDelete({ onConfirm, label = 'Supprimer' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button variant="danger" onClick={() => (armed ? onConfirm() : setArmed(true))} className={armed ? 'bg-neg! text-white!' : ''}>
      {armed ? 'Confirmer' : label}
    </Button>
  )
}

/* ---------- Sélecteur de mois ---------- */

export function MonthSwitcher() {
  const { month, setMonth } = useStore()
  const isCurrent = month === currentMonth()
  const arrow = 'grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-90 disabled:opacity-30'
  return (
    <div className="flex w-full items-center justify-between rounded-full border border-line bg-surface p-0.5 md:inline-flex md:w-auto">
      <button type="button" aria-label="Mois précédent" className={arrow} onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => setMonth(currentMonth())}
        title={isCurrent ? undefined : 'Revenir au mois en cours'}
        className="min-w-32 px-1 text-center text-[15px] font-semibold"
      >
        <span key={month} className="inline-block animate-[fade_0.25s_ease-out]">{monthLabel(month)}</span>
      </button>
      <button type="button" aria-label="Mois suivant" className={arrow} disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

/* ---------- Notifications ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const show = useCallback((msg: string) => setToast({ id: Date.now(), msg }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-8">
        {toast && (
          <div key={toast.id} className="toast flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            <span className="grid size-5 place-items-center rounded-full bg-ember">
              <Check size={13} strokeWidth={3.5} />
            </span>
            {toast.msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}
