import prisma from '../config/database.js'

// Segmentos já usados em /loja/:slug/<segmento> pelo frontend
export const RESERVED_EVENT_SLUGS = new Set([
  'carrinho', 'login', 'pedido', 'meus-pedidos', 'minha-conta',
  'alterar-senha', 'termos-de-uso', 'privacidade', 'eventos',
])

export function normalizeEventSlug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Data de hoje no fuso da loja, no formato das colunas @db.Date (meia-noite UTC)
export function todayDate(now = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function liveEventWhere(now = new Date()) {
  const today = todayDate(now)
  return {
    active: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: today } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: today } }] },
    ],
  }
}

export function isEventLive(event, now = new Date()) {
  if (!event || !event.active) return false
  const today = todayDate(now).getTime()
  if (event.startsAt && new Date(event.startsAt).getTime() > today) return false
  if (event.endsAt && new Date(event.endsAt).getTime() < today) return false
  return true
}

// Item do catálogo principal (eventId null) ou de um evento em vigor
export function sellableWhere(now = new Date()) {
  return { OR: [{ eventId: null }, { event: liveEventWhere(now) }] }
}

export function parseDateInput(value) {
  if (value === undefined) return undefined
  if (!value) return null
  const str = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return 'invalid'
  return new Date(`${str}T00:00:00.000Z`)
}

// Valida que o evento pertence à loja. undefined = não alterar, null = catálogo principal.
export async function resolveOwnedEventId(userId, eventId) {
  if (eventId === undefined) return undefined
  if (eventId === null || eventId === '' || eventId === 0) return null
  const id = Number(eventId)
  const event = Number.isInteger(id)
    ? await prisma.catalogEvent.findFirst({ where: { id, userId }, select: { id: true } })
    : null
  if (!event) {
    const err = new Error('Catálogo de data comemorativa não encontrado')
    err.statusCode = 400
    throw err
  }
  return event.id
}
