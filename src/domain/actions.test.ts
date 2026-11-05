import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDexieRepository } from '../storage/repository'
import { applyDecision, importWeekly, saveDailyEntry, setProductDomain } from './actions'
import { newProduct } from './factory'
import {
  consolidate, creativesMissing, daysBetween, looksLikeCardNumber, offerMissing, operationalAlerts, pageMissing, periodRange,
  previousRange, splitWeekly, stepMissing,
} from './rules'
import type { AdSet, DailyEntry } from './types'

let n = 0
const fresh = () => createDexieRepository('act' + n++)
const adSet = (id: string, productId: string): AdSet => ({ id, productId, name: id, creativeUrl: '', paused: false, createdAt: '' })
const entry = (id: string, productId: string, adSetId: string, date: string, o: Partial<DailyEntry> = {}): DailyEntry =>
  ({ id, productId, adSetId, date, spend: 10, checkouts: 1, sales: 1, revenue: 30, ...o })

describe('lançamentos e produto', () => {
  it('R$ 50 sem checkout gera recomendação PAUSAR e decisão manual inativa só sem conjunto elegível', async () => {
    const r = fresh(); const p = newProduct({ name: 'P' })
    await r.put('products', p); await r.put('adSets', adSet('a', p.id)); await r.put('adSets', adSet('b', p.id))
    const adv = await saveDailyEntry(r, entry('e1', p.id, 'a', '2026-11-01', { spend: 50, checkouts: 0, sales: 0, revenue: 0 }))
    expect(adv.action).toBe('PAUSAR')
    await applyDecision(r, 'e1', 'pausou', 'regra R$ 50')
    expect((await r.list('products'))[0].operationalStatus).not.toBe('Inativo')
    await saveDailyEntry(r, entry('e2', p.id, 'b', '2026-11-01', { spend: 50, checkouts: 0, sales: 0 }))
    await applyDecision(r, 'e2', 'pausou', 'regra R$ 50')
    expect((await r.list('products'))[0].operationalStatus).toBe('Inativo')
  })
  it('valida produto com 3 dias lucrativos nos 5 primeiros e preserva histórico ao inativar', async () => {
    const r = fresh(); const p = newProduct({ name: 'P' })
    await r.put('products', p); await r.put('adSets', adSet('a', p.id))
    for (let i = 1; i <= 3; i++) await saveDailyEntry(r, entry('e' + i, p.id, 'a', `2026-11-0${i}`))
    let prod = (await r.list('products'))[0]
    expect(prod.validation.validated).toBe(true); expect(prod.validation.date).toBe('2026-11-03'); expect(prod.steps.analise).toBe(true)
    await applyDecision(r, 'e3', 'pausou', 'fim do teste')
    prod = (await r.list('products'))[0]
    expect(prod.operationalStatus).toBe('Inativo'); expect(prod.validation.validated).toBe(true)
  })
  it('lançamento duplicado é recusado', async () => {
    const r = fresh(); const p = newProduct({ name: 'P' }); await r.put('products', p)
    await saveDailyEntry(r, entry('e1', p.id, 'a', '2026-11-01'))
    await expect(saveDailyEntry(r, entry('e2', p.id, 'a', '2026-11-01'))).rejects.toThrow('Já existe')
  })
})

describe('consolidado de 7 dias', () => {
  it('divide preservando totais exatos', () => {
    const parts = splitWeekly({ spend: 100, checkouts: 10, sales: 3, revenue: 333.33 }, '2026-11-01')
    expect(parts).toHaveLength(7); expect(parts[6].date).toBe('2026-11-07')
    const t = parts.reduce((a, x) => ({ spend: a.spend + x.spend, checkouts: a.checkouts + x.checkouts, sales: a.sales + x.sales, revenue: a.revenue + x.revenue }), { spend: 0, checkouts: 0, sales: 0, revenue: 0 })
    expect(t.spend).toBeCloseTo(100, 2); expect(t.checkouts).toBe(10); expect(t.sales).toBe(3); expect(t.revenue).toBeCloseTo(333.33, 2)
  })
  it('não soma consolidado e diário do mesmo período', async () => {
    const r = fresh(); const p = newProduct({ name: 'P' }); await r.put('products', p)
    await saveDailyEntry(r, entry('e1', p.id, 'a', '2026-11-02'))
    await expect(importWeekly(r, p.id, 'a', '2026-11-01', { spend: 70, checkouts: 7, sales: 7, revenue: 140 }, false)).rejects.toThrow('substituição')
    await importWeekly(r, p.id, 'a', '2026-11-01', { spend: 70, checkouts: 7, sales: 7, revenue: 140 }, true)
    const t = consolidate(await r.list('dailyEntries'), { productIds: [p.id] })
    expect(t.spend).toBeCloseTo(70, 2); expect(t.revenue).toBeCloseTo(140, 2)
  })
})

describe('domínio', () => {
  it('6º produto bloqueado, transferência libera vaga', async () => {
    const r = fresh()
    await r.put('domains', { id: 'd1', host: 'a.com', productIds: ['1', '2', '3', '4', '5'] }); await r.put('domains', { id: 'd2', host: 'b.com', productIds: [] })
    await expect(setProductDomain(r, '6', 'd1')).rejects.toThrow('Limite atingido')
    await setProductDomain(r, '5', 'd2')
    expect((await r.list('domains')).find((d) => d.id === 'd1')!.productIds).toHaveLength(4)
    await setProductDomain(r, '6', 'd1')
    expect((await r.list('domains')).find((d) => d.id === 'd1')!.productIds).toContain('6')
  })
})

describe('etapas e checklists', () => {
  it('oferta só conclui com tudo marcado; sequência exige etapa anterior', () => {
    const p = newProduct({ name: 'P' })
    expect(offerMissing(p.offer).length).toBeGreaterThan(10)
    expect(stepMissing(p, 'rastreamento')[0]).toContain('Conclua antes')
    expect(creativesMissing(p)).toHaveLength(3)
    expect(pageMissing(p.page).length).toBeGreaterThan(5)
    for (const k of ['main', 'bump1', 'bump2'] as const) {
      Object.assign(p.offer[k], { name: 'x', hotmartUrl: 'u' }); p.offer[k].checks = { nome: true, descricao: true, logo: true, capa: true, arquivo: true, hotmart: true }
    }
    p.offer.checkoutUrl = 'u'; p.offer.checkoutChecks = { bumps: true, precos: true, links: true, fluxo: true }
    expect(offerMissing(p.offer)).toEqual([])
    expect(stepMissing(p, 'oferta')).toEqual([])
  })
  it('preços padrão em euro', () => {
    const o = newProduct({ name: 'P' }).offer
    expect([o.main.priceEUR, o.bump1.priceEUR, o.bump2.priceEUR]).toEqual([27, 7.9, 14.9])
  })
  it('cartão: recusa número, aceita apelido', () => {
    expect(looksLikeCardNumber('4111 1111 1111 1111')).toBe(true)
    expect(looksLikeCardNumber('Nubank PJ final azul')).toBe(false)
  })
})

describe('períodos e alertas', () => {
  it('janelas', () => {
    expect(periodRange('7', '2026-11-07')).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(periodRange('dia', '2026-11-07')).toEqual({ from: '2026-11-07', to: '2026-11-07' })
    expect(daysBetween(periodRange('30', '2026-11-30'))).toBe(30)
    expect(previousRange({ from: '2026-11-08', to: '2026-11-14' })).toEqual({ from: '2026-11-01', to: '2026-11-07' })
  })
  it('alerta de R$ 50 sem checkout some após decisão executada', () => {
    const p = newProduct({ name: 'P' }); const a = adSet('a', p.id)
    const e = entry('e', p.id, 'a', '2026-11-01', { spend: 50, checkouts: 0, sales: 0, revenue: 0 })
    expect(operationalAlerts([p], [a], [e])[0].text).toContain('pausar')
    expect(operationalAlerts([p], [a], [{ ...e, executed: 'pausou' }]).some((x) => x.text.includes('recomendado pausar'))).toBe(false)
  })
})

describe('dados fictícios', () => {
  it('carrega e remove sem deixar resíduo e sem tocar em dados reais', async () => {
    const { loadDemo, removeDemo } = await import('./demo')
    const r = fresh(); const real = newProduct({ name: 'Real' }); await r.put('products', real)
    await loadDemo(r)
    expect((await r.list('products')).length).toBe(3)
    await removeDemo(r)
    expect((await r.list('products')).map((p) => p.name)).toEqual(['Real'])
    expect(await r.list('dailyEntries')).toHaveLength(0); expect(await r.list('domains')).toHaveLength(0)
  })
})
