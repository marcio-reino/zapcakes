import prisma from '../config/database.js'

const comboInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
  },
}

export class ComboController {
  async list(request, reply) {
    const combos = await prisma.combo.findMany({
      where: { userId: request.user.id },
      include: comboInclude,
      orderBy: { name: 'asc' },
    })

    const result = combos.map((c) => ({
      ...c,
      totalProducts: c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0),
      finalPrice: c.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0) - Number(c.discount),
    }))

    return result
  }

  async create(request, reply) {
    const { name, description, discount, imageUrl, items } = request.body

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
      include: comboInclude,
    })

    return reply.status(201).send(combo)
  }

  async getById(request, reply) {
    const combo = await prisma.combo.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: comboInclude,
    })

    if (!combo) {
      return reply.status(404).send({ error: 'Combo não encontrado' })
    }

    return combo
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, description, discount, imageUrl, active, items } = request.body

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

    const updated = await prisma.$transaction(async (tx) => {
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

      return tx.combo.update({
        where: { id: Number(id) },
        data: { name, description, discount, imageUrl, active },
        include: comboInclude,
      })
    })

    return updated
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
