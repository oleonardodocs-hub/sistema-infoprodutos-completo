// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDemo } from '../domain/demo'
import { createDexieRepository } from '../storage/repository'
import { App } from './App'

afterEach(cleanup)
let n = 0
async function boot(withDemo = true) {
  const repo = createDexieRepository('ui' + n++)
  if (withDemo) await loadDemo(repo)
  render(<App repo={repo} />)
  return { repo, user: userEvent.setup() }
}
const go = (user: ReturnType<typeof userEvent.setup>, label: string) => user.click(within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(label) }))

describe('renderização de todas as telas com dados fictícios', () => {
  it('Dashboard mostra cards, consolidado e alertas', async () => {
    await boot()
    await waitFor(() => expect(screen.getAllByText(/Produto A \(FICTÍCIO\)/).length).toBeGreaterThan(0))
    expect(screen.getByText('Dashboard consolidado')).toBeTruthy()
    expect(screen.getByText(/recomendado pausar/)).toBeTruthy() // R$ 50 sem checkout do Produto B
    expect(screen.getByText(/Nenhum backup feito ainda/)).toBeTruthy()
  })
  it('navega por todas as telas sem erro', async () => {
    const { user } = await boot()
    await waitFor(() => screen.getAllByText(/Produto A/))
    for (const [menu, marker] of [['Mineração', /Novo item/], ['Produtos e produção', /Duplicar/], ['Oferta e checkout', /Order bump 02/], ['Rastreamento', /Token Meta CAPI/],
      ['Domínios e páginas', /Link público da página/], ['Criativos', /Pasta Drive dos criativos originais/], ['Análise e otimização', /Lançamento diário/], ['Backups', /Exportar backup/]] as const) {
      await go(user, menu)
      await waitFor(() => expect(screen.getAllByText(marker).length).toBeGreaterThan(0))
    }
  })
  it('mineração: 9 dias reprova e 10 dias aprova', async () => {
    const { user } = await boot(false)
    await go(user, 'Mineração'); await user.click(screen.getByText('Novo item'))
    await user.click(screen.getByLabelText(/É low ticket/))
    const [ads, days] = screen.getAllByRole('spinbutton').slice(1)
    await user.clear(ads); await user.type(ads, '1'); await user.clear(days); await user.type(days, '9')
    expect(screen.getByText('Reprovado')).toBeTruthy()
    await user.clear(days); await user.type(days, '10')
    expect(screen.getByText('Aprovado')).toBeTruthy()
  })
  it('domínio 5/5 bloqueia o sexto produto na tela', async () => {
    cleanup()
    const repo = createDexieRepository('ui-dom'); const user = userEvent.setup()
    const { newProduct } = await import('../domain/factory')
    const ps = Array.from({ length: 6 }, (_, i) => newProduct({ id: 'p' + i, name: 'Prod ' + i }))
    for (const p of ps) await repo.put('products', p)
    await repo.put('domains', { id: 'd', host: 'cheio.com', productIds: ps.slice(0, 5).map((p) => p.id) })
    render(<App repo={repo} />)
    await go(user, 'Domínios e páginas')
    await waitFor(() => expect(screen.getAllByText('Limite atingido').length).toBeGreaterThan(0))
    await user.selectOptions(screen.getByLabelText('Produto'), 'p5') // 6º produto, ainda fora do domínio
    const opt = screen.getAllByRole('option').find((o) => /cheio.com/.test(o.textContent ?? ''))!
    expect(opt.getAttribute('disabled')).not.toBeNull()
  })
  it('concluir etapa sem checklist mostra pendências; duplicar usa prompt', async () => {
    const { user } = await boot()
    await waitFor(() => screen.getAllByText(/Produto A/))
    await go(user, 'Oferta e checkout')
    await user.click(await screen.findByRole('button', { name: 'Concluir etapa' }))
    expect(await screen.findByText('Pendências:')).toBeTruthy()
    vi.spyOn(window, 'prompt').mockReturnValueOnce('França').mockReturnValueOnce('Francês')
    await go(user, 'Produtos e produção')
    await user.click(screen.getAllByText(/Duplicar para outro/)[0])
    await waitFor(() => expect(screen.getAllByText(/Duplicado de/).length).toBeGreaterThan(0))
    expect(screen.getAllByDisplayValue(/\(França\)/).length).toBe(1)
  })
})
