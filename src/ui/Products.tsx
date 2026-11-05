import { useState } from 'react'
import { newProduct } from '../domain/factory'
import { validateManually } from '../domain/rules'
import { STEPS, type OperationalStatus, type Product } from '../domain/types'
import { PageHead, SaveBar, TextField, confirmDelete, today, useDraft } from './common'
import { useData } from './data'

const STATUS: OperationalStatus[] = ['Em produção', 'Em validação', 'Ativo', 'Inativo']
const GO: Record<string, string> = { oferta: 'offer', rastreamento: 'tracking', pagina: 'domains', criativos: 'creatives', analise: 'analysis' }

export function Products({ go }: { go: (p: string) => void }) {
  const { data } = useData()
  return (
    <>
      <PageHead title="Produtos e produção" />
      {data.products.length === 0 && <section className="card"><p className="muted">Nenhum produto. Aprove um item na Mineração e clique em Iniciar produção.</p></section>}
      {data.products.map((p) => <Card key={p.id} p={p} go={go} />)}
    </>
  )
}

function Card({ p, go }: { p: Product; go: (p: string) => void }) {
  const { repo, data, refresh, setSelectedId } = useData()
  const [d, setD, dirty] = useDraft(p)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const done = STEPS.filter((s) => p.steps[s.key]).length
  const origin = data.miningItems.find((m) => m.id === p.miningId)
  const source = data.products.find((x) => x.id === p.sourceProductId)
  const up = <K extends keyof Product>(k: K, v: Product[K]) => setD((x) => ({ ...x, [k]: v }))

  async function duplicate() {
    const country = window.prompt('País do novo produto', ''); if (country === null) return
    const language = window.prompt('Idioma do novo produto', ''); if (language === null) return
    // registro independente: sem vendas, validação, campanhas, checkout ou checklist do original; mantém só os links-fonte
    const copy = newProduct({
      name: `${p.name} (${country || 'novo'})`, country, language, miningId: p.miningId, sourceProductId: p.id,
      page: { ...newProduct({ name: '' }).page, htmlSourceUrl: p.page.htmlSourceUrl, version: p.page.version, deliverableSourceUrl: p.page.deliverableSourceUrl, bump1SourceUrl: p.page.bump1SourceUrl, bump2SourceUrl: p.page.bump2SourceUrl, originalLanguage: p.page.originalLanguage || p.language, destCountry: country },
      creativesOriginalUrl: p.creativesOriginalUrl,
    })
    await repo.put('products', copy); await refresh()
  }
  async function remove() {
    if (!confirmDelete(`o produto "${p.name}" e todos os seus lançamentos, conjuntos e criativos`)) return
    for (const e of data.dailyEntries.filter((e) => e.productId === p.id)) await repo.remove('dailyEntries', e.id)
    for (const a of data.adSets.filter((a) => a.productId === p.id)) await repo.remove('adSets', a.id)
    for (const c of data.creatives.filter((c) => c.productId === p.id)) await repo.remove('creatives', c.id)
    for (const s of data.secrets.filter((s) => s.id.startsWith(p.id + ':'))) await repo.remove('secrets', s.id)
    for (const dm of data.domains.filter((x) => x.productIds.includes(p.id))) await repo.put('domains', { ...dm, productIds: dm.productIds.filter((x) => x !== p.id) })
    for (const m of data.miningItems.filter((m) => m.productId === p.id)) await repo.put('miningItems', { ...m, productId: undefined })
    await repo.remove('products', p.id); await refresh()
  }
  async function manual() {
    const why = window.prompt('Justificativa da validação manual (obrigatória)'); if (why === null) return
    try { setErr(''); await repo.put('products', { ...p, validation: validateManually(why, today()) }); await refresh() } catch (e) { setErr((e as Error).message) }
  }
  return (
    <section className="card">
      <div className="grid">
        <TextField label="Nome" value={d.name} onChange={(v) => up('name', v)} />
        <TextField label="País" value={d.country} onChange={(v) => up('country', v)} />
        <TextField label="Idioma" value={d.language} onChange={(v) => up('language', v)} />
        <TextField label="Nome da campanha" value={d.campaignName} onChange={(v) => up('campaignName', v)} />
        <label className="field"><span>Status operacional</span><select value={d.operationalStatus} onChange={(e) => up('operationalStatus', e.target.value as OperationalStatus)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <TextField label="Primeiro dia de operação" type="date" value={d.startedAt ?? ''} onChange={(v) => up('startedAt', v || undefined)} />
      </div>
      <SaveBar dirty={dirty} msg={msg} onSave={async () => { await repo.put('products', d); await refresh(); setMsg('Salvo.') }} />
      <div className="bar2"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      <div className="row">{STEPS.map((s) => (
        <button key={s.key} className={'chip btnchip ' + (p.steps[s.key] ? 'aprovado' : '')} onClick={() => { setSelectedId(p.id); go(GO[s.key]) }}>{p.steps[s.key] ? 'Concluída' : 'Pendente'}: {s.label}</button>))}
        <span className="muted">{done}/{STEPS.length}</span></div>
      <div className="row">
        <span className={'chip ' + (p.validation.validated ? 'aprovado' : '')}>{p.validation.validated ? `Validado em ${p.validation.date}` : 'Em validação'}</span>
        {p.validation.evidence && <span className="muted">{p.validation.evidence}{p.validation.manual ? ' (manual)' : ''}</span>}
        {origin && <span className="muted">Origem: mineração de {origin.foundAt}</span>}
        {source && <span className="muted">Duplicado de: {source.name}</span>}
      </div>
      {err && <p className="verdict reprovado">{err}</p>}
      <div className="row">
        {!p.validation.validated && <button className="btn ghost sm" onClick={manual}>Validar manualmente</button>}
        <button className="btn ghost sm" onClick={duplicate}>Duplicar para outro país ou idioma</button>
        <button className="link danger" onClick={remove}>Excluir</button>
      </div>
    </section>
  )
}
