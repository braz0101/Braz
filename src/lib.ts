import type { Backup, Category, Currency, Data, Goal, Recurring, Transaction, Budget } from './types'

export const uid = () => crypto.randomUUID()

/* ---------- Dates ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const currentMonth = () => todayISO().slice(0, 7)
const parse = (iso: string) => new Date(iso.length === 7 ? `${iso}-01T12:00:00` : `${iso}T12:00:00`)

export function shiftMonth(month: string, delta: number): string {
  const d = parse(month)
  d.setMonth(d.getMonth() + delta)
  return toISO(d).slice(0, 7)
}
export function shiftDay(iso: string, delta: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + delta)
  return toISO(d)
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const monthLabel = (month: string) =>
  cap(parse(month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
export const monthShort = (month: string) =>
  parse(month).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
export function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Aujourd’hui'
  if (iso === shiftDay(today, -1)) return 'Hier'
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  return cap(
    parse(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
    }),
  )
}
export const dateLabel = (iso: string) =>
  parse(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/* ---------- Montants ---------- */

const SYMBOL: Record<Currency, string> = { FCFA: 'FCFA', XOF: 'XOF', EUR: '€', USD: '$' }
export const currencySymbol = (c: Currency) => SYMBOL[c]
const decimals = (c: Currency) => (c === 'FCFA' || c === 'XOF' ? 0 : 2)

export function formatNumber(n: number, c: Currency): string {
  const dec = decimals(c)
  const abs = Math.abs(n)
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: dec,
    minimumFractionDigits: Number.isInteger(abs) ? 0 : dec,
  }).format(abs)
}
export function formatMoney(n: number, c: Currency, sign = false): string {
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${prefix}${formatNumber(n, c)} ${SYMBOL[c]}`
}
/** Format compact pour les axes : 125 k, 1,2 M */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}
/** Met en forme la saisie d'un montant : « 125000 » → « 125 000 » */
export function formatAmountInput(raw: string, c: Currency): string {
  let s = raw.replace(/[^\d.,]/g, '').replace('.', ',')
  const [int = '', ...rest] = s.split(',')
  const grouped = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (decimals(c) === 0 || s.indexOf(',') === -1) return grouped
  s = `${grouped || '0'},${rest.join('').slice(0, 2)}`
  return s
}
export const amountToInput = (n: number, c: Currency) =>
  n ? formatAmountInput(String(n).replace('.', ','), c) : ''

/* ---------- Catégories ---------- */

export const PALETTE = [
  '#4B4EE6', '#FF5B2E', '#0E9F6E', '#E0A100', '#D6336C',
  '#0C8CE9', '#8B5CF6', '#0FA3A3', '#A0714F', '#7A7FA3',
]

const c = (id: string, name: string, type: Category['type'], icon: string, color: string): Category => ({
  id, name, type, icon, color,
})
export const DEFAULT_CATEGORIES: Category[] = [
  c('alimentation', 'Alimentation', 'expense', 'utensils', '#FF5B2E'),
  c('transport', 'Transport', 'expense', 'bus', '#0C8CE9'),
  c('logement', 'Logement', 'expense', 'home', '#4B4EE6'),
  c('etudes', 'Études', 'expense', 'graduation', '#8B5CF6'),
  c('sante', 'Santé', 'expense', 'heart', '#D6336C'),
  c('loisirs', 'Loisirs', 'expense', 'gamepad', '#E0A100'),
  c('shopping', 'Shopping', 'expense', 'bag', '#0FA3A3'),
  c('factures', 'Factures', 'expense', 'receipt', '#A0714F'),
  c('communication', 'Communication', 'expense', 'phone', '#0E9F6E'),
  c('autres', 'Autres', 'expense', 'more', '#7A7FA3'),
  c('salaire', 'Salaire', 'income', 'briefcase', '#0E9F6E'),
  c('bourse', 'Bourse', 'income', 'award', '#8B5CF6'),
  c('freelance', 'Freelance', 'income', 'laptop', '#0C8CE9'),
  c('cadeau', 'Cadeau', 'income', 'gift', '#D6336C'),
  c('autres-revenus', 'Autres revenus', 'income', 'coins', '#7A7FA3'),
]

export const UNKNOWN_CATEGORY: Category = c('?', 'Sans catégorie', 'expense', 'more', '#7A7FA3')

/* ---------- Calculs ---------- */

export const sum = (txs: Transaction[], type: Transaction['type']) =>
  txs.reduce((s, t) => (t.type === type ? s + t.amount : s), 0)
export const inMonth = (txs: Transaction[], month: string) => txs.filter((t) => t.date.startsWith(month))
export const sortTx = (txs: Transaction[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))

export function spentByCategory(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) if (t.type === 'expense') map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  return map
}

/* ---------- Récurrences ---------- */

export const recurringDate = (month: string, day: number) => `${month}-${pad(Math.min(day, daysInMonth(month)))}`

/**
 * Transactions à créer pour les récurrences arrivées à échéance, et récurrences mises à jour.
 * L'identifiant de chaque transaction est déterministe : rejouer le calcul ne crée pas de doublon.
 */
export function dueRecurring(recurring: Recurring[], today: string): { transactions: Transaction[]; recurring: Recurring[] } {
  const transactions: Transaction[] = []
  const updated: Recurring[] = []
  const thisMonth = today.slice(0, 7)
  for (const r of recurring) {
    let month = r.lastRun ? shiftMonth(r.lastRun, 1) : r.startMonth
    let last = r.lastRun
    for (let guard = 0; month <= thisMonth && guard < 60; guard++) {
      const date = recurringDate(month, r.day)
      if (date > today) break
      transactions.push({
        id: `${r.id}-${month}`,
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        note: r.note,
        date,
        createdAt: Date.now(),
        recurringId: r.id,
      })
      last = month
      month = shiftMonth(month, 1)
    }
    if (last !== r.lastRun) updated.push({ ...r, lastRun: last })
  }
  return { transactions, recurring: updated }
}

/* ---------- Code d'accès ---------- */

/** Empreinte salée du code. Verrou d'écran local : les données ne sont pas chiffrées. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const text = `${salt}:${pin}`
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Hors contexte sécurisé (HTTP), crypto.subtle n'existe pas : empreinte FNV-1a de repli.
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}

/* ---------- Sauvegarde ---------- */

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Enregistre un fichier. Renvoie false si l'utilisateur a annulé. */
export async function download(filename: string, content: string, type: string): Promise<boolean> {
  // Sur iPhone, une application installée ne sait pas télécharger un lien : on passe par la feuille de partage.
  if (isIOS() && typeof navigator.share === 'function') {
    const file = new File([content], filename, { type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return true
      } catch {
        return false
      }
    }
  }
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export function toBackup(data: Data): Backup {
  // Le code d'accès reste propre à l'appareil : il n'est jamais exporté.
  const settings = { id: 'settings' as const, currency: data.settings.currency }
  return { app: 'braz', version: 1, exportedAt: new Date().toISOString(), ...data, settings }
}

/** Valide un fichier de sauvegarde ; lève une erreur lisible si le fichier n'est pas exploitable. */
export function readBackup(text: string): Data {
  let raw: Partial<Backup>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde BRAZ lisible.')
  }
  if (raw?.app !== 'braz' || !Array.isArray(raw.transactions) || !Array.isArray(raw.categories)) {
    throw new Error('Ce fichier n’est pas une sauvegarde BRAZ.')
  }
  const okTx = raw.transactions.every(
    (t) => t && typeof t.id === 'string' && typeof t.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(t.date),
  )
  if (!okTx) throw new Error('La sauvegarde contient des transactions invalides.')
  return {
    transactions: raw.transactions,
    categories: raw.categories,
    budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring : [],
    settings: { id: 'settings', currency: raw.settings?.currency ?? 'FCFA' },
  }
}

export function toCSV(txs: Transaction[], categories: Category[]): string {
  const cat = new Map(categories.map((x) => [x.id, x.name]))
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = sortTx(txs).map((t) =>
    [t.date, t.type === 'income' ? 'Revenu' : 'Dépense', esc(cat.get(t.categoryId) ?? ''), String(t.amount).replace('.', ','), esc(t.note)].join(';'),
  )
  return '﻿' + ['Date;Type;Catégorie;Montant;Note', ...rows].join('\r\n')
}

/* ---------- Données d'exemple ---------- */

export function demoData(): Pick<Data, 'transactions' | 'budgets' | 'goals' | 'recurring'> {
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const between = (a: number, b: number, step = 500) => Math.round((a + rnd() * (b - a)) / step) * step
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const today = todayISO()
  const txs: Transaction[] = []
  let n = 0
  const add = (date: string, type: Transaction['type'], categoryId: string, amount: number, note: string) => {
    if (date <= today) txs.push({ id: uid(), type, categoryId, amount, note, date, createdAt: Date.now() - 1e6 + n++ })
  }
  for (let back = 3; back >= 0; back--) {
    const m = shiftMonth(currentMonth(), -back)
    const days = daysInMonth(m)
    const day = (d: number) => `${m}-${pad(Math.min(d, days))}`
    add(day(1), 'income', 'salaire', 350000, 'Salaire')
    if (back % 2 === 1) add(day(14), 'income', 'freelance', between(60000, 120000, 5000), 'Mission site web')
    add(day(2), 'expense', 'logement', 90000, 'Loyer')
    add(day(5), 'expense', 'factures', between(12000, 19000), 'Électricité')
    add(day(6), 'expense', 'communication', 10000, 'Forfait internet')
    add(day(9), 'expense', 'etudes', between(15000, 30000, 1000), pick(['Livres', 'Formation en ligne', 'Fournitures']))
    for (let d = 1; d <= days; d++) {
      if (rnd() < 0.62) add(day(d), 'expense', 'alimentation', between(1500, 7500), pick(['Marché', 'Déjeuner', 'Supermarché', 'Boulangerie', 'Dîner']))
      if (rnd() < 0.45) add(day(d), 'expense', 'transport', between(500, 3000), pick(['Taxi', 'Bus', 'Carburant', 'Moto-taxi']))
      if (rnd() < 0.1) add(day(d), 'expense', 'loisirs', between(3000, 12000), pick(['Cinéma', 'Sortie entre amis', 'Concert', 'Jeux']))
      if (rnd() < 0.05) add(day(d), 'expense', 'shopping', between(8000, 25000, 1000), pick(['Vêtements', 'Chaussures', 'Accessoires']))
      if (rnd() < 0.035) add(day(d), 'expense', 'sante', between(3000, 15000), pick(['Pharmacie', 'Consultation']))
    }
  }
  const budgets: Budget[] = [
    { id: uid(), categoryId: 'alimentation', limit: 90000 },
    { id: uid(), categoryId: 'transport', limit: 30000 },
    { id: uid(), categoryId: 'loisirs', limit: 25000 },
    { id: uid(), categoryId: 'shopping', limit: 30000 },
  ]
  const goals: Goal[] = [
    { id: uid(), name: 'Ordinateur portable', target: 450000, saved: 180000, icon: 'laptop', color: '#4B4EE6', createdAt: Date.now() - 2 },
    { id: uid(), name: 'Fonds d’urgence', target: 300000, saved: 95000, icon: 'piggy', color: '#0E9F6E', createdAt: Date.now() - 1 },
  ]
  // Les exemples mensuels ci-dessus existent déjà : la récurrence reprend au mois suivant.
  const rec = (categoryId: string, type: Transaction['type'], amount: number, note: string, day: number): Recurring => {
    const month = currentMonth()
    const done = recurringDate(month, day) <= today
    return { id: uid(), type, amount, categoryId, note, day, startMonth: month, lastRun: done ? month : shiftMonth(month, -1) }
  }
  const recurring = [
    rec('salaire', 'income', 350000, 'Salaire', 1),
    rec('logement', 'expense', 90000, 'Loyer', 2),
    rec('communication', 'expense', 10000, 'Forfait internet', 6),
  ]
  return { transactions: txs, budgets, goals, recurring }
}
