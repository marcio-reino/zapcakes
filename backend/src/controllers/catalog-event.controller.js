import prisma from '../config/database.js'
import {
  RESERVED_EVENT_SLUGS, normalizeEventSlug, parseDateInput, isEventLive,
} from '../services/catalog-event.service.js'

function withStatus(event) {
  const { _count, ...rest } = event
  return {
    ...rest,
    live: isEventLive(event),
    productCount: _count?.products ?? 0,
    comboCount: _count?.combos ?? 0,
  }
}

const countInclude = { _count: { select: { products: true, combos: true } } }

async function validatePayload(userId, body, currentId = null) {
  const data = {}

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (!name) return { error: 'Informe o nome do catálogo' }
    data.name = name.slice(0, 120)
  }

  if (body.slug !== undefined || (!currentId && data.name)) {
    const slug = normalizeEventSlug(body.slug || data.name)
    if (!slug) return { error: 'Informe o endereço (link) do catálogo' }
    if (RESERVED_EVENT_SLUGS.has(slug)) return { error: `O endereço "${slug}" é reservado. Escolha outro.` }
    const dup = await prisma.catalogEvent.findFirst({
      where: { userId, slug, ...(currentId ? { id: { not: currentId } } : {}) },
      select: { id: true },
    })
    if (dup) return { error: `Já existe um catálogo com o endereço "${slug}"` }
    data.slug = slug
  }

  if (body.description !== undefined) data.description = body.description ? String(body.description) : null
  if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl || null
  if (body.active !== undefined) data.active = Boolean(body.active)

  const startsAt = parseDateInput(body.startsAt)
  const endsAt = parseDateInput(body.endsAt)
  if (startsAt === 'invalid' || endsAt === 'invalid') return { error: 'Data inválida' }
  if (startsAt !== undefined) data.startsAt = startsAt
  if (endsAt !== undefined) data.endsAt = endsAt

  return { data }
}

export class CatalogEventController {
  async list(request) {
    const events = await prisma.catalogEvent.findMany({
      where: { userId: request.user.id },
      include: countInclude,
      orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
    })
    return events.map(withStatus)
  }

  async create(request, reply) {
    if (!request.body?.name) return reply.status(400).send({ error: 'Informe o nome do catálogo' })
    const { data, error } = await validatePayload(request.user.id, request.body)
    if (error) return reply.status(400).send({ error })

    if (data.startsAt && data.endsAt && data.startsAt > data.endsAt) {
      return reply.status(400).send({ error: 'A data final deve ser depois da data inicial' })
    }

    const event = await prisma.catalogEvent.create({
      data: { ...data, userId: request.user.id },
      include: countInclude,
    })
    return reply.status(201).send(withStatus(event))
  }

  async update(request, reply) {
    const id = Number(request.params.id)
    const current = await prisma.catalogEvent.findFirst({ where: { id, userId: request.user.id } })
    if (!current) return reply.status(404).send({ error: 'Catálogo não encontrado' })

    const { data, error } = await validatePayload(request.user.id, request.body || {}, id)
    if (error) return reply.status(400).send({ error })

    const startsAt = data.startsAt !== undefined ? data.startsAt : current.startsAt
    const endsAt = data.endsAt !== undefined ? data.endsAt : current.endsAt
    if (startsAt && endsAt && startsAt > endsAt) {
      return reply.status(400).send({ error: 'A data final deve ser depois da data inicial' })
    }

    const event = await prisma.catalogEvent.update({
      where: { id },
      data,
      include: countInclude,
    })
    return withStatus(event)
  }

  // Produtos e combos voltam para o catálogo principal (onDelete: SetNull), mas ficam inativos
  // para não aparecerem de surpresa na loja.
  async delete(request, reply) {
    const id = Number(request.params.id)
    const event = await prisma.catalogEvent.findFirst({ where: { id, userId: request.user.id } })
    if (!event) return reply.status(404).send({ error: 'Catálogo não encontrado' })

    await prisma.$transaction([
      prisma.product.updateMany({ where: { eventId: id }, data: { active: false } }),
      prisma.combo.updateMany({ where: { eventId: id }, data: { active: false } }),
      prisma.catalogEvent.delete({ where: { id } }),
    ])
    return { message: 'Catálogo removido. Os produtos e combos dele foram desativados.' }
  }
}
