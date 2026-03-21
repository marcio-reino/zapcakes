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

    // Envia notificação via WhatsApp quando o pedido é confirmado
    if (status === 'CONFIRMED' && order.remoteJid) {
      const deliveryInfo = order.estimatedDeliveryDate
        ? `\n📅 *Previsão de entrega:* ${order.estimatedDeliveryDate}`
        : ''
      await OrderController._sendWhatsApp(
        request.user.id,
        order.remoteJid,
        `✅ *Pedido #${order.id} Confirmado!*\n\nSeu pedido foi confirmado e logo será preparado para entrega! 🎂${deliveryInfo}`
      )
    }

    return updated
  }

  async verifyProof(request, reply) {
    const { id } = request.params
    const { depositAmount, depositDivergence } = request.body || {}

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }
    if (!order.paymentProof) {
      return reply.status(400).send({ error: 'Este pedido não possui comprovante anexado' })
    }

    const updateData = { proofVerified: true, status: 'CONFIRMED' }

    // Se o operador informou valor manual do depósito (divergência de preço)
    if (depositAmount !== undefined && depositAmount !== null) {
      updateData.depositAmount = Number(depositAmount)
      updateData.depositDivergence = !!depositDivergence
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: updateData,
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

  async updateInternalNotes(request, reply) {
    const { id } = request.params
    const { internalNotes } = request.body

    const order = await prisma.order.findFirst({
      where: { id: Number(id), userId: request.user.id },
    })
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' })
    }

    const updated = await prisma.order.update({
      where: { id: Number(id) },
      data: { internalNotes: internalNotes || null },
    })

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

    // Decrementa contador na agenda se o pedido tinha data prevista
    if (order.estimatedDeliveryDate) {
      const parsedDate = OrderController._parseDeliveryDate(order.estimatedDeliveryDate)
      if (parsedDate) {
        const slot = await prisma.agendaSlot.findUnique({
          where: { userId_date: { userId: request.user.id, date: parsedDate } },
        })
        if (slot && slot.currentOrders > 0) {
          await prisma.agendaSlot.update({
            where: { id: slot.id },
            data: { currentOrders: { decrement: 1 } },
          })
        }
      }
    }

    // Envia notificação de cancelamento via WhatsApp com dados de contato (se notify não for false)
    const { notify } = request.body || {}
    if (notify !== false && order.remoteJid) {
      const contactInfo = await OrderController._getContactInfo(request.user.id)
      let msg = `❌ *Pedido #${order.id} Cancelado*\n\nSeu pedido foi cancelado pelo estabelecimento.`
      if (contactInfo) {
        msg += `\n\nPara mais informações, entre em contato:\n${contactInfo}`
      } else {
        msg += `\n\nPara mais informações, entre em contato com o estabelecimento.`
      }
      await OrderController._sendWhatsApp(request.user.id, order.remoteJid, msg)
    }

    return updated
  }

  // Parseia string de data de entrega para Date UTC
  static _parseDeliveryDate(dateStr) {
    if (!dateStr) return null
    try {
      const brMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (brMatch) {
        const [, day, month, year] = brMatch
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      }
      const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
      if (isoMatch) {
        const [, year, month, day] = isoMatch
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      }
      return null
    } catch {
      return null
    }
  }

  // Busca informações de contato/suporte nas instruções do agente e dados do usuário
  static async _getContactInfo(userId) {
    try {
      const parts = []

      // Busca telefone e dados do usuário dono do estabelecimento
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user?.phone) {
        const phone = user.phone.replace(/\D/g, '')
        parts.push(`📱 ${user.phone}`)
      }

      // Busca nas instruções do agente por links/contatos de suporte
      const instructions = await prisma.agentInstruction.findMany({
        where: { userId, active: true },
      })

      const allContent = instructions.map(i => `${i.title} ${i.content}`).join('\n')

      // Busca URLs (links de suporte, redes sociais, etc)
      const urlRegex = /https?:\/\/[^\s,)}\]]+/gi
      const urls = allContent.match(urlRegex)
      if (urls) {
        // Pega URLs únicas
        const uniqueUrls = [...new Set(urls)]
        for (const url of uniqueUrls) {
          parts.push(`🔗 ${url}`)
        }
      }

      // Busca números de telefone no conteúdo (formato brasileiro)
      const phoneRegex = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g
      const phones = allContent.match(phoneRegex)
      if (phones) {
        const uniquePhones = [...new Set(phones)]
        for (const phone of uniquePhones) {
          if (!parts.some(p => p.includes(phone.replace(/\D/g, '')))) {
            parts.push(`📱 ${phone.trim()}`)
          }
        }
      }

      return parts.length > 0 ? parts.join('\n') : null
    } catch (err) {
      console.error('Erro ao buscar info de contato:', err.message)
      return null
    }
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
