import { useRef, useState } from 'react'
import { backupOverdue, createBackup, markBackupDone, restoreBackup } from '../storage/backup'
import { loadDemo, removeDemo } from '../domain/demo'
import { useData } from './data'

export function Backups() {
  const { repo, refresh, lastBackupAt } = useData()
  const [msg, setMsg] = useState(''); const file = useRef<HTMLInputElement>(null)

  async function exportJson() {
    const b = await createBackup(repo)
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `infoprodutos-${b.exportedAt.slice(0, 10)}.backup.json`; a.click()
    URL.revokeObjectURL(url); await markBackupDone(repo); await refresh(); setMsg('Backup exportado. Guarde o arquivo em um repositório privado.')
  }
  async function importJson(f: File) {
    if (!window.confirm('Restaurar substitui TODOS os dados atuais pelos do arquivo. Continuar?')) return
    try { const b = await restoreBackup(repo, await f.text()); await refresh(); setMsg(`Restaurado. Backup de ${new Date(b.exportedAt).toLocaleString('pt-BR')}.`) }
    catch (e) { setMsg('Erro: ' + (e as Error).message) }
  }
  return (
    <>
      <header className="top"><h1>Backups e configurações</h1></header>
      <section className="card">
        <p className={backupOverdue(lastBackupAt) ? 'verdict reprovado' : 'muted'}>
          Último backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString('pt-BR') : 'nunca'}{backupOverdue(lastBackupAt) && ' (faça um backup agora)'}
        </p>
        <div className="row">
          <button className="btn" onClick={exportJson}>Exportar backup</button>
          <button className="btn ghost" onClick={() => file.current?.click()}>Importar backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '' }} />
        </div>
        {msg && <p>{msg}</p>}
      </section>
      <section className="card">
        <h2>Dados de exemplo (fictícios)</h2>
        <p className="muted">Servem só para testar. Todos levam o rótulo FICTÍCIO e podem ser removidos sem afetar seus dados reais.</p>
        <div className="row">
          <button className="btn ghost" onClick={async () => { await loadDemo(repo); await refresh(); setMsg('Exemplos fictícios carregados.') }}>Carregar exemplos</button>
          <button className="btn ghost" onClick={async () => { if (window.confirm('Remover todos os dados de exemplo?')) { await removeDemo(repo); await refresh(); setMsg('Exemplos removidos.') } }}>Remover exemplos</button>
        </div>
      </section>
      <section className="card">
        <h2>Limites desta versão</h2>
        <ul>
          <li>O GitHub Pages não oferece banco de dados na nuvem. Os dados ficam neste navegador.</li>
          <li>Os dados não sincronizam entre dispositivos.</li>
          <li>Limpar os dados do navegador apaga os registros se não houver backup.</li>
          <li>A interface publicada pode ser pública. Nenhum dado seu vai no código nem no repositório.</li>
          <li>Tokens são cifrados com sua frase-senha, que não é gravada. O backup leva apenas o texto cifrado. Sem a frase-senha eles não podem ser recuperados.</li>
        </ul>
      </section>
    </>
  )
}
