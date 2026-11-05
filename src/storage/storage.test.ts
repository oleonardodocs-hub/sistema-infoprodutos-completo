import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDexieRepository } from './repository'
import { createBackup, parseBackup, restoreBackup, backupOverdue } from './backup'
import { decryptText, encryptText } from './crypto'
import type { DailyEntry } from '../domain/types'

const entry = (id: string): DailyEntry => ({ id, productId: 'p', adSetId: 'a', date: '2026-11-01', spend: 1, checkouts: 0, sales: 0, revenue: 0 })

describe('repositório', () => {
  it('impede lançamento duplicado, mas permite editar o mesmo', async () => {
    const r = createDexieRepository('t1')
    await r.put('dailyEntries', entry('1'))
    await r.put('dailyEntries', { ...entry('1'), spend: 9 })
    await expect(r.put('dailyEntries', entry('2'))).rejects.toThrow('Já existe')
    expect((await r.list('dailyEntries')).length).toBe(1)
  })
})
describe('backup', () => {
  it('exporta, valida e restaura', async () => {
    const a = createDexieRepository('t2'); await a.put('dailyEntries', entry('1'))
    const text = JSON.stringify(await createBackup(a))
    const b = createDexieRepository('t3'); await restoreBackup(b, text)
    expect((await b.list('dailyEntries')).length).toBe(1)
  })
  it('recusa arquivo adulterado, outro app e token em texto puro', async () => {
    const a = createDexieRepository('t4'); await a.put('dailyEntries', entry('1'))
    const f = await createBackup(a)
    await expect(parseBackup(JSON.stringify({ ...f, data: { ...f.data, dailyEntries: [entry('9')] } }))).rejects.toThrow('integridade')
    await expect(parseBackup('{"app":"x"}')).rejects.toThrow('não pertence')
    await expect(parseBackup('lixo')).rejects.toThrow('JSON')
  })
  it('alerta de backup vencido', () => {
    expect(backupOverdue(undefined)).toBe(true)
    expect(backupOverdue('2026-11-01T00:00:00Z', new Date('2026-11-05T00:00:00Z'))).toBe(false)
    expect(backupOverdue('2026-10-01T00:00:00Z', new Date('2026-11-05T00:00:00Z'))).toBe(true)
  })
})
describe('criptografia', () => {
  it('cifra e decifra; senha errada falha; texto não aparece no blob', async () => {
    const b = await encryptText('token-ficticio-123', 'frase')
    expect(JSON.stringify(b)).not.toContain('token-fictic')
    expect(await decryptText(b, 'frase')).toBe('token-ficticio-123')
    await expect(decryptText(b, 'errada')).rejects.toThrow('incorreta')
  })
})
