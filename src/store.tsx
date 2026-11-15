import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as db from './db'
import type { Budget, Category, Data, Goal, Recurring, Settings, Transaction } from './types'
import { DEFAULT_CATEGORIES, currentMonth, demoData, download, dueRecurring, formatMoney, toBackup, todayISO } from './lib'

type Lists = { transactions: Transaction; categories: Category; budgets: Budget; goals: Goal; recurring: Recurring }
const DEFAULT_SETTINGS: Settings = { id: 'settings', currency: 'FCFA' }

interface Store extends Data {
  month: string
  setMonth: (m: string) => void
  save: <K extends keyof Lists>(list: K, item: Lists[K]) => void
  remove: (list: keyof Lists, id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: Data) => Promise<void>
  clearAll: () => Promise<void>
  /** Enregistre une sauvegarde JSON et note la date de l'export. Renvoie false si l'export a été annulé. */
  exportBackup: () => Promise<boolean>
  loadDemo: () => Promise<void>
  /** Formulaire de transaction ouvert : une transaction à modifier, 'new', ou null */
  txForm: Transaction | 'new' | null
  setTxForm: (v: Transaction | 'new' | null) => void
  money: (n: number, sign?: boolean) => string
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [txForm, setTxForm] = useState<Store['txForm']>(null)

  useEffect(() => {
    db.loadAll()
      .then(async (d) => {
        const settings: Settings = { ...DEFAULT_SETTINGS, ...d.settings, id: 'settings' }
        let categories = d.categories ?? []
        if (!categories.length) {
          categories = DEFAULT_CATEGORIES
          await db.replaceAll({
            transactions: d.transactions ?? [],
            budgets: d.budgets ?? [],
            goals: d.goals ?? [],
            recurring: d.recurring ?? [],
            categories,
            settings,
          })
        }
        setData({
          transactions: d.transactions ?? [],
          budgets: d.budgets ?? [],
          goals: d.goals ?? [],
          recurring: d.recurring ?? [],
          categories,
          settings,
        })
        // Demande au navigateur de ne pas purger les données locales.
        navigator.storage?.persist?.().catch(() => {})
      })
      .catch(() => setError('Impossible d’ouvrir le stockage local. Vérifiez que la navigation privée est désactivée, puis rechargez la page.'))
  }, [])

  const save = useCallback<Store['save']>((list, item) => {
    setData((d) => {
      if (!d) return d
      const items = d[list] as { id: string }[]
      const exists = items.some((x) => x.id === item.id)
      return { ...d, [list]: exists ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item] }
    })
    db.put(list, item).catch(() => setError('L’enregistrement a échoué. Rechargez la page et réessayez.'))
  }, [])

  const remove = useCallback<Store['remove']>((list, id) => {
    setData((d) => (d ? { ...d, [list]: (d[list] as { id: string }[]).filter((x) => x.id !== id) } : d))
    db.remove(list, id).catch(() => setError('La suppression a échoué. Rechargez la page et réessayez.'))
  }, [])

  const updateSettings = useCallback<Store['updateSettings']>((patch) => {
    setData((d) => {
      if (!d) return d
      const settings = { ...d.settings, ...patch }
      db.put('meta', settings).catch(() => {})
      return { ...d, settings }
    })
  }, [])

  const replaceAll = useCallback(async (next: Data) => {
    await db.replaceAll(next)
    setData(next)
  }, [])

  // Crée les transactions récurrentes arrivées à échéance : au chargement, et au retour dans l'application un autre jour.
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const onVisible = () => !document.hidden && setToday(todayISO())
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const recurring = data?.recurring
  useEffect(() => {
    if (!recurring) return
    const due = dueRecurring(recurring, today)
    due.transactions.forEach((t) => save('transactions', t))
    due.recurring.forEach((r) => save('recurring', r))
  }, [recurring, today, save])

  const value = useMemo<Store | null>(() => {
    if (!data) return null
    // Catégories d'origine dans leur ordre naturel, puis les catégories personnalisées par nom.
    const rank = (id: string) => {
      const i = DEFAULT_CATEGORIES.findIndex((c) => c.id === id)
      return i < 0 ? DEFAULT_CATEGORIES.length : i
    }
    const categories = [...data.categories].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'fr'))
    return {
      ...data,
      categories,
      month,
      setMonth,
      save,
      remove,
      updateSettings,
      replaceAll,
      clearAll: () =>
        replaceAll({ transactions: [], budgets: [], goals: [], recurring: [], categories: DEFAULT_CATEGORIES, settings: data.settings }),
      exportBackup: async () => {
        const ok = await download(`braz-sauvegarde-${todayISO()}.json`, JSON.stringify(toBackup(data), null, 2), 'application/json')
        if (ok) updateSettings({ lastBackupAt: Date.now(), backupSnoozeUntil: undefined })
        return ok
      },
      loadDemo: () => {
        const demo = demoData()
        // Les exemples s'appuient sur les catégories par défaut : on les rétablit si elles ont été supprimées.
        const ids = new Set(data.categories.map((c) => c.id))
        const categories = [...data.categories, ...DEFAULT_CATEGORIES.filter((c) => !ids.has(c.id))]
        return replaceAll({ ...demo, categories, settings: data.settings })
      },
      txForm,
      setTxForm,
      money: (n, sign) => formatMoney(n, data.settings.currency, sign),
    }
  }, [data, month, txForm, save, remove, updateSettings, replaceAll])

  if (error && !value) {
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center" role="alert">
        <p className="max-w-sm text-muted">{error}</p>
      </div>
    )
  }
  if (!value) return null
  return (
    <Ctx.Provider value={value}>
      {children}
      {error && (
        <div role="alert" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-neg px-4 py-3 text-sm font-medium text-white">
          {error}
        </div>
      )}
    </Ctx.Provider>
  )
}
