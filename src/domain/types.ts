export type Id = string
export type YesNoPending = 'sim' | 'nao' | 'pendente'

export interface MiningItem {
  id: Id
  foundAt: string // YYYY-MM-DD
  originalUrl: string
  audience: string
  ticketBRL: number
  activeAds: number
  daysRunning: number
  adLibraryUrl: string
  destCountry: string
  isVisual: boolean
  isNiche: boolean
  isLowTicket: boolean
  runsInDestination: YesNoPending
  productId?: Id // preenchido ao iniciar produção (preserva a origem)
  createdAt: string
}

export type MiningStatus = 'Aprovado' | 'Reprovado'
export type AdStrength = 'Aceitável' | 'Bom' | 'Muito bom' | 'Excelente'
export type DestinationRating = 'Bom' | 'Excelente' | 'Pendente'

export const STEPS = [
  { key: 'oferta', label: 'Oferta e checkout' },
  { key: 'rastreamento', label: 'Rastreamento' },
  { key: 'pagina', label: 'Página e domínio' },
  { key: 'criativos', label: 'Criativos' },
  { key: 'analise', label: 'Análise e otimização' },
] as const
export type StepKey = (typeof STEPS)[number]['key']

export type OperationalStatus = 'Em produção' | 'Em validação' | 'Ativo' | 'Inativo'

export interface ValidationRecord {
  validated: boolean // status HISTÓRICO: nunca é apagado ao inativar
  date?: string
  evidence?: string
  manual?: boolean
}

export interface OfferItem {
  name: string
  description: string
  logoUrl: string
  coverUrl: string
  deliverableUrl: string
  hotmartUrl: string
  priceEUR: number // preço comercial (a análise financeira é sempre em R$)
  checks: Record<string, boolean>
}
export interface Offer {
  main: OfferItem
  bump1: OfferItem
  bump2: OfferItem
  checkoutUrl: string
  checkoutChecks: Record<string, boolean>
}
export type CheckoutState = 'pendente' | 'em andamento' | 'configurado'
export interface Tracking {
  bmId?: Id
  accountId?: Id
  cardId?: Id
  fbPageName: string
  fbPageUrl: string
  igName: string
  igUrl: string
  pixelName: string
  pixelId: string
  utmifyData: string // dados não secretos da UTMify (o token fica em 'secrets', cifrado)
  utmDocsUrl: string
  checkoutState: CheckoutState
  events: { pageView: boolean; initiateCheckout: boolean; purchase: boolean }
  notes: string
}
export interface PageInfo {
  domainId?: Id
  publicUrl: string
  htmlSourceUrl: string
  version: string
  deliverableSourceUrl: string
  bump1SourceUrl: string
  bump2SourceUrl: string
  originalLanguage: string
  destCountry: string
  checks: Record<string, boolean>
}

export interface Product {
  id: Id
  name: string
  country: string
  language: string
  miningId?: Id
  sourceProductId?: Id // referência ao produto duplicado (sem copiar vendas)
  operationalStatus: OperationalStatus
  validation: ValidationRecord
  campaignName: string
  steps: Record<StepKey, boolean>
  startedAt?: string // primeiro dia de operação
  offer: Offer
  tracking: Tracking
  page: PageInfo
  creativesOriginalUrl: string
  creativesProducedUrl: string
  creativesReady: boolean
  retestNote: string // possibilidade de novo teste em outra conta ou outro país/idioma
  createdAt: string
}

export interface Domain {
  id: Id
  host: string
  productIds: Id[]
}

export type AssetKind = 'bm' | 'account' | 'card'
export interface Asset {
  id: Id
  kind: AssetKind
  name: string // para cartão: apenas apelido
  externalId: string // ID da BM ou da conta (vazio para cartão)
}

export interface AdSet {
  id: Id
  productId: Id
  name: string // 1 conjunto = 1 criativo testado
  creativeUrl: string
  paused: boolean
  pausedAt?: string
  createdAt: string
}

export type CreativeStatus = 'Em teste' | 'Validado' | 'Não validado' | 'Pausado'
export interface Creative {
  id: Id
  productId: Id
  name: string
  url: string
  date: string
  status: CreativeStatus
  notes: string
  adSetId?: Id
}

export type Executed = '' | 'pausou' | 'manteve'
export interface DailyEntry {
  id: Id
  productId: Id
  adSetId: Id // 1 conjunto = 1 criativo
  date: string // YYYY-MM-DD
  spend: number // R$
  checkouts: number
  sales: number
  revenue: number // R$ líquido (taxas Hotmart já descontadas)
  note?: string
  recommendation?: string
  executed?: Executed // decisão executada manualmente
  decisionReason?: string
  executedAt?: string
  source?: 'diario' | 'semanal'
}
