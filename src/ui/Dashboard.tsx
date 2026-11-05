import { useMemo, useState } from 'react'
import {
  DOMAIN_LIMIT, classifyWindow, consolidate, creativeValidated, domainOccupancy, fmtBRL, fmtNum, fmtPct, metrics, operationalAlerts,
  periodRange, previousRange, type Period,
} from '../domain/rules'
import { STEPS } from '../domain/types'
import { backupOverdue } from '../storage/backup'
import { today } from './common'
import { useData } from './data'

const COLORS = ['blue', 'purple', 'yellow', 'coral']
const PERIODS: [Period, string][] = [['dia', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['custom', 'Personalizado']]

export function Dashboard({ go }: { go: (p: string) => void }) {
  const { data, lastBackupAt, ready } = useData()
  const [one, setOne] = useState('')
  const [period, setPeriod] = useState<Period>('7')
  const [custom, setCustom] = useState({ from: today(), to: today() })
  const [f, setF] = useState({ country: '', bm: '', account: '', card: '', status: '' })
  const [sel, setSel] = useState<string[] | null>(null) // null = todos os filtrados

  const filtered = useMemo(() => data.products.filter((p) =>
    (!f.country || p.country === f.country) && (!f.bm || p.tracking.bmId === f.bm) && (!f.account || p.tracking.accountId === f.account) &&
    (!f.card || p.tracking.cardId === f.card) && (!f.status || p.operationalStatus === f.status)), [data.products, f])
  const chosen = sel === null ? filtered : filtered.filter((p) => sel.includes(p.id))
  const ids = chosen.map((p) => p.id)
  const range = periodRange(period, today(), custom)
  const prev = previousRange(range)
  const total = metrics(consolidate(data.dailyEntries, { productIds: ids, ...range }))
  const before = metrics(consolidate(data.dailyEntries, { productIds: ids, ...prev }))
  const week = metrics(consolidate(data.dailyEntries, { ...periodRange('7', today()) }))

  const alerts: string[] = []
  if (ready && backupOverdue(lastBackupAt)) alerts.push(lastBackupAt ? 'Backup vencido. Exporte um novo.' : 'Nenhum backup feito ainda.')
  for (const d of data.domains) if (domainOccupancy(d) >= DOMAIN_LIMIT) alerts.push(`Domínio ${d.host}: limite atingido (5/5)`)
  for (const p of data.products) if (!p.language || !p.country || !p.campaignName) alerts.push(`Dados incompletos: ${p.name}`)
  for (const a of operationalAlerts(data.products, data.adSets, data.dailyEntries)) alerts.push(a.text)

  const countries = [...new Set(data.products.map((p) => p.country).filter(Boolean))]
  const assets = (k: string) => data.assets.filter((a) => a.kind === k)
  const prod = data.products.find((p) => p.id === one)
  const toggle = (id: string) => setSel((cur) => { const base = cur ?? filtered.map((p) => p.id); return base.includes(id) ? base.filter((x) => x !== id) : [...base, id] })

  return (
    <div className="dash">
      <section>
        <header className="top"><h1>Dashboard</h1><span className="muted">{new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span></header>
        {data.products.length === 0 && <div className="card"><p>Nenhum produto ainda.</p><button className="btn" onClick={() => go('mining')}>Ir para Mineração</button></div>}
        <div className="cards">
          {data.products.map((p, idx) => {
            const done = STEPS.filter((s) => p.steps[s.key]).length
            const t = metrics(consolidate(data.dailyEntries, { productIds: [p.id] }))
            const bm = data.assets.find((a) => a.id === p.tracking.bmId), acc = data.assets.find((a) => a.id === p.tracking.accountId), card = data.assets.find((a) => a.id === p.tracking.cardId)
            const dom = data.domains.find((d) => d.id === p.page.domainId)
            return (
              <article key={p.id} className={'pcard ' + COLORS[idx % 4]} onClick={() => setOne(p.id === one ? '' : p.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOne(p.id === one ? '' : p.id)}>
                <div className="num">{done}/{STEPS.length}</div>
                <h3>{p.name}</h3>
                <p>{p.country || 'País?'} · {p.language || 'Idioma?'}</p>
                <div className="bar"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
                <p className="small">{p.operationalStatus} · {p.validation.validated ? 'Validado' : 'Não validado'} · Lucro {fmtBRL(t.profit)} · Faturamento {fmtBRL(t.revenue)}</p>
                <p className="small">Campanha: {p.campaignName || '—'} · BM: {bm?.name ?? '—'} · Conta: {acc?.name ?? '—'} · Cartão: {card?.name ?? '—'}</p>
                <p className="small">Domínio: {dom ? `${dom.host} (${domainOccupancy(dom)}/${DOMAIN_LIMIT})` : '—'}</p>
              </article>)
          })}
        </div>

        {prod && <Individual id={prod.id} />}

        <section className="card">
          <h2>Dashboard consolidado</h2>
          <div className="row filters">
            <select value={f.country} onChange={(e) => { setF({ ...f, country: e.target.value }); setSel(null) }} aria-label="País"><option value="">Todos os países</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={f.bm} onChange={(e) => { setF({ ...f, bm: e.target.value }); setSel(null) }} aria-label="BM"><option value="">Todas as BMs</option>{assets('bm').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select value={f.account} onChange={(e) => { setF({ ...f, account: e.target.value }); setSel(null) }} aria-label="Conta"><option value="">Todas as contas</option>{assets('account').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select value={f.card} onChange={(e) => { setF({ ...f, card: e.target.value }); setSel(null) }} aria-label="Cartão"><option value="">Todos os cartões</option>{assets('card').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setSel(null) }} aria-label="Status"><option value="">Todos os status</option>{['Em produção', 'Em validação', 'Ativo', 'Inativo'].map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="row">{PERIODS.map(([k, l]) => <button key={k} className={'btn sm ' + (period === k ? '' : 'ghost')} onClick={() => setPeriod(k)}>{l}</button>)}
            {period === 'custom' && <><input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /><input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></>}
            <span className="muted">{range.from} a {range.to}</span></div>
          <div className="row checks">
            <label><input type="checkbox" checked={sel === null || filtered.every((p) => sel.includes(p.id))} onChange={(e) => setSel(e.target.checked ? null : [])} /> Selecionar todos</label>
            {filtered.map((p) => <label key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} /> {p.name}</label>)}
          </div>
          {chosen.length === 0 ? <p className="muted">Nenhum produto selecionado.</p> : (
            <>
              <dl className="inline"><dt>Investimento</dt><dd>{fmtBRL(total.investment)}</dd><dt>Faturamento líquido</dt><dd>{fmtBRL(total.revenue)}</dd>
                <dt>Lucro operacional de mídia</dt><dd>{fmtBRL(total.profit)}</dd><dt>Margem</dt><dd>{fmtPct(total.margin)}</dd><dt>ROI operacional de mídia</dt><dd>{fmtPct(total.roi)}</dd>
                <dt>ROAS líquido</dt><dd>{fmtNum(total.roas)}</dd><dt>CPA</dt><dd>{fmtBRL(total.cpa)}</dd></dl>
              <p className="muted">Período anterior ({prev.from} a {prev.to}): lucro {fmtBRL(before.profit)}, investimento {fmtBRL(before.investment)}.</p>
              <div className="scroll"><table><thead><tr><th>Produto</th><th>Investimento</th><th>Faturamento</th><th>Lucro</th><th>ROI</th><th>ROAS</th><th>CPA</th></tr></thead><tbody>
                {chosen.map((p) => { const x = metrics(consolidate(data.dailyEntries, { productIds: [p.id], ...range })); return (
                  <tr key={p.id}><td>{p.name}</td><td>{fmtBRL(x.investment)}</td><td>{fmtBRL(x.revenue)}</td><td>{fmtBRL(x.profit)}</td><td>{fmtPct(x.roi)}</td><td>{fmtNum(x.roas)}</td><td>{fmtBRL(x.cpa)}</td></tr>) })}
                <tr><th>Total geral</th><th>{fmtBRL(total.investment)}</th><th>{fmtBRL(total.revenue)}</th><th>{fmtBRL(total.profit)}</th><th>{fmtPct(total.roi)}</th><th>{fmtNum(total.roas)}</th><th>{fmtBRL(total.cpa)}</th></tr>
              </tbody></table></div>
            </>)}
        </section>
      </section>
      <aside className="right">
        <div className="card"><h2>Últimos 7 dias (todos)</h2>
          <dl><dt>Investimento</dt><dd>{fmtBRL(week.investment)}</dd><dt>Faturamento líquido</dt><dd>{fmtBRL(week.revenue)}</dd><dt>Lucro operacional</dt><dd>{fmtBRL(week.profit)}</dd><dt>ROAS líquido</dt><dd>{fmtNum(week.roas)}</dd></dl></div>
        <div className="card"><h2>Alertas</h2>{alerts.length === 0 ? <p className="muted">Nenhum alerta.</p> : <ul>{alerts.map((a, i) => <li key={i}>{a}</li>)}</ul>}</div>
      </aside>
    </div>
  )
}

function Individual({ id }: { id: string }) {
  const { data } = useData()
  const p = data.products.find((x) => x.id === id)!
  const entries = data.dailyEntries.filter((e) => e.productId === id)
  const byDate = new Map<string, { spend: number; revenue: number; checkouts: number; sales: number }>()
  for (const e of entries) { const c = byDate.get(e.date) ?? { spend: 0, revenue: 0, checkouts: 0, sales: 0 }; c.spend += e.spend; c.revenue += e.revenue; c.checkouts += e.checkouts; c.sales += e.sales; byDate.set(e.date, c) }
  const dates = [...byDate.keys()].sort().reverse()
  const max = Math.max(1, ...[...byDate.values()].flatMap((v) => [v.spend, v.revenue]))
  const winners = data.adSets.filter((a) => a.productId === id).map((a) => {
    const mine = entries.filter((e) => e.adSetId === a.id); const last = mine.map((e) => e.date).sort().pop()
    return { a, cls: last ? classifyWindow(mine, last).cls : 'Dados insuficientes', cv: creativeValidated(mine).validated }
  }).filter((x) => x.cls === 'Vencedor' || x.cls === 'Lucrativo' || x.cv)
  return (
    <section className="card">
      <h2>{p.name}: painel individual</h2>
      <p className="muted">{p.validation.validated ? `Validado em ${p.validation.date}. ${p.validation.evidence ?? ''}` : 'Em validação'} · Status operacional: {p.operationalStatus}</p>
      <h3>Criativos vencedores ou validados</h3>
      {winners.length === 0 ? <p className="muted">Nenhum ainda.</p> : <div className="row">{winners.map((w) => <span className="chip aprovado" key={w.a.id}>{w.a.name}: {w.cls}{w.cv ? ', validado' : ''}</span>)}</div>}
      <h3>Receitas e gastos por data</h3>
      {dates.length === 0 ? <p className="muted">Sem lançamentos.</p> : (
        <div className="scroll"><table><thead><tr><th>Data</th><th>Gasto</th><th>Receita</th><th /><th>Checkouts</th><th>Vendas</th><th>Lucro</th></tr></thead><tbody>
          {dates.map((d) => { const v = byDate.get(d)!; return (
            <tr key={d}><td>{d.split('-').reverse().join('/')}</td><td>{fmtBRL(v.spend)}</td><td>{fmtBRL(v.revenue)}</td>
              <td className="bars"><i className="s" style={{ width: `${(v.spend / max) * 100}%` }} /><i className="r" style={{ width: `${(v.revenue / max) * 100}%` }} /></td>
              <td>{v.checkouts}</td><td>{v.sales}</td><td>{fmtBRL(v.revenue - v.spend)}</td></tr>) })}
        </tbody></table></div>)}
    </section>
  )
}
