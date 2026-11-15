import { useCallback, useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import { useStore } from './store'
import { DEFAULT_CATEGORIES, hashPin, uid } from './lib'
import { Button, ConfirmDelete, Sheet, cx, useClosing, useToast } from './ui'
import { Logo } from './parts'

const LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/* Garde anti-essais : conservée hors de la base pour survivre à un rechargement de la page. */
const GUARD_KEY = 'braz-lock'
const FREE_ATTEMPTS = 5
interface Guard { fails: number; until: number }
function readGuard(): Guard {
  try {
    const g = JSON.parse(localStorage.getItem(GUARD_KEY) ?? '{}')
    return { fails: Number(g.fails) || 0, until: Number(g.until) || 0 }
  } catch {
    return { fails: 0, until: 0 }
  }
}
function writeGuard(g: Guard | null) {
  try {
    if (g) localStorage.setItem(GUARD_KEY, JSON.stringify(g))
    else localStorage.removeItem(GUARD_KEY)
  } catch {
    /* stockage indisponible : la garde ne vaut alors que pour la session */
  }
}
/** Cinq essais libres, puis 30 s d'attente, doublée à chaque nouvelle erreur (15 min au plus). */
const penalty = (fails: number) => (fails < FREE_ATTEMPTS ? 0 : Math.min(30_000 * 2 ** (fails - FREE_ATTEMPTS), 900_000))
const waitLabel = (ms: number) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min` : `${Math.ceil(ms / 1000)} s`)

/** Clavier à quatre chiffres. `onComplete` renvoie false si le code est refusé. */
export function PinPad({
  title, error, onComplete, disabled,
}: { title: string; error?: string; disabled?: boolean; onComplete: (code: string) => boolean | Promise<boolean> }) {
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)

  const press = useCallback((d: string) => {
    if (disabled) return
    setWrong(false)
    setCode((c) => (c.length < LENGTH ? c + d : c))
  }, [disabled])
  const erase = useCallback(() => setCode((c) => c.slice(0, -1)), [])

  useEffect(() => {
    if (code.length !== LENGTH) return
    let alive = true
    Promise.resolve(onComplete(code)).then((ok) => {
      if (!alive || ok) return
      setWrong(true)
      navigator.vibrate?.(60)
      setTimeout(() => alive && setCode(''), 380)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') erase()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [press, erase])

  const key =
    'display grid aspect-square w-full max-w-20 place-items-center justify-self-center rounded-full bg-surface [@media(max-height:650px)]:max-w-16 text-2xl font-semibold shadow-[0_1px_2px_rgb(43_44_79/0.05),0_8px_20px_-12px_rgb(43_44_79/0.25)] transition duration-100 active:scale-90 active:bg-primary-soft disabled:opacity-40'

  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <p className="display text-xl font-semibold">{title}</p>
      <p role="alert" className="mt-1 h-5 text-sm text-neg">{wrong && !disabled ? 'Code incorrect' : error}</p>
      <div className={cx('my-5 flex gap-4', wrong && 'shake')} aria-label={`${code.length} chiffre sur ${LENGTH}`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={`${i}-${i < code.length}`}
            className={cx(
              'size-3.5 rounded-full transition-colors',
              i < code.length ? (wrong ? 'bg-neg' : 'dot-pop bg-primary') : 'bg-ink/15',
            )}
          />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-x-5 gap-y-3 [@media(min-height:700px)]:gap-y-4">
        {KEYS.map((d) => (
          <button key={d} type="button" className={key} disabled={disabled} onClick={() => press(d)}>{d}</button>
        ))}
        <span />
        <button type="button" className={key} disabled={disabled} onClick={() => press('0')}>0</button>
        <button
          type="button"
          aria-label="Effacer"
          onClick={erase}
          disabled={!code}
          className="grid aspect-square w-full max-w-20 place-items-center justify-self-center rounded-full text-muted transition active:scale-90 disabled:opacity-30"
        >
          <Delete size={26} />
        </button>
      </div>
    </div>
  )
}

/** Écran de verrouillage affiché à l'ouverture quand un code est défini. */
export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const { settings, replaceAll } = useStore()
  const [leaving, setLeaving] = useState(false)
  const [forgot, setForgot] = useState(false)
  const pin = settings.pin!
  const [guard, setGuard] = useState(readGuard)
  const [now, setNow] = useState(() => Date.now())
  const waiting = Math.max(0, guard.until - now)

  // Décompte tant que le pavé est bloqué
  useEffect(() => {
    if (guard.until <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [guard.until])

  const open = () => {
    writeGuard(null)
    setLeaving(true)
    setTimeout(onUnlock, 230)
  }

  return (
    <div
      className={cx(
        'hero fixed inset-0 z-40 flex overflow-y-auto px-8 py-[max(1.5rem,env(safe-area-inset-top))]',
        leaving && 'lock-out',
      )}
    >
      {/* m-auto centre le contenu tout en le laissant défiler sur les petits écrans */}
      <div className="m-auto flex w-full flex-col items-center gap-6 [@media(min-height:700px)]:gap-9">
      <div className="rise flex flex-col items-center gap-3">
        <Logo size={56} />
        <span className="display text-3xl font-bold [@media(max-height:650px)]:hidden">braz</span>
      </div>
      <div className="rise flex w-full justify-center" style={{ animationDelay: '90ms' }}>
        <PinPad
          title="Code d’accès"
          disabled={waiting > 0}
          error={waiting > 0 ? `Trop d’essais. Réessayez dans ${waitLabel(waiting)}` : undefined}
          onComplete={async (code) => {
            const ok = (await hashPin(code, pin.salt)) === pin.hash
            if (ok) open()
            else {
              const fails = guard.fails + 1
              const next = { fails, until: Date.now() + penalty(fails) }
              writeGuard(next)
              setGuard(next)
              setNow(Date.now())
            }
            return ok
          }}
        />
      </div>
      <button type="button" onClick={() => setForgot(true)} className="rounded-md text-sm font-semibold text-muted hover:text-ink">
        Code oublié ?
      </button>

      {forgot && (
        <Sheet
          title="Code oublié ?"
          onClose={() => setForgot(false)}
          footer={
            <>
              <Button variant="soft" className="flex-1" onClick={() => setForgot(false)}>Annuler</Button>
              <ConfirmDelete
                label="Tout effacer"
                onConfirm={() =>
                  replaceAll({
                    transactions: [],
                    budgets: [],
                    goals: [],
                    categories: DEFAULT_CATEGORIES,
                    settings: { id: 'settings', currency: settings.currency },
                  }).then(open)
                }
              />
            </>
          }
        >
          <p className="text-[15px] text-muted">
            Sans le code, il faut effacer les données de cet appareil. Vous pourrez ensuite restaurer une sauvegarde.
          </p>
        </Sheet>
      )}
      </div>
    </div>
  )
}

/** Définit ou remplace le code d'accès : saisie, puis confirmation. */
export function PinSetupSheet({ onClose: done }: { onClose: () => void }) {
  const { updateSettings } = useStore()
  const toast = useToast()
  const [closing, onClose] = useClosing(done)
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()

  return (
    <Sheet title="Code d’accès" onClose={onClose} closing={closing}>
      <div className="flex justify-center pb-4 pt-2">
        {first ? (
          <PinPad
            key="confirm"
            title="Confirmez le code"
            onComplete={async (code) => {
              if (code !== first) {
                setTimeout(() => {
                  setFirst('')
                  setError('Les codes ne correspondent pas')
                }, 380)
                return false
              }
              const salt = uid()
              updateSettings({ pin: { salt, hash: await hashPin(code, salt) } })
              toast('Code d’accès activé')
              onClose()
              return true
            }}
          />
        ) : (
          <PinPad
            key="new"
            title="Choisissez 4 chiffres"
            error={error}
            onComplete={(code) => {
              setError(undefined)
              setFirst(code)
              return true
            }}
          />
        )}
      </div>
    </Sheet>
  )
}
