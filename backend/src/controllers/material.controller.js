import prisma from '../config/database.js'

export class MaterialController {
  async list(request, reply) {
    const materials = await prisma.material.findMany({
      where: { userId: request.user.id },
      orderBy: { name: 'asc' },
    })
    return materials
  }

  async create(request, reply) {
    const { name, unit, brand, category, basePrice, refCode } = request.body

    const material = await prisma.material.create({
      data: {
        userId: request.user.id,
        name,
        unit,
        brand,
        category,
        refCode: refCode || null,
        basePrice: basePrice || 0,
      },
    })
    return reply.status(201).send(material)
  }

  async update(request, reply) {
    const { id } = request.params
    const { name, unit, brand, category, basePrice, active, refCode } = request.body

    const material = await prisma.material.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!material) {
      return reply.status(404).send({ error: 'Material não encontrado' })
    }

    const updated = await prisma.material.update({
      where: { id: Number(id) },
      data: { name, unit, brand, category, basePrice, active, refCode: refCode !== undefined ? (refCode || null) : undefined },
    })
    return updated
  }

  async updateStock(request, reply) {
    const { id } = request.params
    const { stock } = request.body

    const material = await prisma.material.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!material) {
      return reply.status(404).send({ error: 'Material não encontrado' })
    }

    const updated = await prisma.material.update({
      where: { id: Number(id) },
      data: { stock: stock ?? 0 },
    })
    return updated
  }

  async stockFromShoppingList(request, reply) {
    const { shoppingListId } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(shoppingListId), userId: request.user.id },
      include: {
        items: {
          where: { checked: true },
          include: { material: { select: { unit: true } } },
        },
      },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista de compras não encontrada' })
    }

    function parseUnitQty(unit) {
      if (!unit) return 1
      const match = unit.match(/^([\d.,]+)/)
      return match ? parseFloat(match[1].replace(',', '.')) || 1 : 1
    }

    // Soma a quantidade comprada (checked) × quantidade da unidade ao estoque
    const updates = list.items.map((item) => {
      const baseQty = parseUnitQty(item.material.unit)
      const increment = Number(item.quantity) * baseQty
      return prisma.material.update({
        where: { id: item.materialId },
        data: { stock: { increment } },
      })
    })
    await prisma.$transaction(updates)

    // Fecha a lista e marca estoque inserido
    await prisma.shoppingList.update({
      where: { id: Number(shoppingListId) },
      data: { status: 'CLOSED', closedAt: new Date(), stockInserted: true },
    })

    return { message: `Estoque atualizado com ${list.items.length} itens da lista` }
  }

  async revertStockFromShoppingList(request, reply) {
    const { shoppingListId } = request.body

    const list = await prisma.shoppingList.findFirst({
      where: { id: Number(shoppingListId), userId: request.user.id },
      include: {
        items: {
          where: { checked: true },
          include: { material: { select: { unit: true } } },
        },
      },
    })
    if (!list) {
      return reply.status(404).send({ error: 'Lista de compras não encontrada' })
    }

    function parseUnitQty(unit) {
      if (!unit) return 1
      const match = unit.match(/^([\d.,]+)/)
      return match ? parseFloat(match[1].replace(',', '.')) || 1 : 1
    }

    // Remove a quantidade do estoque
    const stockUpdates = list.items.map((item) => {
      const baseQty = parseUnitQty(item.material.unit)
      const decrement = Number(item.quantity) * baseQty
      return prisma.material.update({
        where: { id: item.materialId },
        data: { stock: { decrement } },
      })
    })
    await prisma.$transaction(stockUpdates)

    // Restaura os preços base originais dos materiais
    const allItems = await prisma.shoppingListItem.findMany({
      where: { shoppingListId: Number(shoppingListId), previousBasePrice: { not: null } },
    })
    for (const item of allItems) {
      await prisma.material.update({
        where: { id: item.materialId },
        data: { basePrice: item.previousBasePrice },
      })
      await prisma.shoppingListItem.update({
        where: { id: item.id },
        data: { previousBasePrice: null },
      })
    }

    // Reabre a lista e desmarca estoque
    await prisma.shoppingList.update({
      where: { id: Number(shoppingListId) },
      data: { status: 'OPEN', closedAt: null, stockInserted: false },
    })

    return { message: `Estoque revertido e lista reaberta` }
  }

  async stockHistory(request, reply) {
    const { id } = request.params

    const material = await prisma.material.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!material) {
      return reply.status(404).send({ error: 'Material não encontrado' })
    }

    const movements = await prisma.stockMovement.findMany({
      where: { materialId: Number(id) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return movements
  }

  async delete(request, reply) {
    const material = await prisma.material.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })
    if (!material) {
      return reply.status(404).send({ error: 'Material não encontrado' })
    }

    await prisma.material.delete({ where: { id: material.id } })
    return { message: 'Material removido com sucesso' }
  }
}
