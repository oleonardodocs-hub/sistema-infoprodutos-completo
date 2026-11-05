import { useState } from 'react'
import { evaluateMining } from '../domain/rules'
import { type MiningItem } from '../domain/types'
import { newId, newProduct } from '../domain/factory'
import { useData } from './data'
import { CopyOpen, Field, confirmDelete, today } from './common'

const blank = (): MiningItem => ({
  id: newId(), foundAt: today(), originalUrl: '', audience: '', ticketBRL: 0, activeAds: 0, daysRunning: 0, adLibraryUrl: '',
  destCountry: '', isVisual: false, isNiche: false, isLowTicket: false, runsInDestination: 'pendente', createdAt: new Date().toISOString(),
})

export function Mining({ go }: { go: (p: string) => void }) {
  const { repo, data, refresh } = useData()
  const [form, setForm] = useState<MiningItem | null>(null)
  const [q, setQ] = useState(''); const [filter, setFilter] = useState('todos')
  const set = <K extends keyof MiningItem>(k: K, v: MiningItem[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const ev = form ? evaluateMining(form) : null

  const rows = data.miningItems
    .map((i) => ({ i, e: evaluateMining(i) }))
    .filter(({ i, e }) => (filter === 'todos' || e.status.toLowerCase() === filter) &&
      (i.audience + i.destCountry + i.originalUrl).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.i.foundAt.localeCompare(a.i.foundAt))

  async function save() {
    if (!form) return
    await repo.put('miningItems', form); setForm(null); await refresh()
  }
  async function startProduction(i: MiningItem) {
    const p = newProduct({ name: i.audience || 'Novo produto', country: i.destCountry, miningId: i.id })
    await repo.put('products', p); await repo.put('miningItems', { ...i, productId: p.id }); await refresh(); go('products')
  }

  return (
    <>
      <header className="top"><h1>Mineração</h1><button className="btn" onClick={() => setForm(blank())}>Novo item</button></header>
      {form && (
        <section className="card form">
          <div className="grid">
            <Field label="Data em que encontrou"><input type="date" value={form.foundAt} onChange={(e) => set('foundAt', e.target.value)} /></Field>
            <Field label="Link da página de vendas original BR"><input value={form.originalUrl} onChange={(e) => set('originalUrl', e.target.value)} /></Field>
            <Field label="Público ou profissão"><input value={form.audience} onChange={(e) => set('audience', e.target.value)} /></Field>
            <Field label="Ticket (R$)"><input type="number" min={0} step="0.01" value={form.ticketBRL} onChange={(e) => set('ticketBRL', +e.target.value)} /></Field>
            <Field label="Anúncios ativos"><input type="number" min={0} value={form.activeAds} onChange={(e) => set('activeAds', Math.max(0, +e.target.value))} /></Field>
            <Field label="Dias rodando"><input type="number" min={0} value={form.daysRunning} onChange={(e) => set('daysRunning', Math.max(0, +e.target.value))} /></Field>
            <Field label="Link da Biblioteca de Anúncios"><input value={form.adLibraryUrl} onChange={(e) => set('adLibraryUrl', e.target.value)} /></Field>
            <Field label="País de destino"><input value={form.destCountry} onChange={(e) => set('destCountry', e.target.value)} /></Field>
            <Field label="Já roda no destino?">
              <select value={form.runsInDestination} onChange={(e) => set('runsInDestination', e.target.value as MiningItem['runsInDestination'])}>
                <option value="pendente">Não pesquisado</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </Field>
          </div>
          <div className="row checks">
            <label><input type="checkbox" checked={form.isVisual} onChange={(e) => set('isVisual', e.target.checked)} /> É visual</label>
            <label><input type="checkbox" checked={form.isNiche} onChange={(e) => set('isNiche', e.target.checked)} /> É nichado</label>
            <label><input type="checkbox" checked={form.isLowTicket} onChange={(e) => set('isLowTicket', e.target.checked)} /> É low ticket</label>
          </div>
          {ev && (
            <p className={'verdict ' + ev.status.toLowerCase()}>
              <b>{ev.status}</b>{ev.strength && ` · anúncios: ${ev.strength}`} · destino: {ev.destination}
              {ev.reasons.length > 0 && ` · ${ev.reasons.join('; ')}`}
            </p>
          )}
          <div className="row"><button className="btn" onClick={save}>Salvar</button><button className="btn ghost" onClick={() => setForm(null)}>Cancelar</button></div>
        </section>
      )}
      <section className="card">
        <div className="row filters">
          <input placeholder="Buscar por público, país ou link" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todos">Todos</option><option value="aprovado">Aprovados</option><option value="reprovado">Reprovados</option>
          </select>
        </div>
        {rows.length === 0 ? <p className="muted">Nenhum item. Clique em Novo item para cadastrar o primeiro.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Encontrado</th><th>Público</th><th>Destino</th><th>Ticket</th><th>Anúncios</th><th>Dias</th><th>Status</th><th>Força</th><th>Pesquisa destino</th><th>Links</th><th /></tr></thead>
            <tbody>{rows.map(({ i, e }) => (
              <tr key={i.id}>
                <td>{i.foundAt.split('-').reverse().join('/')}</td><td>{i.audience}</td><td>{i.destCountry}</td>
                <td>R$ {i.ticketBRL.toFixed(2)}</td><td>{i.activeAds}</td><td>{i.daysRunning}</td>
                <td><span className={'chip ' + e.status.toLowerCase()} title={e.reasons.join('; ')}>{e.status}</span></td>
                <td>{e.strength ?? '—'}</td><td>{e.destination}</td>
                <td><CopyOpen url={i.originalUrl} /> <CopyOpen url={i.adLibraryUrl} /></td>
                <td className="row">
                  {e.status === 'Aprovado' && !i.productId && <button className="btn sm" onClick={() => startProduction(i)}>Iniciar produção</button>}
                  {i.productId && <span className="chip">Em produção</span>}
                  <button className="link" onClick={() => setForm(i)}>Editar</button>
                  <button className="link danger" onClick={async () => { if (confirmDelete('este item de mineração')) { await repo.remove('miningItems', i.id); await refresh() } }}>Excluir</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
