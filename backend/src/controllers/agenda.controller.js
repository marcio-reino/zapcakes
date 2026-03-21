import prisma from '../config/database.js'

export class AgendaController {
  async list(request, reply) {
    const { month } = request.query
    const userId = request.user.id

    let dateFilter = {}
    if (month) {
      const [year, m] = month.split('-').map(Number)
      const start = new Date(Date.UTC(year, m - 1, 1))
      const end = new Date(Date.UTC(year, m, 0, 23, 59, 59))
      dateFilter = { date: { gte: start, lte: end } }
    }

    const slots = await prisma.agendaSlot.findMany({
      where: { userId, ...dateFilter },
      include: {
        categorySlots: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    })

    return slots.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      maxOrders: s.maxOrders,
      currentOrders: s.currentOrders,
      active: s.active,
      categories: s.categorySlots.map((cs) => ({
        id: cs.id,
        categoryId: cs.category.id,
        categoryName: cs.category.name,
        maxUnits: cs.maxUnits,
        currentUnits: cs.currentUnits,
      })),
    }))
  }

  async upsert(request, reply) {
    const userId = request.user.id
    const { date, maxOrders, categories } = request.body

    if (!date) {
      return reply.status(400).send({ error: 'date é obrigatório' })
    }

    const dateObj = new Date(date + 'T00:00:00.000Z')

    // Calcula maxOrders como soma das unidades das categorias (se fornecidas)
    const totalMax = categories && categories.length > 0
      ? categories.reduce((sum, c) => sum + Number(c.maxUnits), 0)
      : Number(maxOrders || 0)

    const slot = await prisma.agendaSlot.upsert({
      where: { userId_date: { userId, date: dateObj } },
      update: { maxOrders: totalMax, active: true },
      create: { userId, date: dateObj, maxOrders: totalMax },
    })

    // Atualiza categorias se fornecidas
    if (categories && categories.length > 0) {
      // Remove categorias antigas deste slot
      await prisma.agendaCategorySlot.deleteMany({
        where: { agendaSlotId: slot.id },
      })

      // Cria as novas
      for (const cat of categories) {
        if (Number(cat.maxUnits) > 0) {
          await prisma.agendaCategorySlot.create({
            data: {
              agendaSlotId: slot.id,
              categoryId: Number(cat.categoryId),
              maxUnits: Number(cat.maxUnits),
            },
          })
        }
      }
    }

    // Recarrega com categorias
    const result = await prisma.agendaSlot.findUnique({
      where: { id: slot.id },
      include: {
        categorySlots: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    })

    return {
      id: result.id,
      date: result.date.toISOString().slice(0, 10),
      maxOrders: result.maxOrders,
      currentOrders: result.currentOrders,
      active: result.active,
      categories: result.categorySlots.map((cs) => ({
        id: cs.id,
        categoryId: cs.category.id,
        categoryName: cs.category.name,
        maxUnits: cs.maxUnits,
        currentUnits: cs.currentUnits,
      })),
    }
  }

  async bulkUpsert(request, reply) {
    const userId = request.user.id
    const { slots } = request.body

    if (!slots || !Array.isArray(slots)) {
      return reply.status(400).send({ error: 'slots deve ser um array' })
    }

    const results = []
    for (const { date, maxOrders, categories } of slots) {
      const dateObj = new Date(date + 'T00:00:00.000Z')

      const totalMax = categories && categories.length > 0
        ? categories.reduce((sum, c) => sum + Number(c.maxUnits), 0)
        : Number(maxOrders || 0)

      const slot = await prisma.agendaSlot.upsert({
        where: { userId_date: { userId, date: dateObj } },
        update: { maxOrders: totalMax, active: true },
        create: { userId, date: dateObj, maxOrders: totalMax },
      })

      if (categories && categories.length > 0) {
        await prisma.agendaCategorySlot.deleteMany({
          where: { agendaSlotId: slot.id },
        })
        for (const cat of categories) {
          if (Number(cat.maxUnits) > 0) {
            await prisma.agendaCategorySlot.create({
              data: {
                agendaSlotId: slot.id,
                categoryId: Number(cat.categoryId),
                maxUnits: Number(cat.maxUnits),
              },
            })
          }
        }
      }

      results.push({
        id: slot.id,
        date: slot.date.toISOString().slice(0, 10),
        maxOrders: slot.maxOrders,
        currentOrders: slot.currentOrders,
        active: slot.active,
      })
    }

    return results
  }

  async remove(request, reply) {
    const userId = request.user.id
    const { id } = request.params

    const slot = await prisma.agendaSlot.findFirst({
      where: { id: Number(id), userId },
    })
    if (!slot) {
      return reply.status(404).send({ error: 'Slot não encontrado' })
    }

    await prisma.agendaSlot.delete({ where: { id: Number(id) } })
    return { success: true }
  }

  // Rota pública usada pelo agente IA
  async availability(request, reply) {
    const { userId, days } = request.query

    if (!userId) {
      return reply.status(400).send({ error: 'userId é obrigatório' })
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + (Number(days) || 60))

    const slots = await prisma.agendaSlot.findMany({
      where: {
        userId: Number(userId),
        active: true,
        date: { gte: today, lte: endDate },
      },
      include: {
        categorySlots: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    })

    return slots
      .filter((s) => s.currentOrders < s.maxOrders)
      .map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        remaining: s.maxOrders - s.currentOrders,
        maxOrders: s.maxOrders,
        categories: s.categorySlots.map((cs) => ({
          categoryName: cs.category.name,
          maxUnits: cs.maxUnits,
          currentUnits: cs.currentUnits,
          remaining: cs.maxUnits - cs.currentUnits,
        })),
      }))
  }
}
