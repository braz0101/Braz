// Fine couche au-dessus d'IndexedDB : une base, un magasin par collection.
import type { Data } from './types'

const NAME = 'braz'
const VERSION = 3
export const LISTS = ['transactions', 'categories', 'budgets', 'goals', 'recurring', 'accounts', 'transfers', 'moves'] as const
export type ListName = (typeof LISTS)[number]
type StoreName = ListName | 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of [...LISTS, 'meta']) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function all<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function loadAll(): Promise<Partial<Data>> {
  const db = await open()
  const out: Record<string, unknown> = {}
  await Promise.all([
    ...LISTS.map(async (s) => {
      out[s] = await all(db, s)
    }),
    all<Data['settings']>(db, 'meta').then((meta) => {
      out.settings = meta.find((m) => m.id === 'settings')
    }),
  ])
  return out as Partial<Data>
}

export async function put(store: StoreName, value: unknown): Promise<void> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  return done(tx)
}

export async function remove(store: StoreName, id: string): Promise<void> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(id)
  return done(tx)
}

/** Remplace tout le contenu de la base en une seule transaction atomique. */
export async function replaceAll(data: Data): Promise<void> {
  const db = await open()
  const tx = db.transaction([...LISTS, 'meta'], 'readwrite')
  for (const s of LISTS) {
    const store = tx.objectStore(s)
    store.clear()
    for (const item of data[s]) store.put(item)
  }
  tx.objectStore('meta').put(data.settings)
  return done(tx)
}
