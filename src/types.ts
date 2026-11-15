export type TxType = 'expense' | 'income'
export type Currency = 'FCFA' | 'XOF' | 'EUR' | 'USD'

export interface Transaction {
  id: string
  type: TxType
  amount: number
  categoryId: string
  note: string
  /** Date locale au format AAAA-MM-JJ */
  date: string
  createdAt: number
}

export interface Category {
  id: string
  name: string
  type: TxType
  icon: string
  color: string
}

/** Limite mensuelle récurrente pour une catégorie de dépenses */
export interface Budget {
  id: string
  categoryId: string
  limit: number
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  icon: string
  color: string
  deadline?: string
  createdAt: number
}

export interface Settings {
  id: 'settings'
  currency: Currency
  /** Code d'accès : seule son empreinte salée est conservée. */
  pin?: { salt: string; hash: string }
}

export interface Data {
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  settings: Settings
}

export interface Backup extends Data {
  app: 'braz'
  version: 1
  exportedAt: string
}
