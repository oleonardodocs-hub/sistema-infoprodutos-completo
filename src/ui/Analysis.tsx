import { useState } from 'react'
import { applyDecision, importWeekly, saveDailyEntry } from '../domain/actions'
import { newId } from '../domain/factory'
import { classifyWindow, consolidate, creativeValidated, dayProfit, entryAdvice, fmtBRL, fmtNum, fmtPct, metrics, type Advice } from '../domain/rules'
import type { AdSet, DailyEntry, Product } from '../domain/types'
import { NoProduct, PageHead, ProductSelect, confirmDelete, today } from './common'
import { useData } from './data'

const blank = (productId: string, adSetId: string): DailyEntry => ({ id: newId(), productId, adSetId, date: today(), spend: 0, checkouts: 0, sales: 0, revenue: 0, source: 'diario' })

export function Analysis() {
  const { selected } = useData()
  return <><PageHead title="Análise e otimização"><ProductSelect /></PageHead>{selected ? <Body key={selected.id} p={selected} /> : <NoProduct />}</>
}

function Body({ p }: { p: Product }) {
  const { repo, data, refresh } = useData()
  const sets = data.adSets.filter((a) => a.productId === p.id)
  const entries = data.dailyEntries.filter((e) => e.productId === p.id)
  const [name, setName] = useState('')
  const [form, setForm] = useState<DailyEntry | null>(null)
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [err, setErr] = useState('')
  const [week, setWeek] = useState({ adSetId: '', start: today(), spend: 0, checkouts: 0, sales: 0, revenue: 0 })
  const [filter, setFilter] = useState('')
  const m = metrics(consolidate(entries, {}))
  const setName_ = (id: string) => sets.find((s) => s.id === id)?.name ?? '—'

  async function save() {
    if (!form) return
    try { setErr(''); setAdvice(await saveDailyEntry(repo, form)); setForm(null); await refresh() } catch (e) { setErr((e as Error).message) }
  }
  async function decide(e: DailyEntry, v: 'pausou' | 'manteve') {
    const reason = window.prompt(v === 'pausou' ? 'Motivo da pausa (obrigatório)' : 'Motivo de manter (obrigatório)', e.recommendation ?? '')
    if (!reason?.trim()) return
    await applyDecision(repo, e.id, v, reason.trim()); await refresh()
  }
  const rows = entries.filter((e) => !filter || e.adSetId === filter).sort((a, b) => b.date.localeCompare(a.date) || a.adSetId.localeCompare(b.adSetId))

  return (
    <>
      <section className="card">
        <div className="row">
          <span className={'chip ' + (p.validation.validated ? 'aprovado' : '')}>{p.validation.validated ? `Produto validado em ${p.validation.date}` : 'Em validação'}</span>
          <span className="chip">Operacional: {p.operationalStatus}</span>
          {p.validation.evidence && <span className="muted">{p.validation.evidence}{p.validation.manual ? ' (manual)' : ''}</span>}
        </div>
        <dl className="inline"><dt>Investimento</dt><dd>{fmtBRL(m.investment)}</dd><dt>Faturamento líquido</dt><dd>{fmtBRL(m.revenue)}</dd>
          <dt>Lucro operacional de mídia</dt><dd>{fmtBRL(m.profit)}</dd><dt>ROAS líquido</dt><dd>{fmtNum(m.roas)}</dd><dt>CPA</dt><dd>{fmtBRL(m.cpa)}</dd></dl>
        {p.operationalStatus === 'Inativo' && <div className="verdict">Produto inativo (nenhum conjunto elegível). O histórico de validação foi mantido. Novo teste possível em outra conta de anúncios ou em outro país e idioma, com Duplicar.</div>}
        <Retest p={p} />
      </section>

      <section className="card">
        <h2>Conjuntos de anúncios (1 conjunto = 1 criativo)</h2>
        <div className="row"><input placeholder="Nome do conjunto ou criativo" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn sm" disabled={!name.trim()} onClick={async () => { const a: AdSet = { id: newId(), productId: p.id, name: name.trim(), creativeUrl: '', paused: false, createdAt: new Date().toISOString() }; await repo.put('adSets', a); setName(''); await refresh() }}>Adicionar conjunto</button></div>
        {sets.length === 0 ? <p className="muted">Adicione ao menos um conjunto para lançar análises.</p> : (
          <div className="scroll"><table><thead><tr><th>Conjunto</th><th>Situação</th><th>Criativo</th><th>Janela de 7 dias</th><th>Lucro total</th><th>Última recomendação</th><th /></tr></thead><tbody>
            {sets.map((a) => {
              const mine = entries.filter((e) => e.adSetId === a.id)
              const last = mine.length ? mine.reduce((x, y) => (y.date > x.date ? y : x)) : undefined
              const w = last ? classifyWindow(mine, last.date) : undefined
              const cv = creativeValidated(mine)
              return (<tr key={a.id}><td>{a.name}</td><td><span className={'chip ' + (a.paused ? 'reprovado' : 'aprovado')}>{a.paused ? 'Pausado' : 'Ativo'}</span></td>
                <td>{cv.validated ? <span className="chip aprovado">Validado</span> : 'Em teste'}</td>
                <td>{w ? `${w.cls} (${w.profitDays} lucro, ${w.lossDays} prejuízo, ${w.recorded}/7 lançados)` : '—'}</td>
                <td>{fmtBRL(mine.reduce((s, e) => s + dayProfit(e), 0))}</td><td>{last?.recommendation ?? '—'}</td>
                <td><button className="link danger" onClick={async () => { if (confirmDelete(`o conjunto "${a.name}" e seus lançamentos`)) { for (const e of mine) await repo.remove('dailyEntries', e.id); await repo.remove('adSets', a.id); await refresh() } }}>Excluir</button></td></tr>)
            })}</tbody></table></div>)}
      </section>

      <section className="card">
        <div className="top"><h2>Lançamento diário</h2><button className="btn sm" disabled={!sets.length} onClick={() => setForm(blank(p.id, sets[0].id))}>Novo lançamento</button></div>
        {err && <p className="verdict reprovado">{err}</p>}
        {advice && <div className={'verdict ' + (advice.action === 'PAUSAR' ? 'reprovado' : 'aprovado')}><b>Recomendação: {advice.action}</b>. {advice.reason}. O sistema não pausa o Meta Ads: execute a ação lá e registre abaixo.{advice.alerts.length > 0 && ` Alertas: ${advice.alerts.join('; ')}.`}</div>}
        {form && (
          <div className="card form"><div className="grid">
            <label className="field"><span>Conjunto</span><select value={form.adSetId} onChange={(e) => setForm({ ...form, adSetId: e.target.value })}>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span>Data</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field"><span>Gasto (R$)</span><input type="number" min={0} step="0.01" value={form.spend} onChange={(e) => setForm({ ...form, spend: +e.target.value })} /></label>
            <label className="field"><span>Checkouts iniciados</span><input type="number" min={0} value={form.checkouts} onChange={(e) => setForm({ ...form, checkouts: +e.target.value })} /></label>
            <label className="field"><span>Vendas</span><input type="number" min={0} value={form.sales} onChange={(e) => setForm({ ...form, sales: +e.target.value })} /></label>
            <label className="field"><span>Receita líquida (R$, já sem taxas Hotmart)</span><input type="number" min={0} step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: +e.target.value })} /></label>
          </div>
            <label className="field"><span>Observações</span><input value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="row"><button className="btn sm" onClick={save}>Salvar lançamento</button><button className="btn ghost sm" onClick={() => setForm(null)}>Cancelar</button></div>
          </div>)}
        <details><summary>Lançar consolidado manual de 7 dias</summary>
          <p className="muted">É dividido em 7 lançamentos diários com os mesmos totais. Se já houver lançamentos no período, você escolhe substituir. Nunca soma os dois.</p>
          <div className="grid">
            <label className="field"><span>Conjunto</span><select value={week.adSetId} onChange={(e) => setWeek({ ...week, adSetId: e.target.value })}><option value="">Selecionar</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span>Primeiro dia do período</span><input type="date" value={week.start} onChange={(e) => setWeek({ ...week, start: e.target.value })} /></label>
            <label className="field"><span>Gasto total (R$)</span><input type="number" min={0} step="0.01" value={week.spend} onChange={(e) => setWeek({ ...week, spend: +e.target.value })} /></label>
            <label className="field"><span>Checkouts</span><input type="number" min={0} value={week.checkouts} onChange={(e) => setWeek({ ...week, checkouts: +e.target.value })} /></label>
            <label className="field"><span>Vendas</span><input type="number" min={0} value={week.sales} onChange={(e) => setWeek({ ...week, sales: +e.target.value })} /></label>
            <label className="field"><span>Receita líquida total (R$)</span><input type="number" min={0} step="0.01" value={week.revenue} onChange={(e) => setWeek({ ...week, revenue: +e.target.value })} /></label>
          </div>
          <button className="btn sm" disabled={!week.adSetId} onClick={async () => {
            const t = { spend: week.spend, checkouts: week.checkouts, sales: week.sales, revenue: week.revenue }
            try { await importWeekly(repo, p.id, week.adSetId, week.start, t, false) }
            catch (e) { if (!window.confirm(`${(e as Error).message}\n\nSubstituir os lançamentos existentes deste período pelo consolidado?`)) return; await importWeekly(repo, p.id, week.adSetId, week.start, t, true) }
            await refresh(); setErr('')
          }}>Lançar consolidado</button>
        </details>
      </section>

      <section className="card">
        <div className="row"><h2>Histórico</h2><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os conjuntos</option>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {rows.length === 0 ? <p className="muted">Nenhum lançamento.</p> : (
          <div className="scroll"><table><thead><tr><th>Data</th><th>Conjunto</th><th>Gasto</th><th>Checkouts</th><th>Vendas</th><th>Receita</th><th>Lucro</th><th>Recomendação</th><th>Decisão executada</th><th /></tr></thead><tbody>
            {rows.map((e) => {
              const adv = entryAdvice(e, data.dailyEntries)
              return (<tr key={e.id}><td>{e.date.split('-').reverse().join('/')}</td><td>{setName_(e.adSetId)}{e.source === 'semanal' && <small> (semanal)</small>}</td>
                <td>{fmtBRL(e.spend)}</td><td>{e.checkouts}</td><td>{e.sales}</td><td>{fmtBRL(e.revenue)}</td><td>{fmtBRL(dayProfit(e))}</td>
                <td><span className={'chip ' + (adv.action === 'PAUSAR' ? 'reprovado' : '')} title={adv.reason}>{adv.action}</span></td>
                <td>{e.executed ? <span title={e.decisionReason}>{e.executed === 'pausou' ? 'Pausei' : 'Mantive'} em {e.executedAt ? new Date(e.executedAt).toLocaleString('pt-BR') : ''}</span> : <span className="row"><button className="link" onClick={() => decide(e, 'pausou')}>Registrar pausa</button><button className="link" onClick={() => decide(e, 'manteve')}>Registrar manter</button></span>}</td>
                <td className="row"><button className="link" onClick={() => { setAdvice(null); setForm(e) }}>Editar</button><button className="link danger" onClick={async () => { if (confirmDelete('este lançamento')) { await repo.remove('dailyEntries', e.id); await refresh() } }}>Excluir</button></td></tr>)
            })}</tbody></table></div>)}
        <p className="muted">Margem do produto: {fmtPct(m.margin)} · ROI operacional de mídia: {fmtPct(m.roi)}</p>
      </section>
    </>
  )
}

function Retest({ p }: { p: Product }) {
  const { repo, refresh } = useData()
  const [v, setV] = useState(p.retestNote)
  return <div className="row"><input style={{ flex: 1 }} placeholder="Nota sobre novo teste em outra conta ou duplicação para outro país e idioma" value={v} onChange={(e) => setV(e.target.value)} />
    <button className="btn ghost sm" disabled={v === p.retestNote} onClick={async () => { await repo.put('products', { ...p, retestNote: v }); await refresh() }}>Salvar nota</button></div>
}
