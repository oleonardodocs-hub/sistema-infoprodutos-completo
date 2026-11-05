import { useState } from 'react'
import { creativeValidated } from '../domain/rules'
import { newId } from '../domain/factory'
import type { Creative, CreativeStatus, Product } from '../domain/types'
import { CopyOpen, NoProduct, PageHead, ProductSelect, SaveBar, StepBar, TextField, UrlField, confirmDelete, today, useDraft } from './common'
import { useData } from './data'

const STATUS: CreativeStatus[] = ['Em teste', 'Validado', 'Não validado', 'Pausado']

export function Creatives() {
  const { selected } = useData()
  return <><PageHead title="Criativos"><ProductSelect /></PageHead>{selected ? <Form key={selected.id} p={selected} /> : <NoProduct />}</>
}
function Form({ p }: { p: Product }) {
  const { repo, data, refresh } = useData()
  const [d, setD, dirty] = useDraft(p)
  const [msg, setMsg] = useState('')
  const [c, setC] = useState<Creative | null>(null)
  const list = data.creatives.filter((x) => x.productId === p.id).sort((a, b) => b.date.localeCompare(a.date))
  const sets = data.adSets.filter((a) => a.productId === p.id)
  const blank = (): Creative => ({ id: newId(), productId: p.id, name: '', url: '', date: today(), status: 'Em teste', notes: '' })
  return (
    <>
      <StepBar stepKey="criativos" dirty={dirty} />
      <section className="card">
        <div className="grid">
          <UrlField label="Pasta Drive dos criativos originais (referência)" value={d.creativesOriginalUrl} onChange={(v) => setD((x) => ({ ...x, creativesOriginalUrl: v }))} />
          <UrlField label="Pasta Drive dos criativos produzidos (idioma do destino)" value={d.creativesProducedUrl} onChange={(v) => setD((x) => ({ ...x, creativesProducedUrl: v }))} />
        </div>
        <div className="row checks"><label><input type="checkbox" checked={d.creativesReady} onChange={(e) => setD((x) => ({ ...x, creativesReady: e.target.checked }))} /> Materiais preparados</label></div>
        <p className="muted">A validação dos criativos acontece depois e não bloqueia a conclusão desta etapa.</p>
        <SaveBar dirty={dirty} msg={msg} onSave={async () => { await repo.put('products', d); await refresh(); setMsg('Salvo.') }} />
      </section>
      <section className="card">
        <div className="top"><h2>Criativos individuais</h2><button className="btn sm" onClick={() => setC(blank())}>Adicionar criativo</button></div>
        {c && (
          <div className="card form">
            <div className="grid">
              <TextField label="Identificação" value={c.name} onChange={(v) => setC({ ...c, name: v })} />
              <UrlField label="Link" value={c.url} onChange={(v) => setC({ ...c, url: v })} />
              <TextField label="Data" type="date" value={c.date} onChange={(v) => setC({ ...c, date: v })} />
              <label className="field"><span>Status</span><select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as CreativeStatus })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="field"><span>Conjunto de anúncios vinculado</span><select value={c.adSetId ?? ''} onChange={(e) => setC({ ...c, adSetId: e.target.value || undefined })}><option value="">Nenhum</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            </div>
            <TextField label="Observações (opcional)" value={c.notes} onChange={(v) => setC({ ...c, notes: v })} />
            <div className="row"><button className="btn sm" disabled={!c.name.trim()} onClick={async () => { await repo.put('creatives', c); setC(null); await refresh() }}>Salvar criativo</button><button className="btn ghost sm" onClick={() => setC(null)}>Cancelar</button></div>
          </div>)}
        {list.length === 0 ? <p className="muted">Nenhum criativo individual registrado.</p> : (
          <div className="scroll"><table><thead><tr><th>Criativo</th><th>Data</th><th>Status</th><th>Sugestão automática</th><th>Link</th><th /></tr></thead><tbody>
            {list.map((x) => {
              const auto = x.adSetId ? creativeValidated(data.dailyEntries.filter((e) => e.adSetId === x.adSetId)).validated : false
              return (<tr key={x.id}><td>{x.name}</td><td>{x.date}</td><td><span className="chip">{x.status}</span></td>
                <td>{auto && x.status !== 'Validado' ? <button className="link" onClick={async () => { await repo.put('creatives', { ...x, status: 'Validado' }); await refresh() }}>Vendas nos 2 primeiros dias: marcar Validado</button> : auto ? 'Validado pelas vendas' : '—'}</td>
                <td><CopyOpen url={x.url} /></td>
                <td className="row"><button className="link" onClick={() => setC(x)}>Editar</button><button className="link danger" onClick={async () => { if (confirmDelete('este criativo')) { await repo.remove('creatives', x.id); await refresh() } }}>Excluir</button></td></tr>)
            })}</tbody></table></div>)}
      </section>
    </>
  )
}
