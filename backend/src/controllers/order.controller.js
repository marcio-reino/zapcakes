import prisma from '../config/database.js'
import evolutionApi from '../config/evolution.js'

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

  async verifyProof(request, reply) {
    const { id } = request.params

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }
    if (!order.paymentProof) {
      return reply.status(400).send({ error: 'Este pedido não possui comprovante anexado' })
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { proofVerified: true, status: 'CONFIRMED' },
      include: { items: { include: { product: true } } },
    })

    // Envia mensagem de confirmação via WhatsApp se tiver remoteJid
    if (order.remoteJid) {
      await OrderController._sendWhatsApp(
        request.user.id,
        order.remoteJid,
        `✅ *Pagamento da reserva verificado!*\n\nPedido #${order.id} confirmado. Em breve iniciaremos a produção! 🎂`
      )
    }

    return updated
  }

  async confirmPayment(request, reply) {
    const { id } = request.params

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { paymentConfirmed: true, status: 'CONFIRMED' },
      include: { items: { include: { product: true } } },
    })

    if (order.remoteJid) {
      await OrderController._sendWhatsApp(
        request.user.id,
        order.remoteJid,
        `✅ *Pagamento integral confirmado!*\n\nPedido #${order.id} confirmado. Em breve iniciaremos a produção! 🎂`
      )
    }

    return updated
  }

  async cancelOrder(request, reply) {
    const { id } = request.params

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }
    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Pedido já está cancelado' })
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { status: 'CANCELLED' },
      include: { items: { include: { product: true } } },
    })

    // Envia notificação de cancelamento via WhatsApp
    if (order.remoteJid) {
      await OrderController._sendWhatsApp(
        request.user.id,
        order.remoteJid,
        `❌ *Pedido #${order.id} Cancelado*\n\nSeu pedido foi cancelado pelo estabelecimento. Para mais informações, entre em contato.`
      )
    }

    return updated
  }

  // Helper para enviar mensagem WhatsApp via Evolution API
  static async _sendWhatsApp(userId, remoteJid, text) {
    try {
      const instance = await prisma.instance.findFirst({
        where: { userId, status: 'CONNECTED' },
      })
      if (!instance) return

      const number = remoteJid.replace('@s.whatsapp.net', '')
      await evolutionApi.post(`/message/sendText/${instance.instanceName}`, {
        number,
        text,
      })
    } catch (err) {
      console.error('Erro ao enviar mensagem WhatsApp:', err.message)
    }
  }
}
