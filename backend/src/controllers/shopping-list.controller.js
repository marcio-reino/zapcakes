import prisma from '../config/database.js'

const listInclude = {
  items: {
    include: { material: true },
    orderBy: [{ checked: 'asc' }, { id: 'asc' }],
  },
}

export class ShoppingListController {
  async list(request, reply) {
    const lists = await prisma.shoppingList.findMany({
      where: { userId: request.user.id },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return lists
  }

  async getById(request, reply) {
    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: listInclude,
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }
    return list
  }

  async create(request, reply) {
    const { name } = request.body
    const today = new Date().toLocaleDateString('pt-BR')
    const list = await prisma.shoppingList.create({
      data: {
        userId: request.user.id,
        name: name || `Compras ${today}`,
      },
      include: listInclude,
    })
    return reply.status(201).send(list)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, status, discount } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    const data = {}
    if (name !== undefined) data.name = name
    if (discount !== undefined) data.discount = discount
    if (status !== undefined) {
      data.status = status
      if (status === 'CLOSED') {
        data.closedAt = new Date()
        // Salva o preço base anterior e atualiza com o preço atual
        const items = await prisma.shoppingListItem.findMany({
          where: { shoppingListId: Number(id), actualPrice: { not: null } },
          include: { material: { select: { basePrice: true } } },
        })
        for (const item of items) {
          // Salva o basePrice original no item
          await prisma.shoppingListItem.update({
            where: { id: item.id },
            data: { previousBasePrice: item.material.basePrice },
          })
          // Atualiza o material com o preço atual
          await prisma.material.update({
            where: { id: item.materialId },
            data: { basePrice: item.actualPrice },
          })
        }
      }
      if (status === 'OPEN') data.closedAt = null
    }

    const updated = await prisma.shoppingList.update({
      where: { id: Number(id) },
      data,
      include: listInclude,
    })
    return updated
  }

  async delete(request, reply) {
    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    await prisma.shoppingList.delete({ where: { id: list.id } })
    return { message: 'Lista removida com sucesso' }
  }

  async duplicate(request, reply) {
    const original = await prisma.shoppingList.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: { items: true },
    })
    if (!original) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    const today = new Date().toLocaleDateString('pt-BR')
    const list = await prisma.shoppingList.create({
      data: {
        userId: request.user.id,
        name: `${original.name} (cópia ${today})`,
        items: {
          create: original.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
          })),
        },
      },
      include: listInclude,
    })
    return reply.status(201).send(list)
  }

  // --- Itens ---

  async addItem(request, reply) {
    const { id } = request.params
    const { materialId, quantity } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }
    if (list.status === 'CLOSED') {
      return reply.status(400).send({ error: 'Lista já está fechada' })
    }

    const material = await prisma.material.findFirst({
      where: { id: Number(materialId), userId: request.user.id },
    })
    if (!material) {
      return reply.status(404).send({ error: 'Material não encontrado' })
    }

    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: Number(id),
        materialId: Number(materialId),
        quantity: quantity || 1,
      },
      include: { material: true },
    })
    return reply.status(201).send(item)
  }

  async addItems(request, reply) {
    const { id } = request.params
    const { items } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }
    if (list.status === 'CLOSED') {
      return reply.status(400).send({ error: 'Lista já está fechada' })
    }

    // Verificar materiais
    const materialIds = items.map((i) => i.materialId)
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds }, userId: request.user.id },
    })
    if (materials.length !== materialIds.length) {
      return reply.status(400).send({ error: 'Um ou mais materiais não encontrados' })
    }

    // Ignorar duplicados
    const existing = await prisma.shoppingListItem.findMany({
      where: { shoppingListId: Number(id) },
      select: { materialId: true },
    })
    const existingIds = new Set(existing.map((e) => e.materialId))
    const newItems = items.filter((i) => !existingIds.has(i.materialId))

    if (newItems.length > 0) {
      await prisma.shoppingListItem.createMany({
        data: newItems.map((i) => ({
          shoppingListId: Number(id),
          materialId: i.materialId,
          quantity: i.quantity || 1,
        })),
      })
    }

    const updated = await prisma.shoppingList.findFirst({
      where: { id: Number(id) },
      include: listInclude,
    })
    return updated
  }

  async updateItem(request, reply) {
    const { id, itemId } = request.params
    const { quantity, actualPrice, checked } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    const data = {}
    if (quantity !== undefined) data.quantity = quantity
    if (actualPrice !== undefined) data.actualPrice = actualPrice
    if (checked !== undefined) data.checked = checked

    const item = await prisma.shoppingListItem.update({
      where: { id: Number(itemId) },
      data,
      include: { material: true },
    })
    return item
  }

  async removeItem(request, reply) {
    const { id, itemId } = request.params

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    await prisma.shoppingListItem.delete({ where: { id: Number(itemId) } })
    return { message: 'Item removido com sucesso' }
  }
}
