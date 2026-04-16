import prisma from '../config/database.js'

export class AdditionalController {
  async list(request, reply) {
    const includeInactive = request.query.includeInactive === 'true'
    const where = { userId: request.user.id }
    if (!includeInactive) where.active = true

    const additionals = await prisma.additional.findMany({
      where,
      orderBy: [{ active: 'desc' }, { description: 'asc' }],
    })
    return additionals
  }

  async create(request, reply) {
    const { description, imageUrl, price } = request.body

    if (!description || !String(description).trim()) {
      return reply.status(400).send({ error: 'Descrição é obrigatória' })
    }
    if (String(description).length > 120) {
      return reply.status(400).send({ error: 'Descrição deve ter no máximo 120 caracteres' })
    }
    const priceNum = Number(price)
    if (isNaN(priceNum) || priceNum < 0) {
      return reply.status(400).send({ error: 'Preço inválido' })
    }

    const additional = await prisma.additional.create({
      data: {
        userId: request.user.id,
        description: String(description).trim(),
        imageUrl: imageUrl || null,
        price: priceNum,
      },
    })
    return reply.status(201).send(additional)
  }

  async update(request, reply) {
    const { id } = request.params
    const { description, imageUrl, price, active } = request.body

    const existing = await prisma.additional.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Adicional não encontrado' })
    }

    const data = {}
    if (description !== undefined) {
      if (!String(description).trim()) return reply.status(400).send({ error: 'Descrição é obrigatória' })
      if (String(description).length > 120) return reply.status(400).send({ error: 'Descrição deve ter no máximo 120 caracteres' })
      data.description = String(description).trim()
    }
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null
    if (price !== undefined) {
      const n = Number(price)
      if (isNaN(n) || n < 0) return reply.status(400).send({ error: 'Preço inválido' })
      data.price = n
    }
    if (active !== undefined) data.active = !!active

    const updated = await prisma.additional.update({
      where: { id: existing.id },
      data,
    })
    return updated
  }

  async delete(request, reply) {
    const existing = await prisma.additional.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Adicional não encontrado' })
    }

    // Soft delete para preservar histórico de pedidos
    await prisma.additional.update({
      where: { id: existing.id },
      data: { active: false },
    })
    return { message: 'Adicional desativado com sucesso' }
  }
}
