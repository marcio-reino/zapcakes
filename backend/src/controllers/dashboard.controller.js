import prisma from '../config/database.js'

export class DashboardController {
  async chart(request, reply) {
    const userId = request.user.id
    const now = new Date()

    // Gera array dos últimos 12 meses (do mais antigo ao mais recente)
    const months = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      })
    }

    const startDate = months[0].start
    const endDate = months[months.length - 1].end

    // Ganhos: pedidos não cancelados
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { total: true, createdAt: true },
    })

    // Gastos: listas de compras fechadas com estoque inserido (total dos itens checked × preço atual)
    const shoppingLists = await prisma.shoppingList.findMany({
      where: {
        userId,
        stockInserted: true,
        closedAt: { gte: startDate, lte: endDate },
      },
      select: {
        closedAt: true,
        discount: true,
        items: {
          where: { checked: true },
          select: { quantity: true, actualPrice: true, material: { select: { basePrice: true } } },
        },
      },
    })

    // Monta dados por mês
    const data = months.map((m) => {
      // Ganhos do mês
      const monthRevenue = orders
        .filter((o) => {
          const d = new Date(o.createdAt)
          return d.getMonth() === m.month && d.getFullYear() === m.year
        })
        .reduce((sum, o) => sum + Number(o.total), 0)

      // Gastos do mês (compras)
      const monthExpense = shoppingLists
        .filter((l) => {
          const d = new Date(l.closedAt)
          return d.getMonth() === m.month && d.getFullYear() === m.year
        })
        .reduce((sum, l) => {
          const itemsTotal = l.items.reduce((s, item) => {
            const price = item.actualPrice != null ? Number(item.actualPrice) : Number(item.material.basePrice)
            return s + price * Number(item.quantity)
          }, 0)
          return sum + itemsTotal - Number(l.discount || 0)
        }, 0)

      return {
        month: m.label,
        ganhos: Math.round(monthRevenue * 100) / 100,
        gastos: Math.round(monthExpense * 100) / 100,
      }
    })

    return data
  }
}
