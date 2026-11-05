import Dexie, { type Table } from 'dexie'
import type { AdSet, Asset, Creative, DailyEntry, Domain, MiningItem, Product } from '../domain/types'
import { normalizeProduct } from '../domain/factory'
import type { EncryptedBlob } from './crypto'

export interface SecretRecord { id: string; blob: EncryptedBlob } // sempre cifrado
export interface Meta { key: string; value: string }

export interface Tables {
  miningItems: MiningItem
  products: Product
  domains: Domain
  dailyEntries: DailyEntry
  secrets: SecretRecord
  assets: Asset
  adSets: AdSet
  creatives: Creative
}
export type TableName = keyof Tables
export const TABLES: TableName[] = ['miningItems', 'products', 'domains', 'dailyEntries', 'secrets', 'assets', 'adSets', 'creatives']
export type Snapshot = { [K in TableName]: Tables[K][] }

/** Contrato usado pelas telas. Trocar IndexedDB por um banco na nuvem = implementar esta interface. */
export interface Repository {
  list<K extends TableName>(t: K): Promise<Tables[K][]>
  put<K extends TableName>(t: K, row: Tables[K]): Promise<void>
  remove(t: TableName, id: string): Promise<void>
  snapshot(): Promise<Snapshot>
  replaceAll(s: Snapshot): Promise<void>
  getMeta(key: string): Promise<string | undefined>
  setMeta(key: string, value: string): Promise<void>
}

class DB extends Dexie {
  miningItems!: Table<MiningItem, string>
  products!: Table<Product, string>
  domains!: Table<Domain, string>
  dailyEntries!: Table<DailyEntry, string>
  secrets!: Table<SecretRecord, string>
  assets!: Table<Asset, string>
  adSets!: Table<AdSet, string>
  creatives!: Table<Creative, string>
  meta!: Table<Meta, string>
  constructor(name = 'infoprodutos') {
    super(name)
    this.version(1).stores({
      miningItems: 'id', products: 'id', domains: 'id',
      dailyEntries: 'id, productId, date, [productId+adSetId+date]',
      secrets: 'id', meta: 'key',
    })
    this.version(2).stores({
      miningItems: 'id', products: 'id', domains: 'id',
      dailyEntries: 'id, productId, date, [productId+adSetId+date]',
      secrets: 'id', meta: 'key', assets: 'id', adSets: 'id, productId', creatives: 'id, productId',
    })
  }
}

export function createDexieRepository(dbName?: string): Repository {
  const db = new DB(dbName)
  const tbl = (t: TableName) => db[t] as unknown as Table<{ id: string }, string>
  return {
    list: async (t) => {
      const rows = await tbl(t).toArray()
      return (t === 'products' ? rows.map((r) => normalizeProduct(r as unknown as Product)) : rows) as never
    },
    put: async (t, row) => {
      if (t === 'dailyEntries') {
        // evita duplicar o mesmo produto+conjunto+data
        const r = row as DailyEntry
        const dup = await db.dailyEntries.where('[productId+adSetId+date]').equals([r.productId, r.adSetId, r.date]).first()
        if (dup && dup.id !== r.id) throw new Error('Já existe lançamento para este produto, conjunto e data. Edite o existente.')
      }
      await tbl(t).put(row as never)
    },
    remove: (t, id) => tbl(t).delete(id),
    snapshot: async () => {
      const s = {} as Snapshot
      for (const t of TABLES) (s as Record<string, unknown>)[t] = t === 'products' ? (await tbl(t).toArray()).map((r) => normalizeProduct(r as unknown as Product)) : await tbl(t).toArray()
      return s
    },
    replaceAll: (s) =>
      db.transaction('rw', [db.miningItems, db.products, db.domains, db.dailyEntries, db.secrets, db.assets, db.adSets, db.creatives], async () => {
        for (const t of TABLES) { await tbl(t).clear(); await tbl(t).bulkPut((s[t] ?? []) as never[]) }
      }),
    getMeta: async (k) => (await db.meta.get(k))?.value,
    setMeta: async (k, v) => { await db.meta.put({ key: k, value: v }) },
  }
}
export { newId } from '../domain/factory'
