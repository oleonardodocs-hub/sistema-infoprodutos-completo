import { describe, expect, it } from 'vitest'
import {
  adviseDaily, classifyWindow, consecutiveNoSalesDays, consolidate, creativeValidated, domainFull, domainOccupancy,
  evaluateMining, fmtNum, linkProduct, metrics, productShouldBeInactive, unlinkProduct, validateManually, validateProduct,
} from './rules'
import type { DailyEntry, Domain } from './types'

const e = (date: string, o: Partial<DailyEntry> = {}): DailyEntry => ({
  id: date + (o.adSetId ?? 'a'), productId: 'p1', adSetId: 'a', date, spend: 20, checkouts: 1, sales: 1, revenue: 40, ...o,
})
const days = (n: number, f: (i: number) => Partial<DailyEntry>) =>
  Array.from({ length: n }, (_, i) => e(`2026-11-${String(i + 1).padStart(2, '0')}`, f(i)))

describe('mineração', () => {
  const base = { isLowTicket: true, activeAds: 1, daysRunning: 10, runsInDestination: 'pendente' as const }
  it('10 dias exatos aprova, 9 reprova', () => {
    expect(evaluateMining(base).status).toBe('Aprovado')
    expect(evaluateMining({ ...base, daysRunning: 9 }).status).toBe('Reprovado')
  })
  it('menos de 10 dias reprova mesmo com 4, 10 ou 20 anúncios', () => {
    for (const ads of [4, 10, 20]) expect(evaluateMining({ ...base, activeAds: ads, daysRunning: 9 }).status).toBe('Reprovado')
  })
  it('exige low ticket e 1 anúncio', () => {
    expect(evaluateMining({ ...base, isLowTicket: false }).status).toBe('Reprovado')
    expect(evaluateMining({ ...base, activeAds: 0 }).status).toBe('Reprovado')
  })
  it('força dos anúncios', () => {
    expect([1, 2, 3, 4, 9].map((n) => evaluateMining({ ...base, activeAds: n }).strength)).toEqual(
      ['Aceitável', 'Bom', 'Muito bom', 'Excelente', 'Excelente'])
  })
  it('país de destino não reprova', () => {
    expect(evaluateMining({ ...base, runsInDestination: 'sim' })).toMatchObject({ status: 'Aprovado', destination: 'Bom' })
    expect(evaluateMining({ ...base, runsInDestination: 'nao' }).destination).toBe('Excelente')
    expect(evaluateMining(base).destination).toBe('Pendente')
  })
})

describe('domínios', () => {
  const d: Domain = { id: 'd', host: 'x.com', productIds: ['1', '2', '3', '4', '5'] }
  it('5/5 bloqueia o sexto, repetir produto não conta, desvincular libera', () => {
    expect(domainFull(d)).toBe(true)
    expect(() => linkProduct(d, '6')).toThrow('Limite atingido')
    expect(domainOccupancy({ productIds: ['1', '1', '2'] })).toBe(2)
    expect(linkProduct(d, '5')).toBe(d)
    expect(domainFull(unlinkProduct(d, '5'))).toBe(false)
  })
})

describe('regra diária de R$ 50', () => {
  const ctx = { creativeValidated: false, weeklyProfitable: false }
  it('R$ 49,99 sem checkout mantém; R$ 50 sem checkout pausa', () => {
    expect(adviseDaily(e('2026-11-01', { spend: 49.99, checkouts: 0, sales: 0 }), [], ctx).action).toBe('MANTER')
    expect(adviseDaily(e('2026-11-01', { spend: 50, checkouts: 0, sales: 0 }), [], ctx).action).toBe('PAUSAR')
  })
  it('R$ 50 com checkout mantém até o fim do dia', () => {
    expect(adviseDaily(e('2026-11-01', { spend: 50, checkouts: 1 }), [], ctx).action).toBe('MANTER ATÉ O FIM DO DIA')
  })
  it('pausa por R$ 50 mesmo se vendeu em dias anteriores e histórico é lucrativo', () => {
    const hist = days(7, () => ({}))
    const today = e('2026-11-08', { spend: 50, checkouts: 0, sales: 0 })
    expect(adviseDaily(today, [...hist, today], { creativeValidated: true, weeklyProfitable: true }).action).toBe('PAUSAR')
  })
})

describe('tolerância de dias sem vendas', () => {
  const noSales = (n: number) => days(n, () => ({ sales: 0, revenue: 0, checkouts: 1 }))
  it('validado sem histórico lucrativo: pausa no 2º dia seguido', () => {
    const h = noSales(2)
    const r = adviseDaily(h[1], h, { creativeValidated: true, weeklyProfitable: false })
    expect(r.action).toBe('PAUSAR')
  })
  it('histórico lucrativo: alerta no 2º, pausa no 3º', () => {
    const h = noSales(3)
    const ctx = { creativeValidated: true, weeklyProfitable: true }
    const r2 = adviseDaily(h[1], h.slice(0, 2), ctx)
    expect(r2.action).toBe('MANTER'); expect(r2.alerts).toContain('2º dia sem vendas')
    expect(adviseDaily(h[2], h, ctx).action).toBe('PAUSAR')
  })
  it('dia não lançado interrompe a sequência', () => {
    const h = [e('2026-11-01', { sales: 0 }), e('2026-11-03', { sales: 0 })]
    expect(consecutiveNoSalesDays(h, '2026-11-03')).toBe(1)
  })
})

describe('criativo validado', () => {
  it('venda no dia 1 e no dia 2', () => {
    expect(creativeValidated([e('2026-11-01'), e('2026-11-02')]).validated).toBe(true)
    expect(creativeValidated([e('2026-11-01'), e('2026-11-02', { sales: 0 })]).validated).toBe(false)
    expect(creativeValidated([e('2026-11-01'), e('2026-11-03')]).validated).toBe(false)
    expect(creativeValidated([]).validated).toBe(false)
  })
})

describe('janela de 7 dias', () => {
  const win = (profits: number[]) => profits.map((p, i) => e(`2026-11-0${i + 1}`, { spend: 100, revenue: 100 + p }))
  it('classifica', () => {
    expect(classifyWindow(win([1, 1, 1, 1, 1, -1, -1]), '2026-11-07').cls).toBe('Vencedor')
    expect(classifyWindow(win([1, 1, 1, 1, -1, -1, -1]), '2026-11-07').cls).toBe('Lucrativo')
    expect(classifyWindow(win([1, 1, -1, -1, -1, -1, -1]), '2026-11-07').cls).toBe('Perdedor')
  })
  it('janela incompleta não inventa zeros', () => {
    expect(classifyWindow(win([1, 1, 1, 1, 1]), '2026-11-07').cls).toBe('Dados insuficientes')
  })
})

describe('validação do produto', () => {
  const run = (profits: number[]) => profits.map((p, i) => e(`2026-11-0${i + 1}`, { spend: 100, revenue: 100 + p }))
  it('3 de 5 dias validam; 2 de 5 não', () => {
    const ok = validateProduct(run([5, -5, 5, -5, 5]), '2026-11-01')
    expect(ok).toMatchObject({ validated: true, date: '2026-11-05' })
    expect(validateProduct(run([5, -5, 5, -5, -5]), '2026-11-01').validated).toBe(false)
  })
  it('venda isolada não valida; lucros após o 5º dia não contam', () => {
    expect(validateProduct(run([5, -5, -5, -5, -5, 5, 5, 5]), '2026-11-01').validated).toBe(false)
  })
  it('lucro do dia soma conjuntos', () => {
    const es = [e('2026-11-01', { spend: 100, revenue: 150 }), e('2026-11-01', { adSetId: 'b', spend: 100, revenue: 0 })]
    expect(validateProduct(es, '2026-11-01').validated).toBe(false)
  })
  it('histórico preservado e validação manual exige justificativa', () => {
    const v = { validated: true, date: '2026-10-01', evidence: 'x' }
    expect(validateProduct([], '2026-11-01', v)).toBe(v)
    expect(() => validateManually('  ', '2026-11-01')).toThrow()
    expect(validateManually('Operado antes do app', '2026-11-01').manual).toBe(true)
  })
  it('produto só inativa sem conjunto elegível', () => {
    expect(productShouldBeInactive([{ paused: true }, { paused: false }])).toBe(false)
    expect(productShouldBeInactive([{ paused: true }, { paused: true }])).toBe(true)
  })
})

describe('consolidação e métricas', () => {
  it('não duplica período nem soma fora da janela/produtos', () => {
    const a = e('2026-11-01'), dup = { ...a, id: 'outro' }
    const other = e('2026-11-01', { productId: 'p2' })
    const old = e('2026-10-01')
    const t = consolidate([a, dup, other, old], { productIds: ['p1'], from: '2026-11-01', to: '2026-11-07' })
    expect(t).toEqual({ spend: 20, checkouts: 1, sales: 1, revenue: 40 })
  })
  it('denominador zero vira —', () => {
    const m = metrics({ spend: 0, checkouts: 0, sales: 0, revenue: 0 })
    expect([m.margin, m.roi, m.roas, m.cpa].map((v) => fmtNum(v))).toEqual(['—', '—', '—', '—'])
  })
  it('cálculos corretos sem subtrair taxas de novo', () => {
    const m = metrics({ spend: 100, checkouts: 5, sales: 2, revenue: 150 })
    expect(m.profit).toBe(50); expect(m.margin).toBeCloseTo(33.33, 1); expect(m.roi).toBe(50); expect(m.roas).toBe(1.5); expect(m.cpa).toBe(50)
  })
})
