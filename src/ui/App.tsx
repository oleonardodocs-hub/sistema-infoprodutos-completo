import { useState } from 'react'
import { DataProvider } from './data'
import type { Repository } from '../storage/repository'
import { Dashboard } from './Dashboard'
import { Mining } from './Mining'
import { Products } from './Products'
import { Backups } from './Backups'
import { Offer } from './Offer'
import { Tracking } from './Tracking'
import { Domains } from './Domains'
import { Creatives } from './Creatives'
import { Analysis } from './Analysis'

const MENU = [
  { id: 'dash', label: 'Dashboard', icon: '▦' },
  { id: 'mining', label: 'Mineração', icon: '⌕' },
  { id: 'products', label: 'Produtos e produção', icon: '▣' },
  { id: 'offer', label: 'Oferta e checkout', icon: '◈' },
  { id: 'tracking', label: 'Rastreamento', icon: '◉' },
  { id: 'domains', label: 'Domínios e páginas', icon: '◎' },
  { id: 'creatives', label: 'Criativos', icon: '✦' },
  { id: 'analysis', label: 'Análise e otimização', icon: '↗' },
  { id: 'backups', label: 'Backups e configurações', icon: '⚙' },
] as const

export function App({ repo }: { repo?: Repository } = {}) {
  const [page, setPage] = useState<string>('dash')
  const [open, setOpen] = useState(false)
  return (
    <DataProvider repo={repo}>
      <div className="shell">
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        <aside className={'side' + (open ? ' open' : '')}>
          <div className="brand"><span className="dot" />Infoprodutos</div>
          <nav>
            {MENU.map((m) => (
              <button key={m.id} className={page === m.id ? 'on' : ''} onClick={() => { setPage(m.id); setOpen(false) }}>
                <span>{m.icon}</span>{m.label}
              </button>
            ))}
          </nav>
        </aside>
        <main>
          {page === 'dash' && <Dashboard go={setPage} />}
          {page === 'mining' && <Mining go={setPage} />}
          {page === 'products' && <Products go={setPage} />}
          {page === 'offer' && <Offer />}
          {page === 'tracking' && <Tracking />}
          {page === 'domains' && <Domains />}
          {page === 'creatives' && <Creatives />}
          {page === 'analysis' && <Analysis />}
          {page === 'backups' && <Backups />}
        </main>
      </div>
    </DataProvider>
  )
}
