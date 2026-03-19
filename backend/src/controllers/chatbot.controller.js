import prisma from '../config/database.js'

async function verifyInstanceOwnership(request, instanceId) {
  return prisma.instance.findFirst({
    where: { id: Number(instanceId), userId: request.user.id },
  })
}

export class ChatbotController {
  async getByInstance(request, reply) {
    const { instanceId } = request.params

    const instance = await verifyInstanceOwnership(request, instanceId)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    const chatbot = await prisma.chatbot.findUnique({
      where: { instanceId: Number(instanceId) },
    })

    if (!chatbot) {
      return reply.status(404).send({ error: 'Chatbot não configurado para esta instância' })
    }

    return chatbot
  }

  async create(request, reply) {
    const { instanceId, welcomeMsg, menuMsg, closingMsg, businessHoursStart, businessHoursEnd } = request.body

    const instance = await verifyInstanceOwnership(request, instanceId)
    if (!instance) {
      return reply.status(404).send({ error: 'Instância não encontrada' })
    }

    const chatbot = await prisma.chatbot.create({
      data: {
        instanceId,
        welcomeMsg,
        menuMsg,
        closingMsg,
        businessHoursStart,
        businessHoursEnd,
      },
    })

    return reply.status(201).send(chatbot)
  }

  async update(request, reply) {
    const { id } = request.params
    const { welcomeMsg, menuMsg, closingMsg, active, businessHoursStart, businessHoursEnd } = request.body

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: Number(id) },
      include: { instance: true },
    })
    if (!chatbot || chatbot.instance.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Chatbot não encontrado' })
    }

    const updated = await prisma.chatbot.update({
      where: { id: Number(id) },
      data: { welcomeMsg, menuMsg, closingMsg, active, businessHoursStart, businessHoursEnd },
    })

    return updated
  }
}
