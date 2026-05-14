import prisma from '../config/database.js'

const MAX_ADDITIONALS_PER_COMBO = 6

const comboInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
  },
  comboAdditionals: {
    where: { additional: { active: true } },
    include: { additional: true },
    orderBy: { sortOrder: 'asc' },
  },
}

function mapAdditionals(combo) {
  if (!combo) return combo
  const additionals = (combo.comboAdditionals || []).map((ca) => ({
    id: ca.additional.id,
    description: ca.additional.description,
    imageUrl: ca.additional.imageUrl,
    price: ca.additional.price,
  }))
  const { comboAdditionals, ...rest } = combo
  return { ...rest, additionals }
}

async function syncComboAdditionals(userId, comboId, additionalIds) {
  if (!Array.isArray(additionalIds)) return
  const unique = [...new Set(additionalIds.map((x) => Number(x)).filter((x) => !isNaN(x)))]
  if (unique.length > MAX_ADDITIONALS_PER_COMBO) {
    const err = new Error(`Máximo de ${MAX_ADDITIONALS_PER_COMBO} adicionais por combo`)
    err.statusCode = 400
    throw err
  }
  if (unique.length > 0) {
    const owned = await prisma.additional.findMany({
      where: { id: { in: unique }, userId, active: true },
      select: { id: true },
    })
    if (owned.length !== unique.length) {
      const err = new Error('Um ou mais adicionais inválidos')
      err.statusCode = 400
      throw err
    }
  }
  await prisma.$transaction([
    prisma.comboAdditional.deleteMany({ where: { comboId } }),
    ...(unique.length > 0
      ? [
          prisma.comboAdditional.createMany({
            data: unique.map((additionalId, idx) => ({ comboId, additionalId, sortOrder: idx })),
          }),
        ]
      : []),
  ])
}

export class ComboController {
  async list(request, reply) {
    const combos = await prisma.combo.findMany({
      where: { userId: request.user.id },
      include: comboInclude,
      orderBy: { name: 'asc' },
    })

    const result = combos.map((c) => {
      const mapped = mapAdditionals(c)
      return {
        ...mapped,
        totalProducts: c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0),
        finalPrice: c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0) - Number(c.discount),
      }
    })

    return result
  }

  async create(request, reply) {
    const { name, description, discount, imageUrl, items, additionalIds } = request.body

    if (!items || items.length < 2) {
      return reply.status(400).send({ error: 'O combo deve ter pelo menos 2 produtos' })
    }

    // Verifica se os produtos pertencem ao usuário
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: request.user.id },
    })
    if (products.length !== productIds.length) {
      return reply.status(400).send({ error: 'Um ou mais produtos não encontrados' })
    }

    const combo = await prisma.combo.create({
      data: {
        userId: request.user.id,
        name,
        description,
        discount: discount || 0,
        imageUrl,
        items: {
          create: items.map((i, index) => ({
            productId: i.productId,
            quantity: i.quantity || 1,
            sortOrder: index,
          })),
        },
      },
    })

    try {
      await syncComboAdditionals(request.user.id, combo.id, additionalIds)
    } catch (err) {
      return reply.status(err.statusCode || 500).send({ error: err.message })
    }

    const full = await prisma.combo.findUnique({
      where: { id: combo.id },
      include: comboInclude,
    })

    return reply.status(201).send(mapAdditionals(full))
  }

  async getById(request, reply) {
    const combo = await prisma.combo.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: comboInclude,
    })

    if (!combo) {
      return reply.status(404).send({ error: 'Combo não encontrado' })
    }

    return mapAdditionals(combo)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, description, discount, imageUrl, active, items, additionalIds } = request.body

    const combo = await prisma.combo.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!combo) {
      return reply.status(404).send({ error: 'Combo não encontrado' })
    }

    // Verifica produtos se items foram enviados
    if (items) {
      if (items.length < 2) {
        return reply.status(400).send({ error: 'O combo deve ter pelo menos 2 produtos' })
      }

      const productIds = items.map((i) => i.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, userId: request.user.id },
      })
      if (products.length !== productIds.length) {
        return reply.status(400).send({ error: 'Um ou mais produtos não encontrados' })
      }
    }

    await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.comboItem.deleteMany({ where: { comboId: Number(id) } })
        await tx.comboItem.createMany({
          data: items.map((i, index) => ({
            comboId: Number(id),
            productId: i.productId,
            quantity: i.quantity || 1,
            sortOrder: index,
          })),
        })
      }

      await tx.combo.update({
        where: { id: Number(id) },
        data: { name, description, discount, imageUrl, active },
      })
    })

    try {
      await syncComboAdditionals(request.user.id, Number(id), additionalIds)
    } catch (err) {
      return reply.status(err.statusCode || 500).send({ error: err.message })
    }

    const full = await prisma.combo.findUnique({
      where: { id: Number(id) },
      include: comboInclude,
    })
    return mapAdditionals(full)
  }

  async delete(request, reply) {
    const combo = await prisma.combo.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!combo) {
      return reply.status(404).send({ error: 'Combo não encontrado' })
    }

    await prisma.combo.delete({ where: { id: combo.id } })
    return { message: 'Combo removido com sucesso' }
  }
}
