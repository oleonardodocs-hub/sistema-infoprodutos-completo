import { STEPS, type Offer, type OfferItem, type PageInfo, type Product, type Tracking } from './types'

export const newId = () => crypto.randomUUID()
const item = (price: number): OfferItem => ({ name: '', description: '', logoUrl: '', coverUrl: '', deliverableUrl: '', hotmartUrl: '', priceEUR: price, checks: {} })
export const defaultOffer = (): Offer => ({ main: item(27), bump1: item(7.9), bump2: item(14.9), checkoutUrl: '', checkoutChecks: {} })
export const defaultTracking = (): Tracking => ({
  fbPageName: '', fbPageUrl: '', igName: '', igUrl: '', pixelName: '', pixelId: '', utmifyData: '', utmDocsUrl: '',
  checkoutState: 'pendente', events: { pageView: false, initiateCheckout: false, purchase: false }, notes: '',
})
export const defaultPage = (): PageInfo => ({
  publicUrl: '', htmlSourceUrl: '', version: 'V1', deliverableSourceUrl: '', bump1SourceUrl: '', bump2SourceUrl: '',
  originalLanguage: '', destCountry: '', checks: {},
})
export const emptySteps = () => Object.fromEntries(STEPS.map((s) => [s.key, false])) as Product['steps']

export function newProduct(o: Partial<Product> & { name: string }): Product {
  return {
    id: newId(), country: '', language: '', operationalStatus: 'Em produção', validation: { validated: false }, campaignName: '',
    steps: emptySteps(), offer: defaultOffer(), tracking: defaultTracking(), page: defaultPage(),
    creativesOriginalUrl: '', creativesProducedUrl: '', creativesReady: false, retestNote: '',
    createdAt: new Date().toISOString(), ...o,
  }
}

/** Completa produtos antigos com campos novos (compatibilidade). */
export function normalizeProduct(p: Product): Product {
  const d = newProduct({ name: p.name })
  const oi = (k: 'main' | 'bump1' | 'bump2') => ({ ...d.offer[k], ...(p.offer?.[k] ?? {}) })
  return {
    ...d, ...p, steps: { ...d.steps, ...p.steps },
    offer: { ...d.offer, ...p.offer, main: oi('main'), bump1: oi('bump1'), bump2: oi('bump2') },
    tracking: { ...d.tracking, ...p.tracking, events: { ...d.tracking.events, ...(p.tracking?.events ?? {}) } },
    page: { ...d.page, ...p.page },
  }
}
