import type {
  AdSet, AdStrength, DailyEntry, DestinationRating, Domain, Id, MiningItem, MiningStatus, Offer, PageInfo, Product, StepKey, ValidationRecord,
} from './types'
import { STEPS } from './types'

export const DAILY_SPEND_LIMIT = 50
export const MIN_DAYS_RUNNING = 10
export const DOMAIN_LIMIT = 5

/* ---------- datas ---------- */
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/* ---------- 3. Mineração ---------- */
export interface MiningEvaluation {
  status: MiningStatus
  reasons: string[]
  strength?: AdStrength
  destination: DestinationRating
}

export function evaluateMining(i: Pick<MiningItem, 'isLowTicket' | 'activeAds' | 'daysRunning' | 'runsInDestination'>): MiningEvaluation {
  const reasons: string[] = []
  if (!i.isLowTicket) reasons.push('Não é low ticket')
  if (i.activeAds < 1) reasons.push('Nenhum anúncio ativo')
  if (i.daysRunning < MIN_DAYS_RUNNING) reasons.push(`Menos de ${MIN_DAYS_RUNNING} dias rodando`)
  const approved = reasons.length === 0
  const destination: DestinationRating =
    i.runsInDestination === 'sim' ? 'Bom' : i.runsInDestination === 'nao' ? 'Excelente' : 'Pendente'
  return {
    status: approved ? 'Aprovado' : 'Reprovado',
    reasons,
    strength: approved ? adStrength(i.activeAds) : undefined,
    destination,
  }
}

export function adStrength(activeAds: number): AdStrength {
  if (activeAds >= 4) return 'Excelente'
  if (activeAds === 3) return 'Muito bom'
  if (activeAds === 2) return 'Bom'
  return 'Aceitável'
}

/* ---------- 6. Domínios ---------- */
export function domainOccupancy(d: Pick<Domain, 'productIds'>): number {
  return new Set(d.productIds).size // por produto distinto
}
export const domainFull = (d: Pick<Domain, 'productIds'>) => domainOccupancy(d) >= DOMAIN_LIMIT
export function linkProduct(d: Domain, productId: Id): Domain {
  if (d.productIds.includes(productId)) return d
  if (domainFull(d)) throw new Error('Limite atingido')
  return { ...d, productIds: [...d.productIds, productId] }
}
export const unlinkProduct = (d: Domain, productId: Id): Domain => ({
  ...d, productIds: d.productIds.filter((p) => p !== productId),
})

/* ---------- 8. Métricas ---------- */
export interface Totals { spend: number; checkouts: number; sales: number; revenue: number }
export const emptyTotals = (): Totals => ({ spend: 0, checkouts: 0, sales: 0, revenue: 0 })

/** Soma apenas lançamentos únicos (produto+conjunto+data) dentro da janela e dos produtos. */
export function consolidate(
  entries: DailyEntry[], opts: { productIds?: Id[]; from?: string; to?: string },
): Totals {
  const seen = new Set<string>()
  const t = emptyTotals()
  for (const e of entries) {
    if (opts.productIds && !opts.productIds.includes(e.productId)) continue
    if (opts.from && e.date < opts.from) continue
    if (opts.to && e.date > opts.to) continue
    const key = `${e.productId}|${e.adSetId}|${e.date}`
    if (seen.has(key)) continue
    seen.add(key)
    t.spend += e.spend; t.checkouts += e.checkouts; t.sales += e.sales; t.revenue += e.revenue
  }
  return t
}

const div = (a: number, b: number): number | null => (b === 0 ? null : a / b)
export function metrics(t: Totals) {
  const profit = t.revenue - t.spend // lucro operacional de mídia
  return {
    investment: t.spend,
    revenue: t.revenue,
    profit,
    margin: div(profit, t.revenue) === null ? null : (profit / t.revenue) * 100,
    roi: div(profit, t.spend) === null ? null : (profit / t.spend) * 100,
    roas: div(t.revenue, t.spend),
    cpa: div(t.spend, t.sales),
  }
}
export function fmtNum(v: number | null, digits = 2): string {
  return v === null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export const fmtBRL = (v: number | null) => (v === null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
export const fmtPct = (v: number | null) => (v === null || !Number.isFinite(v) ? '—' : fmtNum(v, 1) + '%')

/* ---------- Análise diária por conjunto ---------- */
export type Recommendation = 'PAUSAR' | 'MANTER' | 'MANTER ATÉ O FIM DO DIA'
export interface Advice { action: Recommendation; reason: string; alerts: string[] }

export const dayProfit = (e: Pick<DailyEntry, 'revenue' | 'spend'>) => e.revenue - e.spend

/** Dias consecutivos sem vendas, contando a partir da data informada para trás. Dia não lançado interrompe a contagem. */
export function consecutiveNoSalesDays(history: DailyEntry[], upTo: string): number {
  const byDate = new Map(history.map((e) => [e.date, e]))
  let n = 0
  for (let d = upTo; ; d = addDays(d, -1)) {
    const e = byDate.get(d)
    if (!e || e.sales > 0) break
    n++
  }
  return n
}

export interface AdviceContext {
  creativeValidated: boolean
  weeklyProfitable: boolean // histórico de 7 dias lucrativo (Lucrativo ou Vencedor)
}

export function adviseDaily(entry: DailyEntry, history: DailyEntry[], ctx: AdviceContext): Advice {
  const alerts: string[] = []
  // Prioridade absoluta: R$ 50 no dia
  if (entry.spend >= DAILY_SPEND_LIMIT && entry.checkouts === 0) {
    return { action: 'PAUSAR', reason: 'R$ 50 gastos no dia sem checkout (regra prioritária)', alerts: ['Conjunto R$ 50 sem checkout'] }
  }
  const streak = consecutiveNoSalesDays(history, entry.date)
  if (ctx.creativeValidated) {
    const tolerance = ctx.weeklyProfitable ? 3 : 2
    if (streak >= 2) alerts.push(`${streak}º dia sem vendas`)
    if (streak >= tolerance) {
      return { action: 'PAUSAR', reason: `${streak} dias consecutivos sem vendas (tolerância ${tolerance})`, alerts }
    }
  }
  if (entry.spend >= DAILY_SPEND_LIMIT && entry.checkouts > 0) {
    return { action: 'MANTER ATÉ O FIM DO DIA', reason: 'R$ 50 gastos com checkout: observar até o fim do dia', alerts }
  }
  return { action: 'MANTER', reason: 'Nenhuma regra de pausa atingida', alerts }
}

/** Criativo validado: venda no dia 1 e no dia 2 (dias de calendário consecutivos a partir do primeiro lançamento). */
export function creativeValidated(history: DailyEntry[]): { validated: boolean; date?: string } {
  if (history.length === 0) return { validated: false }
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const d1 = sorted[0].date, d2 = addDays(d1, 1)
  const e1 = sorted.find((e) => e.date === d1)!
  const e2 = sorted.find((e) => e.date === d2)
  return e1.sales > 0 && e2 && e2.sales > 0 ? { validated: true, date: d2 } : { validated: false }
}

/* ---------- Janela de 7 dias ---------- */
export type WindowClass = 'Vencedor' | 'Lucrativo' | 'Perdedor' | 'Dados insuficientes' | 'Sem classificação'
/** Usa apenas dias lançados; dia ausente nunca vira zero. Janela incompleta (<7 lançamentos) = Dados insuficientes. */
export function classifyWindow(history: DailyEntry[], endDate: string): { cls: WindowClass; profitDays: number; lossDays: number; recorded: number } {
  const start = addDays(endDate, -6)
  const byDate = new Map<string, number>()
  for (const e of history) if (e.date >= start && e.date <= endDate) byDate.set(e.date, (byDate.get(e.date) ?? 0) + dayProfit(e))
  const vals = [...byDate.values()]
  const profitDays = vals.filter((v) => v > 0).length
  const lossDays = vals.filter((v) => v < 0).length
  const base = { profitDays, lossDays, recorded: vals.length }
  if (vals.length < 7) return { cls: 'Dados insuficientes', ...base }
  if (profitDays >= 5) return { cls: 'Vencedor', ...base }
  if (profitDays >= 3) return { cls: 'Lucrativo', ...base }
  if (lossDays > vals.length / 2) return { cls: 'Perdedor', ...base }
  return { cls: 'Sem classificação', ...base }
}

/* ---------- Validação comercial do produto ---------- */
/** Lucro em ao menos 3 dos 5 primeiros dias de operação (lucro do dia somado entre conjuntos). */
export function validateProduct(entries: DailyEntry[], startDate: string, current?: ValidationRecord): ValidationRecord {
  if (current?.validated) return current // histórico nunca é apagado
  const end = addDays(startDate, 4)
  const perDay = new Map<string, number>()
  for (const e of entries) if (e.date >= startDate && e.date <= end) perDay.set(e.date, (perDay.get(e.date) ?? 0) + dayProfit(e))
  const profitDates = [...perDay.entries()].filter(([, v]) => v > 0).map(([d]) => d).sort()
  if (profitDates.length >= 3) {
    return { validated: true, date: profitDates[2], evidence: `Lucro em ${profitDates.length} dos 5 primeiros dias (${profitDates.join(', ')})` }
  }
  return { validated: false }
}
export function validateManually(justification: string, date: string): ValidationRecord {
  if (!justification.trim()) throw new Error('Justificativa obrigatória')
  return { validated: true, date, evidence: justification.trim(), manual: true }
}

/** Produto só fica inativo quando nenhum conjunto segue ativo ou elegível. */
export function productShouldBeInactive(adSets: { paused: boolean }[]): boolean {
  return adSets.length > 0 && adSets.every((a) => a.paused)
}

/* ---------- Etapas e checklists ---------- */
export const ITEM_CHECKS: [string, string][] = [
  ['nome', 'Nome definido'], ['descricao', 'Descrição escrita'], ['logo', 'Logo no Drive'],
  ['capa', 'Capa no Drive'], ['arquivo', 'Entregável pronto'], ['hotmart', 'Cadastrado na Hotmart'],
]
export const CHECKOUT_CHECKS: [string, string][] = [
  ['bumps', 'Order bumps vinculados corretamente'], ['precos', 'Preços conferidos'],
  ['links', 'Links conferidos'], ['fluxo', 'Fluxo testado'],
]
export const PAGE_CHECKS: [string, string][] = [
  ['criada', 'Página criada'], ['dominio', 'Domínio e URL configurados'], ['checkout', 'Checkout conectado'],
  ['rastreamento', 'Rastreamento testado'], ['revisao', 'Revisão desktop e mobile'],
]

export function offerMissing(o: Offer): string[] {
  const out: string[] = []
  const names = { main: 'Produto principal', bump1: 'Order bump 01', bump2: 'Order bump 02' } as const
  for (const k of ['main', 'bump1', 'bump2'] as const) {
    if (!o[k].name.trim()) out.push(`${names[k]}: nome`)
    if (!o[k].hotmartUrl.trim()) out.push(`${names[k]}: link Hotmart`)
    for (const [c, l] of ITEM_CHECKS) if (!o[k].checks[c]) out.push(`${names[k]}: ${l}`)
  }
  if (!o.checkoutUrl.trim()) out.push('Checkout: link definitivo')
  for (const [c, l] of CHECKOUT_CHECKS) if (!o.checkoutChecks[c]) out.push(`Checkout: ${l}`)
  return out
}
export function trackingMissing(p: Product): string[] {
  const t = p.tracking, out: string[] = []
  if (!t.bmId) out.push('BM ou Portfólio')
  if (!t.accountId) out.push('Conta de anúncios')
  if (!t.pixelId.trim()) out.push('ID do Pixel')
  if (t.checkoutState !== 'configurado') out.push('Rastreamento configurado no checkout')
  return out
}
export function pageMissing(pg: PageInfo): string[] {
  const out: string[] = []
  if (!pg.domainId) out.push('Domínio')
  if (!pg.publicUrl.trim()) out.push('Link público da página')
  if (!pg.htmlSourceUrl.trim()) out.push('Link do HTML-fonte')
  if (!pg.version.trim()) out.push('Versão')
  if (!pg.deliverableSourceUrl.trim()) out.push('Arquivo-fonte do entregável')
  if (!pg.bump1SourceUrl.trim() || !pg.bump2SourceUrl.trim()) out.push('Arquivos-fonte dos order bumps')
  for (const [c, l] of PAGE_CHECKS) if (!pg.checks[c]) out.push(l)
  return out
}
export function creativesMissing(p: Product): string[] {
  const out: string[] = []
  if (!p.creativesOriginalUrl.trim()) out.push('Pasta dos criativos originais')
  if (!p.creativesProducedUrl.trim()) out.push('Pasta dos criativos produzidos')
  if (!p.creativesReady) out.push('Materiais preparados')
  return out // validação de criativo NÃO bloqueia a conclusão
}
/** Pendências para concluir uma etapa, incluindo a etapa anterior (sequência). */
export function stepMissing(p: Product, key: StepKey): string[] {
  const idx = STEPS.findIndex((s) => s.key === key)
  const out: string[] = []
  if (idx > 0 && !p.steps[STEPS[idx - 1].key]) out.push(`Conclua antes: ${STEPS[idx - 1].label}`)
  if (key === 'oferta') out.push(...offerMissing(p.offer))
  if (key === 'rastreamento') out.push(...trackingMissing(p))
  if (key === 'pagina') out.push(...pageMissing(p.page))
  if (key === 'criativos') out.push(...creativesMissing(p))
  return out
}
/** Apenas apelido do cartão: recusa sequências que parecem número de cartão. */
export function looksLikeCardNumber(s: string): boolean {
  return /\b(?:\d[ -]?){13,19}\b/.test(s)
}

/* ---------- Períodos ---------- */
export type Period = 'dia' | '7' | '30' | '90' | 'custom'
export interface Range { from: string; to: string }
export function periodRange(p: Period, today: string, custom?: Range): Range {
  if (p === 'custom') return custom ?? { from: today, to: today }
  if (p === 'dia') return { from: today, to: today }
  return { from: addDays(today, -(Number(p) - 1)), to: today }
}
export function daysBetween(r: Range): number {
  return Math.round((new Date(r.to + 'T00:00:00Z').getTime() - new Date(r.from + 'T00:00:00Z').getTime()) / 86400000) + 1
}
export function previousRange(r: Range): Range {
  const n = daysBetween(r)
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) }
}

/* ---------- Consolidado manual de 7 dias ---------- */
const splitInt = (total: number, n: number) => Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0))
const splitMoney = (total: number, n: number) => splitInt(Math.round(total * 100), n).map((c) => c / 100)
/** Divide o consolidado em 7 lançamentos diários que somam exatamente o total informado. */
export function splitWeekly(t: Totals, start: string): { date: string; spend: number; checkouts: number; sales: number; revenue: number }[] {
  const sp = splitMoney(t.spend, 7), ck = splitInt(t.checkouts, 7), sl = splitInt(t.sales, 7), rv = splitMoney(t.revenue, 7)
  return sp.map((_, i) => ({ date: addDays(start, i), spend: sp[i], checkouts: ck[i], sales: sl[i], revenue: rv[i] }))
}

/* ---------- Alertas operacionais ---------- */
export function entryAdvice(entry: DailyEntry, all: DailyEntry[]): Advice {
  const history = all.filter((e) => e.adSetId === entry.adSetId && e.date <= entry.date)
  const cls = classifyWindow(history, entry.date).cls
  return adviseDaily(entry, history, {
    creativeValidated: creativeValidated(history).validated,
    weeklyProfitable: cls === 'Lucrativo' || cls === 'Vencedor',
  })
}
export function operationalAlerts(products: Product[], adSets: AdSet[], entries: DailyEntry[]): { productId: Id; text: string }[] {
  const out: { productId: Id; text: string }[] = []
  for (const p of products) {
    for (const a of adSets.filter((x) => x.productId === p.id && !x.paused)) {
      const mine = entries.filter((e) => e.adSetId === a.id)
      if (!mine.length) continue
      const last = mine.reduce((x, y) => (y.date > x.date ? y : x))
      const adv = entryAdvice(last, entries)
      if (adv.action === 'PAUSAR' && !last.executed) out.push({ productId: p.id, text: `${p.name} / ${a.name}: recomendado pausar (${adv.reason})` })
      else for (const t of adv.alerts) out.push({ productId: p.id, text: `${p.name} / ${a.name}: ${t}` })
    }
    if (p.validation.validated && !p.validation.manual && p.validation.date && p.validation.date >= addDays(new Date().toISOString().slice(0, 10), -2))
      out.push({ productId: p.id, text: `${p.name}: 3º dia lucrativo atingido, produto validado` })
  }
  return out
}
