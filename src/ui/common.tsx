import { useEffect, useState, type ReactNode } from 'react'
import { STEPS, type StepKey } from '../domain/types'
import { stepMissing } from '../domain/rules'
import { useData } from './data'

export function CopyOpen({ url }: { url: string }) {
  const [ok, setOk] = useState(false)
  if (!url) return <span className="muted">—</span>
  return (
    <span className="row">
      <a href={url} target="_blank" rel="noreferrer noopener">Abrir</a>
      <button className="link" onClick={async () => { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 1200) }}>{ok ? 'Copiado' : 'Copiar'}</button>
    </span>
  )
}
export const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="field"><span>{label}</span>{children}</label>
export const today = () => new Date().toISOString().slice(0, 10)
export const confirmDelete = (what: string) => window.confirm(`Excluir ${what}? Esta ação não pode ser desfeita.`)

/** Rascunho local: edita sem gravar a cada tecla; grava ao clicar em Salvar. */
export function useDraft<T>(src: T): [T, (f: (d: T) => T) => void, boolean] {
  const key = JSON.stringify(src)
  const [d, setD] = useState<T>(src)
  useEffect(() => { setD(src) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return [d, (f) => setD((x) => f(x)), JSON.stringify(d) !== key]
}

export function TextField({ label, value, onChange, type = 'text', area }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; area?: boolean }) {
  return <Field label={label}>{area
    ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    : <input type={type} value={value} step={type === 'number' ? '0.01' : undefined} onChange={(e) => onChange(e.target.value)} />}</Field>
}
export function UrlField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label}><div className="urlrow"><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" /><CopyOpen url={value} /></div></Field>
}
export function Checks({ items, value, onChange }: { items: [string, string][]; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  return <div className="row checks">{items.map(([k, l]) => (
    <label key={k}><input type="checkbox" checked={!!value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} /> {l}</label>
  ))}</div>
}

export function NoProduct() {
  return <section className="card"><p className="muted">Nenhum produto cadastrado. Aprove um item na Mineração e clique em Iniciar produção, ou carregue os exemplos fictícios em Backups e configurações.</p></section>
}
export function ProductSelect() {
  const { data, selected, setSelectedId } = useData()
  if (!selected) return null
  return (
    <div className="row"><span className="muted">Produto</span>
      <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Produto">
        {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )
}
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="top"><h1>{title}</h1>{children}</header>
}

/** Concluir/Reabrir etapa. Só conclui com pendências zeradas e rascunho salvo. */
export function StepBar({ stepKey, dirty }: { stepKey: StepKey; dirty: boolean }) {
  const { repo, selected: p, refresh } = useData()
  const [missing, setMissing] = useState<string[]>([])
  if (!p) return null
  const label = STEPS.find((s) => s.key === stepKey)!.label
  const done = p.steps[stepKey]
  const set = async (v: boolean) => { await repo.put('products', { ...p, steps: { ...p.steps, [stepKey]: v } }); setMissing([]); await refresh() }
  return (
    <div className="card stepbar">
      <div className="row">
        <span className={'chip ' + (done ? 'aprovado' : '')}>{done ? `Etapa concluída: ${label}` : `Etapa em andamento: ${label}`}</span>
        {done
          ? <button className="btn ghost sm" onClick={() => set(false)}>Reabrir etapa</button>
          : <button className="btn sm" disabled={dirty} onClick={() => { const m = stepMissing(p, stepKey); if (m.length) setMissing(m); else void set(true) }}>Concluir etapa</button>}
        {dirty && !done && <span className="muted">Salve as alterações antes de concluir.</span>}
      </div>
      {missing.length > 0 && <div className="verdict reprovado"><b>Pendências:</b><ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
    </div>
  )
}
export function SaveBar({ dirty, onSave, msg }: { dirty: boolean; onSave: () => void; msg?: string }) {
  return <div className="row"><button className="btn" disabled={!dirty} onClick={onSave}>Salvar</button>{dirty && <span className="muted">Alterações não salvas</span>}{msg && <span className="muted">{msg}</span>}</div>
}
