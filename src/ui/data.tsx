import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createDexieRepository, type Repository, type Snapshot } from '../storage/repository'
import type { Product } from '../domain/types'

interface Ctx {
  repo: Repository; data: Snapshot; lastBackupAt?: string; refresh: () => Promise<void>; ready: boolean
  selected?: Product; setSelectedId: (id: string) => void
  pass: string; setPass: (p: string) => void // frase-senha só em memória
}
const C = createContext<Ctx>(null as never)
export const useData = () => useContext(C)
const empty: Snapshot = { miningItems: [], products: [], domains: [], dailyEntries: [], secrets: [], assets: [], adSets: [], creatives: [] }

export function DataProvider({ children, repo: injected }: { children: ReactNode; repo?: Repository }) {
  const repo = useMemo(() => injected ?? createDexieRepository(), [injected])
  const [data, setData] = useState<Snapshot>(empty)
  const [lastBackupAt, setLast] = useState<string>()
  const [ready, setReady] = useState(false)
  const [selId, setSelectedId] = useState('')
  const [pass, setPass] = useState('')
  const refresh = useCallback(async () => {
    setData(await repo.snapshot()); setLast(await repo.getMeta('lastBackupAt')); setReady(true)
  }, [repo])
  useEffect(() => { void refresh() }, [refresh])
  const selected = data.products.find((p) => p.id === selId) ?? data.products[0]
  return <C.Provider value={{ repo, data, lastBackupAt, refresh, ready, selected, setSelectedId, pass, setPass }}>{children}</C.Provider>
}
