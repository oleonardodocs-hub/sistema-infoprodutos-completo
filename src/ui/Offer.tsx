import { useState } from 'react'
import { CHECKOUT_CHECKS, ITEM_CHECKS } from '../domain/rules'
import type { OfferItem, Product } from '../domain/types'
import { Checks, NoProduct, PageHead, ProductSelect, SaveBar, StepBar, TextField, UrlField, useDraft } from './common'
import { useData } from './data'

function ItemBlock({ title, it, set }: { title: string; it: OfferItem; set: (i: OfferItem) => void }) {
  const up = <K extends keyof OfferItem>(k: K, v: OfferItem[K]) => set({ ...it, [k]: v })
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="grid">
        <TextField label="Nome" value={it.name} onChange={(v) => up('name', v)} />
        <TextField label="Preço comercial (€)" type="number" value={it.priceEUR} onChange={(v) => up('priceEUR', Number(v))} />
        <UrlField label="Link da logo (Drive)" value={it.logoUrl} onChange={(v) => up('logoUrl', v)} />
        <UrlField label="Link da capa (Drive)" value={it.coverUrl} onChange={(v) => up('coverUrl', v)} />
        <UrlField label="Link do arquivo ou entregável" value={it.deliverableUrl} onChange={(v) => up('deliverableUrl', v)} />
        <UrlField label="Link do cadastro na Hotmart" value={it.hotmartUrl} onChange={(v) => up('hotmartUrl', v)} />
      </div>
      <TextField label={`Descrição (${it.description.length} caracteres)`} area value={it.description} onChange={(v) => up('description', v)} />
      <Checks items={ITEM_CHECKS} value={it.checks} onChange={(v) => up('checks', v)} />
    </section>
  )
}

export function Offer() {
  const { selected } = useData()
  return <><PageHead title="Oferta e checkout"><ProductSelect /></PageHead>{selected ? <Form key={selected.id} p={selected} /> : <NoProduct />}</>
}
function Form({ p }: { p: Product }) {
  const { repo, refresh } = useData()
  const [d, setD, dirty] = useDraft(p)
  const [msg, setMsg] = useState('')
  const o = d.offer
  const setO = (f: (x: Product['offer']) => Product['offer']) => setD((x) => ({ ...x, offer: f(x.offer) }))
  return (
    <>
      <StepBar stepKey="oferta" dirty={dirty} />
      <ItemBlock title="Produto principal" it={o.main} set={(i) => setO((x) => ({ ...x, main: i }))} />
      <ItemBlock title="Order bump 01" it={o.bump1} set={(i) => setO((x) => ({ ...x, bump1: i }))} />
      <ItemBlock title="Order bump 02" it={o.bump2} set={(i) => setO((x) => ({ ...x, bump2: i }))} />
      <section className="card">
        <h2>Checkout</h2>
        <UrlField label="Link definitivo do checkout Hotmart" value={o.checkoutUrl} onChange={(v) => setO((x) => ({ ...x, checkoutUrl: v }))} />
        <Checks items={CHECKOUT_CHECKS} value={o.checkoutChecks} onChange={(v) => setO((x) => ({ ...x, checkoutChecks: v }))} />
      </section>
      <SaveBar dirty={dirty} msg={msg} onSave={async () => { await repo.put('products', d); await refresh(); setMsg('Salvo.') }} />
    </>
  )
}
