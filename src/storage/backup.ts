import { TABLES, type Repository, type Snapshot } from './repository'
import { sha256Hex } from './crypto'

export const SCHEMA_VERSION = 2
export interface BackupFile { app: 'sistema-infoprodutos'; schemaVersion: number; exportedAt: string; checksum: string; data: Snapshot }

export async function createBackup(repo: Repository): Promise<BackupFile> {
  const data = await repo.snapshot() // 'secrets' contém apenas texto cifrado
  return { app: 'sistema-infoprodutos', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), checksum: await sha256Hex(JSON.stringify(data)), data }
}

export async function parseBackup(text: string): Promise<BackupFile> {
  let f: BackupFile
  try { f = JSON.parse(text) } catch { throw new Error('Arquivo inválido: não é JSON') }
  if (f?.app !== 'sistema-infoprodutos') throw new Error('Arquivo não pertence a este sistema')
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion > SCHEMA_VERSION) throw new Error('Versão de esquema não suportada')
  if (!f.data) throw new Error('Backup sem dados')
  if ((await sha256Hex(JSON.stringify(f.data))) !== f.checksum) throw new Error('Falha de integridade: o arquivo foi alterado ou está corrompido')
  for (const t of TABLES) {
    if ((f.data as Record<string, unknown>)[t] === undefined && f.schemaVersion < SCHEMA_VERSION) (f.data as Record<string, unknown>)[t] = []
    const rows = (f.data as Record<string, unknown>)[t]
    if (!Array.isArray(rows) || rows.some((r) => typeof (r as { id?: unknown })?.id !== 'string')) throw new Error(`Tabela inválida: ${t}`)
  }
  const blob = JSON.stringify(f.data)
  if (/"(metaToken|utmifyToken|capiToken)"\s*:\s*"[^"]/.test(blob)) throw new Error('Backup contém token em texto puro e foi recusado')
  return f
}

export async function restoreBackup(repo: Repository, text: string): Promise<BackupFile> {
  const f = await parseBackup(text)
  await repo.replaceAll(f.data)
  await repo.setMeta('lastRestoreAt', new Date().toISOString())
  return f
}
export async function markBackupDone(repo: Repository) { await repo.setMeta('lastBackupAt', new Date().toISOString()) }
export const BACKUP_MAX_DAYS = 7
export function backupOverdue(lastIso: string | undefined, now = new Date(), maxDays = BACKUP_MAX_DAYS): boolean {
  if (!lastIso) return true
  return (now.getTime() - new Date(lastIso).getTime()) / 86400000 > maxDays
}
