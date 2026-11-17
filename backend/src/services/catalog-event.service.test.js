import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config/database.js', () => ({
  default: { catalogEvent: { findFirst: vi.fn() } },
}))

import prisma from '../config/database.js'
import {
  normalizeEventSlug, todayDate, isEventLive, liveEventWhere, sellableWhere,
  parseDateInput, resolveOwnedEventId, RESERVED_EVENT_SLUGS,
} from './catalog-event.service.js'

const d = (ymd) => new Date(`${ymd}T00:00:00.000Z`)

describe('normalizeEventSlug', () => {
  it('remove acentos, espaços e caracteres especiais', () => {
    expect(normalizeEventSlug('Dia das Mães 2026!')).toBe('dia-das-maes-2026')
    expect(normalizeEventSlug('  Páscoa  ')).toBe('pascoa')
    expect(normalizeEventSlug('')).toBe('')
  })

  it('reserva as rotas fixas da loja', () => {
    expect(RESERVED_EVENT_SLUGS.has('carrinho')).toBe(true)
    expect(RESERVED_EVENT_SLUGS.has('natal')).toBe(false)
  })
})

describe('todayDate', () => {
  it('usa o fuso de São Paulo (23h de Brasília ainda é o mesmo dia)', () => {
    // 2026-12-25 02:00 UTC = 2026-12-24 23:00 em Brasília
    expect(todayDate(new Date('2026-12-25T02:00:00Z')).toISOString()).toBe('2026-12-24T00:00:00.000Z')
  })
})

describe('isEventLive', () => {
  const now = new Date('2026-12-10T15:00:00Z')

  it('respeita ativo e período', () => {
    expect(isEventLive({ active: true, startsAt: null, endsAt: null }, now)).toBe(true)
    expect(isEventLive({ active: false, startsAt: null, endsAt: null }, now)).toBe(false)
    expect(isEventLive({ active: true, startsAt: d('2026-12-11'), endsAt: null }, now)).toBe(false)
    expect(isEventLive({ active: true, startsAt: null, endsAt: d('2026-12-09') }, now)).toBe(false)
  })

  it('inclui o primeiro e o último dia', () => {
    expect(isEventLive({ active: true, startsAt: d('2026-12-10'), endsAt: d('2026-12-10') }, now)).toBe(true)
  })
})

describe('filtros Prisma', () => {
  it('liveEventWhere compara com a data de hoje', () => {
    const where = liveEventWhere(new Date('2026-12-10T15:00:00Z'))
    expect(where.active).toBe(true)
    expect(where.AND[0].OR[1].startsAt.lte.toISOString()).toBe('2026-12-10T00:00:00.000Z')
    expect(where.AND[1].OR[1].endsAt.gte.toISOString()).toBe('2026-12-10T00:00:00.000Z')
  })

  it('sellableWhere aceita catálogo principal ou evento em vigor', () => {
    const where = sellableWhere()
    expect(where.OR[0]).toEqual({ eventId: null })
    expect(where.OR[1].event.active).toBe(true)
  })
})

describe('parseDateInput', () => {
  it('trata vazio, válido e inválido', () => {
    expect(parseDateInput(undefined)).toBeUndefined()
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput('2026-12-01').toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(parseDateInput('01/12/2026')).toBe('invalid')
  })
})

describe('resolveOwnedEventId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('undefined não altera e vazio volta ao catálogo principal', async () => {
    expect(await resolveOwnedEventId(1, undefined)).toBeUndefined()
    expect(await resolveOwnedEventId(1, null)).toBeNull()
    expect(await resolveOwnedEventId(1, '')).toBeNull()
    expect(prisma.catalogEvent.findFirst).not.toHaveBeenCalled()
  })

  it('aceita evento da própria loja', async () => {
    prisma.catalogEvent.findFirst.mockResolvedValue({ id: 7 })
    expect(await resolveOwnedEventId(1, '7')).toBe(7)
    expect(prisma.catalogEvent.findFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 1 }, select: { id: true } })
  })

  it('recusa evento de outra loja', async () => {
    prisma.catalogEvent.findFirst.mockResolvedValue(null)
    await expect(resolveOwnedEventId(1, 99)).rejects.toMatchObject({ statusCode: 400 })
  })
})
