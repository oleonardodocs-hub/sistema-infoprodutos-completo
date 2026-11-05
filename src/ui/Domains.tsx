import { useState } from 'react'
import { setProductDomain } from '../domain/actions'
import { newId } from '../domain/factory'
import { DOMAIN_LIMIT, PAGE_CHECKS, domainFull, domainOccupancy } from '../domain/rules'
import type { Product } from '../domain/types'
import { Checks, Field, NoProduct, PageHead, ProductSelect, SaveBar, StepBar, TextField, UrlField, confirmDelete, useDraft } from './common'
import { useData } from './data'

export function Domains() {
  const { repo, data, refresh, selected } = useData()
  const [host, setHost] = useState('')
  return (
    <>
      <PageHead title="Domínios e páginas" />
      <section className="card">
        <h2>Domínios</h2>
        <div className="row"><input placeholder="exemplo.com" value={host} onChange={(e) => setHost(e.target.value)} />
          <button className="btn sm" disabled={!host.trim()} onClick={async () => { await repo.put('domains', { id: newId(), host: host.trim(), productIds: [] }); setHost(''); await refresh() }}>Adicionar domínio</button></div>
        {data.domains.length === 0 && <p className="muted">Nenhum domínio cadastrado.</p>}
        {data.domains.map((d) => {
          const n = domainOccupancy(d)
          return (
            <div key={d.id} className="dom">
              <div className="row"><b>{d.host}</b><span className={'chip ' + (domainFull(d) ? 'reprovado' : '')}>{n}/{DOMAIN_LIMIT}</span>{domainFull(d) && <b className="danger">Limite atingido</b>}
                <button className="link danger" onClick={async () => { if (confirmDelete(`o domínio ${d.host}`)) { for (const p of data.products.filter((p) => p.page.domainId === d.id)) await repo.put('products', { ...p, page: { ...p.page, domainId: undefined } }); await repo.remove('domains', d.id); await refresh() } }}>Excluir</button></div>
              <div className="row">{d.productIds.length === 0 ? <span className="muted">Sem produtos vinculados.</span> : d.productIds.map((id) => {
                const p = data.products.find((x) => x.id === id)
                return <span className="chip" key={id}>{p?.name ?? 'Produto removido'} <button className="link" onClick={async () => { await setProductDomain(repo, id, undefined); if (p) await repo.put('products', { ...p, page: { ...p.page, domainId: undefined } }); await refresh() }}>Desvincular</button></span>
              })}</div>
            </div>)
        })}
      </section>
      <section><div className="row"><span className="muted">Página de vendas do produto</span><ProductSelect /></div>
        {selected ? <PageForm key={selected.id} p={selected} /> : <NoProduct />}</section>
    </>
  )
}

function PageForm({ p }: { p: Product }) {
  const { repo, data, refresh } = useData()
  const [d, setD, dirty] = useDraft(p)
  const [msg, setMsg] = useState(''); const [formErr, setFormErr] = useState('')
  const pg = d.page
  const up = <K extends keyof Product['page']>(k: K, v: Product['page'][K]) => setD((x) => ({ ...x, page: { ...x.page, [k]: v } }))
  async function save() {
    try {
      await setProductDomain(repo, d.id, d.page.domainId) // valida o limite 5/5 antes de gravar
      await repo.put('products', d); await refresh(); setMsg('Salvo.'); setFormErr('')
    } catch (e) { setFormErr((e as Error).message === 'Limite atingido' ? 'Limite atingido: este domínio já tem 5 produtos. Escolha outro ou desvincule um produto.' : (e as Error).message) }
  }
  return (
    <>
      <StepBar stepKey="pagina" dirty={dirty} />
      <section className="card">
        <div className="grid">
          <Field label="Domínio">
            <select value={pg.domainId ?? ''} onChange={(e) => up('domainId', e.target.value || undefined)}>
              <option value="">Selecionar</option>
              {data.domains.map((dm) => <option key={dm.id} value={dm.id} disabled={domainFull(dm) && !dm.productIds.includes(p.id)}>{dm.host} ({domainOccupancy(dm)}/{DOMAIN_LIMIT}){domainFull(dm) && !dm.productIds.includes(p.id) ? ' Limite atingido' : ''}</option>)}
            </select>
          </Field>
          <UrlField label="Link público da página de vendas" value={pg.publicUrl} onChange={(v) => up('publicUrl', v)} />
          <UrlField label="Link do HTML-fonte (GitHub ou Drive)" value={pg.htmlSourceUrl} onChange={(v) => up('htmlSourceUrl', v)} />
          <TextField label="Versão" value={pg.version} onChange={(v) => up('version', v)} />
          <UrlField label="Arquivo-fonte do entregável principal" value={pg.deliverableSourceUrl} onChange={(v) => up('deliverableSourceUrl', v)} />
          <UrlField label="Arquivo-fonte do order bump 01" value={pg.bump1SourceUrl} onChange={(v) => up('bump1SourceUrl', v)} />
          <UrlField label="Arquivo-fonte do order bump 02" value={pg.bump2SourceUrl} onChange={(v) => up('bump2SourceUrl', v)} />
          <TextField label="Idioma original" value={pg.originalLanguage} onChange={(v) => up('originalLanguage', v)} />
          <TextField label="País de destino" value={pg.destCountry} onChange={(v) => up('destCountry', v)} />
        </div>
        <Checks items={PAGE_CHECKS} value={pg.checks} onChange={(v) => up('checks', v)} />
        {formErr && <p className="verdict reprovado">{formErr}</p>}
        <SaveBar dirty={dirty} msg={msg} onSave={save} />
      </section>
    </>
  )
}
