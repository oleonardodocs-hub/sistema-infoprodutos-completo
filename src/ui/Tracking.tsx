import { useState } from 'react'
import { looksLikeCardNumber } from '../domain/rules'
import { newId } from '../domain/factory'
import type { Asset, AssetKind, CheckoutState, Product } from '../domain/types'
import { decryptText, encryptText } from '../storage/crypto'
import { CopyOpen, Field, NoProduct, PageHead, ProductSelect, SaveBar, StepBar, TextField, UrlField, confirmDelete, useDraft } from './common'
import { useData } from './data'

const KIND: Record<AssetKind, string> = { bm: 'BM ou Portfólio', account: 'Conta de anúncios', card: 'Cartão (apelido)' }

function Passphrase() {
  const { data, pass, setPass } = useData()
  const [v, setV] = useState(''); const [msg, setMsg] = useState('')
  async function set() {
    const first = data.secrets[0]
    if (first) { try { await decryptText(first.blob, v) } catch (e) { setMsg((e as Error).message); return } }
    setPass(v); setV(''); setMsg('')
  }
  if (pass) return <div className="row"><span className="chip aprovado">Frase-senha ativa nesta sessão</span><button className="link" onClick={() => setPass('')}>Bloquear</button></div>
  return (
    <div className="row">
      <input type="password" placeholder="Frase-senha (não é gravada)" value={v} onChange={(e) => setV(e.target.value)} aria-label="Frase-senha" />
      <button className="btn sm" disabled={!v} onClick={set}>Desbloquear</button>
      <span className="muted">{msg || 'Necessária para salvar ou ver tokens. Se esquecer, os tokens não podem ser recuperados.'}</span>
    </div>
  )
}

function SecretField({ secretId, label }: { secretId: string; label: string }) {
  const { repo, data, refresh, pass } = useData()
  const stored = data.secrets.find((s) => s.id === secretId)
  const [val, setVal] = useState(''); const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false); const [edit, setEdit] = useState(false); const [msg, setMsg] = useState('')
  const editable = !stored || edit
  const need = () => { if (!pass) { setMsg('Informe a frase-senha acima.'); return false } return true }
  return (
    <Field label={`${label} (protegido)`}>
      <div className="urlrow">
        <input type={show ? 'text' : 'password'} value={val} readOnly={!editable} autoComplete="off"
          placeholder={stored && !loaded ? 'Salvo e cifrado. Clique em Carregar.' : 'Cole o token'} onChange={(e) => setVal(e.target.value)} />
        <span className="row">
          {stored && !loaded && <button className="link" onClick={async () => { if (!need()) return; try { setVal(await decryptText(stored.blob, pass)); setLoaded(true); setMsg('') } catch (e) { setMsg((e as Error).message) } }}>Carregar</button>}
          {editable && <button className="link" onClick={async () => { try { setVal(await navigator.clipboard.readText()) } catch { setMsg('Não foi possível ler a área de transferência.') } }}>Colar</button>}
          <button className="link" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</button>
          <button className="link" disabled={!val} onClick={() => navigator.clipboard.writeText(val)}>Copiar</button>
          {stored && loaded && !edit && <button className="link" onClick={() => setEdit(true)}>Editar</button>}
          {editable && <button className="link" disabled={!val} onClick={async () => {
            if (!need()) return
            await repo.put('secrets', { id: secretId, blob: await encryptText(val, pass) }); await refresh(); setEdit(false); setLoaded(true); setShow(false); setMsg('Salvo cifrado.')
          }}>Salvar</button>}
          {stored && <button className="link danger" onClick={async () => { if (confirmDelete('este token')) { await repo.remove('secrets', secretId); setVal(''); setLoaded(false); await refresh() } }}>Remover</button>}
        </span>
      </div>
      {msg && <small className="muted">{msg}</small>}
    </Field>
  )
}

function Registry() {
  const { repo, data, refresh } = useData()
  const [kind, setKind] = useState<AssetKind>('bm'); const [name, setName] = useState(''); const [ext, setExt] = useState(''); const [err, setErr] = useState('')
  async function add() {
    if (kind === 'card' && (looksLikeCardNumber(name) || looksLikeCardNumber(ext))) { setErr('Use apenas o apelido do cartão. Nunca número, CVV ou validade.'); return }
    if (!name.trim()) return
    await repo.put('assets', { id: newId(), kind, name: name.trim(), externalId: kind === 'card' ? '' : ext.trim() })
    setName(''); setExt(''); setErr(''); await refresh()
  }
  return (
    <section className="card">
      <h2>BMs, contas e cartões reutilizáveis</h2>
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>{(Object.keys(KIND) as AssetKind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select>
        <input placeholder={kind === 'card' ? 'Apelido do cartão' : 'Nome'} value={name} onChange={(e) => setName(e.target.value)} />
        {kind !== 'card' && <input placeholder="ID" value={ext} onChange={(e) => setExt(e.target.value)} />}
        <button className="btn sm" onClick={add}>Adicionar</button>
      </div>
      {err && <p className="verdict reprovado">{err}</p>}
      {data.assets.length === 0 ? <p className="muted">Nada cadastrado ainda.</p> : (
        <div className="scroll"><table><thead><tr><th>Tipo</th><th>Nome</th><th>ID</th><th /></tr></thead><tbody>
          {data.assets.map((a: Asset) => (
            <tr key={a.id}><td>{KIND[a.kind]}</td><td>{a.name}</td><td>{a.externalId || '—'}</td>
              <td><button className="link danger" onClick={async () => {
                const used = data.products.filter((p) => [p.tracking.bmId, p.tracking.accountId, p.tracking.cardId].includes(a.id))
                if (used.length) { setErr(`Em uso por ${used.length} produto(s). Troque-os antes de excluir.`); return }
                if (confirmDelete(`"${a.name}"`)) { await repo.remove('assets', a.id); await refresh() }
              }}>Excluir</button></td></tr>))}
        </tbody></table></div>
      )}
    </section>
  )
}

export function Tracking() {
  const { selected } = useData()
  return <><PageHead title="Rastreamento"><ProductSelect /></PageHead>
    <section className="card"><Passphrase /></section>
    {selected ? <Form key={selected.id} p={selected} /> : <NoProduct />}
    <Registry /></>
}

function Form({ p }: { p: Product }) {
  const { repo, data, refresh } = useData()
  const [d, setD, dirty] = useDraft(p)
  const [msg, setMsg] = useState('')
  const t = d.tracking
  const up = <K extends keyof Product['tracking']>(k: K, v: Product['tracking'][K]) => setD((x) => ({ ...x, tracking: { ...x.tracking, [k]: v } }))
  const sel = (kind: AssetKind, key: 'bmId' | 'accountId' | 'cardId', label: string) => (
    <Field label={label}>
      <select value={t[key] ?? ''} onChange={(e) => up(key, e.target.value || undefined)}>
        <option value="">Selecionar</option>{data.assets.filter((a) => a.kind === kind).map((a) => <option key={a.id} value={a.id}>{a.name}{a.externalId ? ` (${a.externalId})` : ''}</option>)}
      </select>
    </Field>
  )
  return (
    <>
      <StepBar stepKey="rastreamento" dirty={dirty} />
      <section className="card">
        <div className="grid">
          {sel('bm', 'bmId', 'BM ou Portfólio Empresarial')}{sel('account', 'accountId', 'Conta de anúncios')}{sel('card', 'cardId', 'Cartão (apelido)')}
          <TextField label="Página do Facebook, nome" value={t.fbPageName} onChange={(v) => up('fbPageName', v)} />
          <UrlField label="Página do Facebook, link" value={t.fbPageUrl} onChange={(v) => up('fbPageUrl', v)} />
          <TextField label="Instagram, nome" value={t.igName} onChange={(v) => up('igName', v)} />
          <UrlField label="Instagram, link" value={t.igUrl} onChange={(v) => up('igUrl', v)} />
          <TextField label="Pixel Meta, nome" value={t.pixelName} onChange={(v) => up('pixelName', v)} />
          <TextField label="Pixel Meta, ID" value={t.pixelId} onChange={(v) => up('pixelId', v)} />
          <TextField label="Dados da UTMify (sem token)" value={t.utmifyData} onChange={(v) => up('utmifyData', v)} />
          <UrlField label="Documentação dos parâmetros UTM e script" value={t.utmDocsUrl} onChange={(v) => up('utmDocsUrl', v)} />
          <Field label="Checkout (da etapa anterior)"><div className="urlrow"><input readOnly value={p.offer.checkoutUrl} placeholder="Defina em Oferta e checkout" /><CopyOpen url={p.offer.checkoutUrl} /></div></Field>
          <Field label="Rastreamento no checkout">
            <select value={t.checkoutState} onChange={(e) => up('checkoutState', e.target.value as CheckoutState)}><option>pendente</option><option>em andamento</option><option>configurado</option></select>
          </Field>
        </div>
        <div className="row checks">
          {([['pageView', 'PageView testado'], ['initiateCheckout', 'InitiateCheckout testado'], ['purchase', 'Purchase testado']] as const).map(([k, l]) => (
            <label key={k}><input type="checkbox" checked={t.events[k]} onChange={(e) => up('events', { ...t.events, [k]: e.target.checked })} /> {l}</label>))}
        </div>
        <TextField label="Observações" area value={t.notes} onChange={(v) => up('notes', v)} />
        <SaveBar dirty={dirty} msg={msg} onSave={async () => { await repo.put('products', d); await refresh(); setMsg('Salvo.') }} />
      </section>
      <section className="card">
        <h2>Tokens</h2>
        <p className="muted">Cifrados com sua frase-senha antes de gravar. Não aparecem em cards, listas, logs nem no backup em texto puro.</p>
        <SecretField secretId={`${p.id}:meta-capi`} label="Token Meta CAPI" />
        <SecretField secretId={`${p.id}:utmify`} label="Token UTMify" />
      </section>
    </>
  )
}
