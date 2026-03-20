import prisma from '../config/database.js'

export class OrderController {
  async list(request, reply) {
    const where = { userId: request.user.id }
    const { status } = request.query
    if (status) where.status = status

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return orders
  }

  async create(request, reply) {
    const { customerName, customerPhone, deliveryAddress, notes, items } = request.body

    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: request.user.id },
    })

    if (products.length !== productIds.length) {
      return reply.status(400).send({ error: 'Um ou mais produtos não encontrados' })
    }

    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      }
    })

    const total = orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

    const order = await prisma.order.create({
      data: {
        userId: request.user.id,
        customerName,
        customerPhone,
        deliveryAddress,
        notes,
        total,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    })

    return reply.status(201).send(order)
  }

  async getById(request, reply) {
    const { id } = request.params
    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
      include: {
        items: { include: { product: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }

    return order
  }

  async updateStatus(request, reply) {
    const { id } = request.params
    const { status } = request.body

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { status },
    })

    return updated
  }
}
