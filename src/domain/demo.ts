import { addDays, validateProduct } from './rules'
import { newProduct } from './factory'
import type { AdSet, Asset, DailyEntry, Domain, MiningItem, Product } from './types'
import type { Repository, TableName } from '../storage/repository'
import { TABLES } from '../storage/repository'

const D = 'demo-'
/** Dados FICTÍCIOS para teste. Todos os ids começam com "demo-" e podem ser removidos de uma vez. */
export async function loadDemo(repo: Repository) {
  const today = new Date().toISOString().slice(0, 10)
  const day = (k: number) => addDays(today, -k)
  const bm: Asset = { id: D + 'bm', kind: 'bm', name: 'BM Exemplo (FICTÍCIO)', externalId: '000000000000001' }
  const acc: Asset = { id: D + 'acc', kind: 'account', name: 'Conta Exemplo (FICTÍCIO)', externalId: 'act_000000001' }
  const card: Asset = { id: D + 'card', kind: 'card', name: 'Cartão Exemplo (FICTÍCIO)', externalId: '' }
  const mk = (id: string, name: string, country: string, language: string, camp: string): Product => newProduct({
    id: D + id, name: `${name} (FICTÍCIO)`, country, language, campaignName: camp, startedAt: day(6),
    tracking: { ...newProduct({ name: '' }).tracking, bmId: bm.id, accountId: acc.id, cardId: card.id, pixelId: '000000000000000', pixelName: 'Pixel Exemplo (FICTÍCIO)' },
    page: { ...newProduct({ name: '' }).page, domainId: D + 'dom', publicUrl: 'https://exemplo-ficticio.com/' + id, version: 'V1' },
  })
  const A = mk('pa', 'Produto A', 'Portugal', 'Português (PT)', 'CAMP A TESTE'), B = mk('pb', 'Produto B', 'Espanha', 'Espanhol', 'CAMP B TESTE')
  const sets: AdSet[] = [
    { id: D + 'a1', productId: A.id, name: 'A criativo 1', creativeUrl: '', paused: false, createdAt: '' },
    { id: D + 'b1', productId: B.id, name: 'B criativo 1', creativeUrl: '', paused: false, createdAt: '' },
  ]
  const entries: DailyEntry[] = []
  const profitA = [1, 1, 0, 1, 1, 0, 1] // 1 = dia lucrativo
  profitA.forEach((p, i) => entries.push({
    id: D + 'ea' + i, productId: A.id, adSetId: sets[0].id, date: day(6 - i), spend: 40, checkouts: 3,
    sales: p ? 2 : 0, revenue: p ? 90 : 0, source: 'diario',
  }))
  ;[0, 1, 2].forEach((i) => entries.push({
    id: D + 'eb' + i, productId: B.id, adSetId: sets[1].id, date: day(2 - i), spend: i === 2 ? 55 : 30, checkouts: i === 2 ? 0 : 1,
    sales: 0, revenue: 0, source: 'diario',
  }))
  A.validation = validateProduct(entries.filter((e) => e.productId === A.id), A.startedAt!)
  A.operationalStatus = 'Ativo'; B.operationalStatus = 'Em validação'; B.startedAt = day(2)
  const dom: Domain = { id: D + 'dom', host: 'exemplo-ficticio.com', productIds: [A.id, B.id] }
  const mining: MiningItem[] = [
    { id: D + 'm1', foundAt: day(3), originalUrl: 'https://exemplo.com/oferta-a', audience: 'Exemplo: professores (FICTÍCIO)', ticketBRL: 27, activeAds: 3, daysRunning: 12, adLibraryUrl: 'https://exemplo.com/biblioteca', destCountry: 'Portugal', isVisual: true, isNiche: true, isLowTicket: true, runsInDestination: 'nao', createdAt: '' },
    { id: D + 'm2', foundAt: day(1), originalUrl: 'https://exemplo.com/oferta-b', audience: 'Exemplo: cozinheiros (FICTÍCIO)', ticketBRL: 37, activeAds: 20, daysRunning: 9, adLibraryUrl: '', destCountry: 'Espanha', isVisual: false, isNiche: true, isLowTicket: true, runsInDestination: 'pendente', createdAt: '' },
  ]
  for (const a of [bm, acc, card]) await repo.put('assets', a)
  for (const x of [A, B]) await repo.put('products', x)
  for (const x of sets) await repo.put('adSets', x)
  await repo.put('domains', dom)
  for (const x of mining) await repo.put('miningItems', x)
  for (const x of entries) await repo.put('dailyEntries', x)
}

export async function removeDemo(repo: Repository) {
  const demoIds = new Set<string>()
  for (const t of TABLES) {
    for (const r of await repo.list(t as TableName)) {
      if ((r as { id: string }).id.startsWith(D)) { demoIds.add((r as { id: string }).id); await repo.remove(t, (r as { id: string }).id) }
    }
  }
  for (const d of await repo.list('domains')) await repo.put('domains', { ...d, productIds: d.productIds.filter((x) => !demoIds.has(x)) })
}
