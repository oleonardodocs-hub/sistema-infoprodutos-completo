import { addDays, classifyWindow, domainFull, entryAdvice, productShouldBeInactive, splitWeekly, validateProduct, type Totals } from './rules'
import { newId } from './factory'
import type { DailyEntry, Executed, Id } from './types'
import type { Repository } from '../storage/repository'

/** Salva lançamento, calcula recomendação e atualiza início de operação, etapa de análise e validação do produto. */
export async function saveDailyEntry(repo: Repository, entry: DailyEntry) {
  if (entry.spend < 0 || entry.revenue < 0 || entry.checkouts < 0 || entry.sales < 0) throw new Error('Valores não podem ser negativos')
  if (entry.sales > entry.checkouts && entry.checkouts > 0) { /* aceito: checkout pode ter sido iniciado em outro dia */ }
  await repo.put('dailyEntries', entry)
  const all = await repo.list('dailyEntries')
  const saved = all.find((e) => e.id === entry.id)!
  const advice = entryAdvice(saved, all)
  await repo.put('dailyEntries', { ...saved, recommendation: `${advice.action}: ${advice.reason}` })
  await syncProduct(repo, entry.productId)
  return advice
}

async function syncProduct(repo: Repository, productId: Id) {
  const p = (await repo.list('products')).find((x) => x.id === productId)
  if (!p) return
  const mine = (await repo.list('dailyEntries')).filter((e) => e.productId === productId)
  if (!mine.length) return
  const first = mine.map((e) => e.date).sort()[0]
  const startedAt = p.startedAt ?? first
  const validation = validateProduct(mine, startedAt, p.validation)
  let status = p.operationalStatus
  if (status === 'Em produção') status = 'Em validação'
  if (validation.validated && status === 'Em validação') status = 'Ativo'
  await repo.put('products', { ...p, startedAt, validation, operationalStatus: status, steps: { ...p.steps, analise: true } })
}

/** Registra a decisão executada manualmente. O sistema nunca pausa o Meta Ads. */
export async function applyDecision(repo: Repository, entryId: Id, executed: Executed, reason: string) {
  const e = (await repo.list('dailyEntries')).find((x) => x.id === entryId)
  if (!e) return
  await repo.put('dailyEntries', { ...e, executed, decisionReason: reason, executedAt: executed ? new Date().toISOString() : undefined })
  const sets = await repo.list('adSets')
  const a = sets.find((x) => x.id === e.adSetId)
  if (a && executed === 'pausou') await repo.put('adSets', { ...a, paused: true, pausedAt: new Date().toISOString() })
  if (a && executed !== 'pausou' && a.paused) await repo.put('adSets', { ...a, paused: false, pausedAt: undefined })
  const mineSets = (await repo.list('adSets')).filter((x) => x.productId === e.productId)
  const p = (await repo.list('products')).find((x) => x.id === e.productId)
  if (p) {
    // inativa somente sem conjunto ativo; reativa se voltou a ter; a validação histórica nunca é apagada
    if (productShouldBeInactive(mineSets) && p.operationalStatus !== 'Inativo') await repo.put('products', { ...p, operationalStatus: 'Inativo' })
    else if (!productShouldBeInactive(mineSets) && p.operationalStatus === 'Inativo') await repo.put('products', { ...p, operationalStatus: p.validation.validated ? 'Ativo' : 'Em validação' })
  }
}

export async function importWeekly(repo: Repository, productId: Id, adSetId: Id, start: string, totals: Totals, replace: boolean) {
  const end = addDays(start, 6)
  const existing = (await repo.list('dailyEntries')).filter((e) => e.adSetId === adSetId && e.date >= start && e.date <= end)
  if (existing.length && !replace) throw new Error('Já existem lançamentos neste período. Confirme a substituição para não somar duas vezes.')
  for (const e of existing) await repo.remove('dailyEntries', e.id)
  for (const d of splitWeekly(totals, start)) {
    await saveDailyEntry(repo, { id: newId(), productId, adSetId, ...d, source: 'semanal', note: `Dividido do consolidado de 7 dias (${start} a ${end})` })
  }
}

/** Vincula produto a um domínio respeitando o limite de 5 produtos distintos; desvincula dos demais (transferência). */
export async function setProductDomain(repo: Repository, productId: Id, domainId: Id | undefined) {
  const domains = await repo.list('domains')
  const target = domains.find((d) => d.id === domainId)
  if (target && !target.productIds.includes(productId) && domainFull(target)) throw new Error('Limite atingido')
  for (const d of domains) {
    if (d.id !== domainId && d.productIds.includes(productId)) await repo.put('domains', { ...d, productIds: d.productIds.filter((x) => x !== productId) })
  }
  if (target && !target.productIds.includes(productId)) await repo.put('domains', { ...target, productIds: [...target.productIds, productId] })
}

export const windowClass = (entries: DailyEntry[], adSetId: Id, end: string) =>
  classifyWindow(entries.filter((e) => e.adSetId === adSetId), end)
